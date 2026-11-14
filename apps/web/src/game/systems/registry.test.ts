import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemContext } from './context';
import {
  _clearGlobalSystems,
  type GameSystem,
  GameSystemRegistry,
  registerSystem,
} from './registry';

function createMockContext(): SystemContext {
  return {
    playerPosition: { x: 10, y: 0.24, z: 20 },
    insideBase: true,
    driving: false,
    night: 0.5,
    storm: 0.2,
    cameraMode: 'follow',
    teleportPlayerTo: vi.fn(),
    setPlayerSpeedScale: vi.fn(),
    blockExitFromBase: vi.fn(),
    setPlayerSleeping: vi.fn(),
    fadeScreen: vi.fn(),
    getInfirmaryPoint: vi.fn(),
  };
}

describe('GameSystemRegistry', () => {
  beforeEach(() => {
    _clearGlobalSystems();
  });

  it('executa o update na ordem exata de registro dos sistemas', () => {
    const registry = new GameSystemRegistry(false);
    const mockCtx = createMockContext();
    const updateOrder: string[] = [];

    const sysA: GameSystem = {
      id: 'sistema-a',
      update: vi.fn((dt, _ctx) => {
        expect(dt).toBe(0.016);
        updateOrder.push('sistema-a');
      }),
      dispose: vi.fn(),
    };

    const sysB: GameSystem = {
      id: 'sistema-b',
      update: vi.fn((dt, _ctx) => {
        expect(dt).toBe(0.016);
        updateOrder.push('sistema-b');
      }),
      dispose: vi.fn(),
    };

    const sysC: GameSystem = {
      id: 'sistema-c',
      update: vi.fn((dt, _ctx) => {
        expect(dt).toBe(0.016);
        updateOrder.push('sistema-c');
      }),
      dispose: vi.fn(),
    };

    registry.registerSystem(sysA);
    registry.registerSystem(sysB);
    registry.registerSystem(sysC);

    registry.update(0.016, mockCtx);

    expect(updateOrder).toEqual(['sistema-a', 'sistema-b', 'sistema-c']);
    expect(sysA.update).toHaveBeenCalledWith(0.016, mockCtx);
    expect(sysB.update).toHaveBeenCalledWith(0.016, mockCtx);
    expect(sysC.update).toHaveBeenCalledWith(0.016, mockCtx);
  });

  it('garante que o dispose é idempotente e chamado uma única vez', () => {
    const registry = new GameSystemRegistry(false);
    const mockCtx = createMockContext();

    const disposeSpyA = vi.fn();
    const disposeSpyB = vi.fn();

    const sysA: GameSystem = {
      id: 'sys-a',
      update: vi.fn(),
      dispose: disposeSpyA,
    };
    const sysB: GameSystem = {
      id: 'sys-b',
      update: vi.fn(),
      dispose: disposeSpyB,
    };

    registry.registerSystem(sysA);
    registry.registerSystem(sysB);

    // Primeiro dispose: deve chamar dispose dos sistemas cadastrados
    registry.dispose();
    expect(disposeSpyA).toHaveBeenCalledTimes(1);
    expect(disposeSpyB).toHaveBeenCalledTimes(1);

    // Segundo dispose: chamada idempotente não deve chamar novamente
    registry.dispose();
    expect(disposeSpyA).toHaveBeenCalledTimes(1);
    expect(disposeSpyB).toHaveBeenCalledTimes(1);

    // Terceiro dispose
    registry.dispose();
    expect(disposeSpyA).toHaveBeenCalledTimes(1);
    expect(disposeSpyB).toHaveBeenCalledTimes(1);

    // Updates após dispose não devem disparar updates dos sistemas
    registry.update(0.016, mockCtx);
    expect(sysA.update).not.toHaveBeenCalled();
    expect(sysB.update).not.toHaveBeenCalled();
  });

  it('desregistra sistema individualmente chamando seu dispose', () => {
    const registry = new GameSystemRegistry(false);
    const mockCtx = createMockContext();

    const disposeA = vi.fn();
    const sysA: GameSystem = {
      id: 'sys-a',
      update: vi.fn(),
      dispose: disposeA,
    };

    const unregister = registry.registerSystem(sysA);
    expect(registry.getSystem('sys-a')).toBe(sysA);

    unregister();
    expect(disposeA).toHaveBeenCalledTimes(1);
    expect(registry.getSystem('sys-a')).toBeUndefined();

    registry.update(0.016, mockCtx);
    expect(sysA.update).not.toHaveBeenCalled();
  });

  it('propaga sistemas registrados globalmente via registerSystem', () => {
    const registry = new GameSystemRegistry(true);
    const mockCtx = createMockContext();

    const globalSys: GameSystem = {
      id: 'global-sys',
      update: vi.fn(),
      dispose: vi.fn(),
    };

    const unregister = registerSystem(globalSys);
    expect(registry.getSystem('global-sys')).toBe(globalSys);

    registry.update(0.033, mockCtx);
    expect(globalSys.update).toHaveBeenCalledWith(0.033, mockCtx);

    unregister();
    expect(registry.getSystem('global-sys')).toBeUndefined();
    expect(globalSys.dispose).toHaveBeenCalledTimes(1);
  });
});
