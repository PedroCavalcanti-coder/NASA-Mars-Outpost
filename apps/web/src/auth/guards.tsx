import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../store/auth';
import { Spinner } from '../ui/Empty';

/** Só entra logado; senão vai para /login?next=<rota atual>. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return children;
}

/** Login/cadastro: quem já está logado vai direto para a central. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (user) return <Navigate to="/central" replace />;
  return children;
}

/** Destino seguro após o login (só caminhos internos). */
export function safeNext(search: string) {
  const next = new URLSearchParams(search).get('next');
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/central';
}
