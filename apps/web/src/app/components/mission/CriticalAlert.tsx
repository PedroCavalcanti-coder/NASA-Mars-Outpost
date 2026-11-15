import { AlertTriangle, Footprints } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useGameplay } from '../../../store/gameplay';
import { L } from '../../../lib/i18n';

const INFO = {
  breach: {
    title: L('ROMBO NA BLINDAGEM', 'HULL BREACH'),
    text: L('Um impacto abriu um rombo no casco e o oxigênio está vazando. Vá até a fratura e conserte rápido!', 'An impact opened a breach in the hull and oxygen is leaking. Go to the crack and fix it fast!'),
    science:
      L('Em 2004 a Estação Espacial teve um vazamento de ar por um furinho numa mangueira: a tripulação achou o ponto com um detector de som e selou o vazamento.', 'In 2004 the Space Station had an air leak from a tiny hole in a hose: the crew found the spot with a sound detector and sealed the leak.'),
  },
  ducts: {
    title: L('DUTOS DE AR ENTUPIDOS', 'CLOGGED AIR DUCTS'),
    text: L('A poeira entupiu a ventilação: o ar da base está piorando a cada minuto. Limpe os dutos na sala de suporte à vida!', 'Dust clogged the ventilation: the base air is getting worse every minute. Clean the ducts in the life support room!'),
    science:
      L('A poeira de Marte é mais fina que talco. Nas missões Apollo, a poeira lunar entrava nos trajes e na cabine e irritava os olhos e o nariz dos astronautas.', 'Mars dust is finer than talcum powder. On the Apollo missions, Moon dust got into suits and the cabin and irritated the astronauts\' eyes and noses.'),
  },
} as const;

/**
 * Alerta do crítico do dia: aparece uma vez quando o problema começa, com atalho para ir consertar.
 * Fica escondido enquanto há um minigame ou evento na frente (e aparece depois).
 */
export function CriticalAlert({ hidden, onGo }: { hidden: boolean; onGo: () => void }) {
  const critical = useGameplay((s) => s.state?.critical ?? null);
  const [open, setOpen] = useState<keyof typeof INFO | null>(null);
  const shown = useRef('');
  useEffect(() => {
    if (!critical?.active) {
      setOpen(null);
      return;
    }
    const key = `${critical.sol}:${critical.kind}:${critical.at}`;
    if (shown.current === key) return;
    shown.current = key;
    setOpen(critical.kind);
  }, [critical]);

  if (!open || hidden) return null;
  const info = INFO[open];
  return (
    <div className="event-tablet__backdrop" role="presentation">
      <section className="event-tablet event-tablet--major" role="alertdialog" aria-modal="true" aria-labelledby="critical-title">
        <header className="event-tablet__head">
          <span className="event-tablet__alert" aria-hidden="true">
            <AlertTriangle size={26} />
          </span>
          <h2 id="critical-title">
            <small>{L('CRÍTICO:', 'CRITICAL:')} </small>
            {info.title}
          </h2>
        </header>
        <div className="event-tablet__screen">
          <p className="event-tablet__body">{info.text}</p>
          <aside className="event-tablet__fact">
            <span className="event-tablet__fact-tag">{L('ACONTECEU DE VERDADE', 'THIS REALLY HAPPENED')}</span>
            <p>{info.science}</p>
          </aside>
          <button
            type="button"
            className="event-tablet__ok"
            autoFocus
            onClick={() => {
              setOpen(null);
              onGo();
            }}
          >
            <Footprints size={16} aria-hidden="true" /> {L('Ir consertar agora', 'Go fix it now')}
          </button>
        </div>
      </section>
    </div>
  );
}
