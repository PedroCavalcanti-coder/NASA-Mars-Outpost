import { useEffect, useState } from 'react';
import './loadingScreen.css';

const MARS_TIPS = [
  'Um sol (dia marciano) dura 24 horas, 39 minutos e 35 segundos.',
  'A gravidade em Marte é aproximadamente 38% da gravidade da Terra.',
  'O pôr do sol em Marte é azulado: a poeira fina na atmosfera espalha a luz azul.',
  'Uma transmissão de rádio leva entre 4 e 24 minutos para viajar da Terra a Marte.',
  'O Monte Olimpo em Marte é o maior vulcão do Sistema Solar, com 22 km de altitude.',
  'A atmosfera marciana é 100 vezes mais fina que a da Terra e composta por 95% de CO₂.',
  'O instrumento MOXIE da NASA já produziu oxigênio respirável a partir do ar marciano.',
  'Tempestades de poeira marcianas podem engolir o planeta inteiro e durar semanas.',
];

const STEPS = [
  { at: 0, text: 'Iniciando aproximação orbital de Marte…' },
  { at: 25, text: 'Entrando na atmosfera rarefeita a hipervelocidade…' },
  { at: 55, text: 'Acionando retropropulsores e escudo térmico…' },
  { at: 80, text: 'Sincronizando sistemas da base e suporte de vida…' },
  { at: 96, text: 'Aterrissagem confirmada! Acessando habitat…' },
];

interface Props {
  astronautName?: string;
  onComplete: () => void;
}

export function LoadingScreen({ astronautName, onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * MARS_TIPS.length));

  useEffect(() => {
    // Alterna dicas a cada 3.5 segundos
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % MARS_TIPS.length);
    }, 3500);

    // Incrementa progresso suavemente até 100%
    const start = performance.now();
    const duration = 2800; // 2.8 segundos

    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      const p = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(p);

      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          onComplete();
        }, 350);
      }
    }, 40);

    return () => {
      clearInterval(tipTimer);
      clearInterval(interval);
    };
  }, [onComplete]);

  const currentStep = [...STEPS].reverse().find((s) => progress >= s.at)?.text ?? STEPS[0]!.text;

  return (
    <div className="mars-loading-screen" role="status" aria-live="polite">
      {/* Fundo estrelado e poeira orbital */}
      <div className="mars-loading-bg">
        <div className="mars-loading-stars" />
        <div className="mars-loading-planet-glow" />
      </div>

      <div className="mars-loading-content">
        <div className="mars-loading-radar">
          <div className="mars-radar-ring mars-radar-ring--1" />
          <div className="mars-radar-ring mars-radar-ring--2" />
          <img
            src="/assets/branding/mars-outpost-logo.svg"
            alt=""
            className="mars-loading-logo"
            width={64}
            height={64}
          />
        </div>

        <div className="mars-loading-header">
          <span className="mars-loading-kicker">
            EXPEDIÇÃO ARES · {astronautName ? `ASTRONAUTA ${astronautName.toUpperCase()}` : 'MISSÃO MARTE'}
          </span>
          <h1 className="mars-loading-title">Aterrissando na Base</h1>
          <p className="mars-loading-step">{currentStep}</p>
        </div>

        <div className="mars-loading-bar-wrap">
          <div
            className="mars-loading-bar"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="mars-loading-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="mars-loading-pct">{progress}%</span>
        </div>

        <div className="mars-loading-tip-card">
          <span className="mars-tip-badge">CURIOSIDADE CIENTÍFICA</span>
          <p className="mars-tip-text">{MARS_TIPS[tipIndex]}</p>
        </div>
      </div>
    </div>
  );
}
