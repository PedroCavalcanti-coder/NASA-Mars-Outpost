import type { CSSProperties } from 'react';

const HUES = [24, 36, 12, 190, 160, 48, 280, 210];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

/** Avatar com iniciais e cor estável derivada do id. `online` mostra a bolinha de presença. */
export function Avatar({
  id,
  name,
  size = 40,
  online,
}: {
  id: string;
  name: string;
  size?: number;
  online?: boolean;
}) {
  const hue = HUES[hash(id) % HUES.length];
  return (
    <span
      className="avatar"
      style={
        {
          '--size': `${size}px`,
          background: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${hue} 70% 42%))`,
        } as CSSProperties
      }
      title={name}
      aria-hidden
    >
      {initials(name)}
      {online !== undefined && <span className="avatar__dot" data-online={online} />}
    </span>
  );
}
