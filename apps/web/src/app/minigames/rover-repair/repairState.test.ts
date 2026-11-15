import { describe, expect, it } from 'vitest';
import { initialRepair, repairReducer } from './repairState';

describe('rover repair', () => {
  it('requires the tool, all bolts and the replacement before finishing', () => {
    expect(repairReducer(initialRepair, { type: 'hub' })).toBe(initialRepair);
    let state = repairReducer(initialRepair, { type: 'tool' });
    state = repairReducer(state, { type: 'bolt', index: 0 });
    expect(repairReducer(state, { type: 'bolt', index: 0 })).toBe(state);
    expect(repairReducer(state, { type: 'bolt', index: 3 })).toBe(state);
    expect(repairReducer(state, { type: 'hub' })).toBe(state);
    state = repairReducer(state, { type: 'bolt', index: 1 });
    state = repairReducer(state, { type: 'bolt', index: 2 });
    expect(state.phase).toBe('remove');
    expect(repairReducer(state, { type: 'replacement' })).toBe(state);
    state = repairReducer(state, { type: 'hub' });
    expect(state.phase).toBe('replacement');
    expect(repairReducer(state, { type: 'hub' })).toBe(state);
    state = repairReducer(state, { type: 'replacement' });
    state = repairReducer(state, { type: 'hub' });
    expect(state.phase).toBe('tighten');
    for (const index of [2, 0, 1]) state = repairReducer(state, { type: 'bolt', index });
    expect(state.phase).toBe('complete');
    expect(repairReducer(state, { type: 'hub' })).toBe(state);
    expect(repairReducer(state, { type: 'reset' })).toEqual(initialRepair);
  });
});
