import { useEffect, useRef, useState } from 'react';
import { Alert, Slider, Space, Spin, Typography } from 'antd';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { XYZLoader } from 'three/examples/jsm/loaders/XYZLoader.js';
import type { OpenedFile } from '../types';
import { pointCloudFromNpy, pointCloudFromNpz, type PointCloudArrays } from './parseNpy';

interface Props {
  file: OpenedFile;
}

const MAX_POINTS = 1_500_000;

function fitCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.8;
  camera.position.set(center.x + distance * 0.7, center.y - distance * 0.9, center.z + distance * 0.55);
  camera.near = Math.max(distance / 1000, 0.001);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function downsample(cloud: PointCloudArrays, maxPoints: number): PointCloudArrays {
  if (cloud.count <= maxPoints) return cloud;
  const step = Math.ceil(cloud.count / maxPoints);
  const n = Math.floor(cloud.count / step);
  const positions = new Float32Array(n * 3);
  const colors = cloud.colors ? new Float32Array(n * 3) : undefined;
  for (let i = 0, j = 0; i < cloud.count && j < n; i += step, j++) {
    positions[j * 3] = cloud.positions[i * 3];
    positions[j * 3 + 1] = cloud.positions[i * 3 + 1];
    positions[j * 3 + 2] = cloud.positions[i * 3 + 2];
    if (colors && cloud.colors) {
      colors[j * 3] = cloud.colors[i * 3];
      colors[j * 3 + 1] = cloud.colors[i * 3 + 1];
      colors[j * 3 + 2] = cloud.colors[i * 3 + 2];
    }
  }
  return {
    positions,
    colors,
    count: n,
    meta: `${cloud.meta}; downsampled ${cloud.count}→${n}`,
  };
}

function geometryFromArrays(cloud: PointCloudArrays): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(cloud.positions, 3));
  if (cloud.colors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(cloud.colors, 3));
  }
  geometry.computeBoundingSphere();
  return geometry;
}

function geometryFromThreePoints(obj: THREE.Object3D): { geometry: THREE.BufferGeometry; hasColor: boolean } {
  let geometry: THREE.BufferGeometry | null = null;
  let hasColor = false;
  obj.traverse((child) => {
    if (geometry) return;
    if (child instanceof THREE.Points && child.geometry) {
      geometry = child.geometry as THREE.BufferGeometry;
      hasColor = Boolean(geometry.getAttribute('color'));
    } else if (child instanceof THREE.Mesh && child.geometry) {
      // PLYLoader may return Mesh; reuse vertex data as points
      geometry = child.geometry as THREE.BufferGeometry;
      hasColor = Boolean(geometry.getAttribute('color'));
    }
  });
  if (!geometry) {
    if (obj instanceof THREE.Points) {
      geometry = obj.geometry as THREE.BufferGeometry;
      hasColor = Boolean(geometry.getAttribute('color'));
    } else {
      throw new Error('解析结果中未找到点云几何');
    }
  }
  return { geometry, hasColor };
}

async function loadPointCloud(file: OpenedFile): Promise<{
  geometry: THREE.BufferGeometry;
  hasColor: boolean;
  info: string;
}> {
  const ext = file.extension;

  if (ext === 'npz') {
    const cloud = downsample(pointCloudFromNpz(file.buffer), MAX_POINTS);
    return {
      geometry: geometryFromArrays(cloud),
      hasColor: Boolean(cloud.colors),
      info: `${cloud.count.toLocaleString()} pts · ${cloud.meta}`,
    };
  }

  if (ext === 'npy') {
    const cloud = downsample(pointCloudFromNpy(file.buffer), MAX_POINTS);
    return {
      geometry: geometryFromArrays(cloud),
      hasColor: Boolean(cloud.colors),
      info: `${cloud.count.toLocaleString()} pts · ${cloud.meta}`,
    };
  }

  if (ext === 'ply') {
    const loader = new PLYLoader();
    const geometry = loader.parse(file.buffer);
    const pos = geometry.getAttribute('position');
    if (!pos || pos.count === 0) throw new Error('PLY 中没有顶点');
    const colorAttr = geometry.getAttribute('color');
    const hasColor = Boolean(colorAttr);
    if (pos.count > MAX_POINTS) {
      const positions = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        positions[i * 3] = pos.getX(i);
        positions[i * 3 + 1] = pos.getY(i);
        positions[i * 3 + 2] = pos.getZ(i);
      }
      let colors: Float32Array | undefined;
      if (colorAttr) {
        colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          colors[i * 3] = colorAttr.getX(i);
          colors[i * 3 + 1] = colorAttr.getY(i);
          colors[i * 3 + 2] = colorAttr.getZ(i);
        }
      }
      const cloud = downsample({ positions, colors, count: pos.count, meta: 'ply' }, MAX_POINTS);
      geometry.dispose();
      return {
        geometry: geometryFromArrays(cloud),
        hasColor: Boolean(cloud.colors),
        info: `${cloud.count.toLocaleString()} pts · ${cloud.meta}`,
      };
    }
    geometry.computeBoundingSphere();
    return {
      geometry,
      hasColor,
      info: `${pos.count.toLocaleString()} pts · ply`,
    };
  }

  if (ext === 'pcd') {
    const loader = new PCDLoader();
    const points = loader.parse(file.buffer);
    const { geometry, hasColor } = geometryFromThreePoints(points);
    const count = geometry.getAttribute('position')?.count ?? 0;
    return { geometry, hasColor, info: `${count.toLocaleString()} pts · pcd` };
  }

  if (ext === 'xyz') {
    const loader = new XYZLoader();
    // @types/three XYZLoader.parse typings lag the runtime API (sync BufferGeometry).
    const geometry = (loader as unknown as { parse: (text: string) => THREE.BufferGeometry }).parse(
      new TextDecoder().decode(file.buffer),
    );
    const count = geometry.getAttribute('position')?.count ?? 0;
    if (!count) throw new Error('XYZ 文件为空');
    const hasColor = Boolean(geometry.getAttribute('color'));
    return { geometry, hasColor, info: `${count.toLocaleString()} pts · xyz` };
  }

  throw new Error(`不支持的点云格式: .${ext}`);
}

export function PointCloudViewer({ file }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState('');
  const [pointSize, setPointSize] = useState(0.008);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.size = pointSize;
    }
  }, [pointSize]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let animationId = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d23);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1e6);
    camera.up.set(0, 0, 1);

    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.AxesHelper(0.2));

    const resize = () => {
      if (!renderer || !mount) return;
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    resize();
    window.addEventListener('resize', resize);

    const tick = () => {
      if (disposed) return;
      controls.update();
      renderer?.render(scene, camera);
      animationId = requestAnimationFrame(tick);
    };
    tick();

    (async () => {
      setLoading(true);
      setError(null);
      setInfo('');
      try {
        const { geometry, hasColor, info: loadedInfo } = await loadPointCloud(file);
        if (disposed) {
          geometry.dispose();
          return;
        }
        const material = new THREE.PointsMaterial({
          size: pointSize,
          sizeAttenuation: true,
          vertexColors: hasColor,
          color: hasColor ? 0xffffff : 0x6ec1ff,
        });
        materialRef.current = material;
        const points = new THREE.Points(geometry, material);
        group.add(points);
        fitCamera(camera, controls, group);
        setInfo(loadedInfo);
        setLoading(false);
      } catch (err) {
        if (!disposed) {
          setLoading(false);
          setError(err instanceof Error ? err.message : '点云加载失败');
        }
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      controls.dispose();
      materialRef.current = null;
      renderer?.dispose();
      if (renderer?.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      group.traverse((obj) => {
        if (obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
    // pointSize applied via separate effect / materialRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, file.buffer, file.extension]);

  return (
    <div className="viewer-pane cad-viewer pointcloud-viewer">
      {loading && (
        <div className="viewer-loading overlay">
          <Spin tip="加载点云…" />
        </div>
      )}
      {error && <Alert type="error" message={error} showIcon style={{ margin: 12 }} />}
      {!error && (
        <div className="pointcloud-toolbar">
          <Space size="middle" wrap>
            <Typography.Text type="secondary">{info || file.name}</Typography.Text>
            <Space size="small">
              <Typography.Text type="secondary">点大小</Typography.Text>
              <Slider
                min={0.001}
                max={0.05}
                step={0.001}
                value={pointSize}
                onChange={setPointSize}
                style={{ width: 140 }}
                tooltip={{ formatter: (v) => String(v) }}
              />
            </Space>
          </Space>
        </div>
      )}
      <div ref={mountRef} className="cad-canvas pointcloud-canvas" />
    </div>
  );
}
