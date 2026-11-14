import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export function useOxygenCleaning() {
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const target = useRef<HTMLButtonElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const active = useRef<{
    id: number;
    pointer: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    size: number;
    element: SVGGElement;
  } | null>(null);

  const cancel = useCallback(() => {
    const drag = active.current;
    active.current = null;
    if (drag?.element.hasPointerCapture(drag.pointer))
      drag.element.releasePointerCapture(drag.pointer);
    setDragging(false);
    setSelected(null);
    if (target.current) delete target.current.dataset.over;
  }, []);
  function discard(id: number) {
    setRemoved((previous) => new Set([...previous, id]));
    cancel();
  }
  function over(x: number, y: number) {
    const rect = target.current?.getBoundingClientRect();
    return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  function move(event: PointerEvent<SVGGElement>) {
    const drag = active.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    drag.x = event.clientX + drag.dx;
    drag.y = event.clientY + drag.dy;
    if (ghost.current)
      ghost.current.style.transform = `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)`;
    if (target.current) target.current.dataset.over = String(over(drag.x, drag.y));
  }
  function down(event: PointerEvent<SVGGElement>, id: number) {
    if (!event.isPrimary || event.button !== 0 || active.current) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    active.current = {
      id,
      pointer: event.pointerId,
      x,
      y,
      dx: x - event.clientX,
      dy: y - event.clientY,
      size: Math.max(rect.width, rect.height),
      element: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(id);
    setDragging(true);
  }
  function cancelPointer(event: PointerEvent<SVGGElement>) {
    if (active.current?.pointer === event.pointerId) cancel();
  }
  function up(event: PointerEvent<SVGGElement>) {
    const drag = active.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    move(event);
    if (over(drag.x, drag.y)) discard(drag.id);
    else cancel();
  }
  function select(event: KeyboardEvent<SVGGElement>, id: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelected(id);
    // Once selected, the discard control is the next keyboard destination.
  }
  useEffect(() => {
    if (selected !== null && !dragging) target.current?.focus();
  }, [selected, dragging]);
  useEffect(() => {
    const stop = () => cancel();
    const visibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('blur', stop);
    window.addEventListener('resize', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', stop);
      window.removeEventListener('resize', stop);
      document.removeEventListener('visibilitychange', visibility);
      const drag = active.current;
      active.current = null;
      if (drag?.element.hasPointerCapture(drag.pointer))
        drag.element.releasePointerCapture(drag.pointer);
    };
  }, [cancel]);
  function reset() {
    cancel();
    setRemoved(new Set());
  }
  return {
    removed,
    selected,
    dragging,
    target,
    ghost,
    active,
    down,
    move,
    up,
    cancelPointer,
    select,
    discard,
    reset,
  };
}
