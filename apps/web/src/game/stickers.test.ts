// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { bump, STICKERS, useStickers, WEEK_MISSIONS, weekProgress } from './stickers';

describe('figurinhas e missão da semana', () => {
  it('cada contador libera sua figurinha uma única vez', () => {
    bump('expedition');
    bump('expedition');
    expect(Object.keys(useStickers.getState().unlocked)).toContain('first_expedition');
    expect(useStickers.getState().latest?.id).toBeDefined();
  });
  it('completar os passos da semana libera a figurinha da semana', () => {
    useStickers.setState({ week: 0, counts: {}, unlocked: {} });
    for (const st of WEEK_MISSIONS[0]!.steps) for (let i = 0; i < st.target; i++) bump(st.counter);
    const { done, total } = weekProgress(0, useStickers.getState().counts);
    expect(done).toBe(total);
    expect(useStickers.getState().unlocked.week1).toBeTruthy();
  });
  it('ids únicos e as 3 missões da semana se revezam', () => {
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
    expect(weekProgress(3, {}).mission).toBe(WEEK_MISSIONS[0]);
  });
});
