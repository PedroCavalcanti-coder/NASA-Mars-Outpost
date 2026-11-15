import { useId, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { targetSelector } from '../../../game/guide/hudTour';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}
/** A visual cutout, rather than lifting/cloning HUD nodes out of their stacking contexts. */
export function BitSpotlight({
  target,
  onPlacement,
}: {
  target: string;
  onPlacement: (position: 'top' | 'bottom') => void;
}) {
  const mask = useId();
  const [bounds, setBounds] = useState<Bounds | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    let observed: Element | null = null;
    const measure = () => {
      frame = 0;
      const element = document.querySelector(targetSelector(target));
      if (element !== observed) {
        resize.disconnect();
        if (element) resize.observe(element);
        observed = element;
      }
      const rect = element?.getBoundingClientRect();
      if (
        !rect ||
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.bottom <= 0 ||
        rect.top >= innerHeight
      ) {
        setBounds(null);
        return;
      }
      const x = Math.max(2, rect.left - 8);
      const y = Math.max(2, rect.top - 8);
      const next = {
        x,
        y,
        width: Math.max(0, Math.min(innerWidth - 2, rect.right + 8) - x),
        height: Math.max(0, Math.min(innerHeight - 2, rect.bottom + 8) - y),
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      };
      setBounds((previous) =>
        previous &&
        Object.keys(next).every(
          (key) => previous[key as keyof Bounds] === next[key as keyof Bounds],
        )
          ? previous
          : next,
      );
      onPlacement(rect.top + rect.height / 2 > innerHeight / 2 ? 'top' : 'bottom');
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [target, onPlacement]);
  if (!bounds) return null;
  const { x, y, width, height, viewportWidth, viewportHeight } = bounds;
  const round = target === 'personal-oxygen' ? Math.min(width, height) / 2 : 16;
  return createPortal(
    <svg
      className="bit-spotlight"
      viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
      aria-hidden="true"
      data-target={target}
    >
      <defs>
        <mask
          id={mask}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={viewportWidth}
          height={viewportHeight}
        >
          <rect width={viewportWidth} height={viewportHeight} fill="white" />
          <rect x={x} y={y} width={width} height={height} rx={round} fill="black" />
        </mask>
      </defs>
      <rect
        width={viewportWidth}
        height={viewportHeight}
        fill="#030c18"
        fillOpacity=".8"
        mask={`url(#${mask})`}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={round}
        className="bit-spotlight__outline"
      />
    </svg>,
    document.body,
  );
}
