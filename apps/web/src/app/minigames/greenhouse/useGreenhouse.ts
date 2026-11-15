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
import { useGameSettings } from '../../../lib/gameSettings';

const portraitQuery = '(max-aspect-ratio: 4/5)';
function subscribePortrait(listener: () => void) {
  const media = window.matchMedia(portraitQuery);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const isPortrait = () => window.matchMedia(portraitQuery).matches;

export function useGreenhouse() {
  const [crops, dispatch] = useReducer(cropReducer, undefined, initialCrops);
  const [watering, setWatering] = useState<boolean>(false);
  const [camera, setCamera] = useState<CropIndex>(0);
  const portrait = useSyncExternalStore(subscribePortrait, isPortrait, () => false);
  const active = useRef<{ element: HTMLButtonElement; pointer?: number } | null>(
    null,
  );
  const complete = crops.every(healthy);
  useEffect(() => {
    if (!watering || complete) return;
    const { audio } = useGameSettings.getState();
    if (audio.muted || audio.masterVolume <= 0 || audio.sfxVolume <= 0) return;
    const sound = new Audio('/assets/audio/watering-plant.mp3');
    sound.loop = true;
    sound.volume = (audio.masterVolume * audio.sfxVolume) / 10000;
    void sound.play().catch(() => {});
    return () => {
      sound.pause();
      sound.currentTime = 0;
    };
  }, [watering, complete]);
  const stop = useCallback(() => {
    const previous = active.current;
    active.current = null;
    if (previous?.pointer !== undefined && previous.element.hasPointerCapture(previous.pointer))
      previous.element.releasePointerCapture(previous.pointer);
    setWatering(false);
  }, []);
  function down(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || active.current || complete) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = { element: event.currentTarget, pointer: event.pointerId };
    setWatering(true);
  }
  function up(event: PointerEvent<HTMLButtonElement>) {
    if (active.current?.pointer === event.pointerId) stop();
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (event.repeat || active.current || complete) return;
    active.current = { element: event.currentTarget };
    setWatering(true);
  }
  function keyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (active.current?.pointer === undefined) stop();
    }
  }
  useEffect(() => {
    if (watering && complete) stop();
  }, [complete, watering, stop]);
  useEffect(() => {
    if (!watering || complete) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const seconds = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (active.current) CROPS.forEach(({ index }) => dispatch({ type: 'water', index, seconds }));
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
  function reset() {
    stop();
    dispatch({ type: 'reset' });
    setCamera(0);
  }
  return {
    crops,
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
    // Assistive-technology activation also works without holding a physical key.
    waterStep: () => CROPS.forEach(({ index }) => dispatch({ type: 'water', index, seconds: 0.5 })),
  };
}
