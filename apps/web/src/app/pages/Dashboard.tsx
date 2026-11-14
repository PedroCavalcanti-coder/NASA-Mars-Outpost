import type { FriendsResponse } from '@mars/shared';
import { Gamepad2, MessageCircle, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../net/api';
import { useAuth } from '../../store/auth';
import { useRealtime } from '../../store/realtime';
import { Avatar } from '../../ui/Avatar';
import { ButtonLink } from '../../ui/Button';

export default function Dashboard() {
  const user = useAuth((s) => s.user)!;
  const { online, pendingRequests, unread, friendsVersion } = useRealtime();
  const [data, setData] = useState<FriendsResponse | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega quando a lista muda no servidor
  useEffect(() => {
    api<FriendsResponse>('/friends')
      .then(setData)
      .catch(() => {});
  }, [friendsVersion]);

  const friends = data?.friends ?? [];
  const onlineFriends = friends.filter((f) => online.has(f.user.id));
  const unreadTotal = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Central de comando</span>
          <h1>Olá, {user.name.split(' ')[0]}!</h1>
          <p>Reúna sua tripulação. A missão em Marte está sendo construída.</p>
        </div>
      </div>

      <div className="stats">
        <Link to="/amigos" className="card stat">
          <span className="stat__n">{onlineFriends.length}</span>
          <span className="stat__label">
            amigo(s) online <span className="text-mute">de {friends.length}</span>
          </span>
        </Link>
        <Link to="/amigos" className="card stat">
          <span className="stat__n">{pendingRequests}</span>
          <span className="stat__label">pedido(s) de amizade</span>
        </Link>
        <Link to="/mensagens" className="card stat">
          <span className="stat__n">{unreadTotal}</span>
          <span className="stat__label">mensagem(ns) não lida(s)</span>
        </Link>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 12 }}>Tripulação online</h2>
        {onlineFriends.length === 0 ? (
          <p className="text-mute">
            {friends.length === 0
              ? 'Você ainda não tem amigos por aqui. Adicione alguém pelo apelido.'
              : 'Ninguém online agora.'}
          </p>
        ) : (
          <div className="rows">
            {onlineFriends.map((f) => (
              <div key={f.id} className="row">
                <Avatar id={f.user.id} name={f.user.name} online />
                <div className="row__main">
                  <div className="row__title">{f.user.name}</div>
                  <div className="row__sub">@{f.user.username}</div>
                </div>
                <ButtonLink to={`/mensagens/${f.user.id}`} size="sm" icon={<MessageCircle />}>
                  Conversar
                </ButtonLink>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <ButtonLink
            to="/amigos"
            variant="ghost"
            size="sm"
            icon={friends.length ? <Users /> : <UserPlus />}
          >
            {friends.length ? 'Ver todos os amigos' : 'Adicionar amigos'}
          </ButtonLink>
        </div>
      </section>

      <section className="card mission-card">
        <span className="feature__icon">
          <Gamepad2 size={22} />
        </span>
        <h2>Missões em breve</h2>
        <p className="text-mute">
          Aqui você criará o mundo da base e convidará seus amigos para sobreviver juntos em Marte.
        </p>
      </section>
    </>
  );
}
