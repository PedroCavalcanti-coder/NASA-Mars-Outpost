/**
 * Fluxo de decisão dos eventos: pausa o relógio, decide (sozinho, sorteado ou por votação de 30 s)
 * e aplica o MESMO resultado em todos os jogadores da sala.
 */
import type { BaseViewer } from '../BaseViewer';
import { GameClock } from '../sim/clock';
import { type EventOutcome, GAME_EVENTS, type GameEventDef, resolveChoice } from './events';
import { startEventFx } from './fx';
import { scaleDamage } from './shielding';
import { type EventSession, useGameEvents } from './store';
import { modeFor, pickDecider, tally, VOTE_SECONDS } from './voting';

interface FlowContext {
  viewer: () => BaseViewer | null;
  /** aplica recursos na missão e efeitos no mundo; devolve o resultado final (com blindagem zerada) */
  apply: (event: GameEventDef, outcome: EventOutcome) => EventOutcome;
}

let ctx: FlowContext | null = null;
let pausedByEvent = false;

export function setEventFlowContext(c: FlowContext | null) {
  ctx = c;
}

const eidOf = (sol: number, def: GameEventDef) => `${sol}:${def.id}`;

function defFor(eid: string): GameEventDef | undefined {
  const id = eid.split(':')[1];
  return GAME_EVENTS.find((e) => e.id === id);
}

/** O tablet abriu um evento: monta a sessão e pausa o relógio. */
export function beginEvent(def: GameEventDef) {
  const viewer = ctx?.viewer();
  const store = useGameEvents.getState();
  if (!viewer || store.session) return;
  const p = viewer.eventParticipants();
  const mode = modeFor(p.players.length);
  const eid = eidOf(p.sol, def);
  store.setSession({
    eid,
    mode,
    selfId: p.selfId,
    deciderId:
      mode === 'solo'
        ? p.selfId
        : mode === 'decider'
          ? pickDecider(
              p.players.map((x) => x.id),
              p.seed,
              p.sol,
            )
          : null,
    deciderName: '',
    voters: p.players,
    votes: {},
    deadline: Date.now() + VOTE_SECONDS * 1000,
    result: null,
  });
  const s = useGameEvents.getState().session;
  if (s?.deciderId) {
    useGameEvents.getState().setSession({
      ...s,
      deciderName: p.players.find((x) => x.id === s.deciderId)?.name ?? 'Um astronauta',
    });
  }
  // pausa automática (só quem pode mexer no relógio; numa sala, o coordenador)
  if (!GameClock.isPaused() && GameClock.canControl()) {
    pausedByEvent = GameClock.setPaused(true) !== false;
  }
}

/** O jogador local escolheu a opção `idx`. */
export function chooseOption(def: GameEventDef, idx: number) {
  const viewer = ctx?.viewer();
  const s = useGameEvents.getState().session;
  if (!viewer || !s || s.result) return;
  if (s.mode === 'vote') {
    if (s.votes[s.selfId] !== undefined) return;
    useGameEvents.getState().addVote(s.selfId, idx);
    viewer.sendEventVote(s.eid, idx);
    tickEvent(def);
    return;
  }
  if (s.deciderId !== s.selfId) return;
  const roll = Math.random();
  viewer.sendEventResult(s.eid, idx, roll);
  finish(def, idx, roll);
}

export function onRemoteVote(id: string, eid: string, choice: number) {
  const s = useGameEvents.getState().session;
  if (!s || s.eid !== eid || s.result) return;
  useGameEvents.getState().addVote(id, choice);
  const def = defFor(eid);
  if (def) tickEvent(def);
}

export function onRemoteResult(eid: string, choice: number, roll: number) {
  const s = useGameEvents.getState().session;
  const def = defFor(eid);
  if (!s || s.eid !== eid || s.result || !def) return;
  finish(def, choice, roll);
}

/** Chamado a cada segundo (e a cada voto): quem coordena fecha a votação quando todos votaram ou o tempo acabou. */
export function tickEvent(def: GameEventDef) {
  const viewer = ctx?.viewer();
  const s = useGameEvents.getState().session;
  if (!viewer || !s || s.result || s.mode !== 'vote') return;
  const p = viewer.eventParticipants();
  const present = new Set(p.players.map((x) => x.id));
  const votes = Object.fromEntries(Object.entries(s.votes).filter(([id]) => present.has(id)));
  const everyone = [...present].every((id) => votes[id] !== undefined);
  if (!everyone && Date.now() < s.deadline) return;
  if (!p.isCoordinator) return;
  const choice = tally(votes, def.choices.length, p.seed, p.sol);
  const roll = Math.random();
  viewer.sendEventResult(s.eid, choice, roll);
  finish(def, choice, roll);
}

function finish(def: GameEventDef, idx: number, roll: number) {
  const store = useGameEvents.getState();
  const s = store.session;
  const choice = def.choices[idx];
  if (!s || s.result || !choice || !ctx) return;
  const outcome = ctx.apply(def, resolveChoice(choice, roll));
  store.setResult({ choice: idx, outcome });
  startEventFx(def.fx);
}

/** "Entendido": fecha o evento e devolve o relógio ao que era. */
export function closeEvent() {
  const store = useGameEvents.getState();
  store.shift();
  if (pausedByEvent && store.queue.length <= 1) {
    GameClock.setPaused(false);
    pausedByEvent = false;
  }
}

export { scaleDamage };
