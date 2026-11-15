import { GAME_SOL_SECONDS, GAME_START_HOUR } from '@mars/shared';
import { useEffect, useRef, useState } from 'react';
import { chime } from '../../../lib/chime';
import { L } from '../../../lib/i18n';
import { useGameplay } from '../../../store/gameplay';
import './radiationBanner.css';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Aviso de radiação ALTA (explosão solar): enquanto durar, ninguém sai da base. Mostra até que horas
 * de Marte (e quanto tempo) falta, e avisa em verde quando já é seguro sair.
 */
export function RadiationBanner({ hour, sol }: { hour: number; sol: number }) {
  const radiation = useGameplay((s) => s.state?.radiation);
  const storm = useGameplay((s) => (s.state?.storm ?? 0) > 0.25);
  const [safeUntil, setSafeUntil] = useState(0);
  const was = useRef(Boolean(radiation));

  useEffect(() => {
    if (!was.current && radiation) chime([990, 740, 990, 740, 990], 0.18, 'square', 0.05);
    if (was.current && !radiation) {
      chime([523, 659, 784, 1047], 0.12);
      setSafeUntil(Date.now() + 9000);
      const id = window.setTimeout(() => setSafeUntil(0), 9100);
      was.current = false;
      return () => window.clearTimeout(id);
    }
    was.current = Boolean(radiation);
  }, [radiation]);

  if (radiation) {
    const endHours = GAME_START_HOUR + (radiation.until * 24) / (GAME_SOL_SECONDS * 1000);
    const nowHours = (sol - 1) * 24 + hour;
    const left = Math.max(0, endHours - nowHours);
    const endClock = ((endHours % 24) + 24) % 24;
    const h = Math.floor(left);
    const m = Math.floor((left - h) * 60);
    return (
      <div className="rad-banner rad-banner--high" role="alert">
        <span className="rad-banner__icon" aria-hidden="true">☢️</span>
        <div>
          <strong>{L('RADIAÇÃO ALTA lá fora!', 'HIGH RADIATION outside!')}</strong>
          <small>
            {L('Fique dentro da base. Seguro às ', 'Stay inside the base. Safe at ')}
            {pad(Math.floor(endClock))}:{pad(Math.floor((endClock % 1) * 60))}
            {' · '}
            {h > 0 ? `${h} h ` : ''}
            {pad(m)} min
          </small>
        </div>
      </div>
    );
  }
  if (storm) {
    return (
      <div className="rad-banner rad-banner--storm" role="status">
        <span className="rad-banner__icon" aria-hidden="true">🌪️</span>
        <div>
          <strong>{L('Poeira no ar', 'Dust in the air')}</strong>
          <small>{L('Fique perto da base: lá fora o oxigênio acaba mais rápido.', 'Stay near the base: oxygen runs out faster outside.')}</small>
        </div>
      </div>
    );
  }
  if (safeUntil) {
    return (
      <div className="rad-banner rad-banner--safe" role="status">
        <span className="rad-banner__icon" aria-hidden="true">✅</span>
        <div>
          <strong>{L('Radiação segura!', 'Radiation is safe!')}</strong>
          <small>{L('Já dá para sair e consertar a base.', 'You can go out and fix the base now.')}</small>
        </div>
      </div>
    );
  }
  return null;
}
