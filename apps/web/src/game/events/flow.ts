import { gameplayCommand,useGameplay } from '../../store/gameplay';
import { useGameEvents } from './store';
import type { GameEventDef } from './events';
export function setEventFlowContext(_ctx:unknown){}
export function beginEvent(def:GameEventDef){const state=useGameplay.getState().state;if(!state||state.event&&!state.event.result)return;const e=state.eventQueue.find(e=>e.id===def.id);if(e)void gameplayCommand({type:'event:open',eid:e.eid});}
export function chooseOption(_def:GameEventDef,choice:number){const e=useGameplay.getState().state?.event;if(e)void gameplayCommand({type:'event:choose',eid:e.eid,choice});}
export function tickEvent(_def:GameEventDef){}
export function onRemoteVote(_id:string,_eid:string,_choice:number){}
export function onRemoteResult(_eid:string,_choice:number,_roll:number){}
export function closeEvent(){const store=useGameEvents.getState();if(store.session?.result)useGameEvents.setState({dismissed:[...store.dismissed,store.session.eid],session:null,queue:store.queue.slice(1)});}
export { scaleDamage } from './shielding';
