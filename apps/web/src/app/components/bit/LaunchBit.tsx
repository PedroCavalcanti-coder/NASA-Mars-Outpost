import { useEffect, useState } from 'react';
import { L } from '../../../lib/i18n';
import { BitCharacter } from './BitCharacter';
import './bit.css';

/** Falas do B.I.T. durante a viagem: a missão e por que os astronautas vão a Marte. */
const STORY = [
  {
    pt: 'Decolamos! Estamos indo para Marte!',
    en: 'We have lift-off! We are heading to Mars!',
  },
  {
    pt: 'Os astronautas vão a Marte com um objetivo: concluir a pesquisa sobre o solo e sobre microrganismos marcianos.',
    en: 'The astronauts are going to Mars with one goal: to finish the research about Martian soil and microorganisms.',
  },
  {
    pt: 'Cientistas querem saber se Marte já teve vida, mesmo que bem pequenininha. O solo e as rochas podem guardar essas pistas.',
    en: 'Scientists want to know if Mars ever had life, even tiny life. The soil and the rocks may hold those clues.',
  },
  {
    pt: 'Lá, você cuida da base: oxigênio, energia e comida. Sem eles, não existe pesquisa!',
    en: 'There, you take care of the base: oxygen, power and food. Without them, there is no research!',
  },
] as const;

/**
 * B.I.T. na tela de lançamento: faz a contagem regressiva antes da decolagem e, durante a viagem,
 * conta que a missão é concluir a pesquisa sobre solos e microrganismos.
 */
export function LaunchBit({
  phase,
  count,
}: {
  phase: 'countdown' | 'ignition' | 'flight' | 'complete';
  count: number;
}) {
  const [step, setStep] = useState(0);

  // depois da decolagem, uma fala nova a cada alguns segundos (a última fica na tela)
  useEffect(() => {
    if (phase === 'countdown') {
      setStep(0);
      return;
    }
    const id = window.setInterval(() => setStep((n) => Math.min(STORY.length - 1, n + 1)), 4800);
    return () => window.clearInterval(id);
  }, [phase]);

  const counting = phase === 'countdown';
  const line = STORY[step] ?? STORY[0];
  return (
    <aside className="bit-guide bit-guide--launch" aria-live="polite">
      <div className="bit-dialogue">
        <div className="bit-dialogue__heading">
          <span>B.I.T.</span>
          <span>{counting ? L('CONTAGEM REGRESSIVA', 'COUNTDOWN') : L('SEU PARCEIRO DE MISSÃO', 'YOUR MISSION BUDDY')}</span>
        </div>
        {counting ? (
          <p className="bit-countdown">
            <strong>{count}</strong>
            <span>
              {count > 3
                ? L('Preparar para a decolagem…', 'Getting ready for liftoff…')
                : count > 1
                  ? L('Motores ligando!', 'Engines starting!')
                  : L('Já vai!', 'Here we go!')}
            </span>
          </p>
        ) : (
          <p key={step}>{L(line.pt, line.en)}</p>
        )}
      </div>
      <div className="bit-avatar bit-avatar--static" aria-hidden="true">
        <BitCharacter expression={counting ? 'excited' : step === 0 ? 'celebrating' : 'talking'} />
        <span className="bit-name">B.I.T.</span>
      </div>
    </aside>
  );
}
