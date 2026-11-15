import { randomUUID } from 'node:crypto';
import {
  GAME_ERROR_MESSAGES, GAMEPLAY_TARGETS, GAMEPLAY_VERSION, gameCommandSchema, GAME_STEP_MS,
  assignOuter, navigationData, neutralInput, outerAnchors, REPAIR_OUTSIDE, WORLD_AUTOSAVE_MS,
  type GameConfirmation, type GameplayMovement, type GameplaySnapshot, type GameplayState,
  type GameplayUpdate, type WorldSave, type RepairIntent,
} from '@mars/shared';
import {
  addGameplayPlayer, applyGameplayCommand, applyGameplayRepair, createWorldSave, hashString,
  migrateWorldSave, removeGameplayPlayer, seeded, simulationClock, stepGameplay,
} from '@mars/sim';
import type { RoomMovement } from './movement';

type Ledger = {high: number; results: Map<string,GameConfirmation>};
/** One owner, one clock, one transaction stream. Does not calculate movement. */
export class RoomSimulation {
  state: GameplayState;
  private publishedRevision=0;
  private publishedLog=0;
  private dirtyAt=0;
  private savedRevision=-1;
  private ledger=new Map<string,Ledger>();
  private resumes=new Map<string,{player:GameplayState['players'][string];until:number}>();
  private identities=new Map<string,string>();
  /** gravação esperando a vez (só a mais recente importa) e a que está em andamento */
  private pendingSave: {snapshot: WorldSave; revision: number; write: (save: WorldSave) => Promise<void>; waiters: {resolve: () => void; reject: (e: unknown) => void}[]} | null = null;
  private writing: Promise<void> | null = null;
  private lastAutosave=0;
  readonly movementAdapter: GameplayMovement;
  constructor(readonly base: string, readonly code: string, public movement: RoomMovement, raw?: WorldSave | null) {
    const targets=GAMEPLAY_TARGETS[base as keyof typeof GAMEPLAY_TARGETS];
    if(!targets)throw new Error('Base desconhecida');
    const {state,corrections}=migrateWorldSave(raw,hashString(`${code}|${base}`),randomUUID(),targets);
    this.state=state;
    // as rachaduras só nascem em paredes que dão para fora: o reparo é feito do lado de fora
    assignOuter(this.state.integrity,outerAnchors(base));
    if(corrections.length && raw) console.info(`[game] ${code}: save corrigido: ${corrections.join(', ')}`);
    this.movementAdapter={
      context:(id)=>{
        const p=this.movement.players.get(id)?.state;
        if(!p)return;
        const ship=navigationData(base).ship;
        return {x:p.x,z:p.z,inside:this.movement.grid.isInsideBase(p.x,p.z),sheltered:Math.hypot(p.x-ship.x,p.z-ship.z)<3,driving:p.m==='drive'||p.m==='ride',ready:p.ready};
      },
      near:(id,target,distance)=>{
        const p=this.movement.players.get(id)?.state;if(!p)return false;
        const points=targets.points as Record<string,{x:number;z:number}>;
        let candidates: {x:number;z:number}[]=[];
        if(target==='rover')candidates=[this.movement.rover];
        else if(target==='garden')candidates=Object.entries(points).filter(([k])=>k.startsWith('crop:')).map(([,v])=>v);
        else if(target==='delivery')candidates=['station:lab','station:comms'].map(k=>points[k]!).filter(Boolean);
        else if(target.startsWith('repair:')) {
          const f=this.state.integrity.fractures.find(f=>f.id===Number(target.slice(7)));
          const a=f&&REPAIR_OUTSIDE[base]?.[f.anchor];
          if(a)candidates=[{x:a[0],z:a[1]}];
        } else if(target.startsWith('xrock:')) {
          const r=this.state.expedition?.rocks[Number(target.slice(6))];
          if(r)candidates=[r];
        } else if(target.startsWith('rock:')) {
          const i=Number(target.slice(5)),sol=this.state.mission.sol,seed=this.state.mission.seed;
          if(i<0||i>=4)return false;
          const angle=seeded(seed,sol,900+i)*Math.PI*2;
          for(let r=26+seeded(seed,sol,910+i)*12;r<44;r+=5) {
            const spot=this.movement.grid.nearestWalkablePoint(Math.cos(angle)*r,Math.sin(angle)*r,6);
            if(spot&&!this.movement.grid.isInsideBase(spot.x,spot.z)){candidates=[spot];break;}
          }
        } else if(points[target])candidates=[points[target]!];
        return candidates.some(t=>Math.hypot(p.x-t.x,p.z-t.z)<=distance);
      },
      restrict:(id,blocked,cold,slow)=>this.movement.restrict(id,{blocked,cold,slow}),
      occupants:()=>({driver:this.movement.rover.driver,rider:this.movement.rover.rider}),
      roverPose:()=>({x:this.movement.rover.x,z:this.movement.rover.z,h:this.movement.rover.h}),
      teleport:(id,pose)=>{if(id==='rover')this.movement.teleportRover(pose);else this.movement.teleport(id,pose);},
      spot:(x,z,profile)=>{const p=this.movement.grid.nearestWalkablePoint(x,z,14,profile);return p&&!this.movement.grid.isInsideBase(p.x,p.z)?{x:p.x,z:p.z}:null;},
      lockExit:(on)=>{this.movement.exitLock=on;},
      fieldMode:(on)=>this.movement.setField(on),
      rescue:(id)=>{this.movement.action(id,'infirmary');},
    };
  }
  join(id:string,name:string,token?:string,real=Date.now()) {
    for(const [key,r]of this.resumes) if(r.until<real){this.resumes.delete(key);this.ledger.delete(key);}
    const identity=token??id;this.identities.set(id,identity);
    const previous=this.resumes.get(identity);this.resumes.delete(identity);
    addGameplayPlayer(this.state,id,name,previous?.player);
  }
  leave(id:string,real=Date.now()) {
    const identity=this.identities.get(id)??id,p=this.state.players[id];
    if(p)this.resumes.set(identity,{player:{...p},until:real+120000});
    removeGameplayPlayer(this.state,id,this.movementAdapter);this.identities.delete(id);
  }
  command(actor:string,raw:unknown,coordinator:boolean):GameConfirmation {
    const parsed=gameCommandSchema.safeParse(raw);
    const operationId=parsed.success?parsed.data.operationId:'';
    const error=(code:Extract<GameConfirmation,{ok:false}>['code']):GameConfirmation=>({ok:false,operationId,generation:this.state.generation,revision:this.state.revision,code,error:GAME_ERROR_MESSAGES[code]??code});
    if(!parsed.success)return error('INVALID_COMMAND');
    const command=parsed.data;
    if(command.generation!==this.state.generation)return error('STALE_GENERATION');
    const identity=this.identities.get(actor);if(!identity)return error('NOT_READY');
    let ledger=this.ledger.get(identity);
    if(!ledger){ledger={high:0,results:new Map()};this.ledger.set(identity,ledger);}
    const repeated=ledger.results.get(operationId);if(repeated)return repeated;
    if(!/^\d{1,12}$/.test(operationId))return error('INVALID_SEQUENCE');
    const sequence=Number(operationId);if(sequence<=ledger.high)return error('INVALID_SEQUENCE');
    ledger.high=sequence;
    // ferramentas de dev: nunca em produção
    const result=applyGameplayCommand(this.state,actor,command.payload,this.movementAdapter,this.base,coordinator,process.env.NODE_ENV!=='production');
    this.state=result.state;
    const confirmation:GameConfirmation=result.code?error(result.code):{ok:true,operationId,generation:this.state.generation,revision:this.state.revision,attempt:result.attempt};
    ledger.results.set(operationId,confirmation);
    if(ledger.results.size>128)ledger.results.delete(ledger.results.keys().next().value!);
    return confirmation;
  }
  repair(actor:string,intent:RepairIntent,dev:boolean) {return applyGameplayRepair(this.state,actor,intent,this.movementAdapter,dev);}
  step() {return stepGameplay(this.state,GAME_STEP_MS,this.movementAdapter,this.base);}
  snapshot(now=Date.now()):GameplaySnapshot{return {version:GAMEPLAY_VERSION,serverNow:now,state:this.state};}
  update(now=Date.now()):GameplayUpdate|null {
    if(this.state.revision===this.publishedRevision)return null;
    const {log,...mission}=this.state.mission;
    const update:GameplayUpdate={version:GAMEPLAY_VERSION,generation:this.state.generation,previousRevision:this.publishedRevision,revision:this.state.revision,serverNow:now,state:{...this.state,mission},entries:log.filter(e=>e.id>this.publishedLog).reverse()};
    this.publishedRevision=this.state.revision;this.publishedLog=this.state.mission.nextLogId-1;
    return update;
  }
  get scale(){return this.state.pauses.length?0:this.state.scale;}
  projectWorld(now=Date.now()) {
    const s=this.state;
    return {clockStart:now-s.elapsedMs,virtualElapsedMs:s.elapsedMs,timeUpdatedAt:now,timeScale:s.scale,paused:s.pauses.length>0,solar:s.solar.map(Math.floor),crops:s.crops,care:s.care,board:s.board,storm:s.storm,integrity:s.integrity,vehicle:{x:this.movement.rover.x,z:this.movement.rover.z,h:this.movement.rover.h}};
  }
  private savedLog=0;
  /**
   * Hora de gravar? A cada 30 s se algo mudou, e em até 5 s quando a missão avançou (entrada no
   * diário: tarefa, evento, recurso): um reinício sem aviso do servidor perde no máximo isso.
   */
  autosaveDue(now:number) {
    if(this.savedRevision===this.state.revision)return false;
    const progressed=this.state.mission.nextLogId!==this.savedLog;
    if(now-this.lastAutosave<(progressed?5000:WORLD_AUTOSAVE_MS))return false;
    this.lastAutosave=now;this.savedLog=this.state.mission.nextLogId;
    return true;
  }
  /**
   * Um gravador por sala: enquanto uma gravação está em andamento, os pedidos seguintes se juntam
   * num só (com o estado mais recente). Cada pedido é confirmado quando um estado igual ou mais novo
   * chega ao banco, ou recebe o erro dessa gravação.
   */
  save(write:(save:WorldSave)=>Promise<void>):Promise<void> {
    const snapshot=createWorldSave(this.state,{x:this.movement.rover.x,z:this.movement.rover.z,h:this.movement.rover.h});
    const revision=this.state.revision;
    return new Promise((resolve,reject)=>{
      if(this.pendingSave){Object.assign(this.pendingSave,{snapshot,revision,write});this.pendingSave.waiters.push({resolve,reject});}
      else this.pendingSave={snapshot,revision,write,waiters:[{resolve,reject}]};
      this.drain();
    });
  }
  private drain() {
    if(this.writing||!this.pendingSave)return;
    const job=this.pendingSave;this.pendingSave=null;
    this.writing=(async()=>{
      try{await job.write(job.snapshot);this.savedRevision=Math.max(this.savedRevision,job.revision);for(const w of job.waiters)w.resolve();}
      catch(e){for(const w of job.waiters)w.reject(e);}
      finally{this.writing=null;this.drain();}
    })();
  }
  /** Espera todas as gravações pedidas até agora terminarem (com sucesso ou não). */
  async flush(){while(this.writing)await this.writing;}

}
