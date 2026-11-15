import { useEffect, useState } from 'react';
import { gameplayCommand } from '../../../store/gameplay';
import { useExpedition } from '../../../game/expedition/store';
import { L } from '../../../lib/i18n';
import './expedition.css';

/** Alcance do radar (metros): pedras mais longe aparecem coladas na borda. */
const RANGE = 70;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Tela da expedição: tempo, pedras no carro, dica do que fazer agora e o radar (as pedras
 * aparecem em relação a onde o jogador está olhando).
 */
export function ExpeditionHud() {
  const hud = useExpedition();
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!hud.active) return;
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, [hud.active]);
  if (!hud.active) return null;

  const left = hud.leftMs - (now - hud.stamp);
  const free = hud.rocks.filter((r) => !r.carried);
  const origin = hud.inCar ? hud.car : hud.me;
  // rocha mais perto no chão (ou o rover, quando já estou com uma pedra nas mãos)
  const target = hud.carrying ? { x: hud.car.x, z: hud.car.z } : free.slice().sort((a, b) => Math.hypot(a.x - origin.x, a.z - origin.z) - Math.hypot(b.x - origin.x, b.z - origin.z))[0];
  const dist = target ? Math.hypot(target.x - origin.x, target.z - origin.z) : 0;

  const blip = (x: number, z: number) => {
    const dx = x - origin.x;
    const dz = z - origin.z;
    // gira o mapa para "cima" ser para onde o jogador olha
    const cos = Math.cos(hud.me.yaw);
    const sin = Math.sin(hud.me.yaw);
    const rx = dz * sin - dx * cos;
    const ry = dx * sin + dz * cos;
    const len = Math.hypot(rx, ry) || 1;
    const k = Math.min(1, len / RANGE) / len;
    return { left: `${50 + rx * k * 46}%`, top: `${50 - ry * k * 46}%`, far: len > RANGE };
  };

  // seta apontando para o alvo (em relação a onde o jogador olha)
  let arrow = 0;
  if (target) {
    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    const cos = Math.cos(hud.me.yaw);
    const sin = Math.sin(hud.me.yaw);
    arrow = (Math.atan2(dz * sin - dx * cos, dx * sin + dz * cos) * 180) / Math.PI;
  }

  const tip = hud.carrying
    ? L('🪨 Entre no rover com a pedra! Você anda mais devagar.', '🪨 Get in the rover with the rock! You walk slower.')
    : hud.inCar
      ? L('📡 Dirija até uma pedra e SAIA do rover (botão Sair) para pegá-la.', '📡 Drive to a rock, then EXIT the rover (Exit button) to pick it up.')
      : L('👣 Ande até a pedra brilhante (pegar) ou o poço verde (⛏️ cavar parado: já conta como coletado).', '👣 Walk to the glowing rock (pick up) or the green pit (⛏️ dig standing still: it counts as collected).');

  const ring = (
    <svg className="exp-pick" viewBox="0 0 44 44" aria-label={hud.digging ? L('Cavando o poço', 'Digging the pit') : L('Pegando a pedra', 'Picking up the rock')}>
      <circle cx="22" cy="22" r="18" className="exp-pick__bg" />
      <circle cx="22" cy="22" r="18" className="exp-pick__fg" strokeDasharray={`${hud.pick * 113} 113`} />
    </svg>
  );
  return (
    <>
      {hud.pick > 0 && ring}
    <aside className="exp-hud" aria-label={L('Expedição com o rover', 'Rover expedition')}>
      <div className="exp-hud__bar" role="status">
        <span className={left < 30000 ? 'is-low' : ''}>⏱ {clock(left)}</span>
        <span>🪨 {hud.loaded}/{hud.total}</span>
      </div>
      <p className="exp-hud__tip">{tip}</p>
      <p className="exp-hud__tip">{L('⚠️ Longe do rover o oxigênio acaba mais rápido. Se o de alguém acabar, a missão falha.', '⚠️ Far from the rover oxygen runs out faster. If anyone runs out, the mission fails.')}</p>
      <div className="exp-radar" role="img" aria-label={L(`Radar: pedra a ${Math.round(dist)} metros`, `Radar: rock ${Math.round(dist)} meters away`)}>
        <i className="exp-radar__ring exp-radar__ring--a" />
        <i className="exp-radar__ring exp-radar__ring--b" />
        <i className="exp-radar__sweep" />
        <i className="exp-radar__me" />
        {hud.rocks.map((r) => {
          const b = blip(r.x, r.z);
          return (
            <i
              key={`${r.x}:${r.z}`}
              className={`exp-radar__blip ${r.carried ? 'is-carried' : ''} ${r.pit ? 'is-pit' : ''} ${b.far ? 'is-far' : ''}`}
              style={{ left: b.left, top: b.top }}
            />
          );
        })}
        {hud.carrying && (
          <i className="exp-radar__blip exp-radar__blip--car" style={{ left: blip(hud.car.x, hud.car.z).left, top: blip(hud.car.x, hud.car.z).top }} />
        )}
      </div>
      <button
        type="button"
        className="exp-hud__leave"
        onClick={() => {
          if (window.confirm(L('Sair da missão? Vocês voltam à base sem perder nada.', 'Leave the mission? You will go back to the base without losing anything.')))
            void gameplayCommand({ type: 'expedition', op: 'abort' });
        }}
      >
        🚪 {L('Sair da missão', 'Leave mission')}
      </button>
      <p className="exp-hud__dist">
        {target && <span className="exp-arrow" style={{ transform: `rotate(${arrow}deg)` }} aria-hidden="true">⬆</span>}{' '}
        {target ? `${hud.carrying ? '🚙' : '🪨'} ${Math.round(dist)} m` : ''}
      </p>
    </aside>
    </>
  );
}
