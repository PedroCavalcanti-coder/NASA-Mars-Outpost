import { armorValue, restoreIntegrity, WORLD_SAVE_MAX_BYTES, type GameplayState, type WorldSaveV3 } from '@mars/shared';
import { INITIAL, LOG_LIMIT, RESEARCH_GOAL } from './balance';
import { cloneGameplay, createGameplay, simulationClock } from './world';
import { MISSIONS, missionsForSol } from './missions';
import { GAME_EVENTS } from './eventRules';

const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string,any> : {};
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min,Math.min(max,v)) : fallback;
const list = (v: unknown, max: number, top: number, integers = false): number[] => Array.isArray(v) ? v.slice(0,max).map(n=> { const v=number(n,0,0,top); return integers?Math.floor(v):v; }) : [];
/** Never trusts campaign fields spread from JSON. Each retained field is bounded and rebuilt. */
export function migrateWorldSave(raw: unknown, seed: number, generation: string, defaults: {solar: number[]; crops: number[]} = {solar:[],crops:[]}): {state: GameplayState; corrections: string[]} {
  const r = object(raw), source = r.v === 3 ? object(r.simulation) : r;
  const oldMission = object(r.v === 3 ? source.mission : r.mission);
  const state = createGameplay(number(oldMission.seed,seed,0,4294967295),generation,defaults.solar,defaults.crops);
  const corrections: string[]=[];
  state.elapsedMs = number(source.elapsedMs,0,0,600000*15);
  const sol = simulationClock(state.elapsedMs).sol;
  const mission = state.mission;
  mission.sol=sol;
  mission.rng=number(oldMission.rng,mission.seed,0,4294967295);
  const resources = object(oldMission.resources);
  for (const id of ['energy','oxygen','supplies'] as const) {
    const saved = object(resources[id]);
    const fallback = INITIAL.resources[id].value;
    mission.resources[id]={value:number(saved.value,fallback,0,INITIAL.resources[id].max),max:INITIAL.resources[id].max};
    if (saved.value !== undefined && saved.value !== mission.resources[id].value) corrections.push(`resources.${id}`);
  }
  mission.research=number(oldMission.research,0,0,RESEARCH_GOAL);
  mission.secured=number(oldMission.secured,0,0,mission.research);
  mission.morale=number(oldMission.morale,80,0,100);
  mission.actionsLeft=Math.floor(number(oldMission.actionsLeft,3,0,3));
  mission.solarEfficiency=number(oldMission.solarEfficiency,1,0,1);
  const facilities=object(oldMission.facilities);
  for(const key of ['solar','greenhouse','lab'] as const) mission.facilities[key]=Math.floor(number(facilities[key],INITIAL.facilities[key],1,{solar:6,greenhouse:4,lab:3}[key]));
  mission.log=Array.isArray(oldMission.log) ? oldMission.log.slice(0,LOG_LIMIT).flatMap((entry:unknown)=> {
    const e=object(entry);
    if (!Number.isInteger(e.id) || !Number.isInteger(e.sol) || e.id<1 || e.sol<1 || e.sol>sol || typeof e.title!=='string' || typeof e.text!=='string' || !['good','bad','info'].includes(e.tone)) return [];
    const deltas: Record<string,number>={};
    for(const [k,v] of Object.entries(object(e.deltas))) if(['energy','oxygen','supplies','armor','research','morale'].includes(k) && typeof v==='number' && Number.isFinite(v)) deltas[k]=number(v,0,-1000,1000);
    return [{id:e.id,sol:e.sol,title:e.title.slice(0,80),text:e.text.slice(0,240),tone:e.tone,deltas}];
  }) : [];
  mission.log=mission.log.filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i).sort((a,b)=>b.id-a.id);
  mission.nextLogId=Math.max(0,...mission.log.map(e=>e.id))+1;
  if (oldMission.status === 'won' && mission.research>=100) mission.status='won';
  else if (oldMission.status === 'lost' && ['oxygen','deadline','morale'].includes(oldMission.lossReason)) {mission.status='lost';mission.lossReason=oldMission.lossReason;}
  if (oldMission.sol !== sol) corrections.push('mission.sol');
  state.integrity=restoreIntegrity(source.integrity) ?? state.integrity;
  // Legacy cumulative incident credits have already been paid. Never replay them.
  state.integrity.credits={research:number(state.integrity.credits?.research,0,0,10000),supplies:number(state.integrity.credits?.supplies,0,0,10000)};
  state.integrity.seed=number(state.integrity.seed,seed,0,4294967295);
  state.integrity.seq=number(state.integrity.seq,0,0,100000);
  state.integrity.positives=number(state.integrity.positives,0,0,100000);
  state.integrity.wind=number(state.integrity.wind,0,0,100000);
  state.integrity.nextAt=number(state.integrity.nextAt,Infinity,0,1e9);
  if(state.integrity.event) {
    state.integrity.event.start=number(state.integrity.event.start,state.elapsedMs/1000,0,state.elapsedMs/1000);
    state.integrity.event.seq=number(state.integrity.event.seq,0,0,100000);
    state.integrity.event.applied=state.integrity.event.applied === true;
  }
  state.integrity.fractures.forEach(f=> {f.tutorial=f.tutorial===true;f.plate=f.plate===true;delete f.stepAt;});
  mission.eventCredits={...state.integrity.credits};
  mission.resources.armor.value=armorValue(state.integrity);
  state.wind=state.integrity.wind;
  state.solar=Array.isArray(source.solar) ? list(source.solar,defaults.solar.length||32,4) : defaults.solar;
  while(state.solar.length<defaults.solar.length) state.solar.push(0);
  state.crops=Array.isArray(source.crops) && source.crops.length ? list(source.crops,defaults.crops.length||64,3,true) : [...defaults.crops];
  while(state.crops.length<defaults.crops.length) state.crops.push(defaults.crops[state.crops.length]!);
  state.growth=state.crops.map((_,i)=>number(object(source).growth?.[i],0,0,1499.999));
  const care=object(source.care);
  state.care={crops:state.crops.map((_,i)=>Math.floor(number(care.crops?.[i],sol-1,0,sol))),filter:Math.floor(number(care.filter,sol-1,0,sol)),needsCare:state.crops.map((n,i)=>typeof care.needsCare?.[i]==='boolean'?care.needsCare[i]:n>0)};
  const board=object(source.board), sameSol=board.sol===sol;
  state.board={sol,ids:missionsForSol(mission.seed,sol,Math.floor(number(board.players,1,1,4))),done:sameSol && Array.isArray(board.done) ? [...new Set<string>(board.done.filter((id:unknown)=>typeof id==='string' && id in MISSIONS))]:[],garden:Math.floor(number(board.garden,0,0,sol)),players:Math.floor(number(board.players,1,1,4))};
  if(!sameSol && board.sol!==undefined) corrections.push('board.sol');
  const quotas=object(source.quotas);
  state.quotas={moxie:sameSol?Math.floor(number(quotas.moxie,0,0,3)):0,water:sameSol?Math.floor(number(quotas.water,0,0,3)):0,bench:sameSol?Math.floor(number(quotas.bench,0,0,3)):0};
  state.rocks=sameSol?list(source.rocks,4,3,true):[];
  state.scale=source.scale===2 || source.scale===3 ? source.scale : source.timeScale===2 || source.timeScale===3 ? source.timeScale : 1;
  if(source.paused===true || Array.isArray(source.pauses) && source.pauses.includes('manual')) state.pauses.push('manual');
  state.started=source.started===true;
  state.storm=number(source.storm,0,0,1);state.stormLeft=number(source.stormLeft,0,0,600);
  state.pending=Array.isArray(source.pending)?source.pending.slice(0,16).flatMap((p:unknown)=> {
    const entry=object(p);if(typeof entry.id!=='string'||entry.id.length>160||!Number.isFinite(entry.research)||!Number.isFinite(entry.remainingMs))return [];
    return [{id:entry.id,research:number(entry.research,0,0,4),remainingMs:number(entry.remainingMs,0,0,20000)}];
  }):[];
  state.eventSols=list(source.eventSols,16,16,true).filter(n=>n>=1&&n<=sol);
  if(!state.eventSols.includes(sol)) state.eventSols.push(sol);
  state.eventQueue=Array.isArray(source.eventQueue)?source.eventQueue.slice(0,32).flatMap((q:unknown)=> {
    const e=object(q);if(!GAME_EVENTS.some(d=>d.id===e.id)||!Number.isInteger(e.sol)||e.sol<1||e.sol>sol)return [];
    return [{id:e.id,sol:e.sol,eid:`${e.sol}:${e.id}`}];
  }):[];
  // An interrupted decision is offered again with a fresh electorate; no result is replayed.
  state.event=null;state.attempts={};state.players={};state.interactionMs=0;
  if(mission.status!=='playing') state.pauses.push('ended');
  return {state,corrections};
}
export function createWorldSave(state: GameplayState, vehicle?: WorldSaveV3['vehicle']): WorldSaveV3 {
  const simulation=cloneGameplay(state);
  simulation.players={};simulation.attempts={};
  for(const f of simulation.integrity.fractures){delete f.owner;delete f.leaseUntil;delete f.stepAt;}
  return {v:3,simulation,elapsedMs:state.elapsedMs,solar:[...state.solar],crops:[...state.crops],integrity:simulation.integrity,vehicle,care:simulation.care,board:simulation.board,timeScale:state.scale,paused:state.pauses.includes('manual'),mission:simulation.mission};
}
export function validSaveSize(raw: unknown): boolean {
  try {return Array.from(JSON.stringify(raw)).reduce((n,c)=>n+(c.codePointAt(0)!>65535?4:c.charCodeAt(0)>2047?3:c.charCodeAt(0)>127?2:1),0)<=WORLD_SAVE_MAX_BYTES;}catch{return false;}
}
