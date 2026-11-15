import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { CROPS, type CropIndex, cropReducer, healthy, initialCrops } from './greenhouseState';

const portraitQuery = '(max-aspect-ratio: 4/5)';
function subscribePortrait(listener: () => void) {
  const media = window.matchMedia(portraitQuery);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const isPortrait = () => window.matchMedia(portraitQuery).matches;

export function useGreenhouse() {
  const [crops, dispatch] = useReducer(cropReducer, undefined, initialCrops);
  const [watering, setWatering] = useState<CropIndex | null>(null);
  const [camera, setCamera] = useState<CropIndex>(0);
  const portrait = useSyncExternalStore(subscribePortrait, isPortrait, () => false);
  const active = useRef<{ index: CropIndex; element: HTMLButtonElement; pointer?: number } | null>(
    null,
  );
  const complete = crops.every(healthy);
  // água realmente despejada (não devolve ao reiniciar): vira o custo do cuidado na base
  const lastSum = useRef(crops.reduce((n, c) => n + c.water, 0));
  const [poured, setPoured] = useState(0);
  useEffect(() => {
    const sum = crops.reduce((n, c) => n + c.water, 0);
    const diff = sum - lastSum.current;
    lastSum.current = sum;
    if (diff > 0) setPoured((p) => p + diff);
  }, [crops]);
  const stop = useCallback(() => {
    const previous = active.current;
    active.current = null;
    if (previous?.pointer !== undefined && previous.element.hasPointerCapture(previous.pointer))
      previous.element.releasePointerCapture(previous.pointer);
    setWatering(null);
  }, []);
  function down(event: PointerEvent<HTMLButtonElement>, index: CropIndex) {
    if (!event.isPrimary || event.button !== 0 || active.current || complete) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = { index, element: event.currentTarget, pointer: event.pointerId };
    setWatering(index);
  }
  function up(event: PointerEvent<HTMLButtonElement>) {
    if (active.current?.pointer === event.pointerId) stop();
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: CropIndex) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (event.repeat || active.current || complete) return;
    active.current = { index, element: event.currentTarget };
    setWatering(index);
  }
  function keyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (active.current?.pointer === undefined) stop();
    }
  }
  useEffect(() => {
    if (watering !== null && crops[watering].water >= CROPS[watering].water) stop();
  }, [crops, watering, stop]);
  useEffect(() => {
    if (watering === null || complete) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const seconds = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (active.current?.index === watering) dispatch({ type: 'water', index: watering, seconds });
    }, 50);
    return () => clearInterval(timer);
  }, [watering, complete]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    window.addEventListener('resize', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', stop);
      window.removeEventListener('resize', stop);
      document.removeEventListener('visibilitychange', hidden);
      const previous = active.current;
      active.current = null;
      if (previous?.pointer !== undefined && previous.element.hasPointerCapture(previous.pointer))
        previous.element.releasePointerCapture(previous.pointer);
    };
  }, [stop]);
  useEffect(() => {
    if (!portrait || watering !== null || !healthy(crops[camera], camera) || complete) return;
    const next = CROPS.find(({ index }) => !healthy(crops[index], index));
    if (!next) return;
    const timer = setTimeout(() => setCamera(next.index), 900);
    return () => clearTimeout(timer);
  }, [crops, camera, portrait, watering, complete]);
  function reset() {
    stop();
    dispatch({ type: 'reset' });
    setCamera(0);
  }
  return {
    crops,
    /** água despejada (unidades do minigame; ~10 L cada) */
    poured,
    watering,
    camera,
    portrait,
    complete,
    down,
    up,
    keyDown,
    keyUp,
    stop,
    reset,
    light: (index: CropIndex) => dispatch({ type: 'light', index }),
    // Assistive-technology activation also works without holding a physical key.
    waterStep: (index: CropIndex) => dispatch({ type: 'water', index, seconds: 0.5 }),
  };
}
