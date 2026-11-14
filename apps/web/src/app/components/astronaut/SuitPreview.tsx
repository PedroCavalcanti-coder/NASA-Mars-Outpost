import { SUIT_PARTS, type SuitConfig, type SuitPart } from '@mars/shared';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { applySuitColors } from '../../../game/runtime/astronautPreview';
import { peekExpedition } from '../../../game/runtime/expedition';

interface Props {
  suit: SuitConfig;
  highlightPart?: SuitPart | null;
  className?: string;
}
export function SuitPreview({ suit, highlightPart, className = '' }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const preview = peekExpedition()?.preview;
  useEffect(() => {
    const container = mount.current;
    if (!container || !preview) return;
    const { renderer, scene, camera } = preview;
    container.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.85, 0);
    controls.enablePan = controls.enableZoom = false;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = Math.PI * 0.58;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let frame = 0;
    const render = () => {
      if (document.hidden) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(render);
    };
    document.addEventListener('visibilitychange', visibility);
    render();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.remove();
    };
  }, [preview]);
  useEffect(() => {
    if (!preview) return;
    applySuitColors(preview.model, suit);
    for (const part of SUIT_PARTS)
      preview.model.getObjectByName(`color_${part}`)?.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!(m instanceof THREE.MeshStandardMaterial)) continue;
          m.emissive.setHex(highlightPart === part ? 0xffb511 : 0);
          m.emissiveIntensity = highlightPart === part ? 0.28 : 0;
        }
      });
  }, [preview, suit, highlightPart]);
  return (
    <div className={`suit-preview-wrap ${className}`}>
      <div ref={mount} className="suit-preview-canvas" />
      <div className="suit-preview-hint">Arraste para girar 360°</div>
    </div>
  );
}
