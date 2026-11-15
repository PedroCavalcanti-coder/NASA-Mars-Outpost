import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMission } from '../../store/mission';
import type { SystemContext } from '../systems/context';
import { adjustBaseMorale, ColdSystem, useCold } from './ColdSystem';
import { COLD_SETTINGS } from './types';

vi.mock('../../ui/toast', () => ({
  toast: vi.fn(),
}));

function createMockContext(overrides?: Partial<SystemContext>): SystemContext {
  const dummyPoint = new THREE.Vector3(5, 0.24, 8);
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
    sleepUntil: vi.fn(() => 0),
    ...overrides,
  };
}

describe('ColdSystem - Lógica Pura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCold.getState().setOverrideNight(null);
    useMission.getState().start();
  });

  describe('adjustBaseMorale', () => {
    it('altera a moral da base respeitando o teto e o piso', () => {
      useMission.setState((s) => ({ state: { ...s.state, morale: 80 } }));

      adjustBaseMorale(-10);
      expect(useMission.getState().state.morale).toBe(70);

      adjustBaseMorale(50);
      expect(useMission.getState().state.morale).toBe(100); // teto 100

      adjustBaseMorale(-150);
      expect(useMission.getState().state.morale).toBe(0); // piso 0
    });
  });

  describe('Ciclo dia e noite', () => {
    it('de dia (night <= 0.6): libera saída da base e mantém velocidade normal', () => {
      const system = new ColdSystem();
      const ctx = createMockContext({ night: 0.2, insideBase: true });

      system.update(1.0, ctx);

      expect(ctx.blockExitFromBase).toHaveBeenCalledWith(false);
      expect(useCold.getState().isNight).toBe(false);
      expect(useCold.getState().isExposed).toBe(false);
      system.dispose();
    });

    it('à noite (night > 0.6) dentro da base: ativa blockExitFromBase(true)', () => {
      const system = new ColdSystem();
      const ctx = createMockContext({ night: 0.8, insideBase: true });

      system.update(1.0, ctx);

      expect(ctx.blockExitFromBase).toHaveBeenCalledWith(true);
      expect(useCold.getState().isNight).toBe(true);
      expect(useCold.getState().isExposed).toBe(false);
      system.dispose();
    });

    it('à noite fora da base: reduz velocidade para ~0.25 e acumula tempo de exposição', () => {
      const system = new ColdSystem();
      const ctx = createMockContext({ night: 0.8, insideBase: false });

      system.update(2.0, ctx);

      expect(ctx.setPlayerSpeedScale).toHaveBeenCalledWith(COLD_SETTINGS.COLD_SPEED_SCALE);
      expect(system.getExposureTimer()).toBe(2.0);
      expect(useCold.getState().isExposed).toBe(true);
      system.dispose();
    });

    it('ao atingir 6s de exposição ao frio à noite: NÃO teleporta, gasta oxigênio da base e fadeScreen', () => {
      const system = new ColdSystem();
      const ctx = createMockContext({ night: 0.8, insideBase: false });

      const initialOxygen = useMission.getState().state.resources.oxygen.value;

      // 4 segundos de frio
      system.update(4.0, ctx);
      expect(ctx.teleportPlayerTo).not.toHaveBeenCalled();

      // Mais 2.5 segundos (total 6.5s > 6.0s limite)
      system.update(2.5, ctx);

      expect(ctx.fadeScreen).toHaveBeenCalledWith(1.0, expect.any(Number));
      expect(ctx.teleportPlayerTo).not.toHaveBeenCalled();

      // Aquecimento de emergência gasta oxigênio da base
      expect(useMission.getState().state.resources.oxygen.value).toBe(
        initialOxygen - COLD_SETTINGS.COLD_OXYGEN_COST,
      );

      // Velocidade restaurada
      expect(ctx.setPlayerSpeedScale).toHaveBeenCalledWith(1.0);
      expect(system.getExposureTimer()).toBe(0);

      system.dispose();
    });

    it('se o astronauta volta para dentro da base a tempo, o timer de frio zera', () => {
      const system = new ColdSystem();
      const ctxOutside = createMockContext({ night: 0.8, insideBase: false });
      const ctxInside = createMockContext({ night: 0.8, insideBase: true });

      system.update(3.0, ctxOutside);
      expect(system.getExposureTimer()).toBe(3.0);

      // Entrou na base antes de congelar
      system.update(1.0, ctxInside);
      expect(system.getExposureTimer()).toBe(0);
      expect(ctxInside.setPlayerSpeedScale).toHaveBeenCalledWith(1.0);

      system.dispose();
    });

    it('permite forçar noite ou dia pelo devAction override', () => {
      const system = new ColdSystem();
      const ctx = createMockContext({ night: 0.1, insideBase: true }); // dia pelo relógio

      useCold.getState().setOverrideNight(true); // forçado noite

      system.update(1.0, ctx);
      expect(ctx.blockExitFromBase).toHaveBeenCalledWith(true);
      expect(useCold.getState().isNight).toBe(true);

      system.dispose();
    });
  });
});
