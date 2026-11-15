import { NICKNAME_MAX, NICKNAME_MIN } from '@mars/shared';
import { Rocket, User, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { getGuestName, saveGuestName } from '../../lib/guest';
import { L } from '../../lib/i18n';

interface PlayModalProps {
  open: boolean;
  onClose: () => void;
  onStart?: () => void;
}

/** Pop-up do botão "Jogar": pede só o apelido (sem conta) e decola para a base em Marte. */
export function PlayModal({ open, onClose, onStart }: PlayModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const nav = useNavigate();
  const [name, setName] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setName(getGuestName() ?? '');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (value.length < NICKNAME_MIN) return;
    saveGuestName(value);
    onClose();
    if (onStart) {
      onStart();
    } else {
      nav('/jogar');
    }
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clique no fundo fecha; Esc é nativo do <dialog>
    <dialog
      ref={ref}
      className="launch-dialog play-dialog"
      aria-labelledby="play-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <form onSubmit={onSubmit} className="play-dialog__form">
        <div className="launch-dialog-head">
          <span className="launch-dialog-kicker">{L('MARS OUTPOST · EXPEDIÇÃO', 'MARS OUTPOST · EXPEDITION')}</span>
          <button
            className="launch-dialog-close"
            type="button"
            aria-label={L('Fechar', 'Close')}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>

        <h2 id="play-dialog-title">{L('Como devemos te chamar?', 'What should we call you?')}</h2>
        <p className="play-dialog__desc">
          {L('Escolha seu nome de astronauta para a missão. Você não precisa criar conta para explorar as bases de Marte.', 'Pick your astronaut name for the mission. You do not need an account to explore the Mars bases.')}
        </p>

        <div className="play-dialog__field">
          <label htmlFor="astronaut-name" className="play-dialog__label">
            {L('Nome do Astronauta', 'Astronaut Name')}
          </label>
          <div className="play-dialog__input-wrap">
            <User size={18} className="play-dialog__input-icon" aria-hidden="true" />
            <input
              id="astronaut-name"
              type="text"
              className="play-dialog__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={NICKNAME_MIN}
              maxLength={NICKNAME_MAX}
              placeholder={L('Seu apelido de astronauta', 'Your astronaut nickname')}
              autoComplete="nickname"
              required
              autoFocus
            />
          </div>
        </div>

        <button
          type="submit"
          className="launch-cta play-dialog__submit"
          disabled={name.trim().length < NICKNAME_MIN}
        >
          <span className="launch-cta-icon" aria-hidden="true">
            <Rocket size={32} />
          </span>
          <span className="launch-cta-label">
            {L('Iniciar Decolagem', 'Start Launch')}
            <small>{L('Lançar rumo à base marciana', 'Launch toward the Mars base')}</small>
          </span>
        </button>
      </form>
    </dialog>
  );
}
