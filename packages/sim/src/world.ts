import { MAX_SOLS, RESEARCH_GOAL } from './balance';
import {
  armorValue, flareFactor, rulesFor, type Difficulty, flareFor, GAMEPLAY_TARGETS, RADIATION, GAMEPLAY_VERSION, GAME_SOL_SECONDS, GAME_START_HOUR, leakRate,
  newIntegrity, repairIntent, tickIntegrity,
  type ActivityAction, type ExpeditionState, type ActivityAttempt, type ActivityKind, type GameConfirmation,
  type GameErrorCode, type GamePayload, type GameplayMovement, type GameplayState,
  type PauseReason, type RepairIntent,
} from '@mars/shared';
import { createMission, change, pushLog } from './state';
import { checkAction, checkOutcome, runCommand } from './engine';
import { dustStep, filterClogged, gridLoad, gridStep, hashString, OXYGEN_PLANT, panelDustRate, seeded, solarGeneration } from './operations';
import { DAILY_OXYGEN_PER_PLAYER, DAILY_SUPPLIES_PER_PLAYER, gardenComplete, GARDEN_OXYGEN_BONUS, MISSIONS, missionBlock, missionsForSol, NIGHT_LIMIT, roverWindowOpen, soilReward, soilSamples, type MissionId } from './missions';
import { collectSample, drillStep, initialDrill, profileFor, targetLayer } from './drilling';
import { inZone, pingPong, soilQuality, stationQuality, zoneFor } from './scoring';
import { eventsForSol, GAME_EVENTS, resolveChoice, WEATHER_EVENT_IDS } from './eventRules';
import { modeFor, pickDecider, randomChoice, tally } from './voting';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function simulationClock(elapsedMs: number) {
  const hours = GAME_START_HOUR + elapsedMs * 24 / (GAME_SOL_SECONDS * 1000);
  const hour = hours % 24;
  const elevation = Math.sin((hour - 6) * Math.PI / 12);
  const t = clamp((elevation + 0.22) / 0.24, 0, 1);
  return { hour, sol: 1 + Math.floor(hours / 24), night: 1 - t * t * (3 - 2 * t) };
}
export function createGameplay(seed: number, generation: string, solar: number[] = [], crops: number[] = []): GameplayState {
  return {
    version: GAMEPLAY_VERSION, generation, revision: 0, elapsedMs: 0, interactionMs: 0,
    scale: 1, pauses: ['loading','empty'], started: false, mission: createMission(seed),
    integrity: newIntegrity(seed), solar: [...solar], crops: [...crops], growth: crops.map(() => 0),
    care: { crops: crops.map(() => 1), filter: 0, needsCare: crops.map(n => n > 0) },
    board: { sol: 1, ids: missionsForSol(seed, 1, 1), done: [], garden: 0, players: 1 },
    quotas: { moxie: 0, water: 0, bench: 0 }, rocks: [], storm: 0, stormLeft: 0, wind: 0,
    eventQueue: [], event: null, eventSols: [1], pending: [], players: {}, attempts: {}, critical: null, dose: 0, doseAlert: 0,
  };
}
export function setPause(s: GameplayState, reason: PauseReason, active: boolean) {
  if (active && !s.pauses.includes(reason)) s.pauses.push(reason);
  if (!active) s.pauses = s.pauses.filter(p => p !== reason);
}
export function addGameplayPlayer(s: GameplayState, id: string, name: string, previous?: GameplayState['players'][string]) {
  s.players[id] = previous ? { ...previous, id, name, ready: false, blocked: true } : {
    id, name, ready: false, tank: 100, exposure: 0, inside: false, driving: false,
    rescued: 0, rescueUntil: 0, blocked: true, cold: false, carrying: 0,
  };
  setPause(s, 'empty', false);
  const count = Object.keys(s.players).length;
  if (count > s.board.players) {
    s.board.players = count;
    s.board.ids = missionsForSol(s.mission.seed, s.board.sol, count);
  }
  if (count > 1) setPause(s, 'repair', false);
  s.revision++;
}
export function removeGameplayPlayer(s: GameplayState, id: string, movement: GameplayMovement) {
  for (const a of Object.values(s.attempts)) {
    if (a.player === id || a.participants.includes(id)) {
      for (const peer of a.participants) if (s.players[peer]) s.players[peer]!.carrying = 0;
      delete s.attempts[a.id];
    }
  }
  for (const f of s.integrity.fractures) if (f.owner === id) { delete f.owner; delete f.leaseUntil; }
  // a pedra que ele levava volta ao chão
  for (const r of s.expedition?.rocks ?? []) if (r.by === id && !r.loaded) r.by = null;
  if (s.expedition) s.expedition.members = s.expedition.members.filter(m => m !== id);
  delete s.players[id];
  setPause(s, 'repair', false);
  if (s.event && !s.event.result) {
    s.event.voters = s.event.voters.filter(v => v.id !== id);
    delete s.event.votes[id];
    if (s.event.deciderId === id) s.event.deciderId = pickDecider(Object.keys(s.players), s.mission.seed, s.event.sol);
  }
  setPause(s, 'empty', Object.keys(s.players).length === 0);
  updateRestrictions(s, movement);
  s.revision++;
}
function log(s: GameplayState, title: string, deltas: Parameters<typeof change>[1], text = title, tone: 'good' | 'info' | 'bad' = 'good') {
  pushLog(s.mission, { title, text, tone, deltas: change(s.mission, deltas) });
}
function outcome(s: GameplayState) {
  s.mission.resources.armor.value = armorValue(s.integrity);
  checkOutcome(s.mission);
  // Sol belongs to the world clock even when the deadline ends the campaign.
  s.mission.sol = simulationClock(s.elapsedMs).sol;
  setPause(s, 'ended', s.mission.status !== 'playing');
  if (s.mission.status !== 'playing') { s.attempts = {}; setPause(s, 'repair', false); }
}
function sufficient(s: GameplayState, costs: Partial<Record<'energy' | 'supplies' | 'oxygen', number>>) {
  return Object.entries(costs).every(([key, value]) => s.mission.resources[key as 'energy'].value >= value!);
}
function missionCosts(s: GameplayState, id: string, multiplier = 1) {
  const def = MISSIONS[id as MissionId];
  if (!def) return null;
  const c = simulationClock(s.elapsedMs);
  return missionBlock(def, {
    energy: s.mission.resources.energy.value / multiplier,
    supplies: s.mission.resources.supplies.value / multiplier,
    oxygen: s.mission.resources.oxygen.value / multiplier,
    blackout: s.mission.resources.energy.value <= 0, night: c.night,
  });
}
function targetOf(kind: ActivityKind, target: string) {
  if (kind === 'station') return `station:${MISSIONS[target as MissionId]?.site ?? '?'}`;
  if (kind === 'drill') return 'drill';
  // reconhecimento: o minigame abre quando o rover encosta no ponto amarelo
  if (kind === 'soil') return 'soil';
  if (kind === 'upload') return 'station:upload';
  if (kind === 'greenhouse') return 'garden';
  // dutos de ar: na sala de suporte à vida (junto do filtro)
  if (kind === 'ducts') return 'filter:0';
  return `${kind}:${target}`;
}
function updateRestrictions(s: GameplayState, movement: GameplayMovement) {
  movement.lockExit?.(Boolean(s.radiation));
  for (const p of Object.values(s.players)) {
    p.blocked = !p.ready || s.pauses.includes('ended') || Boolean(s.event && !s.event.result) ||
      p.rescueUntil > s.interactionMs || Object.values(s.attempts).some(a => a.participants.includes(p.id) && a.quality === null);
    const carrying = Boolean(s.expedition?.rocks.some(r => r.by === p.id && !r.loaded));
    movement.restrict(p.id, p.blocked, p.cold, carrying);
  }
}
/**
 * Efeito de verdade dos eventos: pesam no estoque e na base (x3 nos simples, x2 nos grandes) e
 * pesquisa vira mantimento (pesquisa só vem das missões). O tablet mostra estes mesmos números.
 */
export function appliedEventDeltas(kind: 'easy' | 'major', raw: Partial<Record<string, number>> = {}, harm = 1): Record<string, number> {
  const deltas: Record<string, number> = {};
  const scale = kind === 'major' ? 2 : 3;
  for (const [key, value] of Object.entries(raw)) {
    if (!value) continue;
    const k = key === 'research' ? 'supplies' : key;
    deltas[k] = (deltas[k] ?? 0) + Math.round(value * (key === 'research' ? 3 : scale) * (value < 0 ? harm : 1));
  }
  return deltas;
}

/** Todo evento de clima deixa uma marca na base, seja qual for a escolha. */
function weatherAftermath(s: GameplayState, id: string) {
  const t = s.elapsedMs / 1000;
  if (id === 'co2_blizzard') { s.solar = s.solar.map(v => clamp(v + 1, 0, 4)); log(s, '❄️ Gelo nos painéis', {}, 'A nevasca cobriu os painéis solares: limpe-os para voltar a gerar energia.', 'bad'); }
  else if (id === 'meteor_shower') { repairIntent(s.integrity, { op: 'damage', amount: 10 }, 'event', t, s.interactionMs); log(s, '☄️ Impacto na blindagem', {}, 'Um meteorito abriu uma rachadura: conserte-a do lado de fora.', 'bad'); }
  else if (id === 'giant_dust_devil') { s.storm = Math.max(s.storm, 0.5); s.stormLeft = Math.max(s.stormLeft, 60); log(s, '🌪️ Poeira no ar', {}, 'O redemoinho deixou poeira no ar: lá fora o oxigênio acaba mais rápido por um tempo.', 'bad'); }
  else if (id === 'ice_clouds') { s.storm = Math.max(s.storm, 0.3); s.stormLeft = Math.max(s.stormLeft, 90); log(s, '☁️ Céu fechado', {}, 'As nuvens de gelo escondem o Sol: os painéis rendem menos.', 'info'); }
}

/** O clima novo substitui o anterior: tempestade, radiação e poeira não acontecem juntas. */
function clearWeather(s: GameplayState) {
  s.storm = 0; s.stormLeft = 0; s.radiation = null;
}

function resolveEvent(s: GameplayState, choice: number) {
  const e = s.event;
  if (!e || e.result) return;
  const def = GAME_EVENTS.find(d => d.id === e.id);
  const option = def?.choices[choice];
  if (!option) return;
  const roll = seeded(s.mission.seed, hashString(e.eid), 771);
  const resolved = resolveChoice(option, roll);
  const deltas = appliedEventDeltas(def?.kind ?? 'easy', resolved.deltas, rulesFor(s.difficulty).harm);
  if (armorValue(s.integrity) <= 0)
    for (const key of ['energy','supplies','oxygen'] as const) if ((deltas[key] ?? 0) < 0) deltas[key] = deltas[key]! * 2;
  if (deltas.armor) repairIntent(s.integrity, { op: 'damage', amount: -deltas.armor }, 'event', s.elapsedMs / 1000, s.interactionMs);
  delete deltas.armor;
  if (WEATHER_EVENT_IDS.includes(e.id) && (s.storm > 0 || s.radiation)) { clearWeather(s); log(s, 'Clima mudou', {}, 'O clima anterior passou: o novo evento toma o lugar dele.', 'info'); }
  log(s, def!.title, deltas, resolved.text, resolved.tone);
  for (const fx of resolved.effects ?? []) {
    if (fx.type === 'storm') { s.storm = fx.strength; s.stormLeft = 150; }
    if (fx.type === 'storm_end') { s.storm = 0; s.stormLeft = 0; }
    if (fx.type === 'dust') s.solar = s.solar.map(v => clamp(v + fx.amount * 4, 0, 4));
    if (fx.type === 'clean_panels') s.solar.fill(0);
    if (fx.type === 'clog_filter') s.care.filter = Math.max(0, s.mission.sol - 2);
    if (fx.type === 'wilt_crop') { const i = s.crops.findIndex(v => v > 0); if (i >= 0) s.crops[i] = 0; }
    // dose da tempestade: quanto mais forte a explosão solar real, maior
    if (fx.type === 'dose') addDose(s, fx.mSv * (e.flare ? flareFactor(e.flare.classType) : 1));
    // radiação alta: a base fecha as portas até passar (quanto mais forte a explosão, mais demora)
    if (fx.type === 'radiation') startRadiation(s, def!.title, fx.hours * (e.flare ? flareFactor(e.flare.classType) : 1));
  }
  weatherAftermath(s, e.id);
  e.result = { choice, outcome: { tone: resolved.tone, text: resolved.text, deltas } };
  s.eventQueue = s.eventQueue.filter(q => q.eid !== e.eid);
  setPause(s, 'event', false);
  outcome(s);
}
function startAttempt(s: GameplayState, player: string, kind: ActivityKind, target: string, movement: GameplayMovement): ActivityAttempt | GameErrorCode {
  // Tentativa antiga do próprio jogador (minigame fechado sem cancelar): é descartada.
  for (const old of Object.values(s.attempts)) {
    if (old.player === player && !(old.kind === 'soil' && old.quality !== null)) delete s.attempts[old.id];
  }
  const exclusive = `${kind}:${target}`;
  if (Object.values(s.attempts).some(a => `${a.kind}:${a.target}` === exclusive && a.player !== player)) return 'BUSY';
  const mission = kind === 'station' ? target : kind === 'drill' ? 'drill' : kind === 'soil' ? 'soil_robot' : null;
  if (mission) {
    if (!s.board.ids.includes(mission) || s.board.done.includes(mission)) return 'UNAVAILABLE';
    if (missionCosts(s, mission)) return 'INSUFFICIENT_RESOURCES';
    if (s.mission.resources.armor.value <= 0) return 'UNAVAILABLE';
    if (kind === 'soil' && (s.expedition || !roverWindowOpen(simulationClock(s.elapsedMs).hour))) return 'UNAVAILABLE';
  }
  if (kind === 'ducts' && !(s.critical?.kind === 'ducts' && s.critical.active)) return 'UNAVAILABLE';
  // filtro, horta e painéis são missões do dia: fora delas (ou já feitas) não abrem
  const daily = kind === 'filter' ? 'air_filter' : kind === 'greenhouse' ? 'garden_care' : kind === 'solar' ? 'solar_clean' : null;
  if (daily && (!s.board.ids.includes(daily) || s.board.done.includes(daily))) return 'UNAVAILABLE';
  if (kind === 'solar' && s.board.solar?.includes(Number(target))) return 'UNAVAILABLE';
  if ((kind === 'solar' && (!/^\d+$/.test(target) || Number(target) >= s.solar.length)) ||
      (kind === 'filter' && (!['0','1'].includes(target) || s.care.filter >= s.mission.sol)) ||
      // a horta é missão do dia: vale regar qualquer canteiro plantado que ainda não foi regado hoje
      (kind === 'greenhouse' && !(Number.isInteger(Number(target)) && (s.crops[Number(target)] ?? 0) > 0 && !s.board.watered?.includes(Number(target)))) ||
      (kind === 'upload' && s.mission.research - s.mission.secured < 10)) return 'UNAVAILABLE';
  if (!movement.near(player, targetOf(kind, target), kind === 'soil' ? 9 : 4.5)) return 'TOO_FAR';
  const id = `${s.generation}:${s.revision + 1}:${player}`;
  const roll = (i: number) => seeded(s.mission.seed, s.revision, i);
  const a: ActivityAttempt = {
    id, player, kind, target, sol: s.mission.sol, startedAt: s.interactionMs,
    elapsed: 0, expiresAt: s.interactionMs + 180000, seq: 0,
    challenge: { rolls: [roll(1),roll(2),roll(3)], target: targetLayer('jezero', s.mission.seed, s.mission.sol).id,
      debris: Array.from({length: 12},(_,i) => i), files: [0,1,2,4,5,6],
      soil: Array.from({length:6},(_,i)=>roll(20+i)), blocks: [3,7,8,9,10,11,12,13] },
    marks: [], lastAction: 0, drill: initialDrill(), holding: false, removed: [], coverage: [],
    water: 0, moisture: 0, samples: [], file: -1, transmitted: 0,
    batch: s.mission.research, quality: null, participants: [player],
  };
  s.attempts[id] = a;
  return a;
}
function action(s: GameplayState, a: ActivityAttempt, command: ActivityAction, base: string): boolean {
  const time = a.elapsed;
  if (command.type === 'mark') {
    if (a.kind !== 'station' || command.round !== a.marks.length || a.marks.length >= 3 || time - a.lastAction < 0.15) return false;
    a.marks.push(inZone(pingPong(time, 1.25), zoneFor(command.round, a.challenge.rolls[command.round]!)));
  } else if (command.type === 'drill') {
    if (a.kind !== 'drill') return false;
    a.holding = command.holding;
  } else if (command.type === 'collect') {
    if (a.kind !== 'drill' || a.drill.depth < 1 || a.quality !== null) return false;
    const sample = collectSample(a.drill.depth, profileFor(base), targetLayer(base, s.mission.seed, a.sol));
    a.quality = clamp(Math.round(sample.research / 8), 0, 2);
    a.holding = false;
  } else if (command.type === 'sample') {
    if (a.kind !== 'soil' || command.index !== a.samples.length || command.index >= 6 || time - a.lastAction < 0.15) return false;
    a.samples.push((time - a.lastAction) * 1000);
  } else if (command.type === 'brush') {
    if (a.kind !== 'solar') return false;
    const cells = new Set(a.coverage);
    let from = command.points[0]!;
    for (const to of command.points) {
      for (let i = 0; i < 256; i++) {
        const x = ((i % 16) + 0.5) / 16, y = (Math.floor(i / 16) + 0.5) / 16;
        const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
        const t = length ? clamp(((x-from.x)*dx + (y-from.y)*dy) / length,0,1) : 0;
        if ((x-from.x-t*dx)**2 + (y-from.y-t*dy)**2 <= 0.075**2) cells.add(i);
      }
      from = to;
    }
    a.coverage = [...cells];
  } else if (command.type === 'remove') {
    if (a.kind !== 'filter' || command.ids.some(id => !a.challenge.debris.includes(id) || a.removed.includes(id)) || new Set(command.ids).size !== command.ids.length) return false;
    a.removed.push(...command.ids);
  } else if (command.type === 'water') {
    if (a.kind !== 'greenhouse') return false;
    a.holding = command.holding;
  } else if (command.type === 'transmit') {
    if (a.kind !== 'upload' || a.quality !== null) return false;
    if (!a.challenge.files.includes(command.file)) { a.lastAction = time + 2.5; a.holding = false; return true; }
    if (time < a.lastAction || command.file !== a.challenge.files[a.removed.length]) return false;
    if (command.holding && a.file !== -1 && a.file !== command.file) return false;
    a.file = command.file; a.holding = command.holding;
  } else if (command.type === 'result') {
    // O minigame original roda no navegador; o servidor só exige tempo mínimo de jogo.
    if (a.reported || time < 1.5) return false;
    a.reported = { quality: command.quality, water: command.water ?? 0, research: command.research ?? 0 };
  } else return false;
  a.lastAction = time;
  return true;
}
/** Canteiros por cúpula da estufa. */
export const BEDS_PER_DOME = 8;
/** Painéis que a missão de limpeza pede por dia (um minigame por painel). */
export const SOLAR_PANELS_PER_DAY = 2;

/** O canteiro escolhido e o vizinho mais próximo (a mesma bancada dupla da estufa). */
export function bedPair(base: string, index: number): number[] {
  const points = (GAMEPLAY_TARGETS as Record<string, { points: Record<string, { x: number; z: number }> }>)[base]?.points;
  const me = points?.[`crop:${index}`];
  if (!points || !me) return [index];
  let best = -1, bestD = Infinity;
  for (const [key, p] of Object.entries(points)) {
    if (!key.startsWith('crop:')) continue;
    const i = Number(key.slice(5));
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (i !== index && d < bestD) { best = i; bestD = d; }
  }
  return best >= 0 && bestD < 2 ? [index, best] : [index];
}

/** A tarefa da base cumpriu a missão do dia correspondente (se ela foi sorteada hoje). */
function markMission(s: GameplayState, id: MissionId) {
  if (!s.board.ids.includes(id) || s.board.done.includes(id)) return;
  s.board.done.push(id);
  log(s, `Missão do dia: ${MISSIONS[id].title}`, {});
}

function finish(s: GameplayState, a: ActivityAttempt, base = 'jezero'): GameErrorCode | null {
  const r = a.reported;
  if (r) {
    if (a.kind === 'station') a.marks = [0, 1, 2].map((i) => r.quality * 3 > i + 0.01);
    if (a.kind === 'drill') a.quality = clamp(Math.round(r.research / 8), 0, 2);
    if (a.kind === 'soil') a.samples = [];
    if (a.kind === 'greenhouse') a.water = clamp(r.water / 10, 0.1, 2);
    if (a.kind === 'upload') a.removed = [...a.challenge.files];
  } else if (a.kind === 'station' && a.marks.length !== 3 ||
      a.kind === 'drill' && a.quality === null ||
      a.kind === 'soil' && a.samples.length !== 6 ||
      a.kind === 'solar' && a.coverage.length < 253 ||
      a.kind === 'filter' && a.removed.length !== a.challenge.debris.length ||
      a.kind === 'greenhouse' && a.moisture < 1.41 - 1e-6 ||
      a.kind === 'upload' && a.removed.length !== a.challenge.files.length) return 'INVALID_SEQUENCE';
  if (a.kind === 'soil' && r) {
    // reconhecimento com o rover: a recompensa sai na volta (com o rover já consertado)
    if (s.board.done.includes('soil_robot')) return 'UNAVAILABLE';
    if (missionCosts(s, 'soil_robot')) return 'INSUFFICIENT_RESOURCES';
    const deltas: Record<string, number> = { research: soilReward(r.quality), morale: MISSIONS.soil_robot.morale ?? 0 };
    for (const [key, value] of Object.entries(MISSIONS.soil_robot.cost)) deltas[key] = -value;
    log(s, 'Reconhecimento com o rover', deltas);
    s.board.done.push('soil_robot');
    delete s.attempts[a.id];
    return null;
  }
  if (a.kind === 'soil') {
    a.quality = soilQuality(a.samples); s.players[a.player]!.carrying = soilSamples(a.quality);
    a.holding = false; a.expiresAt = s.interactionMs + 600000;
    return null;
  }
  const mission = a.kind === 'station' ? a.target : a.kind === 'drill' ? 'drill' : null;
  if (mission) {
    if (s.board.done.includes(mission)) return 'UNAVAILABLE';
    if (missionCosts(s, mission)) return 'INSUFFICIENT_RESOURCES';
    if (s.mission.resources.armor.value <= 0) return 'UNAVAILABLE';
    const def = MISSIONS[mission as MissionId];
    // só missões de pesquisa dão pesquisa; as de manutenção devolvem recursos à base
    const research = def.research <= 0 ? 0 : a.kind === 'drill' ? def.research + Math.min(1, a.quality!) : def.research + Math.round(r ? r.quality : stationQuality(a.marks.filter(Boolean).length,3));
    const deltas: Record<string, number> = {};
    for (const [key,value] of Object.entries(def.cost)) deltas[key] = -value;
    for (const [key,value] of Object.entries(def.reward ?? {})) deltas[key] = (deltas[key] ?? 0) + Math.round(value * (r ? 0.7 + 0.3 * r.quality : 1));
    if (def.morale) deltas.morale = def.morale;
    if (mission === 'antenna_calibration') s.pending.push({ id:a.id, research, remainingMs: 20000 });
    else if (research > 0) deltas.research = research;
    log(s, def.title, deltas);
    s.board.done.push(mission);
    if (mission === 'medical_checkup' && (s.dose ?? 0) > 0) { s.dose = Math.max(0, s.dose! - 10); s.doseAlert = Math.min(s.doseAlert ?? 0, Math.floor(s.dose / DOSE_ALERT_STEP)); }
  } else if (a.kind === 'ducts') {
    s.critical = null;
    log(s, 'Dutos de ar desentupidos a tempo!', { oxygen: 4 }, 'A ventilação voltou a correr. Ar limpo para a tripulação.');
  } else if (a.kind === 'solar') {
    // um painel por minigame; a missão do dia pede 2 painéis diferentes
    const panel = Number(a.target);
    s.solar[panel] = 0;
    s.board.solar = [...new Set([...(s.board.solar ?? []), panel])];
    log(s,`Painel solar limpo (${s.board.solar.length}/${SOLAR_PANELS_PER_DAY})`,{});
    if (s.board.solar.length >= SOLAR_PANELS_PER_DAY) markMission(s, 'solar_clean');
  } else if (a.kind === 'filter') {
    s.care.filter = s.mission.sol; log(s,'Filtro de ar trocado',{});
    markMission(s, 'air_filter');
  } else if (a.kind === 'greenhouse') {
    const cost = Math.max(2, Math.ceil(Math.round(a.water * 10) / 4));
    if (!sufficient(s,{supplies:cost})) return 'INSUFFICIENT_RESOURCES';
    log(s,'Cuidado da horta',{ supplies:-cost });
    // cada irrigação cuida de UM canteiro (o jogador vai de canteiro em canteiro)
    const watered = new Set(s.board.watered ?? []);
    for (const i of [Number(a.target)]) if ((s.crops[i] ?? 0) > 0) { s.care.crops[i] = s.mission.sol; s.care.needsCare[i] = false; watered.add(i); }
    s.board.watered = [...watered];
    // a missão fecha quando TODOS os canteiros plantados foram regados hoje
    if (s.crops.every((v, i) => v <= 0 || watered.has(i))) markMission(s, 'garden_care');
    if (s.board.garden < s.mission.sol && gardenComplete(s.crops,s.care.crops,s.mission.sol)) {
      s.board.garden = s.mission.sol; log(s,'Horta em dia',{ oxygen:GARDEN_OXYGEN_BONUS, supplies:4 });
    }
  } else if (a.kind === 'upload') {
    s.mission.secured = Math.max(s.mission.secured, Math.min(a.batch,s.mission.research));
    log(s,'Dados enviados à Terra',{});
  }
  delete s.attempts[a.id];
  return null;
}
export function applyGameplayCommand(previous: GameplayState, actor: string, payload: GamePayload, movement: GameplayMovement, base: string, coordinator: boolean, dev = false): { state: GameplayState; code?: GameErrorCode; attempt?: ActivityAttempt } {
  const p = previous.players[actor];
  if (!p) return { state: previous, code:'NOT_READY' };
  if (previous.mission.status !== 'playing') return {state: previous, code:'ENDED'};
  const s = cloneGameplay(previous);
  const fail = (code: GameErrorCode) => ({state:previous,code});
  let attempt: ActivityAttempt | undefined;
  if (payload.type === 'ready') {
    s.players[actor]!.ready = true;
    s.started = true; setPause(s,'loading',false);
    repairIntent(s.integrity,{op:'ready'},actor,s.elapsedMs/1000,s.interactionMs);
  } else if (payload.type === 'time') {
    if (!coordinator) return fail('FORBIDDEN');
    s.scale = payload.scale; setPause(s,'manual',payload.paused);
  } else if (payload.type === 'dev') {
    if (!dev) return fail('FORBIDDEN');
    const code = devCommand(s, actor, payload.action, payload.id);
    if (code) return fail(code);
  } else {
    if (!p.ready || !movement.context(actor)?.ready) return fail('NOT_READY');
    const eventCommand = payload.type === 'event:open' || payload.type === 'event:choose';
    if (!eventCommand && payload.type !== 'cancel' && s.pauses.some(p=>p !== 'repair')) return fail('PAUSED');
    if (payload.type === 'start') {
      const result = startAttempt(s,actor,payload.kind,payload.target,movement);
      if (typeof result === 'string') return fail(result);
      result.challenge.target = targetLayer(base,s.mission.seed,s.mission.sol).id;
      attempt = result;
    } else if (payload.type === 'actions' || payload.type === 'finish' || payload.type === 'cancel') {
      const a = s.attempts[payload.attempt];
      if (!a || a.player !== actor) return fail('UNAVAILABLE');
      if (payload.type === 'cancel') { delete s.attempts[a.id]; s.players[actor]!.carrying = 0; }
      else {
        if (a.sol !== s.mission.sol || s.interactionMs > a.expiresAt) return fail('EXPIRED');
        if (!movement.near(actor,targetOf(a.kind,a.target),a.kind === 'soil' ? 10 : 5)) return fail('TOO_FAR');
        if (payload.type === 'actions') {
          if (payload.seq !== a.seq + 1) return fail('INVALID_SEQUENCE');
          for (const input of payload.actions) if (!action(s,a,input,base)) return fail('INVALID_SEQUENCE');
          a.seq = payload.seq;
          attempt = a;
        } else {
          const error = finish(s,a,base); if (error) return fail(error);
        }
      }
    } else if (payload.type === 'interact') {
      const kind = payload.kind, index = Number(payload.target);
      const target = kind === 'moxie' || kind === 'water' ? kind : kind === 'deliver' ? 'delivery' : kind === 'harvest' ? `crop:${payload.target}` : `${kind === 'plant' ? 'crop' : kind}:${payload.target}`;
      if (!movement.near(actor,target,4.5)) return fail('TOO_FAR');
      if (kind === 'moxie' || kind === 'water' || kind === 'bench') {
        // oxigênio e água são missões do dia: só quando sorteadas, e uma vez
        if (kind !== 'bench') {
          const id = kind === 'moxie' ? 'oxygen_moxie' : 'water_extract';
          if (!s.board.ids.includes(id) || s.board.done.includes(id)) return fail('UNAVAILABLE');
        }
        if (s.quotas[kind] >= 3) return fail('UNAVAILABLE');
        const cost = kind === 'bench' ? 4 : 2;
        if (!sufficient(s,{energy:cost})) return fail('INSUFFICIENT_RESOURCES');
        s.quotas[kind]++;
        log(s,kind === 'moxie' ? 'Usina MOXIE' : kind === 'water' ? 'Extração de água' : 'Bancada de ferramentas', {energy:-cost, ...(kind === 'moxie' ? {oxygen:6} : {supplies: kind === 'bench' ? 4 : 6})});
        if (kind === 'moxie') markMission(s, 'oxygen_moxie');
        if (kind === 'water') markMission(s, 'water_extract');
      } else if (kind === 'plant' || kind === 'harvest') {
        if (!Number.isInteger(index) || index < 0 || index >= s.crops.length) return fail('UNAVAILABLE');
        if (kind === 'plant') {
          if (s.crops[index] !== 0) return fail('UNAVAILABLE');
          s.crops[index] = 1; s.growth[index] = 0; s.care.crops[index] = s.mission.sol; s.care.needsCare[index] = true;
        } else {
          if (s.crops[index] !== 3 || s.care.needsCare[index]) return fail('UNAVAILABLE');
          s.crops[index] = 1; s.growth[index] = 0; s.care.crops[index] = s.mission.sol;
          log(s,'Colheita da estufa',{ supplies:8 });
        }
      } else if (kind === 'rock') {
        if (!Number.isInteger(index) || index < 0 || index >= 4 || s.rocks.includes(index)) return fail('UNAVAILABLE');
        s.rocks.push(index);
        const science = seeded(s.mission.seed,s.mission.sol,950+index) < 0.4;
        // rochas viram material para a base (pesquisa só vem das missões de pesquisa)
        log(s,'Amostra de rocha',science ? {supplies:5} : {supplies:3});
      } else if (kind === 'deliver') {
        const a = Object.values(s.attempts).find(a=>a.player === actor && a.kind === 'soil' && a.quality !== null);
        if (!a || !s.players[actor]!.carrying || s.board.done.includes('soil_robot')) return fail('UNAVAILABLE');
        if (missionCosts(s,'soil_robot')) return fail('INSUFFICIENT_RESOURCES');
        const deltas: Record<string,number> = {research:soilReward(a.quality!),morale:3};
        for (const [key,value] of Object.entries(MISSIONS.soil_robot.cost)) deltas[key] = -value;
        log(s,MISSIONS.soil_robot.title,deltas); s.board.done.push('soil_robot');
        s.players[actor]!.carrying = 0; delete s.attempts[a.id];
      }
    } else if (payload.type === 'expedition') {
      const error = expeditionCommand(s, actor, payload.op, payload.rock, movement);
      if (error) return fail(error);
    } else if (payload.type === 'event:open') {
      if (s.event && !s.event.result) return fail('BUSY');
      const q = s.eventQueue.find(e => e.eid === payload.eid);
      if (!q) return fail('UNAVAILABLE');
      const voters = Object.values(s.players).filter(p=>p.ready).map(({id,name})=>({id,name}));
      const mode = modeFor(voters.length);
      // radiação: o evento usa uma explosão solar real do arquivo do DONKI
      const flare = q.id === 'radiation_storm' ? flareFor(hashString(q.eid) ^ s.mission.seed) : undefined;
      s.event = {...q, mode, voters, votes:{}, deciderId:mode === 'vote' ? null : pickDecider(voters.map(p=>p.id),s.mission.seed,q.sol),remainingMs:30000,result:null, ...(flare ? {flare:{...flare}} : {})};
      setPause(s,'event',true);
    } else if (payload.type === 'event:choose') {
      const e = s.event, def = GAME_EVENTS.find(d=>d.id === e?.id);
      if (!e || e.eid !== payload.eid || e.result || !def?.choices[payload.choice]) return fail('UNAVAILABLE');
      if (e.mode === 'vote') {
        if (!e.voters.some(v=>v.id === actor) || e.votes[actor] !== undefined) return fail('FORBIDDEN');
        e.votes[actor] = payload.choice;
        if (e.voters.every(v=>e.votes[v.id] !== undefined)) resolveEvent(s,tally(e.votes,def.choices.length,s.mission.seed,e.sol));
      } else {
        if (e.deciderId !== actor) return fail('FORBIDDEN');
        resolveEvent(s,payload.choice);
      }
    } else if (payload.type === 'action') {
      if (!movement.near(actor, payload.action === 'research' ? 'station:lab' : 'rover',4.5)) return fail('TOO_FAR');
      if (!checkAction(s.mission,payload.action).ok) return fail('INSUFFICIENT_RESOURCES');
      s.mission = runCommand(s.mission,{type:'action',action:payload.action}).state;
    }
  }
  outcome(s); updateRestrictions(s,movement); s.revision++;
  return {state:s,attempt};
}

/** Define a dificuldade do mundo: meta de pesquisa e prazo (o difícil pede 3x os pontos e dá 3x os sóis). */
export function applyDifficulty(s: GameplayState, d: Difficulty) {
  s.difficulty = d;
  const rules = rulesFor(d);
  s.mission.researchGoal = Math.round(RESEARCH_GOAL * rules.researchGoal);
  s.mission.maxSols = Math.round(MAX_SOLS * rules.maxSols);
}

/** Duração da expedição (tempo real, ms) e quantas pedras achar. */
export const EXPEDITION_MS = 240000;
export const EXPEDITION_ROCKS = 3;
export const PIT_DIG_SECONDS = 3;
const round1 = (n: number) => Math.round(n * 10) / 10;

function beginExpedition(s: GameplayState, actor: string, movement: GameplayMovement): GameErrorCode | null {
  if (s.expedition) return 'BUSY';
  if (!s.board.ids.includes('soil_robot') || s.board.done.includes('soil_robot')) return 'UNAVAILABLE';
  if (!roverWindowOpen(simulationClock(s.elapsedMs).hour)) return 'UNAVAILABLE';
  if (missionCosts(s, 'soil_robot')) return 'INSUFFICIENT_RESOURCES';
  if (s.mission.resources.armor.value <= 0) return 'UNAVAILABLE';
  const ctx = movement.context(actor);
  if (!ctx?.driving || !movement.near(actor, 'soil', 10)) return 'TOO_FAR';
  const occupants = movement.occupants?.() ?? { driver: actor, rider: null };
  if (occupants.driver !== actor) return 'FORBIDDEN';
  const members = [occupants.driver, occupants.rider].filter((id): id is string => Boolean(id && s.players[id]));
  const seed = s.mission.seed, sol = s.mission.sol;
  const rules = rulesFor(s.difficulty);
  // o mapa da expedição é um campo aberto: sem as estruturas da base (que ficam escondidas)
  movement.fieldMode?.(true);
  const abort = (code: GameErrorCode) => { movement.fieldMode?.(false); return code; };
  // ponto de chegada longe da base e pedras espalhadas por perto: tudo sorteado pelo servidor
  const a0 = seeded(seed, sol, 1100) * Math.PI * 2;
  const at = (x: number, z: number, profile: 'foot' | 'vehicle') => movement.spot ? movement.spot(x, z, profile) : { x, z };
  const start = at(Math.cos(a0) * 52, Math.sin(a0) * 52, 'vehicle');
  if (!start) return abort('UNAVAILABLE');
  const rocks: ExpeditionState['rocks'] = [];
  const targets = rules.expeditionTargets;
  for (let i = 0; rocks.length < targets && i < 160; i++) {
    const angle = seeded(seed, sol, 1110 + i * 2) * Math.PI * 2, radius = 18 + seeded(seed, sol, 1111 + i * 2) * 30;
    const p = at(start.x + Math.cos(angle) * radius, start.z + Math.sin(angle) * radius, 'foot');
    if (!p || Math.hypot(p.x - start.x, p.z - start.z) < 14 || rocks.some(r => Math.hypot(r.x - p.x, r.z - p.z) < 16)) continue;
    rocks.push({ x: round1(p.x), z: round1(p.z), by: null, loaded: false, kind: rocks.length >= targets - rules.expeditionPits ? 'pit' : 'rock' });
  }
  if (rocks.length < targets) return abort('UNAVAILABLE');
  const home = movement.roverPose?.() ?? { x: 0, z: 0, h: 0 };
  s.expedition = { id: `${s.generation}:${s.revision + 1}`, startedAt: s.interactionMs, deadline: s.interactionMs + rulesFor(s.difficulty).expeditionMs, members, rocks, start: { x: round1(start.x), z: round1(start.z), h: a0 + Math.PI }, home };
  movement.teleport?.('rover', s.expedition.start);
  log(s, 'Expedição com o rover', {}, 'Vocês foram para uma região coberta de neblina. Use o radar e ache os alvos!', 'info');
  return null;
}

/** Termina a expedição: leva todos de volta à base; no sucesso paga a missão e dá a recompensa. */
function endExpedition(s: GameplayState, movement: GameplayMovement, reason: 'done' | 'time' | 'night' | 'empty' | 'oxygen' | 'abort') {
  const x = s.expedition;
  if (!x) return;
  s.expedition = null;
  movement.fieldMode?.(false);
  movement.teleport?.('rover', x.home);
  members: for (const id of x.members) {
    const p = s.players[id];
    if (!p) continue;
    const ctx = movement.context(id);
    if (ctx?.driving) continue members; // vai junto com o rover
    const back = movement.spot ? movement.spot(x.home.x + 2.4, x.home.z, 'foot') : { x: x.home.x + 2.4, z: x.home.z };
    if (back) movement.teleport?.(id, { ...back, h: x.home.h });
  }
  if (reason === 'done') {
    const quality = clamp(1 - (s.interactionMs - x.startedAt) / (x.deadline - x.startedAt), 0, 1);
    const deltas: Record<string, number> = { research: soilReward(quality), morale: MISSIONS.soil_robot.morale ?? 0 };
    for (const [key, value] of Object.entries(MISSIONS.soil_robot.cost)) deltas[key] = -value;
    // previsão do tempo de amanhã (o que o radar do rover viu)
    const next = eventsForSol(s.mission.seed, s.mission.sol + 1, Object.keys(s.players).length, rulesFor(s.difficulty).majorBonus)[0];
    log(s, 'Reconhecimento com o rover', deltas,
      next ? `Todos os alvos foram coletados! Previsão do radar para amanhã: ${next.title}.` : 'Todos os alvos foram coletados! O radar não viu nada de perigoso para amanhã.', 'good');
    s.board.done.push('soil_robot');
  } else if (reason === 'oxygen') {
    // o oxigênio de alguém acabou: a missão falha e só volta no próximo Sol
    if (!s.board.done.includes('soil_robot')) s.board.done.push('soil_robot');
    log(s, 'Expedição fracassou', {}, 'O oxigênio de um astronauta acabou! Todos voltaram à base, mas o reconhecimento não pode ser refeito neste Sol.', 'bad');
  } else {
    log(s, 'Expedição encerrada', {}, reason === 'abort'
      ? 'A tripulação saiu da missão e voltou à base sem perder nada. Dá para tentar de novo.'
      : reason === 'night'
      ? 'Anoiteceu! Vocês voltaram à base sem perder nada. Tentem de novo amanhã.'
      : reason === 'empty' ? 'A tripulação voltou à base.' : 'O tempo acabou! Vocês voltaram à base sem perder nada. Dá para tentar de novo.', 'info');
  }
  outcome(s);
}

function expeditionCommand(s: GameplayState, actor: string, op: 'start' | 'pick' | 'load' | 'abort' | 'dig', rock: number | undefined, movement: GameplayMovement): GameErrorCode | null {
  if (op === 'start') return beginExpedition(s, actor, movement);
  const x = s.expedition;
  if (!x || !x.members.includes(actor)) return 'UNAVAILABLE';
  if (op === 'abort') { endExpedition(s, movement, 'abort'); return null; }
  const mine = x.rocks.find(r => r.by === actor && !r.loaded && r.kind !== 'pit');
  if (op === 'pick') {
    const i = Number(rock);
    const target = x.rocks[i];
    if (!Number.isInteger(i) || !target || target.by || target.loaded || mine || target.kind === 'pit') return 'UNAVAILABLE';
    if (movement.context(actor)?.driving || !movement.near(actor, `xrock:${i}`, 2.6)) return 'TOO_FAR';
    target.by = actor;
    return null;
  }
  if (op === 'dig') {
    const i = Number(rock);
    const pit = x.rocks[i];
    if (!Number.isInteger(i) || !pit || pit.kind !== 'pit' || pit.loaded) return 'UNAVAILABLE';
    if (movement.context(actor)?.driving || !movement.near(actor, `xrock:${i}`, 2.6)) return 'TOO_FAR';
    pit.loaded = true; // cavar o poço já conta como coletado
    if (x.rocks.every(r => r.loaded)) endExpedition(s, movement, 'done');
    return null;
  }
  // load: a pedra vai para o rover
  if (!mine) return 'UNAVAILABLE';
  if (!movement.near(actor, 'rover', 4)) return 'TOO_FAR';
  mine.by = null; mine.loaded = true;
  if (x.rocks.every(r => r.loaded)) endExpedition(s, movement, 'done');
  return null;
}

/** Duração da radiação alta, em horas de Marte (limites para não ficar curta nem eterna). */
export const RADIATION_HOURS = { min: 2, max: 8 } as const;
/** Dose por segundo de jogo para quem está fora (a pé) ou no rover durante a radiação alta. */
export const RADIATION_OUTSIDE_RATE = { foot: 0.05, rover: 0.02 } as const;

export function startRadiation(s: GameplayState, source: string, hours: number) {
  const h = clamp(Math.round(hours * rulesFor(s.difficulty).radiationHours), RADIATION_HOURS.min, RADIATION_HOURS.max);
  const until = s.elapsedMs + h * GAME_SOL_SECONDS * 1000 / 24;
  // dois eventos seguidos: vale o mais longo
  s.radiation = { until: Math.max(until, s.radiation?.until ?? 0), startedAt: s.radiation?.startedAt ?? s.elapsedMs, source };
  log(s, '☢️ Radiação ALTA lá fora', {}, `Fique dentro da base por cerca de ${h} horas de Marte. Quando o aviso ficar verde, é seguro sair.`, 'bad');
}

/** A cada tanto de dose acumulada a tripulação precisa de cuidados (aviso e moral). */
export const DOSE_ALERT_STEP = 25;

/** Soma dose de radiação na tripulação e avisa quando passa de cada faixa. */
export function addDose(s: GameplayState, mSv: number) {
  if (!(mSv > 0)) return;
  s.dose = (s.dose ?? 0) + mSv;
  const band = Math.floor(s.dose / DOSE_ALERT_STEP);
  if (band > (s.doseAlert ?? 0)) {
    s.doseAlert = band;
    log(s, `☢️ Dose da tripulação passou de ${band * DOSE_ALERT_STEP} mSv`, { morale: -6 },
      'Radiação demais cansa o corpo. Use a blindagem nas próximas tempestades solares!', 'bad');
  }
}

/** Chance de o dia ter um problema crítico na base. */
export const CRITICAL_CHANCE = 0.3;

/** Crítico do dia: começa na hora sorteada, cobra enquanto não é resolvido e piora no prazo. */
function stepCritical(s: GameplayState, dt: number) {
  const cr = s.critical;
  if (!cr) return;
  if (cr.sol !== s.mission.sol) { s.critical = null; return; }
  if (!cr.active) {
    if (s.elapsedMs < cr.at) return;
    cr.active = true;
    if (cr.kind === 'breach') {
      repairIntent(s.integrity, { op: 'damage', amount: 30 }, 'critical', s.elapsedMs / 1000, s.interactionMs);
      log(s, '⚠️ CRÍTICO: rombo na blindagem!', {}, 'Um impacto abriu um rombo no casco e o oxigênio está vazando. Conserte rápido!', 'bad');
    } else log(s, '⚠️ CRÍTICO: dutos de ar entupidos!', {}, 'A poeira entupiu a ventilação. Limpe os dutos antes que o ar da base fique ruim!', 'bad');
    return;
  }
  // rombo: resolvido quando a blindagem não tem mais fraturas
  if (cr.kind === 'breach') {
    if (!s.integrity.fractures.length) {
      s.critical = null;
      log(s, 'Rombo consertado a tempo!', {}, 'A blindagem foi selada.', 'good');
    }
    return;
  }
  // dutos entupidos: o ar piora a cada instante
  change(s.mission, { oxygen: -(30 / GAME_SOL_SECONDS) * dt });
  if (!cr.overdue && s.elapsedMs >= cr.deadline) {
    cr.overdue = true;
    repairIntent(s.integrity, { op: 'damage', amount: 15 }, 'critical', s.elapsedMs / 1000, s.interactionMs);
    log(s, 'Os dutos entupidos sobrecarregaram a base', { energy: -10 }, 'Sem ventilação, um sistema superaqueceu e rachou a blindagem.', 'bad');
  }
}

/** Ferramentas do painel de dev (só fora de produção): mexem no estado oficial da sala. */
function devCommand(s: GameplayState, actor: string, action: Extract<GamePayload,{type:'dev'}>['action'], id?: string): GameErrorCode | null {
  if (action === 'complete') {
    const def = MISSIONS[id as MissionId];
    if (!def) return 'INVALID_COMMAND';
    if (!s.board.done.includes(def.id)) s.board.done.push(def.id);
    if (!s.board.ids.includes(def.id)) s.board.ids.push(def.id);
    log(s, `${def.title} (dev)`, { ...(def.research > 0 ? { research: def.research } : {}), ...(def.reward ?? {}) });
  } else if (action === 'event') {
    if (!GAME_EVENTS.some((e) => e.id === id)) return 'INVALID_COMMAND';
    // força o novo evento: para o anterior (votação aberta, fila, clima e incidente da base)
    s.event = null; s.eventQueue = []; setPause(s, 'event', false); clearWeather(s); s.integrity.event = undefined;
    s.eventQueue.push({ id: id!, eid: `dev:${id}:${s.revision}`, sol: s.mission.sol });
  } else if (action === 'catastrophe') {
    if (!repairIntent(s.integrity, { op: 'event', event: id as never }, actor, s.elapsedMs / 1000, s.interactionMs, true)) return 'UNAVAILABLE';
  } else if (action === 'storm') {
    s.storm = s.storm > 0 ? 0 : 0.85;
    s.stormLeft = s.storm ? 150 : 0;
  } else if (action === 'radiation') {
    clearWeather(s); s.event = null; s.eventQueue = []; setPause(s, 'event', false);
    startRadiation(s, 'Teste (dev)', Number(id) || 3);
  } else if (action === 'critical') {
    const kind = id === 'breach' ? 'breach' : 'ducts';
    const solMs = GAME_SOL_SECONDS * 1000;
    s.critical = { kind, sol: s.mission.sol, at: s.elapsedMs, active: false, deadline: s.elapsedMs + solMs * (4 / 24), overdue: false };
  } else if (action === 'refill') {
    for (const r of Object.values(s.mission.resources)) r.value = r.max;
  } else if (action === 'next_sol') {
    // vai para as 6h do próximo Sol (a virada do dia acontece no próximo passo)
    const hours = GAME_START_HOUR + s.elapsedMs * 24 / (GAME_SOL_SECONDS * 1000);
    const next = (Math.floor(hours / 24) + 1) * 24 + 6;
    s.elapsedMs = (next - GAME_START_HOUR) * GAME_SOL_SECONDS * 1000 / 24;
  }
  return null;
}

/** Fixed real step, supplied by the owner. No wall clock is consulted by domain rules. */
export function stepGameplay(s: GameplayState, realMs: number, movement: GameplayMovement, base: string): boolean {
  if (!s.started || s.pauses.includes('empty') || s.pauses.includes('ended')) return false;
  s.interactionMs += realMs;
  if (s.expedition) {
    const x = s.expedition;
    x.members = x.members.filter(id => s.players[id]);
    if (!x.members.length) endExpedition(s, movement, 'empty');
    else if (s.interactionMs >= x.deadline) endExpedition(s, movement, 'time');
    else if (!roverWindowOpen(simulationClock(s.elapsedMs).hour)) endExpedition(s, movement, 'night');
  }
  if (s.event && !s.event.result) {
    s.event.remainingMs = Math.max(0,s.event.remainingMs-realMs);
    if (s.event.remainingMs <= 0) {
      const def = GAME_EVENTS.find(e=>e.id === s.event!.id)!;
      // Tempo esgotado: vale a maioria dos votos dados; sem votos, o jogo sorteia.
      const votes = Object.keys(s.event.votes).length;
      resolveEvent(s,votes ? tally(s.event.votes,def.choices.length,s.mission.seed,s.event.sol) : randomChoice(def.choices.length,s.mission.seed,s.event.sol,hashString(s.event.eid)%97));
    }
  }
  for (const a of Object.values(s.attempts)) {
    if (a.expiresAt < s.interactionMs || !s.players[a.player]) { delete s.attempts[a.id]; if (s.players[a.player]) s.players[a.player]!.carrying=0; continue; }
    if (a.quality !== null) continue;
    a.elapsed += realMs/1000;
    if (a.kind === 'drill') a.drill = drillStep(a.drill,profileFor(base),a.holding,realMs/1000);
    if (a.kind === 'greenhouse' && a.holding) {
      const gained = Math.min(1.41-a.moisture,0.24*realMs/1000);
      a.moisture += gained; a.water += gained;
    }
    if (a.kind === 'upload' && a.holding && a.file >= 0 && a.elapsed >= a.lastAction) {
      a.transmitted += realMs/1000;
      if (a.transmitted >= 5) { a.removed.push(a.file); a.file = -1; a.transmitted = 0; a.holding = false; }
    }
  }
  if (!s.pauses.length) {
    const dt = realMs/1000*s.scale;
    s.elapsedMs += realMs*s.scale;
    const c = simulationClock(s.elapsedMs);
    const oldWind = s.integrity.wind;
    tickIntegrity(s.integrity,s.elapsedMs/1000,s.interactionMs,c.hour);
    if (s.integrity.wind > oldWind) s.solar = s.solar.map(n=>Math.max(0,n-1));
    const credits = s.integrity.credits;
    const applied = s.mission.eventCredits ?? {research:0,supplies:0};
    if (credits.research > applied.research || credits.supplies > applied.supplies) {
      // descobertas e cargas da base viram suprimento (pesquisa só vem das missões de pesquisa)
      log(s,'Suprimentos e descobertas',{supplies:Math.max(0,credits.supplies-applied.supplies)+Math.max(0,credits.research-applied.research)});
      s.mission.eventCredits = {...credits};
    }
    s.solar = s.solar.map((n,i)=>dustStep(n,panelDustRate(s.mission.seed,i),dt,s.storm));
    const incident = s.integrity.event;
    const incidentStorm = incident?.id === 'dust_storm' && s.elapsedMs/1000-incident.start >= 15;
    if (s.stormLeft > 0) { s.stormLeft = Math.max(0,s.stormLeft-dt); if (!s.stormLeft) s.storm=0; }
    s.storm = incidentStorm ? 0.85 : s.stormLeft ? s.storm : 0;
    const gen = solarGeneration(s.solar,1-c.night,s.storm);
    const battery = s.mission.resources.energy;
    battery.value = gridStep(battery.value,battery.max,gen,dt,c.night).battery;
    if (armorValue(s.integrity) <= 25) battery.value = Math.max(0,battery.value-gridLoad()*0.25*dt);
    // consumo diário cresce com a tripulação: cada astronauta respira, come e bebe
    const crew = Math.max(1, Object.keys(s.players).length);
    change(s.mission,{
      oxygen:(((filterClogged(s.care.filter,c.sol) || battery.value<=0 ? 0 : OXYGEN_PLANT.perSol)-(OXYGEN_PLANT.crewPerSol+DAILY_OXYGEN_PER_PLAYER*(crew-1))*rulesFor(s.difficulty).use)/GAME_SOL_SECONDS-leakRate(s.integrity))*dt,
      supplies:-DAILY_SUPPLIES_PER_PLAYER*crew*rulesFor(s.difficulty).use/GAME_SOL_SECONDS*dt,
    });
    // radiação acumulada pesa: cada faixa de 25 mSv gasta 4% mais ar e abate o ânimo da tripulação
    const doseLevel = Math.floor((s.dose ?? 0) / DOSE_ALERT_STEP);
    if (doseLevel > 0) {
      change(s.mission, { oxygen: -(Math.min(0.4, doseLevel * 0.04) * (OXYGEN_PLANT.crewPerSol + DAILY_OXYGEN_PER_PLAYER * (crew - 1)) / GAME_SOL_SECONDS) * dt });
      s.moraleDrain = (s.moraleDrain ?? 0) + doseLevel * 0.6 * dt / GAME_SOL_SECONDS;
      if (s.moraleDrain >= 1) { const n = Math.floor(s.moraleDrain); s.moraleDrain -= n; change(s.mission, { morale: -n }); }
    }
    s.crops.forEach((v,i)=> {
      if (v>0 && v<3) { s.growth[i]=(s.growth[i]??0)+dt; if(s.growth[i]!>=1500) {s.growth[i]!-=1500;s.crops[i]=v+1;} }
    });
    if (c.sol !== s.board.sol) {
      s.mission = runCommand(s.mission,{type:'end_sol',realtime:true}).state;
      s.mission.sol = c.sol;
      for (const a of Object.values(s.attempts)) { if (s.players[a.player]) s.players[a.player]!.carrying=0; }
      s.attempts = {};
      s.board = {sol:c.sol,ids:missionsForSol(s.mission.seed,c.sol,Object.keys(s.players).length),done:[],garden:s.board.garden,players:Object.keys(s.players).length};
      // crítico do dia: 30% dos Sóis, numa hora sorteada entre 7h e 15h
      s.critical = null;
      if (seeded(s.mission.seed, c.sol, 777) < CRITICAL_CHANCE) {
        const kind = seeded(s.mission.seed, c.sol, 778) < 0.5 ? 'breach' : 'ducts';
        const hour = 7 + seeded(s.mission.seed, c.sol, 779) * 8;
        const solMs = GAME_SOL_SECONDS * 1000;
        const at = ((c.sol - 1) * 24 + hour - GAME_START_HOUR) * solMs / 24;
        s.critical = { kind, sol: c.sol, at, active: false, deadline: at + solMs * (4 / 24), overdue: false };
      }
      // o que não foi sorteado hoje não cobra cuidado: o filtro e a horta só pesam no dia da missão
      if (!s.board.ids.includes('air_filter')) s.care.filter = c.sol;
      if (!s.board.ids.includes('garden_care'))
        s.crops.forEach((v,i)=>{ if (v > 0) { s.care.crops[i] = Math.max(s.care.crops[i] ?? 0, c.sol - 1); s.care.needsCare[i] = false; } });
      s.quotas = {moxie:0,water:0,bench:0}; s.rocks=[];
      const grace = Object.keys(s.players).length >= 3 ? 0 : 1;
      s.crops.forEach((v,i)=> {if(v>0 && s.care.crops[i]! < c.sol-1-grace){s.crops[i]=0;s.growth[i]=0;}});
      if (!s.eventSols.includes(c.sol)) {
        s.eventSols.push(c.sol);
        s.eventQueue.push(...eventsForSol(s.mission.seed,c.sol,Object.keys(s.players).length,rulesFor(s.difficulty).majorBonus).map(d=>({id:d.id,eid:`${c.sol}:${d.id}`,sol:c.sol})));
      }
    }
    stepCritical(s, dt);
    if (s.radiation && s.elapsedMs >= s.radiation.until) {
      s.radiation = null;
      log(s, '✅ Radiação segura', {}, 'A radiação baixou. Já é seguro sair da base e fazer os reparos!', 'good');
    }
    // radiação de fundo de Marte, medida pelo RAD do Curiosity: 0,64 mSv por dia
    addDose(s, RADIATION.marsSurfacePerDay * dt / GAME_SOL_SECONDS);
    for (const pending of [...s.pending]) {
      pending.remainingMs -= realMs;
      if (pending.remainingMs <= 0) {log(s,'Confirmação da Terra',{research:pending.research});s.pending=s.pending.filter(p=>p!==pending);}
    }
    for (const p of Object.values(s.players).sort((a,b)=>a.id.localeCompare(b.id))) {
      const ctx = movement.context(p.id);
      if (!ctx || !p.ready || !ctx.ready) continue;
      p.inside = ctx.inside || ctx.sheltered; p.driving=ctx.driving;
      if (s.radiation && !p.inside) addDose(s, (ctx.driving ? RADIATION_OUTSIDE_RATE.rover : RADIATION_OUTSIDE_RATE.foot) * rulesFor(s.difficulty).dose * dt);
      const protectedByAttempt = Object.values(s.attempts).some(a=>a.participants.includes(p.id) && a.quality===null);
      p.cold = c.night > 0.6 && !p.inside && !ctx.driving && !protectedByAttempt;
      if (protectedByAttempt || p.rescueUntil > s.interactionMs) continue;
      // dentro da base ou do rover o tanque do traje recarrega
      if (p.inside || ctx.driving) {
        const cost = Math.min(10*dt,100-p.tank,s.mission.resources.oxygen.value/0.05);
        p.tank+=cost; change(s.mission,{oxygen:-cost*0.05}); p.exposure=0;
      } else {
        // na expedição, quanto mais longe do rover (e mais perto da tempestade), mais rápido o ar acaba
        let far = 1;
        if (s.expedition?.members.includes(p.id)) {
          const car = movement.roverPose?.();
          if (car) far = 1 + Math.min(Math.hypot(ctx.x - car.x, ctx.z - car.z), 50) / 8;
        }
        p.tank=Math.max(0,p.tank-0.8*(1+s.storm*0.5)*far*rulesFor(s.difficulty).suitDrain*dt); p.exposure=p.cold ? p.exposure+dt : 0;
      }
      if (p.tank<=0 && s.expedition?.members.includes(p.id)) {
        endExpedition(s, movement, 'oxygen');
        for (const m of Object.values(s.players)) m.tank = Math.max(m.tank, 40);
        continue;
      }
      if (p.tank<=0 || p.exposure>=6) {
        const cold = p.exposure>=6;
        log(s,cold?'Socorro por hipotermia':'Socorro por falta de oxigênio',{oxygen:cold?-4:-5},'Astronauta socorrido na enfermaria.','bad');
        p.tank=cold?p.tank:25; p.exposure=0; p.cold=false; p.rescued++; p.rescueUntil=s.interactionMs+700;
        movement.rescue(p.id);
      }
      outcome(s);
      if (s.pauses.includes('ended')) break;
    }
    outcome(s);
  }
  updateRestrictions(s,movement); s.revision++;
  return true;
}
/** Repairs share the same transaction/revision and authoritative distance checks. */
export function applyGameplayRepair(s: GameplayState, actor: string, intent: RepairIntent, movement: GameplayMovement, dev: boolean): boolean {
  if (!s.players[actor]?.ready || s.mission.status !== 'playing' || s.pauses.some(p=>p !== 'repair')) return false;
  if (['damage','event','emergency','stop','restart'].includes(intent.op) && !dev) return false;
  if ('fracture' in intent && !movement.near(actor,`repair:${intent.fracture}`,3.5)) return false;
  // o reparo é feito LÁ FORA: dentro da base, com radiação alta ou de noite (frio) não dá
  if ('fracture' in intent && intent.op !== 'release') {
    const ctx = movement.context(actor);
    if (!ctx || ctx.inside || ctx.sheltered || ctx.driving) return false;
    if (intent.op === 'reserve' && (s.radiation || simulationClock(s.elapsedMs).night > NIGHT_LIMIT)) return false;
  }
  if (intent.op === 'reserve' && Object.values(s.attempts).some(a=>a.participants.includes(actor))) return false;
  if (!repairIntent(s.integrity,intent,actor,s.elapsedMs/1000,s.interactionMs,dev)) return false;
  setPause(s,'repair',Object.keys(s.players).length === 1 && s.integrity.fractures.some(f=>Boolean(f.owner)));
  outcome(s); updateRestrictions(s,movement); s.revision++;
  return true;
}

export function cloneGameplay<T>(value: T): T {
  if(Array.isArray(value)) return value.map(cloneGameplay) as T;
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,cloneGameplay(v)])) as T;
  return value;
}
