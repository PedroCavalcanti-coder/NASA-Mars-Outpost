import {
  type DirectMessage,
  type FriendInfo,
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_SIZE,
} from '@mars/shared';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { clock, dayLabel } from '../../lib/format';
import { api } from '../../net/api';
import { useAuth } from '../../store/auth';
import { onDirectMessage, useRealtime } from '../../store/realtime';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Empty, Spinner } from '../../ui/Empty';
import { toast } from '../../ui/toast';

export default function Messages() {
  const { userId } = useParams();
  const nav = useNavigate();
  const me = useAuth((s) => s.user)!;
  const { socket, online, unread, friendsVersion, setActiveChat, clearUnread } = useRealtime();
  const [friends, setFriends] = useState<FriendInfo[] | null>(null);
  const [messages, setMessages] = useState<DirectMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const friend = friends?.find((f) => f.user.id === userId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega quando a lista de amigos muda
  useEffect(() => {
    api<{ friends: FriendInfo[] }>('/friends')
      .then((d) => setFriends(d.friends))
      .catch(() => setFriends([]));
  }, [friendsVersion]);

  const markRead = useCallback(
    (from: string) => {
      clearUnread(from);
      socket?.emit('dm:read', { from });
    },
    [socket, clearUnread],
  );

  // Abre uma conversa: carrega o histórico e marca como lida.
  useEffect(() => {
    setMessages(null);
    setHasMore(false);
    setActiveChat(userId ?? null);
    if (!userId) return;
    let alive = true;
    api<DirectMessage[]>(`/messages/${userId}`)
      .then((m) => {
        if (!alive) return;
        setMessages(m);
        setHasMore(m.length >= MESSAGE_PAGE_SIZE);
        markRead(userId);
      })
      .catch((e) => {
        if (!alive) return;
        toast((e as Error).message, 'error');
        nav('/mensagens', { replace: true });
      });
    return () => {
      alive = false;
      setActiveChat(null);
    };
  }, [userId, nav, markRead, setActiveChat]);

  // Mensagens que chegam em tempo real (do amigo ou de outra aba minha).
  useEffect(() => {
    if (!userId) return;
    return onDirectMessage((m) => {
      const inThisChat =
        (m.from === userId && m.to === me.id) || (m.from === me.id && m.to === userId);
      if (!inThisChat) return;
      setMessages((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
      if (m.from === userId) markRead(userId);
    });
  }, [userId, me.id, markRead]);

  // O amigo leu minhas mensagens.
  useEffect(() => {
    if (!socket || !userId) return;
    const onRead = ({ by, at }: { by: string; at: string }) => {
      if (by === userId)
        setMessages(
          (prev) =>
            prev?.map((m) => (m.from === me.id && !m.readAt ? { ...m, readAt: at } : m)) ?? prev,
        );
    };
    socket.on('dm:read', onRead);
    return () => void socket.off('dm:read', onRead);
  }, [socket, userId, me.id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rola para o fim quando chega mensagem
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  async function loadOlder() {
    const first = messages?.[0];
    if (!first || !userId) return;
    const older = await api<DirectMessage[]>(
      `/messages/${userId}?before=${encodeURIComponent(first.createdAt)}`,
    );
    setMessages((prev) => [...older, ...(prev ?? [])]);
    setHasMore(older.length >= MESSAGE_PAGE_SIZE);
  }

  function send(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || !userId || !socket?.connected) return;
    setSending(true);
    socket.emit('dm:send', { to: userId, text: value }, (res) => {
      setSending(false);
      if (!res.ok) return toast(res.error, 'error');
      setText('');
      setMessages((prev) =>
        prev && !prev.some((x) => x.id === res.message.id) ? [...prev, res.message] : prev,
      );
    });
  }

  if (friends === null) return <Spinner />;

  let lastDay = '';
  return (
    <>
      <div className="page-head page-head--hide-sm">
        <div>
          <h1>Mensagens</h1>
          <p>Converse em tempo real com os amigos da tripulação.</p>
        </div>
      </div>

      {friends.length === 0 ? (
        <Empty
          icon={<MessageCircle />}
          title="Nenhum amigo para conversar"
          action={
            <Link to="/amigos" className="btn btn--primary">
              Adicionar amigos
            </Link>
          }
        >
          Assim que alguém aceitar seu pedido de amizade, a conversa aparece aqui.
        </Empty>
      ) : (
        <div className="card chat" data-open={!!userId} style={{ padding: 0 }}>
          <div className="chat__list">
            {friends.map((f) => (
              <button
                key={f.id}
                type="button"
                className="chat__item"
                aria-current={f.user.id === userId}
                onClick={() => nav(`/mensagens/${f.user.id}`)}
              >
                <Avatar id={f.user.id} name={f.user.name} online={online.has(f.user.id)} />
                <span className="row__main">
                  <span className="row__title">{f.user.name}</span>
                  <span className="row__sub" style={{ display: 'block' }}>
                    @{f.user.username}
                  </span>
                </span>
                {(unread[f.user.id] ?? 0) > 0 && (
                  <span className="badge badge--count">{unread[f.user.id]}</span>
                )}
              </button>
            ))}
          </div>

          <div className="chat__thread">
            {!userId || !friend ? (
              <Empty icon={<MessageCircle />} title="Escolha uma conversa">
                Selecione um amigo na lista para começar.
              </Empty>
            ) : (
              <>
                <header className="chat__head">
                  <Button
                    className="chat__back btn--icon"
                    size="sm"
                    aria-label="Voltar"
                    onClick={() => nav('/mensagens')}
                  >
                    <ArrowLeft />
                  </Button>
                  <Avatar
                    id={friend.user.id}
                    name={friend.user.name}
                    online={online.has(friend.user.id)}
                    size={36}
                  />
                  <div className="row__main">
                    <div className="row__title">{friend.user.name}</div>
                    <div className="row__sub">
                      {online.has(friend.user.id) ? 'online' : 'offline'}
                    </div>
                  </div>
                </header>
                <div className="chat__msgs" aria-live="polite">
                  {messages === null ? (
                    <Spinner />
                  ) : (
                    <>
                      {hasMore && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={loadOlder}
                          style={{ alignSelf: 'center' }}
                        >
                          Mensagens anteriores
                        </Button>
                      )}
                      {messages.length === 0 && (
                        <p className="text-mute" style={{ textAlign: 'center' }}>
                          Diga olá!
                        </p>
                      )}
                      {messages.map((m) => {
                        const day = dayLabel(m.createdAt);
                        const header =
                          day !== lastDay ? (
                            <div key={`d-${m.id}`} className="chat__day">
                              {day}
                            </div>
                          ) : null;
                        lastDay = day;
                        const mine = m.from === me.id;
                        return (
                          <div key={m.id} style={{ display: 'contents' }}>
                            {header}
                            <div className={`bubble ${mine ? 'bubble--me' : ''}`}>
                              {m.text}
                              <small>
                                {clock(m.createdAt)}
                                {mine && m.readAt ? ' · lida' : ''}
                              </small>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={endRef} />
                    </>
                  )}
                </div>
                <form className="chat__form" onSubmit={send}>
                  <input
                    className="input"
                    aria-label="Mensagem"
                    placeholder="Escreva uma mensagem…"
                    value={text}
                    maxLength={MESSAGE_MAX_LENGTH}
                    onChange={(e) => setText(e.target.value)}
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<Send />}
                    loading={sending}
                    disabled={!text.trim()}
                  >
                    Enviar
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
