import { Moon, Wind } from 'lucide-react';
import { NapPanel } from '../../app/components/hud/panels/NapPanel';
import { OxygenPanel } from '../../app/components/hud/panels/OxygenPanel';
import { registerPanel } from '../../app/components/hud/registry';
import { registerSystem } from '../systems/registry';
import { ColdSystem } from './ColdSystem';
import { NapSystem } from './NapSystem';
import { OxygenSystem } from './OxygenSystem';

export * from './ColdSystem';
export * from './NapSystem';
export * from './OxygenSystem';
export * from './types';

let unregisterSurvival: (() => void) | null = null;

/**
 * Registra todos os subsistemas e painéis do módulo de sobrevivência marciana:
 * 1. Oxigênio do Astronauta (OxygenSystem + OxygenPanel)
 * 2. Frio Extremo e Noite Marciana (ColdSystem)
 * 3. Descanso, Cochilo e Moral (NapSystem + NapPanel)
 */
export function registerSurvivalModule(): () => void {
  if (unregisterSurvival) {
    unregisterSurvival();
  }

  const cleanups: Array<() => void> = [];

  // 1. Registra os subsistemas de simulação no registro global
  const oxygenSys = new OxygenSystem();
  cleanups.push(registerSystem(oxygenSys));

  const coldSys = new ColdSystem();
  cleanups.push(registerSystem(coldSys));

  const napSys = new NapSystem();
  cleanups.push(registerSystem(napSys));

  // 2. Registra os painéis no catálogo da HUD (grupo 'essencial' e grupo 'missao')
  cleanups.push(
    registerPanel({
      id: 'oxygen',
      group: 'essencial',
      title: 'Oxigênio Pessoal',
      icon: Wind,
      component: OxygenPanel,
      defaultOpen: true,
    }),
  );

  cleanups.push(
    registerPanel({
      id: 'nap',
      group: 'missao',
      title: 'Descanso e Moral',
      icon: Moon,
      component: NapPanel,
      defaultOpen: false,
    }),
  );

  unregisterSurvival = () => {
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (err) {
        console.error('[SurvivalModule] Erro ao desregistrar componente:', err);
      }
    }
    cleanups.length = 0;
    unregisterSurvival = null;
  };

  return unregisterSurvival;
}

// Auto-registro ao importar o módulo
registerSurvivalModule();
