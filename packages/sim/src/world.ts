import {
  armorValue, GAMEPLAY_VERSION, GAME_SOL_SECONDS, GAME_START_HOUR, leakRate,
  newIntegrity, repairIntent, tickIntegrity,
  type ActivityAction, type ActivityAttempt, type ActivityKind, type GameConfirmation,
  type GameErrorCode, type GamePayload, type GameplayMovement, type GameplayState,
  type PauseReason, type RepairIntent,
} from '@mars/shared';
import { createMission, change, pushLog } from './state';
import { checkAction, checkOutcome, runCommand } from './engine';
import { dustStep, filterClogged, gridLoad, gridStep, hashString, OXYGEN_PLANT, panelDustRate, seeded, solarGeneration } from './operations';
import { gardenComplete, GARDEN_OXYGEN_BONUS, MISSIONS, missionBlock, missionsForSol, soilReward, soilSamples, type MissionId } from './missions';
import { collectSample, drillStep, initialDrill, profileFor, targetLayer } from './drilling';
import { inZone, pingPong, soilQuality, stationQuality, zoneFor } from './scoring';
import { eventsForSol, GAME_EVENTS, resolveChoice } from './eventRules';
import { modeFor, pickDecider, tally } from './voting';

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
    eventQueue: [], event: null, eventSols: [1], pending: [], players: {}, attempts: {},
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
  if (kind === 'soil') return 'soil';
  if (kind === 'upload') return 'station:upload';
  if (kind === 'greenhouse') return 'garden';
  return `${kind}:${target}`;
}
function updateRestrictions(s: GameplayState, movement: GameplayMovement) {
  for (const p of Object.values(s.players)) {
    p.blocked = !p.ready || s.pauses.includes('ended') || Boolean(s.event && !s.event.result) ||
      p.rescueUntil > s.interactionMs || Object.values(s.attempts).some(a => a.participants.includes(p.id) && a.quality === null);
    movement.restrict(p.id, p.blocked, p.cold);
  }
}
function resolveEvent(s: GameplayState, choice: number) {
  const e = s.event;
  if (!e || e.result) return;
  const def = GAME_EVENTS.find(d => d.id === e.id);
  const option = def?.choices[choice];
  if (!option) return;
  const roll = seeded(s.mission.seed, hashString(e.eid), 771);
  const resolved = resolveChoice(option, roll);
  const deltas = { ...resolved.deltas };
  if (armorValue(s.integrity) <= 0)
    for (const key of ['energy','supplies','oxygen'] as const) if ((deltas[key] ?? 0) < 0) deltas[key] = deltas[key]! * 2;
  if (deltas.armor) repairIntent(s.integrity, { op: 'damage', amount: -deltas.armor }, 'event', s.elapsedMs / 1000, s.interactionMs);
  delete deltas.armor;
  log(s, def!.title, deltas, resolved.text, resolved.tone);
  for (const fx of resolved.effects ?? []) {
    if (fx.type === 'storm') { s.storm = fx.strength; s.stormLeft = 150; }
    if (fx.type === 'storm_end') { s.storm = 0; s.stormLeft = 0; }
    if (fx.type === 'dust') s.solar = s.solar.map(v => clamp(v + fx.amount * 4, 0, 4));
    if (fx.type === 'clean_panels') s.solar.fill(0);
    if (fx.type === 'clog_filter') s.care.filter = Math.max(0, s.mission.sol - 2);
    if (fx.type === 'wilt_crop') { const i = s.crops.findIndex(v => v > 0); if (i >= 0) s.crops[i] = 0; }
  }
  e.result = { choice, outcome: { tone: resolved.tone, text: resolved.text, deltas } };
  s.eventQueue = s.eventQueue.filter(q => q.eid !== e.eid);
  setPause(s, 'event', false);
  outcome(s);
}
function startAttempt(s: GameplayState, player: string, kind: ActivityKind, target: string, movement: GameplayMovement): ActivityAttempt | GameErrorCode {
  if (Object.values(s.attempts).some(a => a.participants.includes(player))) return 'BUSY';
  const exclusive = `${kind}:${target}`;
  if (Object.values(s.attempts).some(a => `${a.kind}:${a.target}` === exclusive)) return 'BUSY';
  const mission = kind === 'station' ? target : kind === 'drill' ? 'drill' : kind === 'soil' ? 'soil_robot' : null;
  if (mission) {
    if (!s.board.ids.includes(mission) || s.board.done.includes(mission)) return 'UNAVAILABLE';
    if (missionCosts(s, mission)) return 'INSUFFICIENT_RESOURCES';
    if (s.mission.resources.armor.value <= 0) return 'UNAVAILABLE';
  }
  if ((kind === 'solar' && (!/^\d+$/.test(target) || Number(target) >= s.solar.length)) ||
      (kind === 'filter' && (!['0','1'].includes(target) || s.care.filter >= s.mission.sol)) ||
      (kind === 'greenhouse' && !s.crops.some((v,i) => v > 0 && (s.care.needsCare[i] || s.care.crops[i]! < s.mission.sol))) ||
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
  } else return false;
  a.lastAction = time;
  return true;
}
function finish(s: GameplayState, a: ActivityAttempt): GameErrorCode | null {
  if (a.kind === 'station' && a.marks.length !== 3 ||
      a.kind === 'drill' && a.quality === null ||
      a.kind === 'soil' && a.samples.length !== 6 ||
      a.kind === 'solar' && a.coverage.length < 253 ||
      a.kind === 'filter' && a.removed.length !== a.challenge.debris.length ||
      a.kind === 'greenhouse' && a.moisture < 1.41 - 1e-6 ||
      a.kind === 'upload' && a.removed.length !== a.challenge.files.length) return 'INVALID_SEQUENCE';
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
    const research = a.kind === 'drill' ? a.quality! : def.research + Math.round(stationQuality(a.marks.filter(Boolean).length,3));
    const deltas: Record<string, number> = {};
    for (const [key,value] of Object.entries(def.cost)) deltas[key] = -value;
    if (def.morale) deltas.morale = def.morale;
    if (mission === 'antenna_calibration') s.pending.push({ id:a.id, research, remainingMs: 20000 });
    else deltas.research = research;
    log(s, def.title, deltas);
    s.board.done.push(mission);
  } else if (a.kind === 'solar') {
    s.solar[Number(a.target)] = 0; log(s,'Painel solar limpo',{});
  } else if (a.kind === 'filter') {
    s.care.filter = s.mission.sol; log(s,'Filtro de ar trocado',{});
  } else if (a.kind === 'greenhouse') {
    const cost = Math.max(2, Math.ceil(Math.round(a.water * 10) / 4));
    if (!sufficient(s,{supplies:cost})) return 'INSUFFICIENT_RESOURCES';
    log(s,'Cuidado da horta',{ supplies:-cost });
    s.crops.forEach((v,i)=> { if (v > 0) { s.care.crops[i] = s.mission.sol; s.care.needsCare[i] = false; } });
    if (s.board.garden < s.mission.sol && gardenComplete(s.crops,s.care.crops,s.mission.sol)) {
      s.board.garden = s.mission.sol; log(s,'Horta em dia',{ oxygen:GARDEN_OXYGEN_BONUS, research:1 });
    }
  } else if (a.kind === 'upload') {
    s.mission.secured = Math.max(s.mission.secured, Math.min(a.batch,s.mission.research));
    log(s,'Dados enviados à Terra',{});
  }
  delete s.attempts[a.id];
  return null;
}
export function applyGameplayCommand(previous: GameplayState, actor: string, payload: GamePayload, movement: GameplayMovement, base: string, coordinator: boolean): { state: GameplayState; code?: GameErrorCode; attempt?: ActivityAttempt } {
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
          const error = finish(s,a); if (error) return fail(error);
        }
      }
    } else if (payload.type === 'interact') {
      const kind = payload.kind, index = Number(payload.target);
      const target = kind === 'moxie' || kind === 'water' ? kind : kind === 'deliver' ? 'delivery' : kind === 'harvest' ? `crop:${payload.target}` : `${kind === 'plant' ? 'crop' : kind}:${payload.target}`;
      if (!movement.near(actor,target,4.5)) return fail('TOO_FAR');
      if (kind === 'moxie' || kind === 'water' || kind === 'bench') {
        if (s.quotas[kind] >= 3) return fail('UNAVAILABLE');
        const cost = kind === 'bench' ? 4 : 2;
        if (!sufficient(s,{energy:cost})) return fail('INSUFFICIENT_RESOURCES');
        s.quotas[kind]++;
        log(s,kind === 'moxie' ? 'Usina MOXIE' : kind === 'water' ? 'Extração de água' : 'Bancada de ferramentas', {energy:-cost, ...(kind === 'moxie' ? {oxygen:6} : {supplies: kind === 'bench' ? 4 : 6})});
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
        log(s,'Amostra de rocha',science ? {research:1} : {supplies:3});
      } else if (kind === 'deliver') {
        const a = Object.values(s.attempts).find(a=>a.player === actor && a.kind === 'soil' && a.quality !== null);
        if (!a || !s.players[actor]!.carrying || s.board.done.includes('soil_robot')) return fail('UNAVAILABLE');
        if (missionCosts(s,'soil_robot')) return fail('INSUFFICIENT_RESOURCES');
        const deltas: Record<string,number> = {research:soilReward(a.quality!),morale:3};
        for (const [key,value] of Object.entries(MISSIONS.soil_robot.cost)) deltas[key] = -value;
        log(s,MISSIONS.soil_robot.title,deltas); s.board.done.push('soil_robot');
        s.players[actor]!.carrying = 0; delete s.attempts[a.id];
      }
    } else if (payload.type === 'event:open') {
      if (s.event && !s.event.result) return fail('BUSY');
      const q = s.eventQueue.find(e => e.eid === payload.eid);
      if (!q) return fail('UNAVAILABLE');
      const voters = Object.values(s.players).filter(p=>p.ready).map(({id,name})=>({id,name}));
      const mode = modeFor(voters.length);
      s.event = {...q, mode, voters, votes:{}, deciderId:mode === 'vote' ? null : pickDecider(voters.map(p=>p.id),s.mission.seed,q.sol),remainingMs:30000,result:null};
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

/** Fixed real step, supplied by the owner. No wall clock is consulted by domain rules. */
export function stepGameplay(s: GameplayState, realMs: number, movement: GameplayMovement, base: string): boolean {
  if (!s.started || s.pauses.includes('empty') || s.pauses.includes('ended')) return false;
  s.interactionMs += realMs;
  if (s.event && !s.event.result) {
    s.event.remainingMs = Math.max(0,s.event.remainingMs-realMs);
    if (s.event.remainingMs <= 0) {
      const def = GAME_EVENTS.find(e=>e.id === s.event!.id)!;
      resolveEvent(s,s.event.mode === 'vote' ? tally(s.event.votes,def.choices.length,s.mission.seed,s.event.sol) : 0);
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
      log(s,'Suprimentos e descobertas',{research:Math.max(0,credits.research-applied.research),supplies:Math.max(0,credits.supplies-applied.supplies)});
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
    change(s.mission,{oxygen:(((filterClogged(s.care.filter,c.sol) || battery.value<=0 ? 0 : OXYGEN_PLANT.perSol)-OXYGEN_PLANT.crewPerSol)/600-leakRate(s.integrity))*dt});
    s.crops.forEach((v,i)=> {
      if (v>0 && v<3) { s.growth[i]=(s.growth[i]??0)+dt; if(s.growth[i]!>=1500) {s.growth[i]!-=1500;s.crops[i]=v+1;} }
    });
    if (c.sol !== s.board.sol) {
      s.mission = runCommand(s.mission,{type:'end_sol',realtime:true}).state;
      s.mission.sol = c.sol;
      for (const a of Object.values(s.attempts)) { if (s.players[a.player]) s.players[a.player]!.carrying=0; }
      s.attempts = {};
      s.board = {sol:c.sol,ids:missionsForSol(s.mission.seed,c.sol,Object.keys(s.players).length),done:[],garden:s.board.garden,players:Object.keys(s.players).length};
      s.quotas = {moxie:0,water:0,bench:0}; s.rocks=[];
      const grace = Object.keys(s.players).length >= 3 ? 0 : 1;
      s.crops.forEach((v,i)=> {if(v>0 && s.care.crops[i]! < c.sol-1-grace){s.crops[i]=0;s.growth[i]=0;}});
      if (!s.eventSols.includes(c.sol)) {
        s.eventSols.push(c.sol);
        s.eventQueue.push(...eventsForSol(s.mission.seed,c.sol).map(d=>({id:d.id,eid:`${c.sol}:${d.id}`,sol:c.sol})));
      }
    }
    for (const pending of [...s.pending]) {
      pending.remainingMs -= realMs;
      if (pending.remainingMs <= 0) {log(s,'Confirmação da Terra',{research:pending.research});s.pending=s.pending.filter(p=>p!==pending);}
    }
    for (const p of Object.values(s.players).sort((a,b)=>a.id.localeCompare(b.id))) {
      const ctx = movement.context(p.id);
      if (!ctx || !p.ready || !ctx.ready) continue;
      p.inside = ctx.inside || ctx.sheltered; p.driving=ctx.driving;
      const protectedByAttempt = Object.values(s.attempts).some(a=>a.participants.includes(p.id) && a.quality===null);
      p.cold = c.night > 0.6 && !p.inside && !protectedByAttempt;
      if (protectedByAttempt || p.rescueUntil > s.interactionMs) continue;
      if (p.inside) {
        const cost = Math.min(10*dt,100-p.tank,s.mission.resources.oxygen.value/0.05);
        p.tank+=cost; change(s.mission,{oxygen:-cost*0.05}); p.exposure=0;
      } else { p.tank=Math.max(0,p.tank-0.8*(1+s.storm*0.5)*dt); p.exposure=p.cold ? p.exposure+dt : 0; }
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
