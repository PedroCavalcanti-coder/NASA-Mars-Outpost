import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GAME_SETTINGS, DEFAULT_OUTLINE_SETTINGS, useGameSettings } from './gameSettings';

describe('useGameSettings (Configurações do Jogo)', () => {
  beforeEach(() => {
    useGameSettings.getState().resetSettings();
  });

  it('inicia com os valores padrão corretos', () => {
    const state = useGameSettings.getState();
    expect(state.outline).toEqual(DEFAULT_OUTLINE_SETTINGS);
    expect(state.outline.enabled).toBe(false);
    expect(state.outline.strength).toBe(1.0);
    expect(state.outline.color).toBe('#0f141c');
    expect(state.video.quality).toBe('medium');
    expect(state.video.postProcessing).toBe(true);
    expect(state.audio.masterVolume).toBe(80);
    expect(state.gameplay.showHints).toBe(true);
  });

  it('permite alternar outline por booleano ou objeto independentemente', () => {
    const { setOutline } = useGameSettings.getState();

    // Toggle simples via booleano
    setOutline(true);
    expect(useGameSettings.getState().outline.enabled).toBe(true);

    setOutline(false);
    expect(useGameSettings.getState().outline.enabled).toBe(false);

    // Ajuste granular de intensidade e cor
    setOutline({ enabled: true, strength: 1.8, color: '#00e5ff' });
    const outline = useGameSettings.getState().outline;
    expect(outline.enabled).toBe(true);
    expect(outline.strength).toBe(1.8);
    expect(outline.color).toBe('#00e5ff');

    // Atualização funcional preservando propriedades anteriores
    setOutline((prev) => ({ ...prev, strength: 2.2 }));
    expect(useGameSettings.getState().outline.strength).toBe(2.2);
    expect(useGameSettings.getState().outline.color).toBe('#00e5ff');
  });

  it('atualiza configurações de vídeo de forma parcial e funcional', () => {
    const { setVideo } = useGameSettings.getState();
    setVideo({ quality: 'high', antialiasing: false });

    const state = useGameSettings.getState();
    expect(state.video.quality).toBe('high');
    expect(state.video.antialiasing).toBe(false);
    expect(state.video.postProcessing).toBe(true); // preservado

    setVideo((prev) => ({ ...prev, reducedMotion: !prev.reducedMotion }));
    expect(useGameSettings.getState().video.reducedMotion).toBe(true);
  });

  it('atualiza configurações de áudio e jogabilidade', () => {
    const { setAudio, setGameplay } = useGameSettings.getState();
    setAudio({ masterVolume: 50, muted: true });
    setGameplay({ highContrast: true, cameraSensitivity: 2 });

    const state = useGameSettings.getState();
    expect(state.audio.masterVolume).toBe(50);
    expect(state.audio.muted).toBe(true);
    expect(state.audio.sfxVolume).toBe(85); // preservado

    expect(state.gameplay.highContrast).toBe(true);
    expect(state.gameplay.cameraSensitivity).toBe(2);
    expect(state.gameplay.showHints).toBe(true); // preservado
  });

  it('reseta para os padrões com resetSettings', () => {
    const { setOutline, setVideo, resetSettings } = useGameSettings.getState();
    setOutline({ enabled: true, strength: 2.5, color: '#ffffff' });
    setVideo({ quality: 'low' });

    resetSettings();
    const state = useGameSettings.getState();
    expect(state.outline).toEqual(DEFAULT_OUTLINE_SETTINGS);
    expect(state.video.quality).toBe(DEFAULT_GAME_SETTINGS.video.quality);
  });
});
