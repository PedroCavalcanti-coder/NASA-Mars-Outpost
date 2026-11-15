import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMission } from '../../store/mission';
import type { SystemContext } from '../systems/context';
import { calculateDrain, calculateRefill, OxygenSystem, useOxygen } from './OxygenSystem';
import { OXYGEN_SETTINGS } from './types';

// Mock do toast para evitar dependências de interface no teste unitário
vi.mock('../../ui/toast', () => ({
  toast: vi.fn(),
}));

function createMockContext(overrides?: Partial<SystemContext>): SystemContext {
  const dummyPoint = new THREE.Vector3(12, 0.24, -8);
  return {
    playerPosition: { x: 0, y: 0.24, z: 0 },
    insideBase: false,
    driving: false,
    night: 0,
    storm: 0,
    cameraMode: 'follow',
    teleportPlayerTo: vi.fn(),
    setPlayerSpeedScale: vi.fn(),
    blockExitFromBase: vi.fn(),
    setPlayerBlocked: vi.fn(),
    fadeScreen: vi.fn(),
    getInfirmaryPoint: vi.fn(() => dummyPoint),
    ...overrides,
  };
}

describe('OxygenSystem - Lógica Pura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOxygen.getState().resetTank();
    useMission.getState().start();
  });

  describe('calculateDrain (Descarga)', () => {
    it('calcula a descarga nominal fora da base sem tempestade', () => {
      const dt = 2; // 2 segundos
      const drain = calculateDrain(dt, 0);
      expect(drain).toBe(OXYGEN_SETTINGS.DRAIN_RATE_OUTSIDE * 2);
    });

    it('acelera a descarga sob tempestade de poeira marciana', () => {
      const dt = 1;
      const normalDrain = calculateDrain(dt, 0);
      const stormDrain = calculateDrain(dt, 1.0); // 100% de tempestade

      expect(stormDrain).toBeGreaterThan(normalDrain);
      expect(stormDrain).toBeCloseTo(
        OXYGEN_SETTINGS.DRAIN_RATE_OUTSIDE * OXYGEN_SETTINGS.STORM_DRAIN_MULTIPLIER,
      );
    });
  });

  describe('calculateRefill (Recarga e proporção com a base)', () => {
    it('não recarrega se o tanque já estiver no máximo', () => {
      const res = calculateRefill(1.0, 100, 80);
      expect(res.tankRefill).toBe(0);
      expect(res.baseCost).toBe(0);
    });

    it('não recarrega se a base estiver sem oxigênio', () => {
      const res = calculateRefill(1.0, 50, 0);
      expect(res.tankRefill).toBe(0);
      expect(res.baseCost).toBe(0);
    });

    it('recarrega proporcionalmente debitando da base quando há suprimento suficiente', () => {
      const dt = 1.0;
      const res = calculateRefill(dt, 50, 50);

      expect(res.tankRefill).toBe(OXYGEN_SETTINGS.REFILL_RATE_INSIDE);
      expect(res.baseCost).toBe(
        OXYGEN_SETTINGS.REFILL_RATE_INSIDE * OXYGEN_SETTINGS.BASE_OXYGEN_RATIO,
      );
    });

    it('recarrega apenas o oxigênio restante se a base tiver menos que a taxa do quadro', () => {
      const dt = 1.0;
      const scarceBaseOxygen = 0.2; // apenas 0.2 unidades na base
      const res = calculateRefill(dt, 50, scarceBaseOxygen);

      expect(res.baseCost).toBe(scarceBaseOxygen);
      expect(res.tankRefill).toBeCloseTo(scarceBaseOxygen / OXYGEN_SETTINGS.BASE_OXYGEN_RATIO);
    });
  });

});
