import { describe, expect, it } from 'vitest';
import { describeSim } from './index';

describe('sim', () => {
  it('descreve a simulação', () => {
    expect(describeSim()).toContain('Mars Outpost');
  });
});
