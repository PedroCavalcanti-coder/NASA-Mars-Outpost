import type { GameplayMovement, GameplayState, GamePayload } from '@mars/shared';
import { describe, expect, it } from 'vitest';
import { addGameplayPlayer, applyGameplayCommand, createGameplay, EXPEDITION_MS, stepGameplay } from './world';

interface Pose { x: number; z: number; h: number }

/** Movimento falso: posições simples, rover com motorista e teleportes registrados. */
function world() {
  const pos: Record<string, Pose & { driving: boolean }> = { a: { x: 3, z: 3, h: 0, driving: true } };
  const rover: Pose = { x: 3, z: 3, h: 0 };
  const teleports: Array<[string, Pose]> = [];
  const m: GameplayMovement = {
    context: (id) => (pos[id] ? { x: pos[id]!.x, z: pos[id]!.z, inside: false, sheltered: false, driving: pos[id]!.driving, ready: true } : undefined),
    near: (id, target, distance) => {
      const p = pos[id];
      if (!p) return false;
      if (target === 'soil') return true;
      const t = target === 'rover' ? rover : target.startsWith('xrock:') ? s.expedition?.rocks[Number(target.slice(6))] : undefined;
      return Boolean(t && Math.hypot(p.x - t.x, p.z - t.z) <= distance);
    },
    restrict: () => {},
    rescue: () => {},
    occupants: () => ({ driver: 'a', rider: null }),
    roverPose: () => ({ ...rover }),
    teleport: (id, pose) => {
      teleports.push([id, pose]);
      if (id === 'rover') {
        Object.assign(rover, pose);
        for (const p of Object.values(pos)) if (p.driving) Object.assign(p, pose);
      } else if (pos[id]) Object.assign(pos[id]!, pose, { driving: false });
    },
    spot: (x, z) => ({ x, z }),
  };
  let s: GameplayState = createGameplay(7, 'g', [0], [1]);
  addGameplayPlayer(s, 'a', 'A');
  s = applyGameplayCommand(s, 'a', { type: 'ready' }, m, 'jezero', true).state;
  s.board.ids = ['soil_robot'];
  s.elapsedMs = 1000; // 9h: dentro da janela do rover (2h às 16h)
  s.mission.resources.energy.value = 80;
  s.mission.resources.supplies.value = 80;
  s.mission.resources.oxygen.value = 80;
  const run = (payload: GamePayload) => {
    const r = applyGameplayCommand(s, 'a', payload, m, 'jezero', true);
    s = r.state;
    return r.code;
  };
  return { get s() { return s; }, m, pos, rover, teleports, run };
}

describe('expedição com o rover', () => {
  it('parte do quadrado amarelo: rover vai para longe, com 3 pedras espalhadas', () => {
    const w = world();
    expect(w.run({ type: 'expedition', op: 'start' })).toBeUndefined();
    const x = w.s.expedition!;
    expect(x.rocks).toHaveLength(3);
    expect(w.teleports[0]![0]).toBe('rover');
    expect(Math.hypot(w.rover.x, w.rover.z)).toBeGreaterThan(40);
    for (const r of x.rocks) expect(Math.hypot(r.x - x.start.x, r.z - x.start.z)).toBeGreaterThanOrEqual(14);
    expect(w.run({ type: 'expedition', op: 'start' })).toBe('BUSY');
  });

  it('só quem está dirigindo o rover pode partir', () => {
    const w = world();
    w.pos.a!.driving = false;
    expect(w.run({ type: 'expedition', op: 'start' })).toBe('TOO_FAR');
  });

  it('pegar a pedra exige ir a pé até ela e deixa o astronauta lento; levar ao rover a guarda', () => {
    const w = world();
    w.run({ type: 'expedition', op: 'start' });
    const rock = w.s.expedition!.rocks[0]!;
    expect(w.run({ type: 'expedition', op: 'pick', rock: 0 })).toBe('TOO_FAR'); // ainda no rover
    Object.assign(w.pos.a!, { x: rock.x, z: rock.z, driving: false });
    expect(w.run({ type: 'expedition', op: 'pick', rock: 0 })).toBeUndefined();
    expect(w.s.expedition!.rocks[0]!.by).toBe('a');
    expect(w.run({ type: 'expedition', op: 'pick', rock: 1 })).toBe('UNAVAILABLE'); // já carrega uma
    expect(w.run({ type: 'expedition', op: 'load' })).toBe('TOO_FAR'); // longe do rover
    Object.assign(w.pos.a!, { x: w.rover.x + 1, z: w.rover.z });
    expect(w.run({ type: 'expedition', op: 'load' })).toBeUndefined();
    expect(w.s.expedition!.rocks[0]!.loaded).toBe(true);
  });

  it('com as 3 pedras no carro todos voltam e a missão é paga e cumprida', () => {
    const w = world();
    const before = { ...w.s.mission.resources.energy };
    w.run({ type: 'expedition', op: 'start' });
    const home = { ...w.s.expedition!.home };
    for (let i = 0; i < 3; i++) {
      const rock = w.s.expedition!.rocks[i]!;
      Object.assign(w.pos.a!, { x: rock.x, z: rock.z, driving: false });
      expect(w.run({ type: 'expedition', op: 'pick', rock: i })).toBeUndefined();
      Object.assign(w.pos.a!, { x: w.rover.x + 1, z: w.rover.z });
      expect(w.run({ type: 'expedition', op: 'load' })).toBeUndefined();
    }
    expect(w.s.expedition).toBeNull();
    expect(w.s.board.done).toContain('soil_robot');
    expect(w.rover.x).toBeCloseTo(home.x);
    expect(w.s.mission.resources.energy.value).toBeLessThan(before.value);
    expect(w.s.mission.log[0]!.text).toContain('Previsão');
  });

  it('estourou o tempo: voltam sem perder nada e a missão continua disponível', () => {
    const w = world();
    const energy = w.s.mission.resources.energy.value;
    w.run({ type: 'expedition', op: 'start' });
    const home = { ...w.s.expedition!.home };
    for (let t = 0; t <= EXPEDITION_MS + 1000; t += 1000) stepGameplay(w.s, 1000, w.m, 'jezero');
    expect(w.s.expedition).toBeNull();
    expect(w.s.board.done).not.toContain('soil_robot');
    expect(w.s.mission.resources.energy.value).toBeGreaterThanOrEqual(energy - 1);
    expect(w.rover.x).toBeCloseTo(home.x);
  });

  it('sair da missão volta tudo ao normal sem custo e dá para tentar de novo', () => {
    const w = world();
    const energy = w.s.mission.resources.energy.value;
    w.run({ type: 'expedition', op: 'start' });
    expect(w.run({ type: 'expedition', op: 'abort' })).toBeUndefined();
    expect(w.s.expedition).toBeNull();
    expect(w.s.board.done).not.toContain('soil_robot');
    expect(w.s.mission.resources.energy.value).toBe(energy);
  });

  it('no difícil são 6 alvos, 2 deles poços; cavar o poço já conta como coletado', () => {
    const w = world();
    w.s.difficulty = 'hard';
    w.run({ type: 'expedition', op: 'start' });
    const x = () => w.s.expedition!;
    expect(x().rocks).toHaveLength(6);
    expect(x().rocks.filter((r) => r.kind === 'pit')).toHaveLength(2);
    const pitIndex = x().rocks.findIndex((r) => r.kind === 'pit');
    // pedra não se cava e poço não se pega
    Object.assign(w.pos.a!, { x: x().rocks[pitIndex]!.x, z: x().rocks[pitIndex]!.z, driving: false });
    expect(w.run({ type: 'expedition', op: 'pick', rock: pitIndex })).toBe('UNAVAILABLE');
    expect(w.run({ type: 'expedition', op: 'dig', rock: pitIndex })).toBeUndefined();
    expect(x().rocks[pitIndex]!.loaded).toBe(true);
    const rockIndex = x().rocks.findIndex((r) => r.kind === 'rock');
    expect(w.run({ type: 'expedition', op: 'dig', rock: rockIndex })).toBe('UNAVAILABLE');
  });
});
