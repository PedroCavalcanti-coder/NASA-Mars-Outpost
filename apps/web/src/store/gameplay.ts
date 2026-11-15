import { create } from 'zustand';
import { GAMEPLAY_VERSION, type GameConfirmation, type GamePayload, type GameplaySnapshot, type GameplayState, type GameplayUpdate } from '@mars/shared';
import { GAME_EVENTS } from '../game/events/events';
import { useGameEvents } from '../game/events/store';
import { useMission } from './mission';
import { useOxygen } from '../game/survival/OxygenSystem';
import { useCold } from '../game/survival/ColdSystem';

export const useGameplay=create<{state:GameplayState|null;connected:boolean;selfId:string}>(()=>({state:null,connected:false,selfId:''}));
let send:((payload:GamePayload)=>Promise<GameConfirmation>)|null=null;
export function bindGameplay(command:typeof send) {send=command;}
export function gameplayCommand(payload:GamePayload):Promise<GameConfirmation> {
  return send?.(payload)??Promise.resolve({ok:false,operationId:'',generation:'',revision:0,code:'OFFLINE',error:'Conecte-se à sala para jogar.'});
}
export function projectGameplay(state:GameplayState,selfId:string,entries=state.mission.log) {
  useGameplay.setState({state,connected:true,selfId});
  const prev=useMission.getState().state;
  const fresh=entries.filter(e=>e.id>prev.nextLogId-1);
  const deltas:Record<string,number>={};
  for(const e of fresh)for(const [key,value]of Object.entries(e.deltas))deltas[key]=(deltas[key]??0)+(value??0);
  useMission.setState({state:state.mission,lastEntries:fresh,error:null,feedback:fresh.length?{key:state.revision,deltas,reward:Object.values(deltas).some(v=>v>0)}:null});
  const p=state.players[selfId];
  if(p){
    useOxygen.setState({tank:p.tank,isInside:p.inside,isDriving:p.driving,isLow:p.tank<25,storm:state.storm,baseOxygen:state.mission.resources.oxygen.value,status:p.inside?'safe':p.tank<25?'critical':'consuming',isFainting:p.rescueUntil>state.interactionMs});
    useCold.setState({isNight:p.cold,isExposed:p.cold,exposureTime:p.exposure});
  }
  const store=useGameEvents.getState();
  const visible=state.event && !store.dismissed.includes(state.event.eid) ? state.event : null;
  const queue=[...(visible?[visible]:[]),...state.eventQueue.filter(q=>q.eid!==visible?.eid)].map(q=>GAME_EVENTS.find(d=>d.id===q.id)).filter((d):d is NonNullable<typeof d>=>!!d);
  const event=visible;
  useGameEvents.setState({queue,session:event?{eid:event.eid,mode:event.mode,selfId,deciderId:event.deciderId,deciderName:event.voters.find(p=>p.id===event.deciderId)?.name??'',voters:event.voters,votes:event.votes,deadline:Date.now()+event.remainingMs,result:event.result}:null});
}
