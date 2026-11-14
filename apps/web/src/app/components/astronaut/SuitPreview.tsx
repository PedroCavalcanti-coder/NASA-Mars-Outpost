import {
  DEFAULT_SUIT,
  SUIT_COLORS,
  SUIT_PARTS,
  type SuitConfig,
  type SuitPart,
} from '@mars/shared';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Props {
  suit: SuitConfig;
  highlightPart?: SuitPart | null;
  className?: string;
}

export function SuitPreview({ suit, highlightPart, className = '' }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = mount.current;
    if (!container) return;

    let alive = true;
    let animId = 0;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.replaceChildren(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 50);
    camera.position.set(2.4, 1.6, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.85, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = Math.PI * 0.58;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    // Iluminação cósmica suave
    const hemi = new THREE.HemisphereLight(0xb4d6ff, 0x442818, 1.8);
    scene.add(hemi);

    const keySun = new THREE.DirectionalLight(0xffdfb9, 3.2);
    keySun.position.set(3, 5, 4);
    keySun.castShadow = true;
    scene.add(keySun);

    const rimLight = new THREE.DirectionalLight(0x78ace1, 2.2);
    rimLight.position.set(-3, 3, -4);
    scene.add(rimLight);

    // Plataforma da maquete
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 0.08, 24),
      new THREE.MeshStandardMaterial({
        color: 0x182c54,
        roughness: 0.8,
        metalness: 0.2,
      }),
    );
    pad.position.y = -0.04;
    pad.receiveShadow = true;
    scene.add(pad);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.98, 1.05, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb511, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    const resize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    // Carregamento do GLB do astronauta
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      '/assets/modelos/astronaut.glb',
      (gltf) => {
        if (!alive) return;
        const model = gltf.scene;
        model.scale.setScalar(0.75);
        model.position.y = 0;

        // Clona materiais para permitir coloração isolada por peça
        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m) => m.clone());
            } else if (mesh.material) {
              mesh.material = mesh.material.clone();
            }
          }
        });

        applySuitColors(model, suit);
        modelRef.current = model;
        scene.add(model);
        setLoading(false);
      },
      undefined,
      () => {
        if (alive) {
          setLoading(false);
          setFailed(true);
        }
      },
    );

    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      alive = false;
      cancelAnimationFrame(animId);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      modelRef.current = null;
    };
  }, []);

  // Atualiza as cores do traje sempre que a prop `suit` mudar
  useEffect(() => {
    if (modelRef.current) {
      applySuitColors(modelRef.current, suit);
    }
  }, [suit]);

  // Efeito de destaque na peça selecionada
  useEffect(() => {
    if (!modelRef.current) return;
    for (const p of SUIT_PARTS) {
      const node = modelRef.current.getObjectByName(`color_${p}`);
      node?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const std = m as THREE.MeshStandardMaterial;
            if (std.emissive) {
              if (highlightPart === p) {
                std.emissive.setHex(0xffb511);
                std.emissiveIntensity = 0.28;
              } else {
                std.emissive.setHex(0x000000);
                std.emissiveIntensity = 0;
              }
            }
          }
        }
      });
    }
  }, [highlightPart]);

  return (
    <div className={`suit-preview-wrap ${className}`}>
      <div ref={mount} className="suit-preview-canvas" />
      {loading && (
        <div className="suit-preview-loading">
          <div className="suit-loading-spinner" />
          <span>Carregando traje 3D…</span>
        </div>
      )}
      {failed && (
        <div className="suit-preview-fallback">
          <svg viewBox="0 0 100 120" className="suit-fallback-svg" aria-label="Visualização do traje">
            <ellipse cx="50" cy="24" rx="18" ry="20" fill={SUIT_COLORS[suit.helmet].hex} stroke="#78ace1" strokeWidth="2" />
            <rect x="34" y="44" width="32" height="34" rx="8" fill={SUIT_COLORS[suit.vest].hex} stroke="#78ace1" strokeWidth="2" />
            <rect x="36" y="78" width="12" height="26" rx="4" fill={SUIT_COLORS[suit.suit].hex} />
            <rect x="52" y="78" width="12" height="26" rx="4" fill={SUIT_COLORS[suit.suit].hex} />
            <rect x="34" y="104" width="14" height="12" rx="3" fill={SUIT_COLORS[suit.boots].hex} />
            <rect x="52" y="104" width="14" height="12" rx="3" fill={SUIT_COLORS[suit.boots].hex} />
            <circle cx="28" cy="68" r="7" fill={SUIT_COLORS[suit.gloves].hex} />
            <circle cx="72" cy="68" r="7" fill={SUIT_COLORS[suit.gloves].hex} />
          </svg>
        </div>
      )}
      <div className="suit-preview-hint">Arraste para girar 360°</div>
    </div>
  );
}

function applySuitColors(root: THREE.Object3D, suit: SuitConfig = DEFAULT_SUIT) {
  for (const part of SUIT_PARTS) {
    const node = root.getObjectByName(`color_${part}`);
    node?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          (m as THREE.MeshStandardMaterial).color.set(SUIT_COLORS[suit[part]].hex);
        }
      }
    });
  }
}
