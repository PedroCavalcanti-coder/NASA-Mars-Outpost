// @vitest-environment happy-dom
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMission } from '../../store/mission';
import type { SystemContext } from '../systems/context';
import { NapSystem } from './NapSystem';
import { NAP_SETTINGS } from './types';

vi.mock('../../ui/toast', () => ({
  toast: vi.fn(),
}));

function createMockContext(overrides?: Partial<SystemContext>): SystemContext {
  const dummyPoint = new THREE.Vector3(0, 0.24, 0);
  return {
    playerPosition: { x: 0, y: 0.24, z: 0 },
    insideBase: true,
    driving: false,
    night: 0,
    storm: 0,
    cameraMode: 'follow',
    teleportPlayerTo: vi.fn(),
    setPlayerSpeedScale: vi.fn(),
    blockExitFromBase: vi.fn(),
    setPlayerSleeping: vi.fn(),
    fadeScreen: vi.fn(),
    getInfirmaryPoint: vi.fn(() => dummyPoint),
    ...overrides,
  };
}

describe('NapSystem - Lógica Pura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMission.getState().start();
  });

  it('permite cochilar apenas dentro da base e sem tempestade forte', () => {
    const system = new NapSystem();

    // 1. Fora da base: bloqueado
    const ctxOutside = createMockContext({ insideBase: false, storm: 0 });
    system.update(0.1, ctxOutside);
    expect(system.canNap()).toBe(false);
    expect(system.getReasonBlocked()).toContain('interior da base');

    // 2. Dirigindo rover: bloqueado
    const ctxRover = createMockContext({ insideBase: true, driving: true, storm: 0 });
    system.update(0.1, ctxRover);
    expect(system.canNap()).toBe(false);

    // 3. Sob tempestade forte: bloqueado
    const ctxStorm = createMockContext({ insideBase: true, driving: false, storm: 0.7 });
    system.update(0.1, ctxStorm);
    expect(system.canNap()).toBe(false);
    expect(system.getReasonBlocked()).toContain('tempestade');

    // 4. Seguro dentro da base: liberado
    const ctxSafe = createMockContext({ insideBase: true, driving: false, storm: 0.2 });
    system.update(0.1, ctxSafe);
    expect(system.canNap()).toBe(true);
    expect(system.getReasonBlocked()).toBeNull();

    system.dispose();
  });

  it('ao cochilar: setPlayerSleeping(true), aumenta a moral e consome pouco oxigênio da base', () => {
    const system = new NapSystem();
    const ctx = createMockContext({ insideBase: true, storm: 0 });

    useMission.setState((s) => ({
      state: {
        ...s.state,
        morale: 70,
        resources: {
          ...s.state.resources,
          oxygen: { ...s.state.resources.oxygen, value: 80 },
        },
      },
    }));

    system.update(0.1, ctx);
    const started = system.requestStartNap();
    expect(started).toBe(true);
    expect(system.isSleepingNow()).toBe(true);

    const baseO2Before = useMission.getState().state.resources.oxygen.value;
    const moraleBefore = useMission.getState().state.morale;

    // 2 segundos de sono
    system.update(2.0, ctx);

    expect(ctx.setPlayerSleeping).toHaveBeenCalledWith(true);

    // Moral subiu
    const moraleAfter = useMission.getState().state.morale;
    expect(moraleAfter).toBeGreaterThan(moraleBefore);
    expect(moraleAfter).toBeCloseTo(moraleBefore + NAP_SETTINGS.MORALE_RECOVERY_RATE * 2.0);

    // Oxigênio da base foi consumido suavemente
    const baseO2After = useMission.getState().state.resources.oxygen.value;
    expect(baseO2After).toBeLessThan(baseO2Before);

    system.dispose();
  });

  it('respeita o teto máximo de moral (100) durante o cochilo', () => {
    const system = new NapSystem();
    const ctx = createMockContext({ insideBase: true, storm: 0 });

    useMission.setState((s) => ({
      state: {
        ...s.state,
        morale: 99,
      },
    }));

    system.update(0.1, ctx);
    system.requestStartNap();

    // 5 segundos de sono
    system.update(5.0, ctx);

    expect(useMission.getState().state.morale).toBe(100);

    system.dispose();
  });

  it('acorda imediatamente ao chamar wakeUp ou se for exposto a condições perigosas', () => {
    const system = new NapSystem();
    const ctxSafe = createMockContext({ insideBase: true, storm: 0 });

    system.update(0.1, ctxSafe);
    system.requestStartNap();
    expect(system.isSleepingNow()).toBe(true);

    // Acorda voluntariamente
    system.wakeUp();
    expect(system.isSleepingNow()).toBe(false);
    expect(ctxSafe.setPlayerSleeping).toHaveBeenCalledWith(false);

    // Dorme de novo
    system.requestStartNap();
    expect(system.isSleepingNow()).toBe(true);

    // Repentinamente sai da base (ou é teletransportado)
    const ctxDanger = createMockContext({ insideBase: false, storm: 0 });
    system.update(0.1, ctxDanger);

    expect(system.isSleepingNow()).toBe(false);

    system.dispose();
  });

  it('responde a atalhos de teclado (tecla Z e Escape)', () => {
    const system = new NapSystem();
    const ctx = createMockContext({ insideBase: true, storm: 0 });
    system.update(0.1, ctx);

    // Dispara tecla 'z'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    expect(system.isSleepingNow()).toBe(true);

    // Dispara tecla 'Escape' para acordar
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(system.isSleepingNow()).toBe(false);

    system.dispose();
  });
});
