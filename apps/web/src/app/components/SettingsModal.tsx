import {
  HelpCircle,
  Monitor,
  Sliders,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import './settingsModal.css';

export interface VideoSettings {
  quality: 'low' | 'medium' | 'high';
  postProcessing: boolean;
  antialiasing: boolean;
  reducedMotion: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

export interface GameplaySettings {
  showHints: boolean;
  highContrast: boolean;
  cameraSensitivity: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  video: VideoSettings;
  onVideoChange: (next: VideoSettings) => void;
  audio: AudioSettings;
  onAudioChange: (next: AudioSettings) => void;
  gameplay: GameplaySettings;
  onGameplayChange: (next: GameplaySettings) => void;
}

type TabId = 'video' | 'audio' | 'gameplay' | 'about';

export function SettingsModal({
  open,
  onClose,
  video,
  onVideoChange,
  audio,
  onAudioChange,
  gameplay,
  onGameplayChange,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<TabId>('video');

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click handles close
    <dialog
      ref={dialogRef}
      className="game-settings-dialog"
      aria-labelledby="settings-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      <div className="game-settings-shell">
        <header className="game-settings-header">
          <div className="game-settings-title-wrap">
            <span className="game-settings-kicker">SISTEMA DA MISSÃO</span>
            <h2 id="settings-dialog-title">Configurações</h2>
          </div>
          <button
            type="button"
            className="game-settings-close"
            onClick={onClose}
            aria-label="Fechar configurações"
          >
            <X size={20} />
          </button>
        </header>

        <div className="game-settings-layout">
          {/* Menu Lateral de Sub-Painéis */}
          <nav className="game-settings-nav" aria-label="Seções de configurações">
            <button
              type="button"
              className={`game-nav-tab ${tab === 'video' ? 'is-active' : ''}`}
              onClick={() => setTab('video')}
            >
              <Monitor size={18} />
              <span>Vídeo</span>
            </button>
            <button
              type="button"
              className={`game-nav-tab ${tab === 'audio' ? 'is-active' : ''}`}
              onClick={() => setTab('audio')}
            >
              <Volume2 size={18} />
              <span>Volume</span>
            </button>
            <button
              type="button"
              className={`game-nav-tab ${tab === 'gameplay' ? 'is-active' : ''}`}
              onClick={() => setTab('gameplay')}
            >
              <Sliders size={18} />
              <span>Geral</span>
            </button>
            <button
              type="button"
              className={`game-nav-tab ${tab === 'about' ? 'is-active' : ''}`}
              onClick={() => setTab('about')}
            >
              <HelpCircle size={18} />
              <span>Sobre</span>
            </button>
          </nav>

          {/* Conteúdo do Sub-Painel */}
          <div className="game-settings-panel">
            {tab === 'video' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Gráficos & Desempenho</h3>
                  <p>Ajuste a qualidade visual para melhor fluidez no seu dispositivo.</p>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Nível de Qualidade Visual</span>
                    <small>
                      {video.quality === 'low' && 'Econômico · Recomendado para celulares e tablets'}
                      {video.quality === 'medium' && 'Equilibrado · Padrão para PCs e notebooks'}
                      {video.quality === 'high' && 'Máximo · Alta fidelidade com sombras detalhadas'}
                    </small>
                  </div>
                  <div className="settings-tier-selector">
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'low' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'low' })}
                    >
                      Baixo
                    </button>
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'medium' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'medium' })}
                    >
                      Médio
                    </button>
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'high' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'high' })}
                    >
                      Alto
                    </button>
                  </div>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Pós-processamento</span>
                    <small>Iluminação atmosférica e vinheta de cinema.</small>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={video.postProcessing}
                      onChange={(e) =>
                        onVideoChange({ ...video, postProcessing: e.target.checked })
                      }
                    />
                    <span className="toggle-switch" />
                  </label>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Suavização de Bordas (Antialiasing)</span>
                    <small>Reduz serrilhados nos modelos 3D e no terreno.</small>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={video.antialiasing}
                      onChange={(e) =>
                        onVideoChange({ ...video, antialiasing: e.target.checked })
                      }
                    />
                    <span className="toggle-switch" />
                  </label>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Reduzir Movimentos</span>
                    <small>Evita tremores e transições bruscas de câmera.</small>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={video.reducedMotion}
                      onChange={(e) =>
                        onVideoChange({ ...video, reducedMotion: e.target.checked })
                      }
                    />
                    <span className="toggle-switch" />
                  </label>
                </div>
              </div>
            )}

            {tab === 'audio' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Controle de Áudio & Volume</h3>
                  <p>Ajuste os canais de som ambiente e efeitos de propulsão.</p>
                </div>

                <div className="settings-item settings-item--audio-row">
                  <div className="settings-item-label">
                    <span>Silenciar Todos os Sons</span>
                    <small>Desativa qualquer saída de áudio instantaneamente.</small>
                  </div>
                  <button
                    type="button"
                    className={`mute-btn ${audio.muted ? 'is-muted' : ''}`}
                    onClick={() => onAudioChange({ ...audio, muted: !audio.muted })}
                  >
                    {audio.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    <span>{audio.muted ? 'Mudo' : 'Ativo'}</span>
                  </button>
                </div>

                <div className="settings-slider-item">
                  <div className="slider-header">
                    <span>Volume Geral</span>
                    <span className="slider-value">{audio.muted ? '0%' : `${audio.masterVolume}%`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={audio.muted}
                    value={audio.masterVolume}
                    onChange={(e) =>
                      onAudioChange({ ...audio, masterVolume: Number(e.target.value) })
                    }
                    className="settings-range"
                  />
                </div>

                <div className="settings-slider-item">
                  <div className="slider-header">
                    <span>Efeitos Sonoros (SFX / Propulsão)</span>
                    <span className="slider-value">{audio.muted ? '0%' : `${audio.sfxVolume}%`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={audio.muted}
                    value={audio.sfxVolume}
                    onChange={(e) =>
                      onAudioChange({ ...audio, sfxVolume: Number(e.target.value) })
                    }
                    className="settings-range"
                  />
                </div>

                <div className="settings-slider-item">
                  <div className="slider-header">
                    <span>Música Ambiente</span>
                    <span className="slider-value">{audio.muted ? '0%' : `${audio.musicVolume}%`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={audio.muted}
                    value={audio.musicVolume}
                    onChange={(e) =>
                      onAudioChange({ ...audio, musicVolume: Number(e.target.value) })
                    }
                    className="settings-range"
                  />
                </div>
              </div>
            )}

            {tab === 'gameplay' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Jogabilidade & Interface</h3>
                  <p>Preferências de assistência e visualização.</p>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Exibir Dicas de Controle na Tela</span>
                    <small>Mostra a barra inferior com comandos de rotação e zoom.</small>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={gameplay.showHints}
                      onChange={(e) =>
                        onGameplayChange({ ...gameplay, showHints: e.target.checked })
                      }
                    />
                    <span className="toggle-switch" />
                  </label>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Modo Alto Contraste</span>
                    <small>Aumenta a separação de bordas e textos para maior clareza.</small>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={gameplay.highContrast}
                      onChange={(e) =>
                        onGameplayChange({ ...gameplay, highContrast: e.target.checked })
                      }
                    />
                    <span className="toggle-switch" />
                  </label>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Idioma da Missão</span>
                    <small>Comunicações e relatórios científicos.</small>
                  </div>
                  <span className="settings-badge">Português (Brasil)</span>
                </div>
              </div>
            )}

            {tab === 'about' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Nossa Missão</h3>
                  <p>Mars Outpost · NASA Space Apps Challenge Fortaleza</p>
                </div>

                <div className="settings-about-body">
                  <p>
                    O <strong>Mars Outpost</strong> é um simulador interativo e educativo que explora
                    o desafio de construir e manter bases científicas sustentáveis em Marte.
                  </p>
                  <p>
                    Com modelos modulares em 3D, simulação de recursos vitais (oxigênio, água, energia
                    solar) e dados de missões reais da NASA, o projeto convida os exploradores a
                    vivenciar a ciência por trás da colonização espacial.
                  </p>
                  <div className="settings-about-note">
                    Projeto independente desenvolvido para o NASA Space Apps Challenge Fortaleza.
                    Não há vínculo, endosso ou patrocínio oficial da NASA.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="game-settings-footer">
          <button type="button" className="game-settings-done" onClick={onClose}>
            Concluir
          </button>
        </footer>
      </div>
    </dialog>
  );
}
