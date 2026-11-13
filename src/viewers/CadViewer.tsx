import { useEffect, useRef, useState } from 'react';
import { Alert, Spin } from 'antd';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';
import type { OpenedFile } from '../types';

interface Props {
  file: OpenedFile;
}

type OcctApi = {
  ReadStepFile: (content: Uint8Array) => {
    success: boolean;
    meshes: Array<{
      attributes: {
        position: { array: number[] };
        normal?: { array: number[] };
        index?: { array: number[] };
      };
      color?: number[];
    }>;
  };
};

type OcctFactory = (config?: {
  locateFile?: (path: string, scriptDirectory?: string) => string;
}) => Promise<OcctApi>;

let occtPromise: Promise<OcctApi> | null = null;

async function resolveOcctFactory(): Promise<OcctFactory> {
  const mod = (await import('occt-import-js')) as Record<string, unknown> & {
    default?: unknown;
  };
  const candidate = mod.default ?? mod.occtimportjs ?? mod;
  if (typeof candidate === 'function') return candidate as OcctFactory;
  if (
    candidate &&
    typeof candidate === 'object' &&
    typeof (candidate as { default?: unknown }).default === 'function'
  ) {
    return (candidate as { default: OcctFactory }).default;
  }
  throw new Error('occt-import-js 未导出可用的工厂函数');
}

function loadOcct(): Promise<OcctApi> {
  if (!occtPromise) {
    occtPromise = resolveOcctFactory().then((factory) =>
      factory({
        locateFile: (p: string) => (p.endsWith('.wasm') ? occtWasmUrl : p),
      }),
    );
  }
  return occtPromise;
}

function fitCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.6;
  camera.position.set(center.x + distance, center.y + distance * 0.6, center.z + distance);
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

export function CadViewer({ file }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let animationId = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1e6);
    camera.up.set(0, 0, 1);

    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(1, 1, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.GridHelper(100, 20, 0xcccccc, 0xe8e8e8));

    const group = new THREE.Group();
    scene.add(group);

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
      try {
        if (file.kind === 'stl') {
          const loader = new STLLoader();
          const geometry = loader.parse(file.buffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x4a90d9,
            metalness: 0.15,
            roughness: 0.55,
          });
          const mesh = new THREE.Mesh(geometry, material);
          group.add(mesh);
        } else {
          try {
            const occt = await loadOcct();
            if (disposed) return;
            const result = occt.ReadStepFile(new Uint8Array(file.buffer));
            if (!result?.success || !result.meshes?.length) {
              throw new Error('STEP 解析失败或模型为空');
            }
            for (const resultMesh of result.meshes) {
              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(resultMesh.attributes.position.array, 3),
              );
              if (resultMesh.attributes.normal) {
                geometry.setAttribute(
                  'normal',
                  new THREE.Float32BufferAttribute(resultMesh.attributes.normal.array, 3),
                );
              } else {
                geometry.computeVertexNormals();
              }
              if (resultMesh.attributes.index) {
                geometry.setIndex(resultMesh.attributes.index.array);
              }
              const color = resultMesh.color
                ? new THREE.Color(resultMesh.color[0], resultMesh.color[1], resultMesh.color[2])
                : new THREE.Color(0x6aa84f);
              const material = new THREE.MeshStandardMaterial({
                color,
                metalness: 0.1,
                roughness: 0.6,
              });
              group.add(new THREE.Mesh(geometry, material));
            }
          } catch (inner) {
            const msg = inner instanceof Error ? inner.message : String(inner);
            throw new Error(`STEP 预览失败: ${msg}`);
          }
        }
        if (!disposed) {
          fitCamera(camera, controls, group);
          setLoading(false);
        }
      } catch (err) {
        if (!disposed) {
          setLoading(false);
          setError(err instanceof Error ? err.message : '3D 加载失败');
        }
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer?.dispose();
      if (renderer?.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, [file.id, file.buffer, file.kind]);

  return (
    <div className="viewer-pane cad-viewer">
      {loading && (
        <div className="viewer-loading overlay">
          <Spin tip="加载 3D 模型…" />
        </div>
      )}
      {error && <Alert type="error" message={error} showIcon style={{ margin: 12 }} />}
      <div ref={mountRef} className="cad-canvas" />
    </div>
  );
}
