import {
  footPointNear,
  MOVEMENT_DT,
  type MovementInput,
  mapDirection,
  NAVIGATION_HASH,
  navigationData,
  neutralInput,
  parseMovementInput,
} from '@mars/shared';
import { describe, expect, it } from 'vitest';
import { RoomMovement } from './movement';

function fixture(base = 'jezero') {
  const room = new RoomMovement(base);
  const state = room.join('a', 0, 'secret', 0);
  room.action('a', 'ready');
  room.restrict('a', { blocked: false, cold: false });
  return { room, state };
}
function run(room: RoomMovement, direction: MovementInput['direction'], frames = 30, scale = 1) {
  for (let seq = 1; seq <= frames; seq++) {
    room.input('a', { ...neutralInput(seq), direction }, (seq * 1000) / 30);
    room.step((seq * 1000) / 30, scale, false);
  }
}
describe('movimento autoritativo', () => {
  it.each(['jezero', 'utopia', 'gale', 'olympus', 'valles', 'hellas', 'elysium', 'arcadia'])(
    '%s usa pontos de chegada, estacionamento e enfermaria navegáveis',
    (base) => {
      const { room } = fixture(base),
        data = navigationData(base);
      expect(NAVIGATION_HASH).toHaveLength(64);
      for (const p of data.spawns) expect(room.grid.isWalkable(p.x, p.z)).toBe(true);
      expect(room.grid.isWalkable(data.park.x, data.park.z, 'vehicle')).toBe(true);
      expect(data.infirmary).not.toBeNull();
      expect(room.grid.isInsideBase(data.infirmary!.x, data.infirmary!.z)).toBe(true);
    },
  );
  it('a câmera parada em quatro ângulos não muda posição nem classificação do servidor', () => {
    const { room, state } = fixture();
    const start = { x: state.x, z: state.z };
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      expect(Math.hypot(...Object.values(mapDirection(angle, 0, 0)))).toBe(0);
      run(room, null);
      expect({ x: state.x, z: state.z }).toEqual(start);
      const p = room.snapshot(1000, 1).players[0]!;
      expect(p.inside).toBe(room.grid.isInsideBase(start.x, start.z));
    }
  });
  it('limita aceleração e distância pelo tempo do servidor, mesmo com fila inundada', () => {
    const { room, state } = fixture();
    const x = state.x,
      z = state.z;
    for (let seq = 1; seq <= 1000; seq++)
      room.input('a', { ...neutralInput(seq), direction: { x: 1, z: 0 } }, 0);
    room.step(0, 1, false);
    expect(Math.hypot(state.x - x, state.z - z)).toBeLessThanOrEqual(
      20 * MOVEMENT_DT ** 2 + 0.00001,
    );
    expect(state.lastSeq).toBe(1);
    expect(room.input('a', neutralInput(1), 0)).toBe(false);
  });
  it('ignora coordenadas, velocidade e duração forjadas e rejeita valores inválidos', () => {
    const parsed = parseMovementInput({
      ...neutralInput(1),
      x: 5000,
      z: 5000,
      dt: 100,
      speedScale: 100,
    });
    expect(parsed).not.toHaveProperty('x');
    expect(parsed?.speedScale).toBe(1);
    expect(parseMovementInput({ ...neutralInput(1), direction: { x: NaN, z: 0 } })).toBeNull();
    expect(parseMovementInput({ ...neutralInput(1), destination: { x: 1000, z: 0 } })).toBeNull();
  });
  it('para controles antigos e congela quando a sala está pausada', () => {
    const { room, state } = fixture();
    run(room, { x: 1, z: 0 }, 4);
    const before = { x: state.x, z: state.z };
    room.step(1000, 1, false);
    expect(state.m).toBe('idle');
    expect({ x: state.x, z: state.z }).toEqual(before);
    room.input('a', { ...neutralInput(5), direction: { x: 1, z: 0 } }, 1000);
    room.step(1000, 0, false);
    expect({ x: state.x, z: state.z }).toEqual(before);
  });
  it('não atravessa paredes nem sai da máscara navegável durante trajetos longos', () => {
    const { room, state } = fixture();
    for (let seq = 1; seq <= 900; seq++) {
      const direction = mapDirection((Math.floor(seq / 150) * Math.PI) / 2, 1, 0);
      const from = { x: state.x, z: state.z };
      room.input('a', { ...neutralInput(seq), direction }, seq * 33);
      room.step(seq * 33, 3, false);
      expect(room.grid.isWalkable(state.x, state.z)).toBe(true);
      expect(room.grid.lineClear(from.x, from.z, state.x, state.z)).toBe(true);
    }
  });
  it('retoma a última posição confirmada pelo token e expira a reserva após 120 segundos', () => {
    const { room, state } = fixture();
    run(room, { x: 1, z: 0 }, 10);
    const point = { x: state.x, z: state.z };
    room.remove('a', 'secret', 1000);
    const resumed = room.join('new-socket', 1, 'secret', 2000);
    expect({ x: resumed.x, z: resumed.z }).toEqual(point);
    expect(resumed.lastSeq).toBe(0);
    expect(resumed.m).toBe('idle');
    room.remove('new-socket', 'secret', 2000);
    const expired = room.join('later', 2, 'secret', 123000);
    expect(expired.x).toBe(navigationData('jezero').spawns[2]!.x);
  });
  it('arbitra lugares e usa a posição do rover para ambos; saída e queda são canônicas', () => {
    const { room, state } = fixture();
    const spot = footPointNear(room.grid, room.rover)!;
    Object.assign(state, spot);
    const b = room.join('b', 1, undefined, 0),
      c = room.join('c', 2, undefined, 0);
    room.action('b', 'ready');
    room.restrict('b', { blocked: false, cold: false });
    room.action('c', 'ready');
    room.restrict('c', { blocked: false, cold: false });
    Object.assign(b, spot);
    Object.assign(c, spot);
    expect(room.action('a', 'enter')).toBeNull();
    expect(room.action('b', 'enter')).toBeNull();
    expect(room.action('c', 'enter')).toContain('cheio');
    run(room, { x: 1, z: 0 }, 30);
    expect(state.x).toBe(room.rover.x);
    expect(b.x).toBe(room.rover.x);
    expect(state.m).toBe('drive');
    expect(b.m).toBe('ride');
    room.remove('a', 'secret', 1200);
    expect(room.rover.driver).toBeNull();
    expect(room.rover.rider).toBeNull();
    expect(b.m).toBe('idle');
    expect(room.grid.isWalkable(b.x, b.z)).toBe(true);
  });
  it('usa bloqueio e frio oficiais mesmo quando o cliente envia outros modificadores', () => {
    const { room, state } = fixture();
    room.restrict('a', { blocked: true, cold: false });
    const start = { x: state.x, z: state.z };
    run(room, { x: 1, z: 0 }, 10);
    expect({ x: state.x, z: state.z }).toEqual(start);
    expect(room.snapshot(400, 1).players[0]?.state.blocked).toBe(true);
    room.restrict('a', { blocked: false, cold: true });
    room.input('a', { ...neutralInput(11), direction: { x: 1, z: 0 }, speedScale: 1 }, 400);
    room.step(400, 1, false);
    expect(state.cold).toBe(true);
    expect(Math.hypot(state.x - start.x, state.z - start.z)).toBeLessThan(
      (20 * MOVEMENT_DT ** 2) / 4,
    );
  });
  it('retorno à enfermaria escolhe o destino no servidor', () => {
    const { room, state } = fixture();
    expect(room.action('a', 'infirmary')).toBeNull();
    expect(state.x).toBe(navigationData('jezero').infirmary!.x);
    expect(room.grid.isInsideBase(state.x, state.z)).toBe(true);
  });
});
