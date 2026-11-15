import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { create } from 'zustand';

type Kind = 'ok' | 'error' | 'info';
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

const useToasts = create<{ list: Toast[] }>(() => ({ list: [] }));
let seq = 0;

/** Mostra uma notificação curta (some sozinha). */
export function toast(text: string, kind: Kind = 'ok', ms = 4200) {
  const id = ++seq;
  useToasts.setState((s) => ({ list: [...s.list.slice(-2), { id, kind, text }] }));
  setTimeout(() => useToasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) })), ms);
}

export function Toaster() {
  const list = useToasts((s) => s.list);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {t.kind === 'ok' ? <CircleCheck /> : t.kind === 'error' ? <TriangleAlert /> : <Info />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
