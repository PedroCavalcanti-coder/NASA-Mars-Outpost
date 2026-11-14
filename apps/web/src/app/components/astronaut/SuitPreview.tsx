import type { SuitConfig } from '@mars/shared';
import { Rotate3D } from 'lucide-react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { applySuitColors } from '../../../game/runtime/astronautPreview';
import { peekExpedition } from '../../../game/runtime/expedition';

interface Props {
  suit: SuitConfig;
  className?: string;
}
export function SuitPreview({ suit, className = '' }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const preview = peekExpedition()?.preview;
  useEffect(() => {
    const container = mount.current;
    if (!container || !preview) return;
    const { renderer, scene, camera } = preview;
    container.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    const bounds = new THREE.Box3().setFromObject(preview.model);
    const height = bounds.max.y - bounds.min.y;
    const targetY = height * 0.5;
    camera.position.set(0.35, targetY + 0.2, height * 2.15);
    controls.target.set(0, targetY, 0);
    controls.enablePan = controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.38;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enableDamping = true;
    // A pose inicial fica de frente; o jogador controla a rotação.
    controls.autoRotate = false;
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      const mobile = w <= 700;
      const distance = height * (mobile ? 4.4 : 2.15);
      camera.position
        .sub(controls.target)
        .normalize()
        .multiplyScalar(distance)
        .add(controls.target);
      // Desloca o enquadramento, preservando o pivô no astronauta.
      camera.setViewOffset(
        w,
        h,
        mobile ? 0 : -Math.max(w * 0.18, 200),
        mobile ? h * 0.24 : 0,
        w,
        h,
      );
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
      camera.clearViewOffset();
    };
  }, [preview]);
  useEffect(() => {
    if (!preview) return;
    applySuitColors(preview.model, suit);
  }, [preview, suit]);
  return (
    <div className={`suit-preview-wrap ${className}`}>
      <div ref={mount} className="suit-preview-canvas" />
      <div className="suit-preview-hint">
        <Rotate3D size={15} /> Arraste para girar o astronauta
      </div>
    </div>
  );
}
