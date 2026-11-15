// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMission } from '../../store/mission';
import type { SystemContext } from '../systems/context';
import { NapSystem } from './NapSystem';

vi.mock('../../ui/toast', () => ({
  toast: vi.fn(),
}));

function createMockContext(overrides?: Partial<SystemContext>): SystemContext {
  const dummyPoint = new THREE.Vector3(0, 0.24, 0);
  return {
    playerPosition: { x: 0, y: 0.24, z: 0 },
    insideBase: true,
    driving: false,
    night: 0.9,
    storm: 0,
    cameraMode: 'follow',
    teleportPlayerTo: vi.fn(),
    setPlayerSpeedScale: vi.fn(),
    blockExitFromBase: vi.fn(),
    setPlayerSleeping: vi.fn(),
    fadeScreen: vi.fn(),
    getInfirmaryPoint: vi.fn(() => dummyPoint),
    sleepUntil: vi.fn(() => 7),
    ...overrides,
  };
}

describe('NapSystem - dormir pula a noite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useMission.getState().start();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('só permite dormir à noite, dentro da base e sem tempestade forte', () => {
    const system = new NapSystem();

    system.update(0.1, createMockContext({ insideBase: false }));
    expect(system.canNap()).toBe(false);
    expect(system.getReasonBlocked()).toContain('interior da base');

    system.update(0.1, createMockContext({ driving: true }));
    expect(system.canNap()).toBe(false);

    system.update(0.1, createMockContext({ night: 0.1 }));
    expect(system.canNap()).toBe(false);
    expect(system.getReasonBlocked()).toContain('noite');

    system.update(0.1, createMockContext({ storm: 0.7 }));
    expect(system.canNap()).toBe(false);
    expect(system.getReasonBlocked()).toContain('tempestade');

    system.update(0.1, createMockContext());
    expect(system.canNap()).toBe(true);
    expect(system.getReasonBlocked()).toBeNull();

    system.dispose();
  });

  it('dormir escurece a tela, avança o relógio até o amanhecer e cobra O₂ e uma refeição', () => {
    const system = new NapSystem();
    const ctx = createMockContext();
    system.update(0.1, ctx);

    const before = useMission.getState().state.resources;
    expect(system.requestStartNap()).toBe(true);
    expect(system.isSleepingNow()).toBe(true);
    expect(ctx.fadeScreen).toHaveBeenCalledWith(1.0, expect.any(Number));

    vi.advanceTimersByTime(5000);

    expect(ctx.sleepUntil).toHaveBeenCalled();
    expect(ctx.fadeScreen).toHaveBeenLastCalledWith(0.0, expect.any(Number));
    expect(system.isSleepingNow()).toBe(false);
    const after = useMission.getState().state.resources;
    expect(after.oxygen.value).toBeLessThan(before.oxygen.value);
    expect(after.supplies.value).toBeLessThan(before.supplies.value);
    // a moral não é mexida pelo sono
    expect(useMission.getState().state.morale).toBe(80);

    system.dispose();
  });

  it('se o relógio não puder ser adiantado, acorda sem cobrar nada', () => {
    const system = new NapSystem();
    const ctx = createMockContext({ sleepUntil: vi.fn(() => 0) });
    system.update(0.1, ctx);
    const before = useMission.getState().state.resources.supplies.value;

    system.requestStartNap();
    vi.advanceTimersByTime(5000);

    expect(system.isSleepingNow()).toBe(false);
    expect(useMission.getState().state.resources.supplies.value).toBe(before);
    system.dispose();
  });

  it('responde ao atalho Z', () => {
    const system = new NapSystem();
    system.update(0.1, createMockContext());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    expect(system.isSleepingNow()).toBe(true);
    system.dispose();
  });
});
