import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

/** Both a temporary route and a future equipment interaction can own the preview. */
export function usePreviewClose(onClose?: () => void) {
  const navigate = useNavigate();
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    if (onClose) onClose();
    else navigate('/');
  }, [onClose, navigate]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButton.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [close]);

  return { closeButton, close };
}
