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

  it('manda os 6 arquivos de pesquisa um a um e só então libera "Concluir envio"', () => {
    const onComplete = vi.fn();
    act(() => root.render(<DataUploadGame onComplete={onComplete} />));

    for (const folder of ['/pesquisa/amostras', '/pesquisa/atmosfera']) {
      click(button(folder));
      for (const file of [...container.querySelectorAll('.msn-up__file')]) {
        const label = file.textContent ?? '';
        if (/tmp|bak/.test(label)) continue;
        click(file);
        act(() => {
          vi.advanceTimersByTime(5500);
        });
      }
    }
    expect(container.querySelectorAll('.msn-up__received li').length).toBe(6);
    click(button('Concluir envio'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('arquivo que não é de pesquisa trava o enlace e não conta', () => {
    act(() => root.render(<DataUploadGame />));
    click(button('/sistema'));
    click(container.querySelector('.msn-up__file'));
    expect(container.querySelector('.msn-up__error')).not.toBeNull();
    expect(container.querySelectorAll('.msn-up__received .is-live').length).toBe(0);
    expect(button('Concluir envio')).toBeUndefined();
  });
});
