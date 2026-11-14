import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearDevActions,
  getRegisteredDevActions,
  registerDevAction,
} from '../../../../game/dev/devActions';
import { getPanelMeta } from '../panelMeta';
import { _clearHudPanels, getPanelsByGroup, registerPanel } from '../registry';

describe('HUD Panel Metadata & Shortcuts', () => {
  it('retorna os metadados e atalhos mapeados para cada painel', () => {
    expect(getPanelMeta('recursos').shortcut).toBe('R');
    expect(getPanelMeta('missao').shortcut).toBe('M');
    expect(getPanelMeta('sala').shortcut).toBe('P');
    expect(getPanelMeta('camera').shortcut).toBe('C');
    expect(getPanelMeta('chat').shortcut).toBe('Q');
    expect(getPanelMeta('sistema').shortcut).toBe('O');
    expect(getPanelMeta('dev').shortcut).toBe('D');
  });

  it('ordena os painéis na doca corretamente', () => {
    const ids = ['dev', 'recursos', 'sistema', 'missao'];
    const sorted = [...ids].sort((a, b) => getPanelMeta(a).order - getPanelMeta(b).order);
    expect(sorted).toEqual(['recursos', 'missao', 'sistema', 'dev']);
  });

  it('fornece fallback seguro para painéis dinâmicos não mapeados', () => {
    const meta = getPanelMeta('custom-panel-123');
    expect(meta.order).toBe(50);
    expect(meta.shortcut).toBeUndefined();
  });
});

describe('Dev Actions & Ferramentas de Teste', () => {
  beforeEach(() => {
    _clearDevActions();
  });

  it('permite registrar ações agrupadas e executá-las', async () => {
    let stormExecuted = false;
    let gridExecuted = false;

    const unreg1 = registerDevAction({
      id: 'dev:storm-test',
      label: 'Simular Tempestade',
      group: 'Ambiente & Clima',
      run: () => {
        stormExecuted = true;
      },
    });

    const unreg2 = registerDevAction({
      id: 'dev:grid-test',
      label: 'Alternar Grade',
      group: 'Visualização & Terreno',
      run: () => {
        gridExecuted = true;
      },
    });

    const actions = getRegisteredDevActions();
    expect(actions).toHaveLength(2);

    const stormAction = actions.find((a) => a.id === 'dev:storm-test');
    const gridAction = actions.find((a) => a.id === 'dev:grid-test');

    expect(stormAction?.group).toBe('Ambiente & Clima');
    expect(gridAction?.group).toBe('Visualização & Terreno');

    await stormAction?.run();
    await gridAction?.run();

    expect(stormExecuted).toBe(true);
    expect(gridExecuted).toBe(true);

    unreg1();
    expect(getRegisteredDevActions()).toHaveLength(1);

    unreg2();
    expect(getRegisteredDevActions()).toHaveLength(0);
  });
});

describe('Integração de Grupos HUD', () => {
  beforeEach(() => {
    _clearHudPanels();
  });

  it('separa slots do grupo essencial dos painéis recolhíveis', () => {
    registerPanel({
      id: 'oxygen-slot',
      group: 'essencial',
      title: 'Oxigênio',
      component: () => null,
    });

    registerPanel({
      id: 'clock-slot',
      group: 'essencial',
      title: 'Relógio Marciano',
      component: () => null,
    });

    registerPanel({
      id: 'recursos',
      group: 'recursos',
      title: 'Recursos da Base',
      component: () => null,
    });

    registerPanel({
      id: 'missao',
      group: 'missao',
      title: 'Missão',
      component: () => null,
    });

    const essenciais = getPanelsByGroup('essencial');
    expect(essenciais).toHaveLength(2);
    expect(essenciais.map((p) => p.id)).toContain('oxygen-slot');
    expect(essenciais.map((p) => p.id)).toContain('clock-slot');

    const recursos = getPanelsByGroup('recursos');
    expect(recursos).toHaveLength(1);
    expect(recursos[0]?.id).toBe('recursos');

    const missao = getPanelsByGroup('missao');
    expect(missao).toHaveLength(1);
    expect(missao[0]?.id).toBe('missao');
  });
});
