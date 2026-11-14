import { Home, LogOut, MessageCircle, User, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../store/auth';
import { useRealtime } from '../store/realtime';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';

function Count({ n }: { n: number }) {
  return n > 0 ? <span className="badge badge--count">{n > 99 ? '99+' : n}</span> : null;
}

/** Área logada: barra lateral (desktop) ou barra superior + abas inferiores (celular). */
export function AppLayout() {
  const user = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);
  const { pendingRequests, unread, connected, refreshCounters } = useRealtime();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const unreadTotal = Object.values(unread).reduce((a, b) => a + b, 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: atualiza os contadores a cada troca de rota
  useEffect(() => {
    void refreshCounters();
  }, [pathname]);

  async function onLogout() {
    await logout();
    nav('/');
  }

  const items = [
    { to: '/central', label: 'Central', icon: Home, count: 0 },
    { to: '/amigos', label: 'Amigos', icon: Users, count: pendingRequests },
    { to: '/mensagens', label: 'Mensagens', icon: MessageCircle, count: unreadTotal },
    { to: '/perfil', label: 'Perfil', icon: User, count: 0 },
  ];

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Logo to="/central" compact />
        <Link to="/perfil" aria-label="Meu perfil">
          <Avatar id={user.id} name={user.name} size={36} />
        </Link>
      </header>

      <aside className="app-sidebar">
        <Logo to="/central" />
        <nav className="side-nav" aria-label="Área do jogador">
          {items.map(({ to, label, icon: Icon, count }) => (
            <NavLink key={to} to={to}>
              <Icon /> {label} <Count n={count} />
            </NavLink>
          ))}
        </nav>
        <div className="side-user">
          <Avatar id={user.id} name={user.name} />
          <div className="side-user__info">
            <div className="side-user__name">{user.name}</div>
            <div className="side-user__sub">@{user.username}</div>
            <span className="conn" data-on={connected}>
              <i /> {connected ? 'Conectado' : 'Reconectando…'}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onLogout}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut />
          </button>
        </div>
      </aside>

      <main className="app-main" id="conteudo">
        <Outlet />
      </main>

      <nav className="app-tabbar" aria-label="Área do jogador">
        {items.map(({ to, label, icon: Icon, count }) => (
          <NavLink key={to} to={to}>
            <Icon /> {label}
            <Count n={count} />
          </NavLink>
        ))}
        <button type="button" onClick={onLogout}>
          <LogOut /> Sair
        </button>
      </nav>
    </div>
  );
}
