// @vitest-environment happy-dom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameSettings } from '../../lib/gameSettings';
import type { AudioSettings } from '../components/SettingsModal';
import Home from './Home';

const fixture = vi.hoisted(() => ({
  retained: false,
  version: 0,
  listeners: new Set<() => void>(),
  sceneFailure: false,
  complete: null as (() => void) | null,
  spaceChange: null as ((active: boolean) => void) | null,
  landingAudio: null as
    | ((event: 'falling' | 'parachute' | 'touchdown' | 'decompression') => void)
    | null,
  changeAudio: null as ((audio: AudioSettings) => void) | null,
  retain: vi.fn(),
  release: vi.fn(),
  skip: vi.fn(),
  dispose: vi.fn(),
  session: {
    ready: true,
    entered: false,
    runtime: { paused: false },
    restart: vi.fn(),
    refreshGraphics: vi.fn(),
    enter: vi.fn(),
    error: null,
  },
}));
vi.mock('../../game/runtime/expedition', () => ({
  retainExpedition: fixture.retain,
  peekExpedition: () => (fixture.retained ? fixture.session : null),
  expeditionSnapshot: () => fixture.version,
  subscribeExpedition: (listener: () => void) => {
    fixture.listeners.add(listener);
    return () => fixture.listeners.delete(listener);
  },
}));
vi.mock('../../game/LaunchScene', () => ({
  LaunchScene: class {
    constructor(
      _runtime: unknown,
      _container: HTMLElement,
      _target: HTMLButtonElement,
      _flight: unknown,
      complete: () => void,
      _copy: unknown,
      spaceChange: (active: boolean) => void,
      landingAudio: (event: 'falling' | 'parachute' | 'touchdown' | 'decompression') => void,
    ) {
      if (fixture.sceneFailure) throw new Error('Animation initialization failed');
      fixture.complete = complete;
      fixture.spaceChange = spaceChange;
      fixture.landingAudio = landingAudio;
    }
    launch() {}
    startArrival() {
      fixture.complete?.();
    }
    skip = fixture.skip;
    dispose = fixture.dispose;
    setReducedMotion() {}
    setQuality() {}
    setAntialiasing() {}
    setPostProcessing() {}
  },
}));
vi.mock('../components/astronaut/SuitPreview', () => ({ SuitPreview: () => null }));
vi.mock('../components/SettingsModal', () => ({
  SettingsModal: ({ onAudioChange }: { onAudioChange: (audio: AudioSettings) => void }) => {
    fixture.changeAudio = onAudioChange;
    return null;
  },
}));

class FakeAudio {
  static instances: FakeAudio[] = [];
  volume = 1;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  constructor(readonly src: string) {
    FakeAudio.instances.push(this);
  }
}
let container: HTMLDivElement;
let root: Root;
function notify() {
  fixture.version++;
  for (const listener of fixture.listeners) listener();
}
function button(text: string) {
  const found = [...container.querySelectorAll('button')].find(
    (node) => node.getAttribute('aria-label') === text || node.textContent?.trim() === text,
  );
  if (!found) throw new Error(`Button missing: ${text}`);
  return found;
}
async function mount(arrivalOnly = false) {
  await act(async () =>
    root.render(
      <StrictMode>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<Home arrivalOnly={arrivalOnly} />} />
            <Route path="/centro" element={<p>Centro aberto</p>} />
            <Route path="/jogar" element={<p>Base preparada</p>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    ),
  );
}

beforeEach(() => {
  // as configurações agora ficam num store global: cada teste começa do padrão
  useGameSettings.getState().resetSettings();
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
  FakeAudio.instances = [];
  fixture.retained = false;
  fixture.version = 0;
  fixture.sceneFailure = false;
  fixture.complete = null;
  fixture.spaceChange = null;
  fixture.landingAudio = null;
  fixture.session.ready = true;
  fixture.session.entered = false;
  fixture.session.runtime.paused = false;
  fixture.retain.mockImplementation(() => {
    fixture.retained = true;
    notify();
    return { session: fixture.session, release: fixture.release };
  });
  sessionStorage.clear();
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Clica em “Jogar agora” e pula a contagem regressiva do B.I.T. (os motores acendem na hora). */
async function startLaunch() {
  await act(async () => button('Jogar agora').click());
  if (container.querySelector('.bit-guide--launch .bit-countdown'))
    await act(async () => button('Pular animação →').click());
}

describe('Home initialization and recovery', () => {
  it('starts descent audio on landing events, syncs volume and stops on touchdown', async () => {
    await mount();
    await startLaunch();
    await act(async () => fixture.spaceChange?.(false));
    const parachute = FakeAudio.instances.find((a) => a.src.endsWith('/parachute-open.mp3'));
    expect(parachute?.play).not.toHaveBeenCalled();
    await act(async () => fixture.landingAudio?.('falling'));
    const falling = FakeAudio.instances.find((a) => a.src.endsWith('/falling.mp3'));
    expect(falling?.play).toHaveBeenCalledTimes(1);
    expect(falling?.volume).toBeCloseTo(0.8 * 0.85);
    await act(async () =>
      fixture.changeAudio?.({ masterVolume: 50, sfxVolume: 60, musicVolume: 70, muted: false }),
    );
    expect(falling?.volume).toBeCloseTo(0.3);
    vi.useFakeTimers();
    await act(async () => fixture.landingAudio?.('parachute'));
    expect(parachute?.play).toHaveBeenCalledTimes(1);
    expect(falling?.volume).toBeCloseTo(0.3);
    await act(async () => vi.advanceTimersByTime(500));
    expect(falling?.volume).toBeCloseTo(0.18);
    expect(falling?.pause).not.toHaveBeenCalled();
    await act(async () =>
      fixture.changeAudio?.({ masterVolume: 80, sfxVolume: 100, musicVolume: 70, muted: false }),
    );
    expect(falling?.volume).toBeCloseTo(0.48);
    await act(async () => vi.advanceTimersByTime(500));
    expect(falling?.volume).toBeCloseTo(0.16);
    expect(falling?.pause).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1500));
    expect(falling?.volume).toBeCloseTo(0.16);
    expect(falling?.pause).not.toHaveBeenCalled();
    await act(async () => fixture.landingAudio?.('touchdown'));
    expect(falling?.pause).toHaveBeenCalled();
    expect(parachute?.pause).not.toHaveBeenCalled();
    await act(async () => fixture.landingAudio?.('decompression'));
    const air = FakeAudio.instances.find((a) => a.src.endsWith('/air.mp3'));
    expect(air?.play).toHaveBeenCalledTimes(1);
    expect(air?.volume).toBeCloseTo(0.4);
    await act(async () =>
      fixture.changeAudio?.({ masterVolume: 50, sfxVolume: 60, musicVolume: 70, muted: false }),
    );
    expect(air?.volume).toBeCloseTo(0.15);
    await act(async () => fixture.complete?.());
    expect(air?.pause).toHaveBeenCalledTimes(1);
    expect(parachute?.pause).toHaveBeenCalledTimes(1);
    await act(async () =>
      fixture.changeAudio?.({ masterVolume: 80, sfxVolume: 100, musicVolume: 70, muted: true }),
    );
    expect(air?.volume).toBe(0);
  });

  it('keeps the menu and navigation available when WebGL runtime creation throws', async () => {
    fixture.retain.mockImplementation(() => {
      throw new Error('WebGL unavailable');
    });
    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('modo 3D');
    expect(button('Jogar agora').disabled).toBe(true);
    expect(button('Tentar novamente')).toBeDefined();
    expect(container.querySelector('[aria-label="Configurações"]')).not.toBeNull();
    expect(fixture.release).not.toHaveBeenCalled();
    const link = container.querySelector<HTMLAnchorElement>('a[href="/centro"]');
    await act(async () => link?.click());
    expect(container.textContent).toContain('Centro aberto');
  });
  it('keeps the prepared-world fallback when only the cinematic fails and releases each lease once', async () => {
    fixture.sceneFailure = true;
    await mount();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => button('Jogar agora').click());
    expect(container.querySelector('dialog')?.open).toBe(false);
    await act(async () => root.unmount());
    expect(fixture.retain).toHaveBeenCalledTimes(2);
    expect(fixture.release).toHaveBeenCalledTimes(2);
  });
  it('also guards restart failures after acquiring a session', async () => {
    fixture.session.entered = true;
    fixture.session.restart.mockImplementationOnce(() => {
      throw new Error('Restart failed');
    });
    await mount();
    await act(async () => root.unmount());
    expect(fixture.release).toHaveBeenCalledTimes(2);
  });
  it('completes direct-arrival fallback when the cinematic fails', async () => {
    fixture.sceneFailure = true;
    await mount(true);
    expect(container.querySelector('dialog')?.open).toBe(true);
  });
  it('o B.I.T. faz a contagem regressiva antes da decolagem e pular acende os motores', async () => {
    await mount();
    await act(async () => button('Jogar agora').click());
    expect(container.querySelector('.bit-countdown strong')?.textContent).toBe('5');
    expect(FakeAudio.instances.find((a) => a.src.endsWith('/foguete.mp3'))).toBeUndefined();
    await act(async () => button('Pular animação →').click());
    expect(container.querySelector('.bit-countdown')).toBeNull();
    expect(FakeAudio.instances.find((a) => a.src.endsWith('/foguete.mp3'))?.play).toHaveBeenCalledTimes(1);
  });
  it('skips before completion and reopens customization after closing it', async () => {
    await mount();
    await startLaunch();
    await act(async () => button('Pular animação →').click());
    expect(fixture.skip).toHaveBeenCalledTimes(1);
    await act(async () => fixture.complete?.());
    // ao fim da viagem nada abre sozinho: o botão em destaque é que abre a personalização
    expect(container.querySelector('dialog')?.open).toBe(false);
    expect(button('Personalizar astronauta').dataset.cta).toBe('true');
    await act(async () => button('Personalizar astronauta').click());
    expect(container.querySelector('dialog')?.open).toBe(true);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Fechar janela"]')?.click(),
    );
    expect(container.querySelector('dialog')?.open).toBe(false);
    await act(async () => button('Personalizar astronauta').click());
    expect(container.querySelector('dialog')?.open).toBe(true);
    expect(fixture.skip).toHaveBeenCalledTimes(1);
    await act(async () =>
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    // A name is still required; reopening does not bypass identification.
    expect(fixture.session.enter).not.toHaveBeenCalled();
  });
  it('waits for world readiness before offering customization', async () => {
    fixture.session.ready = false;
    await mount();
    await startLaunch();
    await act(async () => fixture.complete?.());
    expect(button('Personalizar astronauta').disabled).toBe(true);
    await act(async () => {
      fixture.session.ready = true;
      notify();
    });
    expect(button('Personalizar astronauta').disabled).toBe(false);
    expect(container.querySelector('dialog')?.open).toBe(false);
    await act(async () => button('Personalizar astronauta').click());
    expect(container.querySelector('dialog')?.open).toBe(true);
  });
  it('updates the existing ignition sound on mute, unmute and volume changes', async () => {
    await mount();
    await startLaunch();
    const ignition = FakeAudio.instances.find((audio) => audio.src.endsWith('/foguete.mp3'));
    expect(ignition?.play).toHaveBeenCalledTimes(1);
    expect(ignition?.volume).toBeCloseTo(0.65 * 0.8 * 0.85);
    const audio: AudioSettings = { masterVolume: 80, sfxVolume: 85, musicVolume: 70, muted: true };
    await act(async () => fixture.changeAudio?.(audio));
    expect(ignition?.volume).toBe(0);
    await act(async () => fixture.changeAudio?.({ ...audio, muted: false, masterVolume: 50 }));
    expect(ignition?.volume).toBeCloseTo(0.65 * 0.5 * 0.85);
    await act(async () =>
      fixture.changeAudio?.({ ...audio, muted: false, masterVolume: 50, sfxVolume: 20 }),
    );
    expect(ignition?.volume).toBeCloseTo(0.065);
    expect(FakeAudio.instances).toHaveLength(3);
  });
});
