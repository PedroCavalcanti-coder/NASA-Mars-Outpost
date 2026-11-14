import { NAME_MAX, NAME_MIN } from '@mars/shared';
import { Rocket, User, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { getGuestName, saveGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';

interface PlayModalProps {
  open: boolean;
  onClose: () => void;
  onStart?: () => void;
}

/** Pop-up do botão "Jogar": pede só o apelido (sem conta) e decola para a base em Marte. */
export function PlayModal({ open, onClose, onStart }: PlayModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const [name, setName] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setName(user?.name ?? getGuestName() ?? '');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, user]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (value.length < NAME_MIN) return;
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
          <span className="launch-dialog-kicker">MARS OUTPOST · EXPEDIÇÃO</span>
          <button
            className="launch-dialog-close"
            type="button"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>

        <h2 id="play-dialog-title">Como devemos te chamar?</h2>
        <p className="play-dialog__desc">
          Escolha seu nome de astronauta para a missão. Você não precisa criar conta para explorar as bases de Marte.
        </p>

        <div className="play-dialog__field">
          <label htmlFor="astronaut-name" className="play-dialog__label">
            Nome do Astronauta
          </label>
          <div className="play-dialog__input-wrap">
            <User size={18} className="play-dialog__input-icon" aria-hidden="true" />
            <input
              id="astronaut-name"
              type="text"
              className="play-dialog__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={NAME_MIN}
              maxLength={NAME_MAX}
              placeholder="Seu apelido de astronauta"
              autoComplete="nickname"
              required
              autoFocus
            />
          </div>
        </div>

        <button
          type="submit"
          className="launch-cta play-dialog__submit"
          disabled={name.trim().length < NAME_MIN}
        >
          <span className="launch-cta-icon" aria-hidden="true">
            <Rocket size={32} />
          </span>
          <span className="launch-cta-label">
            Iniciar Decolagem
            <small>Lançar rumo à base marciana</small>
          </span>
        </button>
      </form>
    </dialog>
  );
}
