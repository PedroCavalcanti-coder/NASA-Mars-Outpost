import { ArrowLeft, CircleCheck, Mail, Send, TriangleAlert } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { api, HttpError } from '../../../net/api';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    setLoading(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { body: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Não foi possível enviar.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-form">
        <div>
          <span className="eyebrow">Verifique seu e-mail</span>
          <h1>Pedido enviado</h1>
        </div>
        <div className="alert alert--ok">
          <CircleCheck /> Se existir uma conta com esse e-mail, enviamos um link para redefinir a
          senha. Ele vale por 1 hora.
        </div>
        <Link to="/login" className="auth-form__alt">
          <ArrowLeft size={16} style={{ verticalAlign: -3 }} /> Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div>
        <span className="eyebrow">Recuperar acesso</span>
        <h1>Esqueci a senha</h1>
      </div>
      <p className="auth-form__lead">
        Informe o e-mail da conta e enviaremos um link de redefinição.
      </p>
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
        autoFocus
      />
      <Button type="submit" variant="primary" size="lg" block loading={loading} icon={<Send />}>
        Enviar link
      </Button>
      <p className="auth-form__alt">
        Lembrou? <Link to="/login">Entrar</Link>
      </p>
    </form>
  );
}
