/**
 * Roda de Emojis e Expressões da Tripulação.
 *
 * Exibe o botão circular dourado e abre um menu radial (roda) com os 12 emojis
 * sincronizados com as animações 3D do astronauta e balão de fala.
 * Atalhos: tecla 'Q' para alternar abertura e 'Escape' para fechar.
 */

import { EMOTE_ANIMATIONS, GAME_EMOTES } from '@mars/shared';
import { Smile } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { L } from '../../../lib/i18n';

export interface EmoteWheelProps {
  onPick: (index: number) => void;
  disabled?: boolean;
}

export function EmoteWheel({ onPick, disabled }: EmoteWheelProps) {
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Tecla Q abre/fecha; Escape fecha
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.getAttribute('role') === 'textbox')
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handlePick = (index: number) => {
    if (cooling || disabled) return;
    onPick(index);
    setCooling(true);
    window.setTimeout(() => setCooling(false), 1000);
    setOpen(false);
  };

  return (
    <div className="game__emote" ref={rootRef}>
      {open && (
        <div className="game__emote-wheel" role="menu" aria-label="Emojis">
          {GAME_EMOTES.map((emoji, i) => {
            const angle = (i / GAME_EMOTES.length) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * 82;
            const y = Math.sin(angle) * 82;
            const meta = EMOTE_ANIMATIONS[i];
            return (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                className="game__emote-item"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  animationDelay: `${i * 22}ms`,
                }}
                onClick={() => handlePick(i)}
                disabled={cooling || disabled}
                title={meta?.label ? `${meta.label} (${emoji})` : `Enviar ${emoji}`}
                aria-label={`Enviar ${meta?.label ?? 'emoji'} ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className={`game__emote-btn ${open ? 'game__emote-btn--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Emojis (Q)"
        aria-expanded={open}
        aria-label={L('Abrir painel de emojis', 'Open emoji panel')}
      >
        <Smile size={24} />
      </button>
    </div>
  );
}
