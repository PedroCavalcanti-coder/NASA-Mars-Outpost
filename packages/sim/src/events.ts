import { pickWeighted } from './rng';
import { change, cloneState, pushLog } from './state';
import type { Deltas, LogEntry, MissionState } from './types';

type Outcome = Omit<LogEntry, 'id' | 'sol'>;

interface MissionEvent {
  id: string;
  weight: number;
  apply: (s: MissionState) => Outcome;
}

/**
 * Avaria que pede reparo: com materiais suficientes a equipe conserta; sem eles,
 * o prejuízo vira perda de mantimentos, moral e dados.
 */
function breakdown(
  s: MissionState,
  title: string,
  repairCost: number,
  fixedText: string,
  unfixed: Deltas,
  unfixedText: string,
): Outcome {
  if (s.resources.materials.value >= repairCost) {
    return {
      tone: 'bad',
      title,
      text: fixedText,
      deltas: change(s, { materials: -repairCost }),
    };
  }
  return { tone: 'bad', title, text: unfixedText, deltas: change(s, unfixed) };
}

export const EVENTS: readonly MissionEvent[] = [
  {
    id: 'dust_storm',
    weight: 3,
    apply: (s) => {
      s.solarEfficiency = Math.max(0.4, s.solarEfficiency - 0.25);
      return {
        tone: 'bad',
        title: 'Tempestade de poeira',
        text: 'Poeira cobriu os painéis solares (−25% de eficiência). Faça manutenção.',
        deltas: change(s, { energy: -10 }),
      };
    },
  },
  {
    id: 'recycler_failure',
    weight: 2,
    apply: (s) =>
      breakdown(
        s,
        'Falha no reciclador de água',
        15,
        'A equipe trocou a bomba do reciclador usando materiais do estoque.',
        { supplies: -15, morale: -6, research: -4 },
        'Sem materiais para o reparo: água e amostras de cultivo foram perdidas.',
      ),
  },
  {
    id: 'micrometeorite',
    weight: 2,
    apply: (s) =>
      breakdown(
        s,
        'Micrometeorito no laboratório',
        20,
        'O casco do laboratório foi remendado a tempo.',
        { research: -10, morale: -4 },
        'Sem materiais para selar o casco: equipamentos e dados do laboratório se perderam.',
      ),
  },
  {
    id: 'solar_flare',
    weight: 2,
    apply: (s) => ({
      tone: 'bad',
      title: 'Erupção solar',
      text: 'A tripulação se abrigou da radiação e sensores corromperam parte dos dados.',
      deltas: change(s, { morale: -6, research: -5 }),
    }),
  },
  {
    id: 'discovery',
    weight: 2,
    apply: (s) => ({
      tone: 'good',
      title: 'Achado geológico',
      text: 'Uma câmera do rover registrou camadas sedimentares raras perto da base.',
      deltas: change(s, { research: 8, morale: 4 }),
    }),
  },
  {
    id: 'supply_drop',
    weight: 2,
    apply: (s) => ({
      tone: 'good',
      title: 'Cápsula de carga',
      text: 'Uma cápsula enviada da Terra pousou com mantimentos e peças.',
      deltas: change(s, { supplies: 20, materials: 15 }),
    }),
  },
  {
    id: 'cleaning_wind',
    weight: 1,
    apply: (s) => {
      s.solarEfficiency = Math.min(1, s.solarEfficiency + 0.3);
      return {
        tone: 'good',
        title: 'Rajada de vento',
        text: 'Um redemoinho de poeira limpou os painéis solares (+30% de eficiência).',
        deltas: {},
      };
    },
  },
];

export function rollEvent(s: MissionState): Outcome {
  return pickWeighted(s, EVENTS).apply(s);
}

/** Aplica um evento específico para ferramentas de desenvolvimento. */
export function triggerEvent(previous: MissionState, id: string) {
  const event = EVENTS.find((item) => item.id === id);
  if (!event) return null;
  const state = cloneState(previous);
  const entry = pushLog(state, event.apply(state));
  return { state, entry };
}
