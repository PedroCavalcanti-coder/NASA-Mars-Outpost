import type { GameplayState, LogEntry } from '@mars/shared';
import { create } from 'zustand';
import { getPlaySession } from '../lib/gameSession';

/**
 * Álbum de figurinhas e "missão da semana". Tudo fica só neste aparelho (localStorage): nenhum
 * dado vai ao servidor. As figurinhas ganham-se jogando; a missão da semana troca a cada 7 Sóis.
 */
export interface Sticker {
  id: string;
  icon: string;
  title: [string, string];
  how: [string, string];
}

export const STICKERS: Sticker[] = [
  { id: 'first_minigame', icon: '🛠️', title: ['Mãos à obra', 'Hands on'], how: ['Complete seu primeiro minigame.', 'Finish your first minigame.'] },
  { id: 'stars3', icon: '⭐', title: ['3 estrelas', '3 stars'], how: ['Tire 3 estrelas em um minigame.', 'Get 3 stars in a minigame.'] },
  { id: 'first_expedition', icon: '🚙', title: ['Exploradora de Marte', 'Mars explorer'], how: ['Conclua uma expedição com o rover.', 'Complete a rover expedition.'] },
  { id: 'radiation_safe', icon: '☢️', title: ['Sobrevivente da radiação', 'Radiation survivor'], how: ['Espere uma radiação alta passar dentro da base.', 'Wait out high radiation inside the base.'] },
  { id: 'first_repair', icon: '🔧', title: ['Mestre dos reparos', 'Repair master'], how: ['Sele uma rachadura do lado de fora.', 'Seal a crack from the outside.'] },
  { id: 'first_upload', icon: '📡', title: ['Mensagem para a Terra', 'Message to Earth'], how: ['Envie dados à Terra.', 'Send data to Earth.'] },
  { id: 'sol2', icon: '🌅', title: ['Primeiro Sol', 'First sol'], how: ['Sobreviva ao primeiro dia de Marte.', 'Survive your first Martian day.'] },
  { id: 'sol7', icon: '🗓️', title: ['Uma semana em Marte', 'A week on Mars'], how: ['Chegue ao Sol 7.', 'Reach sol 7.'] },
  { id: 'research50', icon: '🔬', title: ['Metade da pesquisa', 'Halfway there'], how: ['Chegue a 50 pontos de pesquisa.', 'Reach 50 research points.'] },
  { id: 'team', icon: '🤝', title: ['Trabalho em equipe', 'Teamwork'], how: ['Jogue com um amigo na mesma base.', 'Play with a friend in the same base.'] },
  { id: 'won', icon: '🏆', title: ['Missão cumprida', 'Mission complete'], how: ['Conclua a pesquisa de Marte (100%).', 'Finish the Mars research (100%).'] },
  { id: 'week1', icon: '🎖️', title: ['Missão da semana', 'Mission of the week'], how: ['Complete uma missão da semana.', 'Complete a mission of the week.'] },
];

type Counter = 'minigame' | 'three_stars' | 'expedition' | 'repair' | 'upload' | 'radiation_safe';

interface WeekStep {
  counter: Counter;
  target: number;
  label: [string, string];
}
export interface WeekMission {
  icon: string;
  title: [string, string];
  steps: WeekStep[];
}

/** Três missões da semana que se revezam a cada 7 Sóis. */
export const WEEK_MISSIONS: WeekMission[] = [
  {
    icon: '🚙',
    title: ['Semana do Rover', 'Rover week'],
    steps: [
      { counter: 'expedition', target: 1, label: ['Concluir 1 expedição', 'Complete 1 expedition'] },
      { counter: 'repair', target: 1, label: ['Consertar 1 rachadura', 'Fix 1 crack'] },
      { counter: 'minigame', target: 5, label: ['Completar 5 minigames', 'Finish 5 minigames'] },
    ],
  },
  {
    icon: '📡',
    title: ['Semana da Terra', 'Earth week'],
    steps: [
      { counter: 'upload', target: 2, label: ['Enviar dados 2 vezes', 'Send data twice'] },
      { counter: 'three_stars', target: 1, label: ['Tirar 3 estrelas', 'Get 3 stars'] },
      { counter: 'minigame', target: 6, label: ['Completar 6 minigames', 'Finish 6 minigames'] },
    ],
  },
  {
    icon: '🛡️',
    title: ['Semana da Blindagem', 'Shielding week'],
    steps: [
      { counter: 'repair', target: 2, label: ['Consertar 2 rachaduras', 'Fix 2 cracks'] },
      { counter: 'three_stars', target: 2, label: ['Tirar 3 estrelas 2 vezes', 'Get 3 stars twice'] },
      { counter: 'minigame', target: 8, label: ['Completar 8 minigames', 'Finish 8 minigames'] },
    ],
  },
];

const KEY = 'mo_stickers';
const readStickers = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
};
const weekKey = (week: number) => `mo_week:${getPlaySession()?.room ?? 'local'}:${week}`;
const readWeek = (week: number): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(weekKey(week)) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
};

interface StickerState {
  unlocked: Record<string, number>;
  /** figurinha recém-ganha (aparece como aviso) */
  latest: Sticker | null;
  albumOpen: boolean;
  week: number;
  counts: Record<string, number>;
  weekDone: boolean;
}

export const useStickers = create<StickerState>(() => ({
  unlocked: readStickers(),
  latest: null,
  albumOpen: false,
  week: 0,
  counts: {},
  weekDone: false,
}));

export function unlockSticker(id: string) {
  const s = useStickers.getState();
  if (s.unlocked[id]) return;
  const sticker = STICKERS.find((x) => x.id === id);
  if (!sticker) return;
  const unlocked = { ...s.unlocked, [id]: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(unlocked));
  } catch {
    /* opcional */
  }
  useStickers.setState({ unlocked, latest: sticker });
}

export const weekProgress = (week: number, counts: Record<string, number>) => {
  const mission = WEEK_MISSIONS[week % WEEK_MISSIONS.length]!;
  const done = mission.steps.filter((st) => (counts[st.counter] ?? 0) >= st.target).length;
  return { mission, done, total: mission.steps.length };
};

/** Soma 1 num contador e confere a missão da semana. */
export function bump(counter: Counter) {
  const s = useStickers.getState();
  const counts = { ...s.counts, [counter]: (s.counts[counter] ?? 0) + 1 };
  try {
    localStorage.setItem(weekKey(s.week), JSON.stringify(counts));
  } catch {
    /* opcional */
  }
  const { done, total } = weekProgress(s.week, counts);
  useStickers.setState({ counts, weekDone: done === total });
  if (counter === 'minigame') unlockSticker('first_minigame');
  if (counter === 'three_stars') unlockSticker('stars3');
  if (counter === 'expedition') unlockSticker('first_expedition');
  if (counter === 'repair') unlockSticker('first_repair');
  if (counter === 'upload') unlockSticker('first_upload');
  if (counter === 'radiation_safe') unlockSticker('radiation_safe');
  if (done === total) unlockSticker('week1');
}

let lastFractures = -1;
let lastLogId = -1;
let lastGeneration = '';

/** Olha o que acabou de acontecer no estado do jogo e ganha figurinhas / avança a missão da semana. */
export function trackGameplay(state: GameplayState, fresh: LogEntry[]) {
  const week = Math.floor((state.mission.sol - 1) / 7);
  const s = useStickers.getState();
  if (s.week !== week || lastGeneration !== state.generation) {
    lastGeneration = state.generation;
    lastFractures = -1;
    lastLogId = state.mission.nextLogId - 1; // não conta o que já tinha acontecido antes de abrir
    const counts = readWeek(week);
    useStickers.setState({ week, counts, weekDone: weekProgress(week, counts).done === weekProgress(week, counts).total });
  }
  for (const e of fresh) {
    if (e.id <= lastLogId) continue;
    if (e.title === 'Reconhecimento com o rover') bump('expedition');
    else if (e.title.includes('Radiação segura')) bump('radiation_safe');
    else if (e.title === 'Dados enviados à Terra') bump('upload');
  }
  lastLogId = Math.max(lastLogId, state.mission.nextLogId - 1);
  const fractures = state.integrity.fractures.length;
  if (lastFractures > fractures) bump('repair');
  lastFractures = fractures;
  const sol = state.mission.sol;
  if (sol >= 2) unlockSticker('sol2');
  if (sol >= 7) unlockSticker('sol7');
  if (state.mission.research >= (state.mission.researchGoal ?? 100) / 2) unlockSticker('research50');
  if (Object.keys(state.players).length >= 2) unlockSticker('team');
  if (state.mission.status === 'won') unlockSticker('won');
}
