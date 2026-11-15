/**
 * Controles de toque do jogo: joystick virtual (andar / dirigir).
 * O aviso para jogar na horizontal fica em components/RotateGate (vale para o site todo).
 *
 * O resto do jogo já funciona só com toque: tocar num objeto leva o astronauta até ele e usa,
 * tocar no chão anda, arrastar gira a câmera e o "pinch" dá zoom.
 */

import { type PointerEvent, useEffect, useRef, useState } from 'react';
import type { BaseViewer } from '../../../game/BaseViewer';
import { L } from '../../../lib/i18n';

const RADIUS = 50;

/** O aparelho principal é de toque (celular/tablet)? */
export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });
  useEffect(() => {
    // um toque de verdade liga os controles (computador com tela sensível)
    const onTouch = (e: globalThis.PointerEvent) => {
      if (e.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('pointerdown', onTouch, { passive: true });
    return () => window.removeEventListener('pointerdown', onTouch);
  }, []);
  return touch;
}

export function TouchJoystick({ viewer }: { viewer: BaseViewer | null }) {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  // biome-ignore lint/correctness/useExhaustiveDependencies: solta o joystick ao trocar de viewer
  useEffect(() => {
    return () => viewer?.setVirtualMove(0, 0);
  }, [viewer]);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / RADIUS);
    const nx = (dx / len) * k;
    const ny = (dy / len) * k;
    setKnob({ x: nx * RADIUS, y: ny * RADIUS });
    viewer?.setVirtualMove(nx, -ny);
  };

  const release = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    viewer?.setVirtualMove(0, 0);
  };

  return (
    <div
      ref={base}
      className="touch-joystick"
      role="application"
      aria-label={L('Joystick: arraste para andar ou dirigir', 'Joystick: drag to walk or drive')}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => {
        if (pointer.current === e.pointerId) move(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div
        className="touch-joystick__knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
