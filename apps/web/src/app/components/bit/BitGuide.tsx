import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BaseViewer, MinigameRequest } from '../../../game/BaseViewer';
import { registerDevAction } from '../../../game/dev/devActions';
import { type Expression, LINES, type LineId } from '../../../game/guide/catalog';
import { GuideEngine, readMemory } from '../../../game/guide/engine';
import { subscribeGuide } from '../../../game/guide/events';
import {
  HUD_LESSONS,
  HUD_TOUR_SKIPPED,
  hudLesson,
  nextHudLesson,
  spotlightTarget,
  targetSelector,
} from '../../../game/guide/hudTour';
import { useOxygen } from '../../../game/survival/OxygenSystem';
import { useBaseOps } from '../../../game/tasks/store';
import { useGameSettings } from '../../../lib/gameSettings';
import { useMission } from '../../../store/mission';
import { BitCharacter } from './BitCharacter';
import { BitSpotlight } from './BitSpotlight';
import './bit.css';

interface Props {
  identity: string;
  viewer: BaseViewer | null;
  minigame: MinigameRequest | null;
  suspended: boolean;
  driving: boolean;
}
const supported = (kind?: string): kind is 'solar' | 'oxygen' | 'greenhouse' | 'drill' =>
  kind === 'solar' || kind === 'oxygen' || kind === 'greenhouse' || kind === 'drill';

export function BitGuide({ identity, viewer, minigame, suspended, driving }: Props) {
  const storageKey = `mars-bit-v1:${identity}`;
  const [engine] = useState(() => {
    try {
      return new GuideEngine(readMemory(localStorage, storageKey));
    } catch {
      return new GuideEngine();
    }
  });
  const [, refresh] = useState(0);
  const [talking, setTalking] = useState(false);
  const [celebration, celebrate] = useState(0);
  const [replay, setReplay] = useState(0);
  const [preview, setPreview] = useState<Expression | null>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const [hidden, setHidden] = useState(document.hidden);
  const [ready, setReady] = useState(Boolean(viewer?.guideReady));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touch = useRef(window.matchMedia('(pointer: coarse)').matches).current;
  const activity = minigame?.kind;
  const quiet = suspended || hidden || activity === 'repair';
  const context = useRef({ quiet, activity, ready });
  context.current = { quiet, activity, ready };
  const attempt = useRef({ interacting: false, lastProgress: Date.now(), hinted: false });
  const previousActivity = useRef(activity);
  const audio = useGameSettings((s) => s.audio);
  const reduced = useGameSettings((s) => s.video.reducedMotion);
  const hints = useGameSettings((s) => s.gameplay.showHints);
  const update = useCallback(() => refresh((n) => n + 1), []);
  const availableTarget = useCallback((target: string) => {
    const rect = document.querySelector(targetSelector(target))?.getBoundingClientRect();
    return Boolean(rect && rect.width > 0 && rect.height > 0);
  }, []);
  const pendingHud = useCallback(
    () => nextHudLesson(engine.memory, availableTarget),
    [engine, availableTarget],
  );
  const offer = useCallback(
    (id: LineId, urgent = false, repeat = false) => {
      if (context.current.quiet) return;
      engine.offer(id, Date.now(), urgent, repeat);
      update();
    },
    [engine, update],
  );

  useEffect(
    () =>
      subscribeGuide((event) => {
        if (event.type === 'ready') {
          setReady(true);
          return;
        }
        if (event.type === 'moved') {
          engine.master('movement');
          engine.discard('move');
          engine.discard('moveTouch');
          if (!pendingHud()) offer('moved');
          return;
        }
        if (event.type === 'progress') {
          attempt.current.lastProgress = Date.now();
          return;
        }
        if (event.type === 'difficulty') {
          if (hints) offer('difficulty');
          return;
        }
        celebrate((n) => n + 1);
        attempt.current.hinted = true;
        if (event.activity !== 'drill' || event.hit !== false) engine.master(event.activity);
        if (event.activity === 'plant' || event.activity === 'harvest') offer(event.activity);
        else {
          engine.clear();
          offer(
            event.activity === 'drill' && event.hit === false
              ? 'drillMiss'
              : (`${event.activity}Done` as LineId),
          );
        }
      }),
    [engine, hints, offer, pendingHud],
  ); // callbacks read current context through ref

  useEffect(() => {
    if (!ready || quiet || !hints) return;
    if (!activity) {
      offer('welcome');
      const lesson = pendingHud();
      if (lesson) offer(lesson.id, false, true);
      else if (!engine.memory.mastered.includes('movement')) offer(touch ? 'moveTouch' : 'move');
    }
  }, [ready, quiet, activity, hints, engine, touch, offer, pendingHud]);

  useEffect(() => {
    if (activity) engine.clear();
    else if (supported(previousActivity.current)) {
      engine.discard(previousActivity.current);
      engine.discard(`${previousActivity.current}Hint`);
    }
    previousActivity.current = activity;
    attempt.current = { interacting: false, lastProgress: Date.now(), hinted: false };
    if (supported(activity) && hints)
      offer(activity, true, !engine.memory.mastered.includes(activity));
    update();
  }, [activity, engine, hints, offer, update]);

  useEffect(() => {
    if (driving && hints) offer(touch ? 'roverTouch' : 'rover');
  }, [driving, hints, touch, offer]);

  useEffect(() => {
    let wasLow = false;
    let wasStorm = false;
    let wasBlackout = false;
    let status = useMission.getState().state.status;
    let stored = '';
    const tick = () => {
      if (!context.current.ready) {
        if (viewer?.guideReady) setReady(true);
        return;
      }
      if (context.current.quiet) return;
      const o = useOxygen.getState();
      const ops = useBaseOps.getState();
      const low = o.isLow && !o.isInside;
      const storm = o.storm > 0.25 && !o.isInside;
      if (low && !wasLow) {
        engine.forget('low');
        offer('low', true);
      }
      if (!low) engine.discard('low');
      if (wasLow && o.isInside) {
        engine.forget('recovered');
        offer('recovered');
      }
      if (storm && !wasStorm && !low) {
        engine.forget('storm');
        offer('storm', true);
      }
      if (!storm) engine.discard('storm');
      if (ops.blackout && !wasBlackout && !low && !storm) {
        engine.forget('blackout');
        offer('blackout', true);
      }
      if (!ops.blackout) engine.discard('blackout');
      wasLow = low;
      wasStorm = storm;
      wasBlackout = ops.blackout;
      const next = useMission.getState().state.status;
      if (next !== status && next !== 'playing') {
        engine.clear();
        offer(next === 'won' ? 'success' : 'ended');
      }
      status = next;
      const current = context.current.activity;
      if (
        hints &&
        !current &&
        engine.memory.mastered.includes('movement') &&
        !engine.current &&
        !pendingHud() &&
        ['oxygen', 'solar', 'greenhouse']
          .filter((topic) => engine.memory.introduced.includes(topic))
          .every((topic) => engine.memory.mastered.includes(topic))
      ) {
        if (ops.filterSol < ops.sol) offer('oxygen');
        else if (ops.cropNeedsCare.some(Boolean)) offer('greenhouse');
        else if (ops.panelStages.some((stage) => stage >= 2)) offer('solar');
      }
      const a = attempt.current;
      if (
        hints &&
        supported(current) &&
        a.interacting &&
        !a.hinted &&
        Date.now() - a.lastProgress >= 20000
      ) {
        a.hinted = true;
        engine.clear();
        offer(`${current}Hint`, false, true);
      }
      if (hints && !current && !engine.current) {
        const lesson = pendingHud();
        if (lesson) offer(lesson.id, false, true);
      }
      engine.tick(Date.now());
      const serialized = JSON.stringify(engine.memory);
      if (serialized !== stored) {
        try {
          localStorage.setItem(storageKey, serialized);
          stored = serialized;
        } catch {
          /* optional */
        }
      }
      update();
    };
    const interval = window.setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [engine, storageKey, hints, viewer, offer, update, pendingHud]);

  useEffect(
    () => () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(engine.memory));
      } catch {
        /* optional */
      }
    },
    [engine, storageKey],
  );

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const interact = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.bit-guide')) return;
      if (!context.current.activity || !supported(context.current.activity)) return;
      attempt.current.interacting = true;
      engine.dismiss();
      update();
    };
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerdown', interact, true);
    document.addEventListener('keydown', interact, true);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerdown', interact, true);
      document.removeEventListener('keydown', interact, true);
    };
  }, [engine, update]);

  useEffect(() => {
    if (!celebration) return;
    const timeout = setTimeout(() => celebrate(0), 3200);
    return () => clearTimeout(timeout);
  }, [celebration]);

  const message = engine.current;
  const id = message?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: serial and replay deliberately restart the same clip.
  useEffect(() => {
    if (!id || quiet) return;
    const sound = new Audio(`/assets/audio/bit/en/${id}.mp3`);
    audioRef.current = sound;
    const settings = useGameSettings.getState().audio;
    sound.volume = settings.muted ? 0 : (settings.masterVolume * settings.sfxVolume) / 10000;
    sound.onplaying = () => setTalking(true);
    sound.onended = sound.onerror = () => setTalking(false);
    if (sound.volume > 0) void sound.play().catch(() => setTalking(false));
    return () => {
      sound.pause();
      sound.onplaying = sound.onended = sound.onerror = null;
      sound.removeAttribute('src');
      sound.load();
      audioRef.current = null;
      setTalking(false);
    };
  }, [id, message?.serial, replay, quiet]);
  useEffect(() => {
    const sound = audioRef.current;
    if (!sound) return;
    sound.volume = audio.muted ? 0 : (audio.masterVolume * audio.sfxVolume) / 10000;
    if (sound.volume === 0) {
      sound.pause();
      setTalking(false);
    }
  }, [audio]);

  const help = () => {
    const current = context.current.activity;
    engine.clear();
    offer(supported(current) ? `${current}Hint` : (pendingHud()?.id ?? 'explore'), true, true);
  };
  const startHudTour = useCallback(() => {
    engine.clear();
    engine.memory.mastered = engine.memory.mastered.filter(
      (topic) => topic !== HUD_TOUR_SKIPPED && !HUD_LESSONS.some((lesson) => lesson.id === topic),
    );
    const lesson = pendingHud();
    if (lesson) offer(lesson.id, true, true);
  }, [engine, pendingHud, offer]);
  const next = () => {
    const lesson = hudLesson(id);
    if (lesson) engine.master(lesson.id);
    if (lesson || id === 'welcome') engine.clear();
    else engine.dismiss();
    const pending = pendingHud();
    if ((lesson || id === 'welcome') && pending) offer(pending.id, true, true);
    else if ((lesson || id === 'welcome') && !engine.memory.mastered.includes('movement'))
      offer(touch ? 'moveTouch' : 'move', true);
    update();
  };
  useEffect(() => {
    const remove = [
      registerDevAction({
        id: 'bit-hud-tour',
        label: 'B.I.T.: explain the HUD',
        group: 'B.I.T.',
        run: startHudTour,
      }),
      registerDevAction({
        id: 'bit-reset',
        label: 'B.I.T.: restart guide',
        group: 'B.I.T.',
        run: () => {
          engine.clear();
          engine.memory = { introduced: [], mastered: [] };
          offer('welcome', true);
          const lesson = pendingHud();
          if (lesson) offer(lesson.id, false, true);
        },
      }),
    ];
    for (const expression of [
      'idle',
      'talking',
      'thinking',
      'excited',
      'warning',
      'celebrating',
    ] as Expression[]) {
      remove.push(
        registerDevAction({
          id: `bit-${expression}`,
          label: `B.I.T.: ${expression}`,
          group: 'B.I.T.',
          run: () => setPreview((value) => (value === expression ? null : expression)),
        }),
      );
    }
    return () => {
      for (const unregister of remove) unregister();
    };
  }, [engine, offer, pendingHud, startHudTour]);

  if (!ready || quiet) return null;
  const expression =
    preview ??
    (talking ? 'talking' : celebration ? 'celebrating' : id ? LINES[id].expression : 'idle');
  const spotlight = !activity && id ? spotlightTarget(id) : undefined;
  const isHudLesson = Boolean(hudLesson(id));
  return createPortal(
    <>
      {spotlight && <BitSpotlight target={spotlight} onPlacement={setPlacement} />}
      <aside
        className={`bit-guide ${activity ? 'bit-guide--activity' : ''} ${spotlight ? 'bit-guide--spotlight' : ''}`}
        data-placement={placement}
        data-reduced={reduced}
        aria-label="B.I.T. mission buddy"
      >
        {id && (
          <div className="bit-dialogue" key={message.serial}>
            <div className="bit-dialogue__heading">
              <span>B.I.T.</span>
              <span>YOUR MISSION BUDDY</span>
            </div>
            <p role="status" aria-live="polite">
              {LINES[id].text}
            </p>
            <div className="bit-dialogue__actions">
              <button type="button" onClick={next}>
                {isHudLesson ? 'Next' : 'Got it'}
              </button>
              <button type="button" onClick={() => setReplay((n) => n + 1)}>
                Repeat
              </button>
              {isHudLesson ? (
                <button
                  type="button"
                  onClick={() => {
                    engine.master(HUD_TOUR_SKIPPED);
                    engine.clear();
                    if (!engine.memory.mastered.includes('movement'))
                      offer(touch ? 'moveTouch' : 'move', true);
                    update();
                  }}
                >
                  Skip tour
                </button>
              ) : (
                <button type="button" onClick={help}>
                  Help
                </button>
              )}
              {!activity && !isHudLesson && (
                <button type="button" onClick={startHudTour}>
                  HUD tour
                </button>
              )}
            </div>
          </div>
        )}
        <button
          className="bit-avatar"
          type="button"
          onClick={() => {
            help();
          }}
          aria-label="Ask B.I.T. for help"
          title="Ask B.I.T. for help"
        >
          <BitCharacter expression={expression} />
          <span className="bit-name">B.I.T.</span>
        </button>
      </aside>
    </>,
    document.body,
  );
}
