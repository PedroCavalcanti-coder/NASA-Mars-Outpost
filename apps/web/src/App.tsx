import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import Home from './app/pages/Home';
import { GuestOnly, RequireAuth } from './auth/guards';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { useAuth } from './store/auth';
import { useRealtime } from './store/realtime';
import { Spinner } from './ui/Empty';
import { Toaster } from './ui/toast';

// A home carrega junto; o resto vem sob demanda.
const Login = lazy(() => import('./app/pages/Auth/Login'));
const Register = lazy(() => import('./app/pages/Auth/Register'));
const ForgotPassword = lazy(() => import('./app/pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./app/pages/Auth/ResetPassword'));
const Dashboard = lazy(() => import('./app/pages/Dashboard'));
const Friends = lazy(() => import('./app/pages/Friends'));
const Messages = lazy(() => import('./app/pages/Messages'));
const Profile = lazy(() => import('./app/pages/Profile'));
const Game = lazy(() => import('./app/pages/Game'));
const Center = lazy(() => import('./app/pages/Center'));
const Support = lazy(() => import('./app/pages/Support'));
const About = lazy(() => import('./app/pages/About'));
const NotFound = lazy(() => import('./app/pages/NotFound'));

export function App() {
  const load = useAuth((s) => s.load);
  const userId = useAuth((s) => s.user?.id);
  const connect = useRealtime((s) => s.connect);
  const disconnect = useRealtime((s) => s.disconnect);

  useEffect(() => {
    void load();
  }, [load]);

  // O WebSocket vive enquanto houver usuário logado.
  useEffect(() => {
    if (userId) connect();
    else disconnect();
  }, [userId, connect, disconnect]);

  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route index element={<Home />} />

          {/* Páginas Públicas do Projeto */}
          <Route path="centro" element={<Center />} />
          <Route path="suporte" element={<Support />} />
          <Route path="sobre" element={<About />} />

          <Route element={<AuthLayout />}>
            <Route
              path="login"
              element={
                <GuestOnly>
                  <Login />
                </GuestOnly>
              }
            />
            <Route
              path="cadastro"
              element={
                <GuestOnly>
                  <Register />
                </GuestOnly>
              }
            />
            <Route path="recuperar-senha" element={<ForgotPassword />} />
            <Route path="redefinir-senha" element={<ResetPassword />} />
          </Route>

          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="central" element={<Dashboard />} />
            <Route path="amigos" element={<Friends />} />
            <Route path="mensagens/:userId?" element={<Messages />} />
            <Route path="perfil" element={<Profile />} />
          </Route>

          <Route path="jogar" element={<Game />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
}
