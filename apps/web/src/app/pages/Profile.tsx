import { NAME_MAX, NAME_MIN, PASSWORD_MIN, type PublicUser, type SessionInfo } from '@mars/shared';
import { KeyRound, LogOut, Monitor, Save, Trash2, User } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { describeAgent, monthYear, timeAgo } from '../../lib/format';
import { api, HttpError } from '../../net/api';
import { useAuth } from '../../store/auth';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Field, PasswordField, PasswordStrength } from '../../ui/Field';
import { toast } from '../../ui/toast';

export default function Profile() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();

  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const loadSessions = useCallback(() => {
    api<SessionInfo[]>('/auth/sessions')
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);
  useEffect(loadSessions, [loadSessions]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      setUser(await api<PublicUser>('/auth/me', { method: 'PATCH', body: { name } }));
      toast('Nome atualizado');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (next.length < PASSWORD_MIN) return setPwError(`Mínimo de ${PASSWORD_MIN} caracteres.`);
    if (next !== confirm) return setPwError('As senhas não conferem.');
    setPwError(null);
    setSavingPw(true);
    try {
      await api('/auth/change-password', { body: { current, next } });
      toast('Senha alterada. Os outros dispositivos foram desconectados.');
      setCurrent('');
      setNext('');
      setConfirm('');
      loadSessions();
    } catch (err) {
      setPwError(err instanceof HttpError ? err.message : 'Não foi possível alterar.');
    } finally {
      setSavingPw(false);
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/auth/sessions/${id}`, { method: 'DELETE' });
      toast('Dispositivo desconectado', 'info');
      loadSessions();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Perfil</h1>
          <p>Seus dados de astronauta e a segurança da conta.</p>
        </div>
      </div>

      <div className="card profile-head">
        <Avatar id={user.id} name={user.name} size={72} />
        <div style={{ minWidth: 0 }}>
          <h2>{user.name}</h2>
          <div className="text-mute">
            @{user.username} · {user.email} · na tripulação desde {monthYear(user.createdAt)}
          </div>
        </div>
      </div>

      <div className="profile-grid">
        <form className="card form-card" onSubmit={saveName}>
          <h2>Dados da conta</h2>
          <Field
            label="Nome de astronauta"
            icon={<User />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={NAME_MIN}
            maxLength={NAME_MAX}
            required
          />
          <Field
            label="Apelido"
            value={`@${user.username}`}
            readOnly
            disabled
            hint="O apelido não pode ser alterado."
          />
          <div>
            <Button
              type="submit"
              variant="primary"
              icon={<Save />}
              loading={savingName}
              disabled={name.trim() === user.name || name.trim().length < NAME_MIN}
            >
              Salvar
            </Button>
          </div>
        </form>

        <form className="card form-card" onSubmit={savePassword}>
          <h2>Alterar senha</h2>
          <PasswordField
            label="Senha atual"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <div style={{ display: 'grid', gap: 8 }}>
            <PasswordField
              label="Nova senha"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={PASSWORD_MIN}
            />
            <PasswordStrength value={next} />
          </div>
          <PasswordField
            label="Confirmar nova senha"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            error={pwError}
          />
          <div>
            <Button type="submit" variant="ghost" icon={<KeyRound />} loading={savingPw}>
              Alterar senha
            </Button>
          </div>
        </form>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 4 }}>Dispositivos conectados</h2>
        <p className="text-mute" style={{ marginBottom: 12 }}>
          Se não reconhecer algum acesso, desconecte-o e troque a senha.
        </p>
        <div className="rows">
          {(sessions ?? []).map((s) => (
            <div key={s.id} className="row">
              <Monitor size={22} color="var(--brand-hi)" />
              <div className="row__main">
                <div className="row__title">
                  {describeAgent(s.userAgent)}{' '}
                  {s.current && <span className="badge">este dispositivo</span>}
                </div>
                <div className="row__sub">
                  IP {s.ip || '—'} · ativo {timeAgo(s.lastUsedAt)}
                </div>
              </div>
              {!s.current && (
                <Button
                  size="sm"
                  className="btn--icon"
                  aria-label="Desconectar dispositivo"
                  onClick={() => revoke(s.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="danger-zone" style={{ marginTop: 16 }}>
        <p>Sair desta conta neste dispositivo.</p>
        <Button
          variant="danger"
          size="sm"
          icon={<LogOut />}
          onClick={async () => {
            await logout();
            nav('/');
          }}
        >
          Sair
        </Button>
      </div>
    </>
  );
}
