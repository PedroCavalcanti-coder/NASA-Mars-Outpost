import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BaseViewer } from '../../../game/BaseViewer';
import { useMission } from '../../../store/mission';
import './resourceRewardFx.css';

const RESOURCES = ['supplies', 'energy', 'materials'] as const;

/** Escuta cada recompensa, inclusive quando vários comandos chegam no mesmo quadro. */
export function ResourceRewardFx({ viewer }: { viewer: BaseViewer | null }) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animations = new Set<Animation>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const clear = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const animation of animations) animation.cancel();
      animations.clear();
      layer.current?.replaceChildren();
    };
    const animate = (element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = element.animate(frames, options);
      animations.add(animation);
      animation.onfinish = () => {
        animations.delete(animation);
        if (element.parentNode === layer.current) element.remove();
        animation.cancel();
      };
    };
    const unsubscribe = useMission.subscribe((next, prev) => {
      const feedback = next.feedback;
      if (!feedback) {
        clear();
        return;
      }
      if (feedback === prev.feedback || !feedback.reward || !layer.current) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const source = viewer?.getRewardScreenPosition() ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.55,
      };

      for (const kind of RESOURCES) {
        const amount = feedback.deltas[kind] ?? 0;
        if (amount <= 0) continue;
        const gauge = document.querySelector<HTMLElement>(`[data-resource-gauge="${kind}"]`);
        const icon = gauge?.querySelector('.hud-resource-gauge__icon');
        if (!gauge || !icon) continue;
        const rect = icon.getBoundingClientRect();
        const target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const count = reducedMotion ? 0 : Math.max(5, Math.min(12, Math.ceil(amount)));
        const duration = 1000;
        const stagger = 75;

        for (let i = 0; i < count; i++) {
          const particle = document.createElement('span');
          particle.className = `resource-reward-fx__icon resource-reward-fx--${kind}`;
          const svg = icon.cloneNode(true) as SVGElement;
          svg.removeAttribute('class');
          particle.appendChild(svg);
          layer.current.appendChild(particle);
          const angle = (i / count) * Math.PI * 2;
          const x = source.x + Math.cos(angle) * (16 + (i % 3) * 9);
          const y = source.y + Math.sin(angle) * 26;
          animate(particle, [
            { transform: `translate(${x}px, ${y}px) scale(0.65)`, opacity: 0 },
            { transform: `translate(${x + (target.x - x) * 0.015}px, ${y - 14}px) scale(1)`, opacity: 1, offset: 0.2 },
            { transform: `translate(${target.x}px, ${target.y}px) scale(0.4)`, opacity: 0.8 },
          ], {
            duration,
            delay: i * stagger,
            easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
            fill: 'both',
          });
        }

        // A chegada destaca o anel e mostra somente a quantidade realmente recebida.
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!layer.current || !gauge.isConnected) return;
          const label = document.createElement('span');
          label.className = `resource-reward-fx__amount resource-reward-fx--${kind}`;
          label.textContent = `+${amount}`;
          const bounds = gauge.getBoundingClientRect();
          label.style.left = `${bounds.left + bounds.width / 2}px`;
          label.style.top = `${bounds.bottom + 5}px`;
          layer.current.appendChild(label);
          animate(label, [
            { opacity: 0, transform: 'translate(-50%, 6px)' },
            { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.15 },
            { opacity: 1, offset: 0.75 },
            { opacity: 0, transform: `translate(-50%, ${reducedMotion ? 0 : -12}px)` },
          ], { duration: 1200, fill: 'both' });
          if (!reducedMotion) {
            animate(gauge, [
              { filter: 'drop-shadow(0 0 0 transparent)' },
              { filter: 'drop-shadow(0 0 12px var(--gauge-color))', offset: 0.3 },
              { filter: 'drop-shadow(0 0 0 transparent)' },
            ], { duration: 450 + (count - 1) * stagger });
          }
        }, reducedMotion ? 0 : duration);
        timers.add(timer);
      }
    });
    return () => {
      unsubscribe();
      clear();
    };
  }, [viewer]);

  return createPortal(<div ref={layer} className="resource-reward-fx" aria-hidden="true" />, document.body);
}
