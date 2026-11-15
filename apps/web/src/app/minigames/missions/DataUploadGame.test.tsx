// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DataUploadGame from './DataUploadGame';

vi.mock('../usePreviewClose', () => ({
  usePreviewClose: (onClose?: () => void) => ({
    close: () => onClose?.(),
    closeButton: { current: null },
  }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('envio de dados à Terra', () => {
  let container: HTMLDivElement;
  let root: Root;
  const click = (el: Element | null | undefined) =>
    act(() => {
      (el as HTMLElement | undefined)?.click();
    });
  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  const science = ['ChemCam', 'poeira', 'MOXIE'];

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('escolhe os 3 cartões de ciência, envia e só então libera "Concluir envio"', () => {
    const onComplete = vi.fn();
    act(() => root.render(<DataUploadGame onComplete={onComplete} />));
    expect((button('Enviar') as HTMLButtonElement).disabled).toBe(true);
    for (const name of science) click(button(name));
    click(button('Enviar'));
    expect(button('Concluir envio')).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    click(button('Concluir envio'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cartão que não é ciência só mostra uma dica e não conta', () => {
    act(() => root.render(<DataUploadGame />));
    click(button('Jogo do computador'));
    expect(container.querySelector('.msn-up__error')?.textContent).toContain('não é pesquisa');
    expect((button('Enviar') as HTMLButtonElement).disabled).toBe(true);
  });
});
