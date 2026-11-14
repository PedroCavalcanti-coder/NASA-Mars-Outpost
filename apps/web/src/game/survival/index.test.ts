// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearHudPanels,
  getPanelsByGroup,
  getRegisteredPanels,
} from '../../app/components/hud/registry';
import { _clearGlobalSystems, GameSystemRegistry } from '../systems/registry';
import { registerSurvivalModule } from './index';

describe('Survival Module - Registro e Integração', () => {
  beforeEach(() => {
    _clearGlobalSystems();
    _clearHudPanels();
  });

  it('registra todos os sistemas de sobrevivência no registro de GameSystems', () => {
    const unregister = registerSurvivalModule();
    const registry = new GameSystemRegistry(true);

    expect(registry.getSystem('survival-oxygen')).toBeDefined();
    expect(registry.getSystem('survival-cold')).toBeDefined();
    expect(registry.getSystem('survival-nap')).toBeDefined();

    unregister();

    const emptyRegistry = new GameSystemRegistry(true);
    expect(emptyRegistry.getSystem('survival-oxygen')).toBeUndefined();
    expect(emptyRegistry.getSystem('survival-cold')).toBeUndefined();
    expect(emptyRegistry.getSystem('survival-nap')).toBeUndefined();
  });

  it('registra os painéis de sobrevivência na HUD nos grupos corretos', () => {
    const unregister = registerSurvivalModule();

    const essentialPanels = getPanelsByGroup('essencial');
    expect(essentialPanels.some((p) => p.id === 'oxygen')).toBe(true);

    const missionPanels = getPanelsByGroup('missao');
    expect(missionPanels.some((p) => p.id === 'nap')).toBe(true);

    unregister();

    expect(getRegisteredPanels().length).toBe(0);
  });
});
