import { NICKNAME_MAX, NICKNAME_MIN, type RecentWorld } from '@mars/shared';
import { Clock, Compass, KeyRound, Trash2, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getGuestName, saveGuestName } from '../../lib/guest';
import { api } from '../../net/api';
import { useAuth } from '../../store/auth';
import './joinWorldModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onJoin: (roomCode: string, nickname: string) => void;
}

type Tab = 'code' | 'recent';

const BASE_NAMES: Record<string, string> = {
  jezero: 'Jezero',
  utopia: 'Utopia',
  gale: 'Gale',
  olympus: 'Olympus',
  valles: 'Valles',
  hellas: 'Hellas',
  elysium: 'Elysium',
  arcadia: 'Arcadia',
};

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

export function JoinWorldModal({ open, onClose, onJoin }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>('code');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(() => user?.name ?? getGuestName() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recents, setRecents] = useState<RecentWorld[] | null>(null);
  const [canSave, setCanSave] = useState(true);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setError('');
    }
    if (!open && d.open) d.close();
  }, [open]);

  // Mundos recentes: os que este jogador salvou (e ainda não passaram de 30 dias)
  useEffect(() => {
    if (!open || tab !== 'recent') return;
    let alive = true;
    api<{ canSave: boolean; worlds: RecentWorld[] }>('/worlds/recent')
      .then((r) => {
        if (!alive) return;
        setRecents(r.worlds);
        setCanSave(r.canSave);
      })
      .catch(() => alive && setRecents([]));
    return () => {
      alive = false;
    };
  }, [open, tab]);

  /** O apelido é validado e conferido no servidor: ninguém entra com o nome de quem já está no mapa. */
  async function enter(roomCode: string, rawName: string) {
    const cleanName = rawName.trim();
    if (!roomCode) return setError('Por favor, informe o código da sala.');
    if (cleanName.length < NICKNAME_MIN || cleanName.length > NICKNAME_MAX) {
      return setError(`O apelido precisa ter de ${NICKNAME_MIN} a ${NICKNAME_MAX} caracteres.`);
    }
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; error?: string }>('/worlds/check-nickname', {
        body: { code: roomCode, name: cleanName },
      });
      if (!r.ok) return setError(r.error ?? 'Apelido indisponível.');
    } catch {
      /* servidor fora do ar: a sala local não tem conflito; o servidor confere de novo ao entrar */
    } finally {
      setBusy(false);
    }
    saveGuestName(cleanName);
    onJoin(roomCode, cleanName);
    onClose();
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void enter(code.trim().toUpperCase(), nickname);
  };

  async function forget(world: RecentWorld) {
    setRecents((l) => l?.filter((w) => w.code !== world.code) ?? l);
    try {
      await api(`/worlds/${encodeURIComponent(world.code)}`, { method: 'DELETE' });
    } catch {
      /* reaparece na próxima abertura */
    }
  }

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

        <div className="join-tabs" role="tablist" aria-label="Como entrar">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'code'}
            className={`join-tab ${tab === 'code' ? 'join-tab--on' : ''}`}
            onClick={() => setTab('code')}
          >
            <KeyRound size={15} /> Código da sala
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recent'}
            className={`join-tab ${tab === 'recent' ? 'join-tab--on' : ''}`}
            onClick={() => setTab('recent')}
          >
            <Clock size={15} /> Mundos recentes
          </button>
        </div>

        {tab === 'code' ? (
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
                placeholder="Ex: 7A9B"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError('');
                }}
                maxLength={40}
              />
              <span className="join-field-hint">
                O anfitrião encontra o código no topo da tela ou nas configurações.
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
                minLength={NICKNAME_MIN}
                maxLength={NICKNAME_MAX}
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
              <button type="submit" className="join-btn-submit" disabled={busy}>
                <Compass size={18} />
                <span>{busy ? 'Conferindo…' : 'Entrar na Base Marciana'}</span>
              </button>
            </footer>
          </form>
        ) : (
          <div className="join-world-form">
            <p className="join-world-desc">
              Mundos que você salvou. Entrar de novo antes de 30 dias renova o vínculo; depois disso
              o mundo sai da sua lista (e é apagado se ninguém mais o tiver).
            </p>

            {recents === null && <p className="join-recent-empty">Carregando…</p>}
            {recents?.length === 0 && (
              <p className="join-recent-empty">
                {canSave
                  ? 'Nenhum mundo salvo ainda. Ao sair de um mundo, escolha "Salvar e sair".'
                  : 'Para salvar mundos, permita o cookie de salvamento na tela inicial ou entre na sua conta.'}
              </p>
            )}

            <ul className="join-recent-list">
              {recents?.map((w) => (
                <li key={w.code} className="join-recent-item">
                  <div className="join-recent-info">
                    <strong>{BASE_NAMES[w.baseId] ?? w.baseId}</strong>
                    <span>
                      {w.code} · jogou {ago(w.lastSeenAt)}
                      {w.nickname ? ` como ${w.nickname}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="join-recent-go"
                    disabled={busy}
                    onClick={() => void enter(w.code, w.nickname || nickname)}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    className="join-recent-del"
                    onClick={() => void forget(w)}
                    aria-label={`Esquecer o mundo ${w.code}`}
                    title="Esquecer este mundo"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>

            {error && (
              <div className="join-error-box" role="alert">
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
