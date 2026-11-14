import { PASSWORD_MIN } from '@mars/shared';
import { CircleCheck, KeyRound, TriangleAlert } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, HttpError } from '../../../net/api';
import { Button, ButtonLink } from '../../../ui/Button';
import { PasswordField, PasswordStrength } from '../../../ui/Field';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) return setError(`Mínimo de ${PASSWORD_MIN} caracteres.`);
    if (mismatch) return setError('As senhas não conferem.');
    setLoading(true);
    setError(null);
    try {
      await api('/auth/reset-password', { body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Não foi possível redefinir.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-form">
        <h1>Link incompleto</h1>
        <div className="alert alert--error">
          <TriangleAlert /> Abra o link completo que enviamos por e-mail, ou peça um novo.
        </div>
        <ButtonLink to="/recuperar-senha" variant="primary">
          Pedir novo link
        </ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-form">
        <h1>Senha alterada</h1>
        <div className="alert alert--ok">
          <CircleCheck /> Pronto! Por segurança, você foi desconectado de todos os dispositivos.
        </div>
        <ButtonLink to="/login" variant="primary" size="lg" block>
          Entrar
        </ButtonLink>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div>
        <span className="eyebrow">Recuperar acesso</span>
        <h1>Nova senha</h1>
      </div>
      {error && (
        <div className="alert alert--error" role="alert">
          <TriangleAlert /> {error} <Link to="/recuperar-senha">Pedir novo link</Link>
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={PASSWORD_MIN}
          required
          autoFocus
        />
        <PasswordStrength value={password} />
      </div>
      <PasswordField
        label="Confirmar nova senha"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        error={mismatch ? 'As senhas não conferem.' : null}
      />
      <Button type="submit" variant="primary" size="lg" block loading={loading} icon={<KeyRound />}>
        Redefinir senha
      </Button>
    </form>
  );
}
