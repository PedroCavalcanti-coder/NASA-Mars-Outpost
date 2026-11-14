import {
  type FriendInfo,
  type FriendsResponse,
  USER_SEARCH_LIMIT,
  USERNAME_MAX,
  type UserSearchResult,
} from '@mars/shared';
import {
  AtSign,
  Check,
  Clock,
  Inbox,
  MessageCircle,
  Send,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { monthYear, timeAgo } from '../../lib/format';
import { api } from '../../net/api';
import { useRealtime } from '../../store/realtime';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Empty, Spinner } from '../../ui/Empty';
import { Field } from '../../ui/Field';
import { toast } from '../../ui/toast';

type Tab = 'friends' | 'incoming' | 'outgoing';

export default function Friends() {
  const { online, friendsVersion, refreshCounters } = useRealtime();
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [tab, setTab] = useState<Tab>('friends');
  const [username, setUsername] = useState('');
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const d = await api<FriendsResponse>('/friends');
      setData(d);
      void refreshCounters();
      return d;
    } catch (e) {
      toast((e as Error).message, 'error');
      return null;
    }
  }, [refreshCounters]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega também quando o servidor avisa
  useEffect(() => {
    void reload();
  }, [reload, friendsVersion]);

  // Se há pedidos e nenhum amigo ainda, abre direto em "Recebidos".
  useEffect(() => {
    if (data && data.friends.length === 0 && data.incoming.length > 0) setTab('incoming');
  }, [data]);

  // Sugestões de apelido enquanto digita (com pequena espera para não sobrecarregar).
  useEffect(() => {
    const q = username.trim().replace(/^@/, '');
    if (q.length < 2) return setSuggestions([]);
    const t = setTimeout(() => {
      api<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [username]);

  async function add(name: string) {
    setSending(true);
    try {
      const r = await api<{ status: 'pending' | 'accepted' }>('/friends', {
        body: { username: name.trim().replace(/^@/, '') },
      });
      toast(r.status === 'accepted' ? 'Vocês agora são amigos!' : 'Pedido de amizade enviado');
      setUsername('');
      setSuggestions([]);
      await reload();
      setTab(r.status === 'accepted' ? 'friends' : 'outgoing');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void add(username);
  }

  async function act(f: FriendInfo, action: 'accept' | 'remove', ok: string) {
    setBusy(f.id);
    try {
      if (action === 'accept') await api(`/friends/${f.id}/accept`, { method: 'POST' });
      else await api(`/friends/${f.id}`, { method: 'DELETE' });
      toast(ok, action === 'accept' ? 'ok' : 'info');
      setConfirmRemove(null);
      const d = await reload();
      if (d && tab !== 'friends' && d[tab].length === 0) setTab('friends');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Users; n: number }[] = [
    { id: 'friends', label: 'Amigos', icon: Users, n: data?.friends.length ?? 0 },
    { id: 'incoming', label: 'Recebidos', icon: Inbox, n: data?.incoming.length ?? 0 },
    { id: 'outgoing', label: 'Enviados', icon: Clock, n: data?.outgoing.length ?? 0 },
  ];
  const list = data?.[tab] ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Amigos</h1>
          <p>Adicione pelo apelido. Quando a missão estiver pronta, é só convidar.</p>
        </div>
      </div>

      <form className="card" style={{ marginBottom: 24 }} onSubmit={onSubmit}>
        <div className="inline-form">
          <Field
            label="Adicionar amigo pelo apelido"
            icon={<AtSign />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="apelido_do_amigo"
            maxLength={USERNAME_MAX + 1}
            autoComplete="off"
            required
          />
          <Button
            type="submit"
            variant="primary"
            icon={<Send />}
            loading={sending}
            style={{ marginBottom: 2 }}
          >
            Enviar pedido
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.slice(0, USER_SEARCH_LIMIT).map((u) => (
              <div key={u.id} className="row">
                <Avatar id={u.id} name={u.name} size={34} />
                <div className="row__main">
                  <div className="row__title">{u.name}</div>
                  <div className="row__sub">@{u.username}</div>
                </div>
                {u.relation === 'none' && (
                  <Button size="sm" icon={<UserPlus />} onClick={() => add(u.username)}>
                    Adicionar
                  </Button>
                )}
                {u.relation === 'incoming' && (
                  <Button size="sm" variant="primary" onClick={() => add(u.username)}>
                    Aceitar
                  </Button>
                )}
                {u.relation === 'outgoing' && <span className="badge">Pedido enviado</span>}
                {u.relation === 'friend' && <span className="badge">Já são amigos</span>}
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="tabs" role="tablist" aria-label="Lista de amigos">
        {tabs.map(({ id, label, icon: Icon, n }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="friends-panel"
            onClick={() => setTab(id)}
          >
            <Icon size={18} /> {label}
            {n > 0 && (
              <span className={`badge ${id === 'incoming' ? 'badge--count' : ''}`}>{n}</span>
            )}
          </button>
        ))}
      </div>

      <div id="friends-panel" role="tabpanel" style={{ marginTop: 16 }}>
        {data === null ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty
            icon={tab === 'friends' ? <UserPlus /> : tab === 'incoming' ? <Inbox /> : <Clock />}
            title={
              tab === 'friends'
                ? 'Sua tripulação está vazia'
                : tab === 'incoming'
                  ? 'Nenhum pedido recebido'
                  : 'Nenhum pedido enviado'
            }
          >
            {tab === 'friends'
              ? 'Busque pelo apelido para montar sua equipe de missão.'
              : tab === 'incoming'
                ? 'Quando alguém te adicionar, o pedido aparece aqui na hora.'
                : 'Pedidos aguardando resposta aparecem aqui.'}
          </Empty>
        ) : (
          <div className="rows">
            {list.map((f) => (
              <div key={f.id} className="row">
                <Avatar
                  id={f.user.id}
                  name={f.user.name}
                  online={tab === 'friends' ? online.has(f.user.id) : undefined}
                />
                <div className="row__main">
                  <div className="row__title">{f.user.name}</div>
                  <div className="row__sub">
                    @{f.user.username} ·{' '}
                    {tab === 'friends' ? `amigos desde ${monthYear(f.since)}` : timeAgo(f.since)}
                  </div>
                </div>
                <div className="row__actions">
                  {tab === 'incoming' && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Check />}
                        loading={busy === f.id}
                        onClick={() => act(f, 'accept', `Você e ${f.user.name} agora são amigos`)}
                      >
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        className="btn--icon"
                        aria-label={`Recusar pedido de ${f.user.name}`}
                        onClick={() => act(f, 'remove', 'Pedido recusado')}
                      >
                        <X />
                      </Button>
                    </>
                  )}
                  {tab === 'outgoing' && (
                    <Button size="sm" onClick={() => act(f, 'remove', 'Pedido cancelado')}>
                      Cancelar
                    </Button>
                  )}
                  {tab === 'friends' &&
                    (confirmRemove === f.id ? (
                      <>
                        <Button size="sm" onClick={() => setConfirmRemove(null)}>
                          Manter
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busy === f.id}
                          onClick={() => act(f, 'remove', `${f.user.name} removido dos amigos`)}
                        >
                          Remover
                        </Button>
                      </>
                    ) : (
                      <>
                        <Link
                          to={`/mensagens/${f.user.id}`}
                          className="btn btn--sm btn--icon"
                          aria-label={`Conversar com ${f.user.name}`}
                          title="Conversar"
                        >
                          <MessageCircle />
                        </Link>
                        <Button
                          size="sm"
                          className="btn--icon"
                          aria-label={`Remover ${f.user.name}`}
                          title="Remover amigo"
                          onClick={() => setConfirmRemove(f.id)}
                        >
                          <UserMinus />
                        </Button>
                      </>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
