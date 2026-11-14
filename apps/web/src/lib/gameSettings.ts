import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  AudioSettings,
  GameplaySettings,
  VideoSettings,
} from '../app/components/SettingsModal';

export type { AudioSettings, GameplaySettings, VideoSettings };

/**
 * Configuração da linha de contorno (outline).
 * Permite realçar a silhueta de astronautas, veículos, equipamentos e estruturas.
 */
export interface OutlineSettings {
  enabled: boolean;
  strength: number;
  color: string;
}

export const DEFAULT_OUTLINE_SETTINGS: OutlineSettings = {
  enabled: false,
  strength: 1.0,
  color: '#0f141c',
};

/**
 * Armazenamento em memória seguro caso window.localStorage não esteja disponível (ex: testes em Node).
 */
const memoryStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: (_key: string) => null,
  key: (_index: number) => null,
  removeItem: (_key: string) => {},
  setItem: (_key: string, _value: string) => {},
};

/**
 * Estado completo das configurações do jogador, combinando vídeo, áudio,
 * jogabilidade e preferências gráficas como linha de contorno (outline).
 */
export interface GameSettingsData {
  outline: OutlineSettings;
  video: VideoSettings;
  audio: AudioSettings;
  gameplay: GameplaySettings;
}

export interface GameSettingsStore extends GameSettingsData {
  setOutline: (
    outline: boolean | Partial<OutlineSettings> | ((prev: OutlineSettings) => OutlineSettings),
  ) => void;
  setVideo: (video: Partial<VideoSettings> | ((prev: VideoSettings) => VideoSettings)) => void;
  setAudio: (audio: Partial<AudioSettings> | ((prev: AudioSettings) => AudioSettings)) => void;
  setGameplay: (
    gameplay: Partial<GameplaySettings> | ((prev: GameplaySettings) => GameplaySettings),
  ) => void;
  setSettings: (patch: Partial<GameSettingsData>) => void;
  resetSettings: () => void;
}

const media = (q: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(q).matches
    : false;
/** Celular/tela pequena começa no gráfico baixo; o resto, no médio. */
const isSmallScreen =
  typeof window !== 'undefined' && (window.innerWidth < 768 || media('(pointer: coarse)'));

export const DEFAULT_GAME_SETTINGS: GameSettingsData = {
  outline: { ...DEFAULT_OUTLINE_SETTINGS },
  video: {
    quality: isSmallScreen ? 'low' : 'medium',
    postProcessing: true,
    antialiasing: true,
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
  },
  audio: {
    masterVolume: 80,
    sfxVolume: 85,
    musicVolume: 70,
    muted: false,
  },
  gameplay: {
    showHints: true,
    highContrast: false,
    cameraSensitivity: 1,
  },
};

/**
 * Store do zustand com persistência em localStorage para configurações do jogador.
 * Mantém compatibilidade com a tipagem do SettingsModal enquanto permite expansões futuras.
 */
export const useGameSettings = create<GameSettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_GAME_SETTINGS,
      setOutline: (outline) =>
        set((state) => {
          if (typeof outline === 'boolean') {
            return { outline: { ...state.outline, enabled: outline } };
          }
          if (typeof outline === 'function') {
            return { outline: outline(state.outline) };
          }
          return { outline: { ...state.outline, ...outline } };
        }),
      setVideo: (video) =>
        set((state) => ({
          video: typeof video === 'function' ? video(state.video) : { ...state.video, ...video },
        })),
      setAudio: (audio) =>
        set((state) => ({
          audio: typeof audio === 'function' ? audio(state.audio) : { ...state.audio, ...audio },
        })),
      setGameplay: (gameplay) =>
        set((state) => ({
          gameplay:
            typeof gameplay === 'function'
              ? gameplay(state.gameplay)
              : { ...state.gameplay, ...gameplay },
        })),
      setSettings: (patch) =>
        set((state) => ({
          ...patch,
          outline: patch.outline ? { ...state.outline, ...patch.outline } : state.outline,
          video: patch.video ? { ...state.video, ...patch.video } : state.video,
          audio: patch.audio ? { ...state.audio, ...patch.audio } : state.audio,
          gameplay: patch.gameplay ? { ...state.gameplay, ...patch.gameplay } : state.gameplay,
        })),
      resetSettings: () =>
        set({
          ...DEFAULT_GAME_SETTINGS,
          outline: { ...DEFAULT_OUTLINE_SETTINGS },
          video: { ...DEFAULT_GAME_SETTINGS.video },
          audio: { ...DEFAULT_GAME_SETTINGS.audio },
          gameplay: { ...DEFAULT_GAME_SETTINGS.gameplay },
        }),
    }),
    {
      name: 'mars-outpost-game-settings',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : memoryStorage,
      ),
      version: 1,
      // só os dados vão para o localStorage (as ações não são serializáveis)
      partialize: ({ outline, video, audio, gameplay }) => ({ outline, video, audio, gameplay }),
      // v0 guardava `outline` como booleano; a normalização em `merge` já converte
      migrate: (persistedState: unknown) => persistedState as GameSettingsData,
      // Mescla por seção: um save antigo sem algum campo novo herda o padrão em vez de
      // apagar a seção inteira (o merge padrão do zustand é raso).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Record<keyof GameSettingsData, unknown>>;
        const section = <T extends object>(value: unknown, fallback: T): T =>
          value && typeof value === 'object' ? { ...fallback, ...(value as Partial<T>) } : fallback;
        const outline =
          typeof p.outline === 'boolean'
            ? { ...current.outline, enabled: p.outline }
            : section(p.outline, current.outline);
        return {
          ...current,
          outline,
          video: section(p.video, current.video),
          audio: section(p.audio, current.audio),
          gameplay: section(p.gameplay, current.gameplay),
        };
      },
    },
  ),
);
