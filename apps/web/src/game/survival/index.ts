import { Wind } from 'lucide-react';
import { OxygenPanel } from '../../app/components/hud/panels/OxygenPanel';
import { registerPanel } from '../../app/components/hud/registry';
export * from './ColdSystem';
export * from './OxygenSystem';
export * from './types';
let cleanup:(()=>void)|null=null;
export function registerSurvivalModule():()=>void {
  cleanup?.();
  cleanup=registerPanel({id:'oxygen',group:'essencial',title:'Oxigênio pessoal',icon:Wind,component:OxygenPanel,defaultOpen:true});
  return ()=>{cleanup?.();cleanup=null;};
}
registerSurvivalModule();
