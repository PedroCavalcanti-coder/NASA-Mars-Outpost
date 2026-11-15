/**
 * Roda de Emojis e Expressões da Tripulação.
 *
 * Exibe o botão circular dourado e abre um menu radial (roda) com os 12 emojis
 * sincronizados com as animações 3D do astronauta e balão de fala.
 * Atalhos: tecla 'Q' para alternar abertura e 'Escape' para fechar.
 */

import {
  DUO_GESTURE_IDS,
  DUO_GESTURES,
  type DuoGestureId,
  EMOTE_ANIMATIONS,
  GAME_EMOTES,
} from '@mars/shared';
import { Handshake, Smile } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { L, t } from '../../../lib/i18n';

export interface EmoteWheelProps {
  onPick: (index: number) => void;
  disabled?: boolean;
  /** só nas salas online: astronautas por perto + convite para um gesto em dupla */
  duo?: {
    partners: Array<{ id: string; name: string }>;
    onInvite: (gesture: DuoGestureId, targetId: string) => void;
  };
}

export function EmoteWheel({ onPick, disabled, duo }: EmoteWheelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'solo' | 'duo'>('solo');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const partners = duo?.partners ?? [];
  const partner = partners.find((p) => p.id === partnerId) ?? partners[0];
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
          {duo && (
            <button
              type="button"
              className={`game__emote-mode ${partners.length ? 'has-partner' : ''}`}
              onClick={() => setTab((t) => (t === 'solo' ? 'duo' : 'solo'))}
              aria-pressed={tab === 'duo'}
              title={
                tab === 'solo'
                  ? L('Gestos em dupla', 'Two-person gestures')
                  : L('Voltar aos emojis', 'Back to emojis')
              }
            >
              {tab === 'solo' ? <Handshake size={20} aria-hidden="true" /> : <Smile size={20} aria-hidden="true" />}
              <span>{tab === 'solo' ? L('Dupla', 'Duo') : L('Emojis', 'Emojis')}</span>
              {tab === 'solo' && partners.length > 0 && <i className="game__emote-dot" aria-hidden="true" />}
            </button>
          )}
          {duo && tab === 'duo' && !partner && (
            <p className="game__emote-hint" role="status">
              {L('Chegue perto de outro astronauta (até 4 m, a pé) para fazer um gesto juntos.', 'Walk close to another astronaut (within 4 m, on foot) to do a gesture together.')}
            </p>
          )}
          {duo && tab === 'duo' && partner && (
            <>
              <button
                type="button"
                className="game__emote-partner"
                onClick={() => {
                  const i = partners.findIndex((p) => p.id === partner.id);
                  setPartnerId(partners[(i + 1) % partners.length]?.id ?? null);
                }}
                title={partners.length > 1 ? L('Trocar de parceiro', 'Change partner') : partner.name}
              >
                👤 {partner.name}
                {partners.length > 1 ? ' ▸' : ''}
              </button>
              {DUO_GESTURE_IDS.map((id, i) => {
                const angle = (i / DUO_GESTURE_IDS.length) * Math.PI * 2 - Math.PI / 4 - Math.PI / 2;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className="game__emote-item game__emote-item--duo"
                    style={{
                      transform: `translate(${Math.cos(angle) * 80}px, ${Math.sin(angle) * 80}px)`,
                      animationDelay: `${i * 30}ms`,
                    }}
                    onClick={() => {
                      duo.onInvite(id, partner.id);
                      setOpen(false);
                    }}
                    title={`${t(DUO_GESTURES[id].label)} · ${partner.name}`}
                    aria-label={`${DUO_GESTURES[id].label} ${partner.name}`}
                  >
                    <span aria-hidden="true">{DUO_GESTURES[id].emoji}</span>
                    <small>{t(DUO_GESTURES[id].label)}</small>
                  </button>
                );
              })}
            </>
          )}
          {tab === 'solo' && GAME_EMOTES.map((emoji, i) => {
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
                title={meta?.label ? `${t(meta.label)} (${emoji})` : emoji}
                aria-label={`${meta ? t(meta.label) : 'emoji'} ${emoji}`}
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
