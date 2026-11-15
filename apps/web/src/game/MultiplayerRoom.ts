import {
  GAME_NAMESPACE, GAMEPLAY_VERSION, MOVEMENT_VERSION, NAVIGATION_HASH, worldClock,
  type DuoGestureId, type GameClientToServer, type GameServerToClient, type GamePlayerInfo,
  type GamePlayerState, type GameWorldState, type GameMotion, type GameCareState,
  type GameVehicleState, type GameTimeState, type GameTimeRequest, type GameMissionEvent,
  type GestureStart, type IntegrityState, type MovementSnapshot, type MovementInput,
  type MovementAction, type MovementActionResult, type RepairIntent, type SuitConfig,
  type GameJoinResult, type GameAck, type GameCommand, type GamePayload, type GameConfirmation, type GameplaySnapshot, type GameplayState, type GameplayUpdate,
} from '@mars/shared';
import { io,type Socket } from 'socket.io-client';
import { newRoomCode } from '../lib/roomCode';
import { bindGameplay, projectGameplay, useGameplay } from '../store/gameplay';
export type RoomMode='online'|'local';
export interface RoomJoinOptions {roomCode:string;baseId:string;name:string;suit:SuitConfig;local?:boolean;
  /** pode criar a sala se ela não existir (quem abriu a sala ou já estava nela) */
  create?:boolean;
  /** código recém-sorteado ("Jogar agora"): se já for de outro mundo, sorteia outro */
  fresh?:boolean;
  /** dificuldade do mundo novo */
  difficulty?:'easy'|'normal'|'hard';
  /** avisado quando a sala ganha outro código (o sorteado já existia) */
  onCode?:(code:string)=>void}

export interface RemotePlayer extends GamePlayerInfo {motion?:GameMotion}
const SOCKET_URL:string=import.meta.env.VITE_SOCKET_URL??'';
export class MultiplayerRoom {
  readonly mode:RoomMode='online';
  self!:GamePlayerInfo;
  world:GameWorldState={clockStart:Date.now(),storm:0,solar:[],crops:[]};
  gameplay:GameplayState|null=null;
  readonly remotes=new Map<string,RemotePlayer>();
  movement:MovementSnapshot|null=null;
  status:'connecting'|'connected'|'reconnecting'|'failed'='connecting';
  persistence:{linked:boolean;canSave:boolean;mission?:unknown}={linked:false,canSave:false};
  onMovement?:(snapshot:MovementSnapshot)=>void;
  onGameplay?:(state:GameplayState)=>void;
  onPlayerJoined?:(p:RemotePlayer,existing:boolean)=>void;
  onPlayerLeft?:(id:string)=>void;
  onPlayerState?:(id:string,state:GameMotion)=>void;
  onIntegrity?:(state:IntegrityState)=>void;
  onStorm?:(strength:number)=>void;
  onSolar?:(stages:number[])=>void;
  onCrops?:(stages:number[])=>void;
  onCare?:(state:GameCareState)=>void;
  onVehicle?:(state:GameVehicleState)=>void;
  onVehicleDenied?:(reason:string)=>void;
  onEmote?:(id:string,emote:number)=>void;
  onChat?:(id:string,text:string)=>void;
  onGestureInvite?:(id:string,gesture:DuoGestureId)=>void;
  onGestureStart?:(start:GestureStart)=>void;
  onGestureDenied?:(reason:string)=>void;
  onTime?:(state:GameTimeState)=>void;
  onStatus?:(status:MultiplayerRoom['status'])=>void;
  onError?:(error:Error)=>void;
  // Presentation callbacks retained while old overlays are phased out; no transport authority.
  onSoil?:(kind:'start'|'done',eid:string,quality:number)=>void;
  onEventVote?:(id:string,eid:string,choice:number)=>void;
  onEventResult?:(eid:string,choice:number,roll:number)=>void;
  onMissionEvent?:(event:GameMissionEvent,mine:boolean)=>void;
  private socket:Socket<GameServerToClient,GameClientToServer>|null=null;
  private disposed=false;
  private onlineReady=false;
  private clockOffset=0;
  private disconnectedAt:number|null=null;
  private commandSequence=0;
  private acknowledgedReady=false;
  private readonly resumeToken=Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
  private constructor(){}
  static async join(opts:RoomJoinOptions) {
    if(opts.local)throw new RoomConnectionError('O jogo precisa de uma sala online.');
    const room=new MultiplayerRoom();
    try{await room.joinOnline(opts);return room;}catch(error){room.dispose();throw error;}
  }
  get connected(){return !this.disposed&&this.onlineReady&&this.socket?.connected===true;}
  get playerCount(){return this.remotes.size+1;}
  get isCoordinator(){return !!this.self&&[...this.remotes.values()].every(p=>p.slot>this.self.slot);}
  get supportsDuoGestures(){return true;}
  get board(){return this.world.board;}
  serverNow(){return Date.now()+this.clockOffset;}
  clock(){return worldClock(this.world,this.disconnectedAt??Math.min(this.serverNow(),(this.world.timeUpdatedAt??0)+600));}
  private setStatus(status:MultiplayerRoom['status']){this.status=status;this.onStatus?.(status);}
  private joinOnline(opts:RoomJoinOptions):Promise<void> {
    return new Promise((resolve,reject)=>{
      const socket=io(`${SOCKET_URL}${GAME_NAMESPACE}`,{transports:['websocket','polling'],tryAllTransports:true,withCredentials:true,timeout:12000,reconnectionDelayMax:3000});
      this.socket=socket;let settled=false;
      const fail=(e:Error)=>{if(!settled){settled=true;clearTimeout(timer);reject(e);}else{this.setStatus('failed');this.onError?.(e);}};
      const timer=window.setTimeout(()=>fail(new RoomConnectionError('Não foi possível conectar à sala.')),12000);
      let retries=0;
      const enter=()=>{
        this.onlineReady=false;
        const connectionId=socket.id;
        socket.timeout(12000).emit('room:join',{code:opts.roomCode,base:opts.baseId,name:opts.name,suit:opts.suit,create:opts.create,fresh:opts.fresh,difficulty:opts.difficulty,movementVersion:MOVEMENT_VERSION,navigationHash:NAVIGATION_HASH,gameplayVersion:GAMEPLAY_VERSION,resumeToken:this.resumeToken},(error: Error | null,r: GameAck<GameJoinResult> | {ok:false;error:string;baseId:string} | {ok:false;error:string;taken:true})=>{
          if(this.disposed||!socket.connected||socket.id!==connectionId)return;
          // o código sorteado já é de outro mundo: sorteia outro e tenta de novo
          if(!error&&!r.ok&&'taken'in r&&opts.fresh&&retries++<5){opts.roomCode=newRoomCode();opts.onCode?.(opts.roomCode);enter();return;}
          if(error||!r.ok)return fail(error?new RoomConnectionError('O servidor demorou a confirmar a entrada.'):'baseId'in r?new RoomBaseMismatchError(r.baseId):new RoomRejectedError(r.error));
          // já esteve na sala: numa reconexão (ex.: servidor reiniciado) pode recriá-la com a base certa
          opts.create=true;opts.fresh=false;opts.baseId=r.baseId??opts.baseId;
          this.self=r.self;this.world=r.world;this.movement=r.movement;this.persistence=r.persistence;
          this.clockOffset=r.serverNow-Date.now();this.disconnectedAt=null;
          const previous=new Set(this.remotes.keys());
          for(const p of r.players){previous.delete(p.id);const known=this.remotes.has(p.id);this.remotes.set(p.id,p);if(!known)this.onPlayerJoined?.(p,true);}
          for(const id of previous){this.remotes.delete(id);this.onPlayerLeft?.(id);}
          this.onlineReady=true;
          this.acceptSnapshot(r.gameplay);
          bindGameplay(payload=>this.command(payload));
          this.setStatus('connected');
          if(this.acknowledgedReady)void this.command({type:'ready'});
          this.onMovement?.(r.movement);
          if(!settled){settled=true;clearTimeout(timer);resolve();}
        });
      };
      socket.on('connect',enter);
      socket.on('disconnect',()=>{this.onlineReady=false;this.disconnectedAt=this.serverNow();socket.sendBuffer.length=0;useGameplay.setState({connected:false});if(!this.disposed)this.setStatus('reconnecting');});
      socket.on('game:snapshot',s=>this.acceptSnapshot(s));
      socket.on('game:update',s=>this.acceptUpdate(s));
      socket.on('movement:snapshot',s=>{if(!this.connected||(this.movement&&s.tick<this.movement.tick))return;this.movement=s;for(const p of s.players){const peer=this.remotes.get(p.id);if(peer)peer.motion=p.state;}this.onMovement?.(s);});
      socket.on('player:joined',p=>{if(!this.remotes.has(p.id)){this.remotes.set(p.id,p);this.onPlayerJoined?.(p,false);}});
      socket.on('player:left',id=>{this.remotes.delete(id);this.onPlayerLeft?.(id);});
      socket.on('player:chat',(id,t)=>this.onChat?.(id,t));
      socket.on('player:emote',(id,e)=>this.onEmote?.(id,e));
      socket.on('gesture:invite',(id,g)=>this.onGestureInvite?.(id,g));
      socket.on('gesture:start',s=>this.onGestureStart?.(s));
      socket.on('gesture:denied',r=>this.onGestureDenied?.(r));
      socket.on('connect_error',()=>{if(!settled&&socket.active===false)fail(new RoomConnectionError('Não foi possível conectar à sala.'));});
    });
  }
  private acceptSnapshot(snapshot:GameplaySnapshot) {
    if(!this.onlineReady||snapshot.version!==GAMEPLAY_VERSION)return;
    if(this.gameplay?.generation===snapshot.state.generation&&snapshot.state.revision<this.gameplay.revision)return;
    if(this.gameplay&&this.gameplay.generation!==snapshot.state.generation)this.commandSequence=0;
    this.clockOffset=snapshot.serverNow-Date.now();this.gameplay=snapshot.state;
    this.project(snapshot.state);
  }
  private acceptUpdate(update:GameplayUpdate) {
    if(!this.connected||!this.gameplay)return;
    if(update.generation===this.gameplay.generation&&update.revision<=this.gameplay.revision)return;
    if(update.version!==GAMEPLAY_VERSION||update.generation!==this.gameplay.generation||update.previousRevision!==this.gameplay.revision){this.socket?.emit('game:resync');return;}
    const log=[...update.entries].reverse().concat(this.gameplay.mission.log).filter((entry,i,all)=>all.findIndex(e=>e.id===entry.id)===i).slice(0,300);
    this.gameplay={...update.state,mission:{...update.state.mission,log}};
    this.clockOffset=update.serverNow-Date.now();this.project(this.gameplay,update.entries);
  }
  private project(s:GameplayState,entries?:GameplayState['mission']['log']) {
    projectGameplay(s,this.self.id,entries);
    this.world={...this.world,clockStart:this.serverNow()-s.elapsedMs,virtualElapsedMs:s.elapsedMs,timeUpdatedAt:this.serverNow(),timeScale:s.scale,paused:s.pauses.length>0,storm:s.storm,solar:s.solar.map(Math.floor),crops:s.crops,care:s.care,board:s.board,integrity:s.integrity};
    this.onSolar?.(this.world.solar);this.onCrops?.(s.crops);this.onCare?.(s.care);this.onIntegrity?.(s.integrity);this.onStorm?.(s.storm);
    this.onTime?.({paused:s.pauses.length>0,scale:s.scale,timeUpdatedAt:this.serverNow(),virtualElapsedMs:s.elapsedMs});
    this.onGameplay?.(s);
  }
  async command(payload:GamePayload):Promise<GameConfirmation> {
    const generation=this.gameplay?.generation??'',operationId=String(++this.commandSequence);
    const offline:GameConfirmation={ok:false,operationId,generation,revision:this.gameplay?.revision??0,code:'OFFLINE',error:'Conexão indisponível.'};
    if(!this.connected||!this.socket||!generation)return offline;
    const command:GameCommand={version:GAMEPLAY_VERSION,operationId,generation,payload};
    try{
      const result=await this.socket.timeout(5000).emitWithAck('game:command',command);
      if(result.generation!==generation)return offline;
      if(result.ok&&payload.type==='ready')this.acknowledgedReady=true;
      if(!result.ok&&result.code==='STALE_GENERATION')this.socket.emit('game:resync');
      return result;
    }catch{return offline;}
  }
  sendInput(input:MovementInput){if(this.connected)this.socket?.emit('movement:input',input);}
  async movementAction(action:MovementAction):Promise<MovementActionResult|null>{if(!this.connected||!this.socket)return null;try{if(action==='ready')await this.command({type:'ready'});const r=await this.socket.timeout(5000).emitWithAck('movement:action',action);this.movement=r.snapshot;this.onMovement?.(r.snapshot);return r;}catch{return null;}}
  async requestRepair(intent:RepairIntent){if(!this.connected||!this.socket)return false;try{const r=await this.socket.timeout(5000).emitWithAck('world:repair',intent);if(r.ok)this.onIntegrity?.(r.state);return r.ok;}catch{return false;}}
  async save(_mission?:unknown):Promise<{ok:true;savedAt:number}|{ok:false;error:string}>{if(!this.connected||!this.socket)return {ok:false,error:'Conexão indisponível.'};try{return await this.socket.timeout(8000).emitWithAck('world:save',{});}catch{return {ok:false,error:'O servidor demorou a responder.'};}}
  async restore():Promise<{ok:true}|{ok:false;error:string}>{if(!this.connected||!this.socket)return {ok:false,error:'Conexão indisponível.'};try{return await this.socket.timeout(8000).emitWithAck('world:restore');}catch{return {ok:false,error:'O servidor demorou a responder.'};}}
  sendTime(req:GameTimeRequest){void this.command({type:'time',paused:req.paused,scale:req.scale});}
  sendChat(text:string){if(this.connected)this.socket?.emit('player:chat',text);}
  sendEmote(i:number){if(this.connected)this.socket?.emit('player:emote',i);}
  sendGestureInvite(g:DuoGestureId,id:string){if(this.connected)this.socket?.emit('gesture:invite',g,id);}
  acceptGesture(id:string){if(this.connected)this.socket?.emit('gesture:accept',id);}
  tickHazards(){}
  repairPause(_active:boolean){}
  sendState(_state:GameMotion){}
  sendVehicle(_state:GameVehicleState){}
  sendSolar(_stages:number[]){}
  sendCrops(_stages:number[]){}
  sendCare(_state:GameCareState){}
  sendStorm(_strength:number){}
  sendSoil(_kind:'start'|'done',_eid:string,_quality:number){}
  sendEventVote(eid:string,choice:number){void this.command({type:'event:choose',eid,choice});}
  sendEventResult(_eid:string,_choice:number,_roll:number){}
  async sendMission(_event:GameMissionEvent){return false;}
  dispose(){this.disposed=true;this.onlineReady=false;this.socket?.removeAllListeners();this.socket?.disconnect();this.socket=null;this.remotes.clear();bindGameplay(null);useGameplay.setState({connected:false});}
}
export class RoomBaseMismatchError extends Error {constructor(readonly baseId:string){super('Esta sala usa outra base.');}}
export class RoomRejectedError extends Error {}
export class RoomConnectionError extends Error {}
