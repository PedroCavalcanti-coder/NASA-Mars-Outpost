import { NAME_MAX, NAME_MIN } from '@mars/shared';
import { Rocket, User, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { saveGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';

/** Pop-up do botão "Jogar": pede só o apelido (sem conta) e leva à página do jogo. */
export function PlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const [name, setName] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setName(user?.name ?? '');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, user]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (value.length < NAME_MIN) return;
    saveGuestName(value);
    nav('/jogar');
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clique no fundo fecha; Esc é nativo do <dialog>
    <dialog
      ref={ref}
      className="modal"
      aria-label="Começar a jogar"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <form className="modal__body" onSubmit={onSubmit}>
        <button
          type="button"
          className="icon-btn modal__close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X />
        </button>
        <span className="eyebrow">Missão rápida</span>
        <h2>Como devemos te chamar?</h2>
        <p className="text-mute">
          Escolha um apelido e comece. Você não precisa criar conta para jogar.
        </p>
        <Field
          label="Apelido"
          icon={<User />}
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={NAME_MIN}
          maxLength={NAME_MAX}
          placeholder="Seu nome de astronauta"
          autoComplete="nickname"
          required
          autoFocus
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          icon={<Rocket />}
          disabled={name.trim().length < NAME_MIN}
        >
          Começar a jogar
        </Button>
      </form>
    </dialog>
  );
}
