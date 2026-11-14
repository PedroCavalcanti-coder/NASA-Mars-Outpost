import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  action?: ReactNode;
}

/** Campo com rótulo, ícone opcional, dica e erro acessíveis. */
export function Field({ label, icon, hint, error, action, id, className, ...input }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-err`]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="field" data-invalid={!!error || undefined}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field__control">
        {icon && <span className="field__icon">{icon}</span>}
        <input
          id={inputId}
          className={['input', icon && 'input--icon', action && 'input--action', className]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy || undefined}
          {...input}
        />
        {action}
      </div>
      {error ? (
        <span className="field__error" id={`${inputId}-err`} role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span className="field__hint" id={`${inputId}-hint`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

/** Campo de senha com botão mostrar/ocultar. */
export function PasswordField(props: Omit<FieldProps, 'type' | 'action'>) {
  const [show, setShow] = useState(false);
  return (
    <Field
      {...props}
      type={show ? 'text' : 'password'}
      action={
        <button
          type="button"
          className="field__action"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={show}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  );
}

/** Força da senha (0–4): heurística simples, só para orientar. */
export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

const LABELS = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
const COLORS = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--ok)', 'var(--ok)'];

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score = passwordScore(value);
  return (
    <div className="strength" aria-live="polite">
      <div className="strength__bars">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ background: i < score ? COLORS[score] : undefined }} />
        ))}
      </div>
      <span className="field__hint">Força da senha: {LABELS[score]}</span>
    </div>
  );
}
