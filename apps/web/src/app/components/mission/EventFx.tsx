import { useEffect, useMemo } from 'react';
import { useEventFx } from '../../../game/events/fx';

const N: Record<string, number> = {
  blizzard: 70,
  meteor: 9,
  dust_devil: 46,
  radiation: 0,
  ice_clouds: 0,
};

/** número pseudo-aleatório estável (0..1) por partícula */
const r = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Efeitos de tela dos eventos da NASA (só visuais, sem custo de jogo): nevasca de CO₂, chuva de
 * meteoritos (com tremor), radiação solar (aurora e ruído), redemoinho de poeira e nuvens
 * iridescentes. Somem sozinhos depois de alguns segundos.
 */
export function EventFx() {
  const fx = useEventFx((s) => s.fx);
  const key = useEventFx((s) => s.key);
  const count = fx ? (N[fx] ?? 0) : 0;
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: r(i, 1) * 100,
        delay: -r(i, 2) * 6,
        dur: 2.5 + r(i, 3) * 3.5,
        size: 3 + r(i, 4) * 7,
        drift: (r(i, 5) - 0.5) * 120,
        ang: r(i, 6) * 360,
        top: r(i, 7) * 100,
      })),
    [count],
  );

  // meteoritos: a base treme
  useEffect(() => {
    if (fx !== 'meteor') return;
    const el = document.querySelector('.game__canvas');
    el?.classList.add('fx-shake');
    return () => el?.classList.remove('fx-shake');
  }, [fx, key]);

  if (!fx) return null;
  return (
    <div className={`event-fx event-fx--${fx}`} key={key} aria-hidden="true">
      {fx === 'blizzard' &&
        parts.map((p, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: partículas fixas
            key={i}
            className="event-fx__flake"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              ['--drift' as string]: `${p.drift}px`,
            }}
          />
        ))}
      {fx === 'meteor' &&
        parts.map((p, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: partículas fixas
            key={i}
            className="event-fx__meteor"
            style={{
              left: `${20 + p.left * 0.9}%`,
              animationDuration: `${0.9 + p.dur * 0.25}s`,
              animationDelay: `${(i * 0.9) % 6}s`,
            }}
          />
        ))}
      {fx === 'dust_devil' &&
        parts.map((p, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: partículas fixas
            key={i}
            className="event-fx__dust"
            style={{
              top: `${30 + p.top * 0.4}%`,
              width: p.size * 1.6,
              height: p.size * 1.6,
              animationDuration: `${2 + p.dur * 0.5}s`,
              animationDelay: `${p.delay}s`,
              ['--r' as string]: `${60 + p.left * 1.6}px`,
              transform: `rotate(${p.ang}deg)`,
            }}
          />
        ))}
      {fx === 'radiation' && (
        <>
          <div className="event-fx__aurora" />
          <div className="event-fx__noise" />
        </>
      )}
      {fx === 'ice_clouds' && (
        <>
          <div className="event-fx__cloud event-fx__cloud--a" />
          <div className="event-fx__cloud event-fx__cloud--b" />
          <div className="event-fx__cloud event-fx__cloud--c" />
        </>
      )}
    </div>
  );
}
