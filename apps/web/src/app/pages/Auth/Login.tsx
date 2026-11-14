import type { PublicUser } from '@mars/shared';
import { LogIn, Mail, TriangleAlert } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { safeNext } from '../../../auth/guards';
import { api, HttpError } from '../../../net/api';
import { useAuth } from '../../../store/auth';
import { Button } from '../../../ui/Button';
import { Field, PasswordField } from '../../../ui/Field';

export default function Login() {
  const nav = useNavigate();
  const { search } = useLocation();
  const setUser = useAuth((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const user = await api<PublicUser>('/auth/login', {
        body: { email: fd.get('email'), password: fd.get('password') },
      });
      setUser(user);
      nav(safeNext(search), { replace: true });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Não foi possível entrar.');
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div>
        <span className="eyebrow">Bem-vindo de volta</span>
        <h1>Entrar</h1>
      </div>
      <p className="auth-form__lead">Sua tripulação está esperando.</p>
      {error && (
        <div className="alert alert--error" role="alert">
          <TriangleAlert /> {error}
        </div>
      )}
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        icon={<Mail />}
        placeholder="voce@exemplo.com"
        autoFocus
      />
      <PasswordField label="Senha" name="password" autoComplete="current-password" required />
      <div className="auth-form__row">
        <span />
        <Link to="/recuperar-senha">Esqueci minha senha</Link>
      </div>
      <Button type="submit" variant="primary" size="lg" block loading={loading} icon={<LogIn />}>
        Entrar
      </Button>
      <p className="auth-form__alt">
        Ainda não tem conta? <Link to={`/cadastro${search}`}>Criar conta grátis</Link>
      </p>
    </form>
  );
}
