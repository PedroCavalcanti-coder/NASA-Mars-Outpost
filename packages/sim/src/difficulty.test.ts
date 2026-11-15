import type { GameplayMovement } from '@mars/shared';
import { describe, expect, it } from 'vitest';
import { createWorldSave, migrateWorldSave } from './saves';
import { eventsForSol } from './eventRules';
import { addGameplayPlayer, applyGameplayCommand, appliedEventDeltas, createGameplay, startRadiation, stepGameplay } from './world';

const m: GameplayMovement = {
  context: () => ({ x: 0, z: 0, inside: true, sheltered: false, driving: false, ready: true }),
  near: () => true,
  restrict: () => {},
  rescue: () => {},
};

function run(d: 'easy' | 'normal' | 'hard') {
  const s = createGameplay(7, 'g', [0], [0]);
  s.difficulty = d;
  addGameplayPlayer(s, 'a', 'A');
  const ready = applyGameplayCommand(s, 'a', { type: 'ready' }, m, 'jezero', true).state;
  Object.assign(s, ready);
  for (let i = 0; i < 600; i++) stepGameplay(s, 1000, m, 'jezero');
  return s;
}

describe('dificuldade', () => {
  it('muda o consumo de oxigênio e de mantimentos', () => {
    const easy = run('easy'), hard = run('hard');
    expect(hard.mission.resources.supplies.value).toBeLessThan(easy.mission.resources.supplies.value);
  });
  it('eventos machucam menos no fácil e mais no difícil', () => {
    const raw = { energy: -10 };
    expect(Math.abs(appliedEventDeltas('major', raw, 0.6).energy!)).toBeLessThan(Math.abs(appliedEventDeltas('major', raw, 1.4).energy!));
  });
  it('a radiação dura mais no difícil e a chance de evento grande sobe', () => {
    const a = createGameplay(7, 'g'), b = createGameplay(7, 'g');
    a.difficulty = 'easy'; b.difficulty = 'hard';
    startRadiation(a, 'x', 3); startRadiation(b, 'x', 3);
    expect(b.radiation!.until).toBeGreaterThan(a.radiation!.until);
    let hard = 0, easy = 0;
    for (let seed = 1; seed < 60; seed++) for (let sol = 4; sol < 12; sol++) {
      hard += eventsForSol(seed * 31, sol, 1, 0.15).length;
      easy += eventsForSol(seed * 31, sol, 1, -0.15).length;
    }
    expect(hard).toBeGreaterThan(easy);
  });
  it('a dificuldade vai e volta no save', () => {
    const s = createGameplay(7, 'g'); s.difficulty = 'hard';
    const back = migrateWorldSave(createWorldSave(s), 1, 'g').state;
    expect(back.difficulty).toBe('hard');
  });
});
