import {
  NAME_MAX,
  NAME_MIN,
  PASSWORD_MIN,
  type PublicUser,
  USERNAME_MAX,
  USERNAME_MIN,
} from '@mars/shared';
import { AtSign, Mail, Rocket, TriangleAlert, User } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { safeNext } from '../../../auth/guards';
import { api, HttpError } from '../../../net/api';
import { useAuth } from '../../../store/auth';
import { Button } from '../../../ui/Button';
import { Field, PasswordField, PasswordStrength } from '../../../ui/Field';

export default function Register() {
  const nav = useNavigate();
  const { search } = useLocation();
  const setUser = useAuth((s) => s.setUser);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN)
      return setError(`A senha precisa ter ao menos ${PASSWORD_MIN} caracteres.`);
    if (mismatch) return setError('As senhas não conferem.');
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const user = await api<PublicUser>('/auth/register', {
        body: {
          name: fd.get('name'),
          username: fd.get('username'),
          email: fd.get('email'),
          password,
        },
      });
      setUser(user);
      nav(safeNext(search), { replace: true });
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else setError('Não foi possível criar a conta.');
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div>
        <span className="eyebrow">Nova tripulação</span>
        <h1>Criar conta</h1>
      </div>
      <p className="auth-form__lead">Grátis, rápido e sem instalar nada.</p>
      {error && (
        <div className="alert alert--error" role="alert">
          <TriangleAlert /> {error}
        </div>
      )}
      <Field
        label="Nome de astronauta"
        name="name"
        autoComplete="name"
        required
        minLength={NAME_MIN}
        maxLength={NAME_MAX}
        icon={<User />}
        placeholder="Como a equipe vai te chamar"
        error={fields.name}
        autoFocus
      />
      <Field
        label="Apelido"
        name="username"
        autoComplete="username"
        required
        minLength={USERNAME_MIN}
        maxLength={USERNAME_MAX}
        pattern="[A-Za-z0-9_]+"
        icon={<AtSign />}
        placeholder="seu_apelido"
        hint="Seus amigos te encontram por ele. Letras, números e _."
        error={fields.username}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        icon={<Mail />}
        placeholder="voce@exemplo.com"
        hint="Só você vê o e-mail. Usado para entrar e recuperar a senha."
        error={fields.email}
      />
      <div style={{ display: 'grid', gap: 8 }}>
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`Mínimo de ${PASSWORD_MIN} caracteres.`}
          error={fields.password}
        />
        <PasswordStrength value={password} />
      </div>
      <PasswordField
        label="Confirmar senha"
        name="confirm"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch ? 'As senhas não conferem.' : null}
      />
      <Button type="submit" variant="primary" size="lg" block loading={loading} icon={<Rocket />}>
        Criar conta
      </Button>
      <p className="auth-form__alt">
        Já tem conta? <Link to={`/login${search}`}>Entrar</Link>
      </p>
    </form>
  );
}
