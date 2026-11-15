import { describe,it,expect } from 'vitest';
import { useCold } from './ColdSystem';
describe('Cold projection',()=>{it('starts without local exposure',()=>{expect(useCold.getState().exposureTime).toBe(0);});});
