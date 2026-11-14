import { Compass, KeyRound, User, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getGuestName, saveGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import './joinWorldModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onJoin: (roomCode: string, nickname: string) => void;
}

export function JoinWorldModal({ open, onClose, onJoin }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const user = useAuth((s) => s.user);
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(() => user?.name ?? getGuestName() ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setError('');
    }
    if (!open && d.open) d.close();
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = nickname.trim();

    if (!cleanCode) {
      setError('Por favor, informe o código da sala.');
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      setError('O apelido de astronauta precisa ter ao menos 2 caracteres.');
      return;
    }

    saveGuestName(cleanName);
    onJoin(cleanCode, cleanName);
    onClose();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click closes modal
    <dialog
      ref={dialogRef}
      className="join-world-dialog"
      aria-labelledby="join-world-title"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      <div className="join-world-shell">
        <header className="join-world-header">
          <div className="join-world-brand">
            <span className="join-world-kicker">EXPLORAÇÃO COLETIVA</span>
            <h2 id="join-world-title">Entrar em um Mundo</h2>
          </div>
          <button type="button" className="join-world-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="join-world-form">
          <p className="join-world-desc">
            Conecte-se à base marciana de um amigo inserindo o código compartilhado da missão.
          </p>

          <div className="join-field-group">
            <label htmlFor="join-room-code" className="join-field-label">
              <KeyRound size={16} />
              <span>Código Exclusivo da Sala</span>
            </label>
            <input
              id="join-room-code"
              type="text"
              required
              autoFocus
              className="join-input join-input--code"
              placeholder="Ex: MARS-JEZERO-7A9B"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              maxLength={30}
            />
            <span className="join-field-hint">
              O anfitrião da sala encontra este código no menu de configurações do jogo.
            </span>
          </div>

          <div className="join-field-group">
            <label htmlFor="join-nickname" className="join-field-label">
              <User size={16} />
              <span>Seu Apelido de Astronauta</span>
            </label>
            <input
              id="join-nickname"
              type="text"
              required
              className="join-input"
              placeholder="Ex: Ares-Commander"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError('');
              }}
              minLength={2}
              maxLength={24}
            />
          </div>

          {error && (
            <div className="join-error-box" role="alert">
              <span>{error}</span>
            </div>
          )}

          <footer className="join-world-footer">
            <button type="button" className="join-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="join-btn-submit">
              <Compass size={18} />
              <span>Entrar na Base Marciana</span>
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}
