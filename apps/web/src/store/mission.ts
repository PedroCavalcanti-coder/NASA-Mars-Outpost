import { createMission, type Command, type Deltas, type LogEntry, type MissionState } from '@mars/sim';
import { create } from 'zustand';
import { gameplayCommand } from './gameplay';
interface MissionStore {
  state:MissionState;feedback:{key:number;deltas:Deltas;reward?:boolean}|null;
  lastEntries:LogEntry[];error:string|null;
  start:(seed?:number)=>void;run:(cmd:Command)=>void;triggerEvent:(id:string)=>void;
}
/** Read projection. Only confirmed snapshots may replace campaign state. */
export const useMission=create<MissionStore>((set)=>({
  state:createMission(0),feedback:null,lastEntries:[],error:null,
  start:()=>set({feedback:null,lastEntries:[],error:null}),
  triggerEvent:()=>set({error:'Eventos são definidos pelo servidor.'}),
  run:(cmd)=>{
    if(cmd.type!=='action')return;
    void gameplayCommand({type:'action',action:cmd.action}).then(r=>{if(!r.ok)set({error:r.error});});
  },
}));
