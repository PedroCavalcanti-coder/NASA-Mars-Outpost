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

    expect(registry.getSystem('survival-oxygen')).toBeUndefined();
    expect(registry.getSystem('survival-cold')).toBeUndefined();

    unregister();

    const emptyRegistry = new GameSystemRegistry(true);
    expect(emptyRegistry.getSystem('survival-oxygen')).toBeUndefined();
    expect(emptyRegistry.getSystem('survival-cold')).toBeUndefined();
  });

  it('registra os painéis de sobrevivência na HUD nos grupos corretos', () => {
    const unregister = registerSurvivalModule();

    const essentialPanels = getPanelsByGroup('essencial');
    expect(essentialPanels.some((p) => p.id === 'oxygen')).toBe(true);

    const missionPanels = getPanelsByGroup('missao');
    expect(missionPanels).toHaveLength(0);

    unregister();

    expect(getRegisteredPanels().length).toBe(0);
  });
});
