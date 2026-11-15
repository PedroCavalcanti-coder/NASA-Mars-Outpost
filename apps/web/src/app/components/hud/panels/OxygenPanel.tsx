import { AlertTriangle, Home, Wind } from 'lucide-react';
import { useOxygen } from '../../../../game/survival/OxygenSystem';
import { OxygenOrb } from './OxygenOrb';
import { L } from '../../../../lib/i18n';

/** Live personal oxygen tank, including refill and storm status. */
export function OxygenPanel() {
  const tank = useOxygen((s) => s.tank);
  const isInside = useOxygen((s) => s.isInside);
  const isLow = useOxygen((s) => s.isLow);
  const storm = useOxygen((s) => s.storm);
  const baseOxygen = useOxygen((s) => s.baseOxygen);

  const rounded = Math.round(tank);
  const inStorm = storm > 0.2 && !isInside;

  return (
    <OxygenOrb
      level={tank}
      title={
        isInside
          ? `Oxigênio Pessoal: ${rounded}% (Dentro da Base · Recarregando) | Suporte Vital da Base: ${Math.round(baseOxygen)} O₂`
          : inStorm
            ? `Oxigênio Pessoal: ${rounded}% (Tempestade de Areia · Consumo Crítico) | Suporte Vital da Base: ${Math.round(baseOxygen)} O₂`
            : `Oxigênio Pessoal: ${rounded}% (No Terreno · Consumindo) | Suporte Vital da Base: ${Math.round(baseOxygen)} O₂`
      }
      status={
        isLow ? (
          <AlertTriangle size={12} aria-label={L('Oxigênio crítico', 'Oxygen critical')} />
        ) : isInside ? (
          <Home size={12} aria-label={L('Na base, recarregando', 'In the base, refilling')} />
        ) : (
          <Wind
            size={12}
            aria-label={inStorm ? 'Tempestade, consumo elevado' : 'No terreno, consumindo'}
          />
        )
      }
    />
  );
}

export default OxygenPanel;
