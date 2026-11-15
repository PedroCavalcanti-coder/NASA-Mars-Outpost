import { useEffect, useRef } from 'react';
import { L } from '../../lib/i18n';
import './difficultyModal.css';

export type Difficulty = 'easy' | 'normal' | 'hard';

const OPTIONS: Array<{
  id: Difficulty;
  icon: string;
  title: [string, string];
  lines: Array<[string, string]>;
}> = [
  {
    id: 'easy',
    icon: '🌱',
    title: ['Fácil', 'Easy'],
    lines: [
      ['Menos consumo de ar e comida', 'Less air and food use'],
      ['Eventos machucam menos', 'Events hurt less'],
      ['Menos radiação, mais tempo na expedição (5 min)', 'Less radiation, more expedition time (5 min)'],
    ],
  },
  {
    id: 'normal',
    icon: '🚀',
    title: ['Médio', 'Medium'],
    lines: [
      ['Como a missão foi pensada', 'The mission as designed'],
      ['Eventos e radiação equilibrados', 'Balanced events and radiation'],
      ['Expedição de 4 minutos', '4-minute expedition'],
    ],
  },
  {
    id: 'hard',
    icon: '🔥',
    title: ['Difícil', 'Hard'],
    lines: [
      ['Mais consumo de ar e comida (+30%)', 'More air and food use (+30%)'],
      ['Mais eventos grandes que machucam mais', 'More big events that hurt more'],
      ['Radiação longa e forte, expedição de 3 min', 'Long, strong radiation; 3-minute expedition'],
    ],
  },
];

/** Escolha de dificuldade ao clicar em "Jogar agora": só depois dela começa a animação. */
export function DifficultyModal({
  open,
  onPick,
  onClose,
}: {
  open: boolean;
  onPick: (d: Difficulty) => void;
  onClose: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="diff-modal" role="dialog" aria-modal="true" aria-label={L('Escolha a dificuldade', 'Pick a difficulty')}>
      <div className="diff-modal__card">
        <h2>{L('Escolha a dificuldade', 'Pick a difficulty')}</h2>
        <p>{L('Ela fica guardada neste mundo e muda as regras de verdade.', 'It is saved with this world and really changes the rules.')}</p>
        <div className="diff-modal__grid">
          {OPTIONS.map((o, i) => (
            <button key={o.id} ref={i === 1 ? first : undefined} aria-label={L(o.title[0], o.title[1])} type="button" className={`diff-card diff-card--${o.id}`} onClick={() => onPick(o.id)}>
              <span className="diff-card__icon" aria-hidden="true">{o.icon}</span>
              <strong>{L(o.title[0], o.title[1])}</strong>
              <ul>
                {o.lines.map((l) => (
                  <li key={l[0]}>{L(l[0], l[1])}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <button type="button" className="diff-modal__cancel" onClick={onClose}>
          {L('Voltar', 'Back')}
        </button>
      </div>
    </div>
  );
}
