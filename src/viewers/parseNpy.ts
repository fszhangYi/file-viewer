import { unzipSync } from 'fflate';

export type NpyArray = {
  name: string;
  shape: number[];
  dtype: string;
  data: Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array;
};

export type PointCloudArrays = {
  positions: Float32Array;
  colors?: Float32Array;
  count: number;
  meta: string;
};

const DTYPE_MAP: Record<
  string,
  { ctor: new (buffer: ArrayBuffer, byteOffset: number, length: number) => NpyArray['data']; bytes: number }
> = {
  '<f4': { ctor: Float32Array, bytes: 4 },
  '>f4': { ctor: Float32Array, bytes: 4 },
  '|f4': { ctor: Float32Array, bytes: 4 },
  '<f8': { ctor: Float64Array, bytes: 8 },
  '>f8': { ctor: Float64Array, bytes: 8 },
  '|u1': { ctor: Uint8Array, bytes: 1 },
  '<u1': { ctor: Uint8Array, bytes: 1 },
  '>u1': { ctor: Uint8Array, bytes: 1 },
  '|i1': { ctor: Int8Array, bytes: 1 },
  '<i2': { ctor: Int16Array, bytes: 2 },
  '>i2': { ctor: Int16Array, bytes: 2 },
  '<u2': { ctor: Uint16Array, bytes: 2 },
  '>u2': { ctor: Uint16Array, bytes: 2 },
  '<i4': { ctor: Int32Array, bytes: 4 },
  '>i4': { ctor: Int32Array, bytes: 4 },
  '<u4': { ctor: Uint32Array, bytes: 4 },
  '>u4': { ctor: Uint32Array, bytes: 4 },
};

function parseHeaderDict(header: string): { descr: string; fortran_order: boolean; shape: number[] } {
  const descr = /'descr'\s*:\s*'([^']+)'/.exec(header)?.[1];
  const fortran = /'fortran_order'\s*:\s*(True|False)/.exec(header)?.[1] === 'True';
  const shapeRaw = /'shape'\s*:\s*\(([^)]*)\)/.exec(header)?.[1] ?? '';
  const shape = shapeRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
  if (!descr || !shape.length) {
    throw new Error(`无法解析 NPY header: ${header.slice(0, 120)}`);
  }
  return { descr, fortran_order: fortran, shape };
}

function swapEndianInPlace(bytes: Uint8Array, width: number): void {
  if (width <= 1) return;
  for (let i = 0; i < bytes.length; i += width) {
    for (let j = 0; j < width / 2; j++) {
      const a = i + j;
      const b = i + width - 1 - j;
      const tmp = bytes[a];
      bytes[a] = bytes[b];
      bytes[b] = tmp;
    }
  }
}

/** Parse a single `.npy` buffer into a typed array view. */
export function parseNpy(buffer: ArrayBuffer, name = 'array'): NpyArray {
  const u8 = new Uint8Array(buffer);
  if (
    u8.length < 10 ||
    u8[0] !== 0x93 ||
    u8[1] !== 0x4e ||
    u8[2] !== 0x55 ||
    u8[3] !== 0x4d ||
    u8[4] !== 0x50 ||
    u8[5] !== 0x59
  ) {
    throw new Error('不是有效的 NPY 文件');
  }
  const view = new DataView(buffer);
  const major = view.getUint8(6);
  let headerLen: number;
  let dataOffset: number;
  if (major <= 1) {
    headerLen = view.getUint16(8, true);
    dataOffset = 10 + headerLen;
  } else {
    headerLen = view.getUint32(8, true);
    dataOffset = 12 + headerLen;
  }
  const header = new TextDecoder('latin1').decode(u8.subarray(dataOffset - headerLen, dataOffset));
  const { descr, fortran_order, shape } = parseHeaderDict(header);
  if (fortran_order) {
    throw new Error('暂不支持 fortran_order=True 的 NPY');
  }
  const mapped = DTYPE_MAP[descr];
  if (!mapped) {
    throw new Error(`不支持的 NPY dtype: ${descr}`);
  }
  const count = shape.reduce((a, b) => a * b, 1);
  const byteLength = count * mapped.bytes;
  if (dataOffset + byteLength > buffer.byteLength) {
    throw new Error('NPY 数据长度不足');
  }
  const slice = buffer.slice(dataOffset, dataOffset + byteLength);
  if (descr.startsWith('>')) {
    swapEndianInPlace(new Uint8Array(slice), mapped.bytes);
  }
  const data = new mapped.ctor(slice, 0, count);
  return { name, shape, dtype: descr, data };
}

/** Unzip `.npz` and parse each `.npy` member. */
export function parseNpz(buffer: ArrayBuffer): Record<string, NpyArray> {
  const files = unzipSync(new Uint8Array(buffer));
  const out: Record<string, NpyArray> = {};
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.toLowerCase().endsWith('.npy')) continue;
    const base = path.split('/').pop()!.replace(/\.npy$/i, '');
    out[base] = parseNpy(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), base);
  }
  if (!Object.keys(out).length) {
    throw new Error('NPZ 中未找到 .npy 数组');
  }
  return out;
}

function toFloat32(arr: NpyArray['data']): Float32Array {
  if (arr instanceof Float32Array) return arr;
  return Float32Array.from(arr as ArrayLike<number>);
}

function normalizeColors(colors: Float32Array): Float32Array {
  let max = 0;
  for (let i = 0; i < colors.length; i++) max = Math.max(max, colors[i]);
  if (max > 1.5) {
    for (let i = 0; i < colors.length; i++) colors[i] /= 255;
  }
  return colors;
}

function fromNx3or6(points: NpyArray, colorsArr: NpyArray | null, meta: string): PointCloudArrays {
  if (points.shape.length !== 2) {
    throw new Error(`点云数组维度应为 2，实际 ${points.shape.join('×')}`);
  }
  const [n, cols] = points.shape;
  const raw = toFloat32(points.data);

  if (cols === 3) {
    let colors: Float32Array | undefined;
    if (colorsArr && colorsArr.shape[0] === n && (colorsArr.shape[1] === 3 || colorsArr.shape[1] === 4)) {
      const c = toFloat32(colorsArr.data);
      const stride = colorsArr.shape[1];
      colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        colors[i * 3] = c[i * stride];
        colors[i * 3 + 1] = c[i * stride + 1];
        colors[i * 3 + 2] = c[i * stride + 2];
      }
      normalizeColors(colors);
    }
    return { positions: raw, colors, count: n, meta };
  }

  if (cols === 6) {
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = raw[i * 6];
      positions[i * 3 + 1] = raw[i * 6 + 1];
      positions[i * 3 + 2] = raw[i * 6 + 2];
      colors[i * 3] = raw[i * 6 + 3];
      colors[i * 3 + 1] = raw[i * 6 + 4];
      colors[i * 3 + 2] = raw[i * 6 + 5];
    }
    return { positions, colors: normalizeColors(colors), count: n, meta };
  }

  throw new Error(`点云列数应为 3 或 6，实际为 ${cols}`);
}

function pickArray(arrays: Record<string, NpyArray>, names: string[]): NpyArray | null {
  for (const n of names) {
    if (arrays[n]) return arrays[n];
  }
  return null;
}

/**
 * Prefer `points`/`colors` (lab export). Also accept common aliases
 * or a single (N,3)/(N,6) array.
 */
export function pointCloudFromNpz(buffer: ArrayBuffer): PointCloudArrays {
  const arrays = parseNpz(buffer);
  const points =
    pickArray(arrays, ['points', 'xyz', 'positions', 'position', 'coords', 'cloud']) ??
    Object.values(arrays).find((a) => a.shape.length === 2 && (a.shape[1] === 3 || a.shape[1] === 6)) ??
    null;

  if (!points) {
    throw new Error(`无法从 NPZ 识别点云（keys: ${Object.keys(arrays).join(', ')}）`);
  }

  const colors = pickArray(arrays, ['colors', 'color', 'rgb', 'rgba']);
  return fromNx3or6(points, colors, `keys=${Object.keys(arrays).join(',')}`);
}

export function pointCloudFromNpy(buffer: ArrayBuffer): PointCloudArrays {
  const arr = parseNpy(buffer);
  return fromNx3or6(arr, null, `npy shape=${arr.shape.join('×')}`);
}
