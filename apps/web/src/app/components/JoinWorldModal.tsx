import { GAME_ROOM_CODE_RE, NICKNAME_MAX, NICKNAME_MIN, type RecentWorld } from '@mars/shared';
import { Clock, Compass, KeyRound, Trash2, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getGuestName, saveGuestName } from '../../lib/guest';
import { api } from '../../net/api';
import './joinWorldModal.css';
import { L } from '../../lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  onJoin: (roomCode: string, nickname: string, baseId?: string, hasSuit?: boolean) => void;
  /** código já preenchido (convite por link) */
  initialCode?: string;
  /** aba aberta ao mostrar a janela ("Meus mundos" abre direto na lista) */
  initialTab?: Tab;
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
  if (days <= 0) return L('hoje', 'today');
  if (days === 1) return L('ontem', 'yesterday');
  return L(`há ${days} dias`, `${days} days ago`);
}

export function JoinWorldModal({
  open,
  onClose,
  onJoin,
  initialCode = '',
  initialTab = 'code',
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>('code');
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState(() => getGuestName() ?? '');
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
      setTab(initialTab);
    }
    if (!open && d.open) d.close();
  }, [open, initialTab]);

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
  async function enter(roomCode: string, rawName: string, baseId?: string) {
    const cleanName = rawName.trim();
    if (busy) return;
    if (!GAME_ROOM_CODE_RE.test(roomCode))
      return setError(L('Código inválido. Use de 3 a 40 letras, números, hífen ou sublinhado.', 'Invalid code. Use 3 to 40 letters, numbers, hyphens or underscores.'));
    if (cleanName.length < NICKNAME_MIN || cleanName.length > NICKNAME_MAX) {
      return setError(L(`O apelido precisa ter de ${NICKNAME_MIN} a ${NICKNAME_MAX} caracteres.`, `Your nickname needs ${NICKNAME_MIN} to ${NICKNAME_MAX} characters.`));
    }
    setBusy(true);
    let realBase = baseId;
    let hasSuit = false;
    try {
      const r = await api<{ ok: boolean; error?: string; baseId?: string; hasSuit?: boolean }>('/worlds/check-nickname', {
        body: { code: roomCode, name: cleanName },
      });
      if (!r.ok) return setError(r.error ?? L('Apelido indisponível.', 'Nickname not available.'));
      realBase = r.baseId ?? baseId;
      hasSuit = Boolean(r.hasSuit);
    } catch {
      return setError(L('Não foi possível consultar a sala. Verifique a conexão e tente novamente.', 'Could not check the room. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
    saveGuestName(cleanName);
    onJoin(roomCode, cleanName, realBase, hasSuit);
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
            <span className="join-world-kicker">{L('EXPLORAÇÃO COLETIVA', 'TEAM EXPLORATION')}</span>
            <h2 id="join-world-title">{L('Entrar em um Mundo', 'Join a World')}</h2>
          </div>
          <button type="button" className="join-world-close" onClick={onClose} aria-label={L('Fechar', 'Close')}>
            <X size={20} />
          </button>
        </header>

        <div className="join-tabs" role="tablist" aria-label={L('Como entrar', 'How to join')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'code'}
            className={`join-tab ${tab === 'code' ? 'join-tab--on' : ''}`}
            onClick={() => setTab('code')}
          >
            <KeyRound size={15} /> {L('Código da sala', 'Room code')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recent'}
            className={`join-tab ${tab === 'recent' ? 'join-tab--on' : ''}`}
            onClick={() => setTab('recent')}
          >
            <Clock size={15} /> {L('Meus mundos', 'My worlds')}
          </button>
        </div>

        {tab === 'code' ? (
          <form onSubmit={handleSubmit} className="join-world-form">
            <p className="join-world-desc">
              {L('Conecte-se à base marciana de um amigo inserindo o código compartilhado da missão.', 'Join a friend\'s Mars base by typing the shared mission code.')}
            </p>

            <div className="join-field-group">
              <label htmlFor="join-room-code" className="join-field-label">
                <KeyRound size={16} />
                <span>{L('Código Exclusivo da Sala', 'Room Code')}</span>
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
                {L('O anfitrião encontra o código no topo da tela ou nas configurações.', 'The host finds the code at the top of the screen or in the settings.')}
              </span>
            </div>

            <div className="join-field-group">
              <label htmlFor="join-nickname" className="join-field-label">
                <User size={16} />
                <span>{L('Seu Apelido de Astronauta', 'Your Astronaut Nickname')}</span>
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
                {L('Cancelar', 'Cancel')}
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
              {L('Seus 5 mundos mais recentes. Cada "Jogar agora" cria um mundo novo e, passando de 5, o mais antigo sai da lista. Mundos sem uso há 30 dias também saem.', 'Your 5 most recent worlds. Each “Play now” creates a new world and, past 5, the oldest leaves the list. Worlds unused for 30 days also leave.')}
            </p>

            {recents === null && <p className="join-recent-empty">{L('Carregando…', 'Loading…')}</p>}
            {recents?.length === 0 && (
              <p className="join-recent-empty">
                {canSave
                  ? 'Nenhum mundo ainda. Clique em "Jogar agora" para criar o primeiro.'
                  : 'Para salvar mundos, permita o cookie de salvamento na tela inicial.'}
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
                    onClick={() => void enter(w.code, w.nickname || nickname, w.baseId)}
                  >
                    {L('Entrar', 'Join')}
                  </button>
                  <button
                    type="button"
                    className="join-recent-del"
                    onClick={() => void forget(w)}
                    aria-label={`Esquecer o mundo ${w.code}`}
                    title={L('Esquecer este mundo', 'Forget this world')}
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
