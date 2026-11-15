// @vitest-environment happy-dom
import { GAME_EMOTES } from '@mars/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmoteWheel } from '../EmoteWheel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('EmoteWheel', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onPick = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onPick.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renderiza o botão fechado inicialmente com Smile e título Emojis (Q)', () => {
    act(() => {
      root.render(<EmoteWheel onPick={onPick} />);
    });

    const btn = host.querySelector('.game__emote-btn') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('title')).toBe('Emojis (Q)');
    expect(btn?.getAttribute('aria-expanded')).toBe('false');

    // Roda de emojis não deve estar visível
    const wheel = host.querySelector('.game__emote-wheel');
    expect(wheel).toBeNull();
  });

  it('abre a roda ao clicar no botão e lista todos os 12 emojis', () => {
    act(() => {
      root.render(<EmoteWheel onPick={onPick} />);
    });

    const btn = host.querySelector('.game__emote-btn') as HTMLButtonElement;
    act(() => {
      btn.click();
    });

    const wheel = host.querySelector('.game__emote-wheel');
    expect(wheel).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    const items = host.querySelectorAll('.game__emote-item');
    expect(items.length).toBe(GAME_EMOTES.length);
    expect(items.length).toBe(12);

    // Primeiro emoji deve ser o primeiro de GAME_EMOTES (😀)
    expect(items[0]?.textContent).toBe(GAME_EMOTES[0]);
  });

  it('ao clicar em um emoji, chama onPick com o índice correto e fecha a roda', () => {
    act(() => {
      root.render(<EmoteWheel onPick={onPick} />);
    });

    const btn = host.querySelector('.game__emote-btn') as HTMLButtonElement;
    act(() => {
      btn.click();
    });

    const items = host.querySelectorAll('.game__emote-item');
    const rocketIndex = GAME_EMOTES.indexOf('🚀');
    const rocketBtn = items[rocketIndex] as HTMLButtonElement;

    act(() => {
      rocketBtn.click();
    });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(rocketIndex);

    // Roda deve fechar após o clique
    expect(host.querySelector('.game__emote-wheel')).toBeNull();
  });

  it('alterna abertura ao pressionar a tecla Q e fecha ao pressionar Escape', () => {
    act(() => {
      root.render(<EmoteWheel onPick={onPick} />);
    });

    // Pressiona Q fora de inputs
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    });
    expect(host.querySelector('.game__emote-wheel')).not.toBeNull();

    // Pressiona Escape fecha
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(host.querySelector('.game__emote-wheel')).toBeNull();

    // Pressiona Q novamente abre
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Q' }));
    });
    expect(host.querySelector('.game__emote-wheel')).not.toBeNull();

    // Pressiona Q novamente fecha
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    });
    expect(host.querySelector('.game__emote-wheel')).toBeNull();
  });

  it('ignora atalho Q quando o foco está em um elemento input ou textarea', () => {
    act(() => {
      root.render(<EmoteWheel onPick={onPick} />);
    });

    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
    });

    expect(host.querySelector('.game__emote-wheel')).toBeNull();
    input.remove();
  });

  it('fecha a roda ao clicar fora do componente', () => {
    act(() => {
      root.render(<EmoteWheel onPick={onPick} />);
    });

    const btn = host.querySelector('.game__emote-btn') as HTMLButtonElement;
    act(() => {
      btn.click();
    });
    expect(host.querySelector('.game__emote-wheel')).not.toBeNull();

    // Clica fora no document.body
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });

    expect(host.querySelector('.game__emote-wheel')).toBeNull();
  });
});
