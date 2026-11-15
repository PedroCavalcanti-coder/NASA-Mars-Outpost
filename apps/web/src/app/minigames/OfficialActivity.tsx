import { useEffect,useRef,useState } from 'react';
import type { ActivityAction,ActivityAttempt,ActivityKind } from '@mars/shared';
import { pingPong,zoneFor } from '@mars/sim';
import { gameplayCommand,useGameplay } from '../../store/gameplay';
import type { MinigameRequest } from '../../game/BaseViewer';
import './missions/missions.css';

function activity(req:MinigameRequest):{kind:ActivityKind;target:string} {
  if(req.kind==='station')return {kind:'station',target:req.mission};
  if(req.kind==='oxygen')return {kind:'filter',target:String(req.index)};
  if(req.kind==='solar')return {kind:'solar',target:String(req.index)};
  if(req.kind==='greenhouse')return {kind:'greenhouse',target:String(req.index)};
  return {kind:req.kind==='drill'?'drill':req.kind==='soil'?'soil':'upload',target:'0'};
}
const names:Record<ActivityKind,string>={station:'Console da base',filter:'Limpeza do filtro de ar',solar:'Limpeza do painel solar',greenhouse:'Irrigação da estufa',drill:'Sondagem do subsolo',soil:'Coleta de solo',upload:'Envio de pesquisa à Terra'};
/** Interactive projection of a server challenge. No score or resource delta is sent. */
export default function OfficialActivity({request,onClose,onComplete}:{request:MinigameRequest;onClose:()=>void;onComplete:()=>void}) {
  const [initial,setInitial]=useState<ActivityAttempt|null>(null),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),[cursor,setCursor]=useState(0);
  const state=useGameplay(s=>s.state),connected=useGameplay(s=>s.connected);
  const active=initial?(state?.attempts[initial.id]??initial):null;
  const queue=useRef<ActivityAction[]>([]),seq=useRef(0),inFlight=useRef<Promise<void>|null>(null),done=useRef(false),attemptId=useRef('');
  const {kind,target}=activity(request);
  useEffect(()=>{
    let live=true;
    void gameplayCommand({type:'start',kind,target}).then(r=>{
      if(!r.ok){if(live)setError(r.error);return;}
      if(!r.attempt)return;
      attemptId.current=r.attempt.id;
      if(!live){void gameplayCommand({type:'cancel',attempt:r.attempt.id});return;}
      seq.current=r.attempt.seq;setInitial(r.attempt);
    });
    return ()=>{live=false;if(attemptId.current&&!done.current)void gameplayCommand({type:'cancel',attempt:attemptId.current});};
  },[kind,target]);
  const send=async()=>{
    if(inFlight.current)return inFlight.current;
    if(!queue.current.length||!attemptId.current)return;
    const actions=queue.current.splice(0,32),next=seq.current+1;
    const promise=gameplayCommand({type:'actions',attempt:attemptId.current,seq:next,actions}).then(r=>{
      if(r.ok){seq.current=next;if(r.attempt)setInitial(r.attempt);}
      else {if(r.code==='RATE_LIMITED')queue.current.unshift(...actions);else setError(r.error);}
    }).finally(()=>{inFlight.current=null;});
    inFlight.current=promise;await promise;
  };
  const sendRef=useRef(send);sendRef.current=send;
  useEffect(()=>{const timer=window.setInterval(()=>void sendRef.current(),110);return ()=>clearInterval(timer);},[]);
  const lastBrush=useRef<{x:number;y:number}|null>(null);
  const enqueue=(action:ActivityAction)=>{if(!connected||!attemptId.current||done.current||queue.current.length>=32)return;queue.current.push(action);};
  const elapsed=active?.elapsed??0;
  useEffect(()=>{
    if(kind!=='station')return;
    const start=performance.now();let raf=0;
    const frame=()=>{setCursor(pingPong(elapsed+(performance.now()-start)/1000,1.25));raf=requestAnimationFrame(frame);};
    raf=requestAnimationFrame(frame);return ()=>cancelAnimationFrame(raf);
  },[elapsed,kind]);
  const finish=async()=>{
    if(busy||!active)return;setBusy(true);setError('');
    await sendRef.current();
    if(queue.current.length){setBusy(false);return;}
    const r=await gameplayCommand({type:'finish',attempt:active.id});
    if(r.ok){done.current=true;onComplete();}else{setError(r.error);setBusy(false);}
  };
  const close=()=>{if(!done.current&&attemptId.current)void gameplayCommand({type:'cancel',attempt:attemptId.current});done.current=true;onClose();};
  const hold=(type:'drill'|'water',holding:boolean)=>enqueue({type,holding});
  const progress=active?(kind==='solar'?active.coverage.length/256:kind==='filter'?active.removed.length/12:kind==='greenhouse'?active.moisture/1.41:kind==='soil'?active.samples.length/6:kind==='upload'?(active.removed.length+active.transmitted/5)/6:kind==='station'?active.marks.length/3:active.drill.depth/200):0;
  const canFinish=active&&(kind==='drill'?active.quality!==null:progress>=(kind==='solar'?253/256:1));
  const brush=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(e.buttons!==1)return;
    const rect=e.currentTarget.getBoundingClientRect(),point={x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))};
    enqueue({type:'brush',points:[lastBrush.current??point,point]});lastBrush.current=point;
  };
  return <main className="msn-mg" aria-label={names[kind]}><section className="msn-mg__card">
    <div className="msn-mg__head"><h2>{request.kind==='station'?request.title:names[kind]}</h2><button type="button" className="msn-mg__close" onClick={close} aria-label="Cancelar atividade">×</button></div>
    {!connected&&<p role="alert">Conexão interrompida. Aguardando o estado da sala.</p>}
    {error&&<p role="alert">{error}</p>}
    {!active?<p>Preparando atividade…</p>:<>
      <progress value={progress} max={1} aria-label="Progresso da atividade" style={{width:'100%'}} />
      {kind==='station'&&active.marks.length<3&&<>
        <p>Trave o cursor na faixa verde. Rodada {active.marks.length+1}/3.</p>
        <div className="msn-bar"><div className="msn-bar__zone" style={{left:`${(zoneFor(active.marks.length,active.challenge.rolls[active.marks.length]!).center-zoneFor(active.marks.length,0).half)*100}%`,width:`${zoneFor(active.marks.length,0).half*200}%`}}/><div className="msn-bar__cursor" style={{left:`${cursor*100}%`}}/></div>
        <button type="button" className="msn-mg__btn" onClick={()=>enqueue({type:'mark',round:active.marks.length})}>Travar cursor</button>
      </>}
      {kind==='drill'&&<>
        <p>Camada solicitada: {active.challenge.target}. Profundidade: {Math.round(active.drill.depth)} cm.</p>
        <p>Temperatura: {Math.round(active.drill.heat*100)}% {active.drill.jammed?'— espere esfriar':''}</p>
        <button type="button" className="msn-mg__btn" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);hold('drill',true);}} onPointerUp={()=>hold('drill',false)} onPointerCancel={()=>hold('drill',false)} onKeyDown={e=>{if(e.key===' '&&!e.repeat)hold('drill',true);}} onKeyUp={()=>hold('drill',false)} onBlur={()=>hold('drill',false)}>Segure para perfurar</button>
        <button type="button" className="msn-mg__btn" onClick={()=>enqueue({type:'collect'})} disabled={active.drill.depth<1||active.quality!==null}>Coletar amostra</button>
      </>}
      {kind==='soil'&&active.samples.length<6&&<>
        <p>Colha os pontos na ordem. Leve as amostras a um computador da base para concluir.</p>
        <div style={{height:220,position:'relative'}}><button type="button" className="msn-mg__btn" style={{position:'absolute',left:`${active.challenge.soil[active.samples.length]!*70}%`,top:`${(active.samples.length%3)*60}px`}} onClick={()=>enqueue({type:'sample',index:active.samples.length})}>Amostra {active.samples.length+1}</button></div>
      </>}
      {kind==='solar'&&<><p>Arraste a escova sobre a poeira.</p><svg viewBox="0 0 320 320" role="img" aria-label="Superfície do painel" style={{width:'min(100%,340px)',touchAction:'none'}} onPointerDown={e=>{lastBrush.current=null;e.currentTarget.setPointerCapture(e.pointerId);brush(e);}} onPointerMove={brush} onPointerUp={()=>{lastBrush.current=null;}}>{Array.from({length:256},(_,i)=><rect key={i} x={(i%16)*20} y={Math.floor(i/16)*20} width="19" height="19" fill={active.coverage.includes(i)?'#2563a1':'#a37548'}/>)}</svg></>}
      {kind==='filter'&&<><p>Remova cada resíduo do filtro.</p><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{active.challenge.debris.filter(id=>!active.removed.includes(id)).map(id=><button key={id} type="button" className="msn-mg__btn" onClick={()=>enqueue({type:'remove',ids:[id]})}>Resíduo {id+1}</button>)}</div></>}
      {kind==='greenhouse'&&<><p>Regue os canteiros. Água usada: {(active.water*10).toFixed(1)} L.</p><button type="button" className="msn-mg__btn" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);hold('water',true);}} onPointerUp={()=>hold('water',false)} onPointerCancel={()=>hold('water',false)} onKeyDown={e=>{if(e.key===' '&&!e.repeat)hold('water',true);}} onKeyUp={()=>hold('water',false)} onBlur={()=>hold('water',false)}>Segure para regar</button></>}
      {kind==='upload'&&<><p>Envie os arquivos científicos na ordem. O lote foi capturado ao iniciar a transmissão.</p><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{[...active.challenge.files,...active.challenge.blocks].sort((a,b)=>a-b).map(file=><button key={file} type="button" className="msn-mg__btn" disabled={active.removed.includes(file)||active.file!==-1} onClick={()=>enqueue({type:'transmit',file,holding:true})}>{active.challenge.files.includes(file)?`Pesquisa ${file+1}`:`Sistema ${file+1}`} {active.removed.includes(file)?'✓':''}</button>)}</div>{active.file>=0&&<p>Transmitindo: {Math.round(active.transmitted/5*100)}%</p>}</>}
      <button type="button" className="msn-mg__btn" disabled={!canFinish||busy||!connected} onClick={()=>void finish()}>{busy?'Confirmando…':kind==='soil'?'Levar amostras à base':'Confirmar atividade'}</button>
    </>}
  </section></main>;
}
