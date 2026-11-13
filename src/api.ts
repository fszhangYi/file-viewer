export type DirEntry = {
  name: string;
  type: 'file' | 'dir';
  size: number;
  mtimeMs: number;
  relPath: string;
};

export type ListResponse = {
  rootDir: string;
  cwd: string;
  parent: string | null;
  entries: DirEntry[];
};

export type ServerState = {
  rootDir: string;
  canPickDir: boolean;
  host: string;
  port: number;
};

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchState(): Promise<ServerState> {
  return readJson(await fetch('/api/state'));
}

export async function fetchList(cwd: string): Promise<ListResponse> {
  const q = new URLSearchParams({ cwd });
  return readJson(await fetch(`/api/list?${q}`));
}

export async function fetchFileBuffer(relPath: string): Promise<{
  buffer: ArrayBuffer;
  name: string;
  size: number;
  lastModified: number;
  mimeType: string;
}> {
  const q = new URLSearchParams({ path: relPath });
  const res = await fetch(`/api/file?${q}`);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const buffer = await res.arrayBuffer();
  const nameHeader = res.headers.get('X-File-Name');
  const name = nameHeader ? decodeURIComponent(nameHeader) : relPath.split('/').pop() || 'file';
  const size = Number(res.headers.get('X-File-Size') || buffer.byteLength);
  const lastModified = Number(res.headers.get('X-File-Mtime') || Date.now());
  const mimeType = res.headers.get('Content-Type') || 'application/octet-stream';
  return { buffer, name, size, lastModified, mimeType };
}
