export type RepairPhase =
  | 'tool'
  | 'unbolt'
  | 'remove'
  | 'replacement'
  | 'install'
  | 'tighten'
  | 'complete';
export interface RepairState {
  phase: RepairPhase;
  bolts: number[];
}
export type RepairAction =
  | { type: 'tool' | 'hub' | 'replacement' | 'reset' }
  | { type: 'bolt'; index: number };
export const initialRepair: RepairState = { phase: 'tool', bolts: [] };
export function repairReducer(state: RepairState, action: RepairAction): RepairState {
  if (action.type === 'reset') return initialRepair;
  if (action.type === 'tool' && state.phase === 'tool') return { phase: 'unbolt', bolts: [] };
  if (action.type === 'bolt' && (state.phase === 'unbolt' || state.phase === 'tighten')) {
    if (
      !Number.isInteger(action.index) ||
      action.index < 0 ||
      action.index > 2 ||
      state.bolts.includes(action.index)
    )
      return state;
    const bolts = [...state.bolts, action.index];
    if (bolts.length === 3)
      return { phase: state.phase === 'unbolt' ? 'remove' : 'complete', bolts: [] };
    return { ...state, bolts };
  }
  if (action.type === 'hub' && state.phase === 'remove') return { phase: 'replacement', bolts: [] };
  if (action.type === 'replacement' && state.phase === 'replacement')
    return { phase: 'install', bolts: [] };
  if (action.type === 'hub' && state.phase === 'install') return { phase: 'tighten', bolts: [] };
  return state;
}
export const repairInstructions: Record<RepairPhase, string> = {
  tool: 'Pegue a chave na bancada.',
  unbolt: 'Use a chave para soltar os três parafusos da roda.',
  remove: 'Retire o cubo rachado do centro da roda.',
  replacement: 'Pegue o cubo de reposição na bancada.',
  install: 'Encaixe a peça nova no centro da roda.',
  tighten: 'Aperte os três parafusos para fixar o cubo.',
  complete: 'Roda reparada. Rover pronto para explorar!',
};
