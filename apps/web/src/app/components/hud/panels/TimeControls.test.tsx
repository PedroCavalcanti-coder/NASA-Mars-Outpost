// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameClock } from '../../../../game/sim/clock';
import { getPanels } from '../registry';
import { TimeControls } from './TimeControls';

// Configura o ambiente para React act
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TimeControls Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    GameClock.reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    // Limpa eventuais banners no document.body
    const banners = document.querySelectorAll('.time-controls__screen-paused-banner');
    banners.forEach((b) => {
      b.remove();
    });
  });

  it('registra o painel "game-clock" no registro da HUD no grupo "essencial"', () => {
    const panels = getPanels();
    const clockPanel = panels.find((p) => p.id === 'game-clock');
    expect(clockPanel).toBeDefined();
    expect(clockPanel?.group).toBe('essencial');
    expect(clockPanel?.title).toBe('Controle de Tempo');
  });

  it('renderiza os botões de controle de tempo (pausa e velocidades 1x, 2x, 3x)', () => {
    act(() => {
      root.render(<TimeControls marsTime={{ sol: 1, formatted: '09:00', isDay: true }} />);
    });

    const pauseBtn = container.querySelector('.time-controls__btn-pause');
    expect(pauseBtn).toBeTruthy();

    const speedBtns = container.querySelectorAll('.time-controls__speed-btn');
    expect(speedBtns.length).toBe(3);
    expect(speedBtns[0]?.textContent).toContain('1×');
    expect(speedBtns[1]?.textContent).toContain('2×');
    expect(speedBtns[2]?.textContent).toContain('3×');

    // Inicialmente não deve exibir o selo PAUSADO
    expect(container.querySelector('.time-controls__paused-badge')).toBeNull();
  });

  it('alterna para pausado ao clicar no botão de pausa e exibe o selo PAUSADO', () => {
    act(() => {
      root.render(<TimeControls marsTime={{ sol: 1, formatted: '09:00', isDay: true }} />);
    });

    const pauseBtn = container.querySelector('.time-controls__btn-pause') as HTMLButtonElement;
    expect(pauseBtn).toBeTruthy();

    // Clica para pausar
    act(() => {
      pauseBtn.click();
    });

    expect(GameClock.isPaused()).toBe(true);
    expect(container.querySelector('.time-controls__paused-badge')).toBeTruthy();
    expect(container.querySelector('.time-controls__paused-badge')?.textContent).toContain(
      'PAUSADO',
    );

    // Clica para retomar
    act(() => {
      pauseBtn.click();
    });

    expect(GameClock.isPaused()).toBe(false);
    expect(container.querySelector('.time-controls__paused-badge')).toBeNull();
  });

  it('altera a velocidade ao clicar nos botões 1x, 2x e 3x', () => {
    act(() => {
      root.render(<TimeControls marsTime={{ sol: 1, formatted: '09:00', isDay: true }} />);
    });

    const speedBtns = container.querySelectorAll('.time-controls__speed-btn');
    const btn2x = speedBtns[1] as HTMLButtonElement;
    const btn3x = speedBtns[2] as HTMLButtonElement;

    act(() => {
      btn2x.click();
    });
    expect(GameClock.getScale()).toBe(2);

    act(() => {
      btn3x.click();
    });
    expect(GameClock.getScale()).toBe(3);
  });

  it('responde aos atalhos de teclado (Espaço para pausa e teclas 1, 2, 3)', () => {
    act(() => {
      root.render(<TimeControls marsTime={{ sol: 1, formatted: '09:00', isDay: true }} />);
    });

    // Pressiona Espaço -> pausa
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    expect(GameClock.isPaused()).toBe(true);

    // Pressiona Espaço novamente -> despausa
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    expect(GameClock.isPaused()).toBe(false);

    // Pressiona tecla '2' -> velocidade 2
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    });
    expect(GameClock.getScale()).toBe(2);

    // Pressiona tecla '3' -> velocidade 3
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    });
    expect(GameClock.getScale()).toBe(3);

    // Pressiona tecla '1' -> velocidade 1
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    });
    expect(GameClock.getScale()).toBe(1);
  });

  it('desabilita os botões se o jogador não tiver autoridade de controle (não-coordenador)', () => {
    const mockRoom = {
      isCoordinator: () => false,
      playerCount: () => 2,
      sendTime: () => {},
    };
    GameClock.attachRoom(mockRoom);

    act(() => {
      root.render(<TimeControls marsTime={{ sol: 1, formatted: '09:00', isDay: true }} />);
    });

    const pauseBtn = container.querySelector('.time-controls__btn-pause') as HTMLButtonElement;
    expect(pauseBtn.disabled).toBe(true);

    const speedBtns = container.querySelectorAll('.time-controls__speed-btn');
    speedBtns.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    expect(container.querySelector('.time-controls__role-tag--restricted')).toBeTruthy();
  });
});
