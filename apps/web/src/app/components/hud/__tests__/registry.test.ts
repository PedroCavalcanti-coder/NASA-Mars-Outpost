import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearDevActions,
  getRegisteredDevActions,
  registerDevAction,
} from '../../../../game/dev/devActions';
import { _clearHudPanels, getPanelsByGroup, getRegisteredPanels, registerPanel } from '../registry';

describe('HUD Registry (Tomada combinada de painéis)', () => {
  beforeEach(() => {
    _clearHudPanels();
  });

  it('registra e desregistra painéis no grupo correto', () => {
    const unregister1 = registerPanel({
      id: 'test-recursos',
      group: 'recursos',
      title: 'Recursos de Teste',
      component: () => null,
    });

    const unregister2 = registerPanel({
      id: 'test-essencial',
      group: 'essencial',
      title: 'Oxigênio de Teste',
      component: () => null,
    });

    const panels = getRegisteredPanels();
    expect(panels.length).toBe(2);

    // Filtro por grupo
    const essenciais = getPanelsByGroup('essencial');
    expect(essenciais.some((p) => p.id === 'test-essencial')).toBe(true);
    expect(essenciais.some((p) => p.id === 'test-recursos')).toBe(false);

    const recursos = getPanelsByGroup('recursos');
    expect(recursos.some((p) => p.id === 'test-recursos')).toBe(true);

    // Limpeza
    unregister1();
    unregister2();
    expect(getRegisteredPanels().length).toBe(0);
  });
});

describe('Dev Actions Registry (Tomada combinada do DevPanel)', () => {
  beforeEach(() => {
    _clearDevActions();
  });

  it('registra ações de desenvolvedor e executa a ação', async () => {
    let triggered = false;
    const unregister = registerDevAction({
      id: 'test-storm',
      label: 'Simular Tempestade',
      group: 'Ambiente',
      run: () => {
        triggered = true;
      },
    });

    const actions = getRegisteredDevActions();
    const found = actions.find((a) => a.id === 'test-storm');
    expect(found).toBeDefined();
    expect(found?.label).toBe('Simular Tempestade');

    await found?.run();
    expect(triggered).toBe(true);

    unregister();
    expect(getRegisteredDevActions().find((a) => a.id === 'test-storm')).toBeUndefined();
  });
});
