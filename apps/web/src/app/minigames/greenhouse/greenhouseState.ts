export type CropIndex = 0 | 1 | 2;
export type CropState = [Crop, Crop, Crop];
export type LightLevel = 1 | 2 | 3;
export type Crop = { water: number; light: LightLevel };
export const CROPS = [
  { index: 0, x: 240, name: 'Brotos', water: 0.45, light: 1 },
  { index: 1, x: 500, name: 'Plantas em crescimento', water: 0.6, light: 2 },
  { index: 2, x: 760, name: 'Tomateiros', water: 0.78, light: 3 },
] as const;
export const WATER_PER_SECOND = 0.24;
export function initialCrops(): CropState {
  return [
    { water: 0.12, light: 3 },
    { water: 0.08, light: 1 },
    { water: 0.22, light: 2 },
  ];
}
export function healthy(crop: Crop, index: number) {
  const needs = CROPS[index];
  return !!needs && crop.water >= needs.water;
}
export function plantHealth(crop: Crop, index: number) {
  const needs = CROPS[index];
  if (!needs) return 0;
  const hydration = Math.min(1, crop.water / needs.water);
  return hydration;
}
export type CropAction =
  | { type: 'water'; index: CropIndex; seconds: number }
  | { type: 'light'; index: CropIndex }
  | { type: 'reset' };
export function cropReducer(state: CropState, action: CropAction): CropState {
  if (action.type === 'reset') return initialCrops();
  if (state.every(healthy)) return state;
  const crop = state[action.index];
  let next: Crop;
  if (action.type === 'light') next = { ...crop, light: ((crop.light % 3) + 1) as LightLevel };
  else {
    if (!Number.isFinite(action.seconds) || action.seconds <= 0) return state;
    const water = Math.min(
      CROPS[action.index].water,
      crop.water + action.seconds * WATER_PER_SECOND,
    );
    if (water === crop.water) return state;
    next = { ...crop, water };
  }
  const result: CropState = [...state];
  result[action.index] = next;
  return result;
}
