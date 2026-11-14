import { AlertTriangle, Home, Wind } from 'lucide-react';
import { useOxygen } from '../../../../game/survival/OxygenSystem';
import './survival.css';

/**
 * Painel compacto de Oxigênio do Astronauta.
 * Alocado no slot essencial da HUD superior (`EssentialBar`) via tomada `registerPanel`.
 * Exibe barra de nível, alerta visual pulsante para < 25%, ícone dinâmico de estar
 * seguro dentro da base ou no terreno marciano, além da reserva central de O₂ da base.
 */
export function OxygenPanel() {
  const tank = useOxygen((s) => s.tank);
  const isInside = useOxygen((s) => s.isInside);
  const isLow = useOxygen((s) => s.isLow);
  const storm = useOxygen((s) => s.storm);
  const baseOxygen = useOxygen((s) => s.baseOxygen);

  const rounded = Math.round(tank);
  const isWarning = !isLow && rounded < 50;

  const colorClass = isLow
    ? 'hud-essential-ox--critical'
    : isWarning
      ? 'hud-essential-ox--warning'
      : 'hud-essential-ox--ok';

  const inStorm = storm > 0.2 && !isInside;

  return (
    <section
      className={`hud-essential-slot hud-essential-ox ${colorClass} ${isLow ? 'oxygen-panel--alert' : ''}`}
      aria-label={`Oxigênio do astronauta: ${rounded}%`}
      title={
        isInside
          ? `Oxigênio Pessoal: ${rounded}% (Dentro da Base · Recarregando) | Suporte Vital da Base: ${Math.round(baseOxygen)} O₂`
          : inStorm
            ? `Oxigênio Pessoal: ${rounded}% (Tempestade de Areia · Consumo Crítico) | Suporte Vital da Base: ${Math.round(baseOxygen)} O₂`
            : `Oxigênio Pessoal: ${rounded}% (No Terreno · Consumindo) | Suporte Vital da Base: ${Math.round(baseOxygen)} O₂`
      }
    >
      <div className="hud-essential-ox__label">
        <span
          className="hud-essential-ox__icon"
          aria-hidden="true"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {isInside ? (
            <Home size={14} color="#4ade80" />
          ) : (
            <Wind size={14} color={inStorm ? '#f87171' : '#facc15'} />
          )}
          <span>O₂</span>
        </span>
        <span className="hud-essential-ox__value">{rounded}%</span>
      </div>

      <div className="hud-essential-ox__bar" aria-hidden="true">
        <div
          className="hud-essential-ox__fill"
          style={{ width: `${Math.max(0, Math.min(100, rounded))}%` }}
        />
      </div>

      {isCritical && (
        <span title="Alerta: Oxigênio Crítico! Retorne imediatamente para a base.">
          <AlertTriangle
            size={14}
            color="#ff4444"
            style={{ animation: 'blink-text 1s infinite ease-in-out' }}
          />
        </span>
      )}
    </section>
  );
}

export default OxygenPanel;
