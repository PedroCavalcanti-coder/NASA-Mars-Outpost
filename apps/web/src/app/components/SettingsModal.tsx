import {
  Check,
  Copy,
  HelpCircle,
  LogOut,
  Monitor,
  Share2,
  Sliders,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { OutlineSettings } from '../../lib/gameSettings';
import { toast } from '../../ui/toast';
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
  /** linha de contorno; sem estas props a seção não aparece */
  outline?: OutlineSettings;
  onOutlineChange?: (next: OutlineSettings) => void;
  inGame?: boolean;
  roomCode?: string;
  onCopyRoomCode?: () => void;
  onLeaveRoom?: () => void;
}

type TabId = 'video' | 'audio' | 'gameplay' | 'room' | 'about';

export function SettingsModal({
  open,
  onClose,
  video,
  onVideoChange,
  audio,
  onAudioChange,
  gameplay,
  onGameplayChange,
  outline,
  onOutlineChange,
  inGame = false,
  roomCode,
  onCopyRoomCode,
  onLeaveRoom,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<TabId>(inGame ? 'room' : 'video');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (inGame) setTab('room');
      else setTab('video');
    }
    if (!open && d.open) d.close();
  }, [open, inGame]);

  const handleCopy = () => {
    if (!roomCode) return;
    if (onCopyRoomCode) {
      onCopyRoomCode();
    } else {
      navigator.clipboard.writeText(roomCode);
      toast(`Código da sala ${roomCode} copiado!`, 'ok');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2600);
  };

  const handleCopyLink = () => {
    if (!roomCode) return;
    const link = `${window.location.origin}/jogar?sala=${encodeURIComponent(roomCode)}`;
    navigator.clipboard.writeText(link);
    toast('Link de convite da sala copiado!', 'ok');
    setCopied(true);
    setTimeout(() => setCopied(false), 2600);
  };

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
            <h2 id="settings-dialog-title">{inGame ? 'Configurações & Sala' : 'Configurações'}</h2>
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
            {inGame && (
              <button
                type="button"
                className={`game-nav-tab is-special ${tab === 'room' ? 'is-active' : ''}`}
                onClick={() => setTab('room')}
              >
                <Users size={18} />
                <span>Sala & Convite</span>
              </button>
            )}

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

          {/* Painel de Conteúdo com scroll seguro */}
          <div className="game-settings-panel">
            {/* SUB-PAINEL: SALA & CONVITE (EM JOGO) */}
            {tab === 'room' && inGame && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Sala & Convite da Expedição</h3>
                  <p>Compartilhe o código exclusivo desta sala para jogar junto com amigos.</p>
                </div>

                <div className="settings-room-card">
                  <span className="settings-room-label">CÓDIGO EXCLUSIVO DA SALA</span>
                  <div className="settings-room-code-display">
                    <code>{roomCode ?? 'MARS-OUTPOST-LOCAL'}</code>
                    <button
                      type="button"
                      className="settings-room-btn is-primary"
                      onClick={handleCopy}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Código Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>
                  <p className="settings-room-instructions">
                    Seu amigo pode entrar na sua sala clicando em{' '}
                    <strong>"Entrar em um mundo"</strong> na tela inicial e colando este código
                    (máximo 4 jogadores).
                  </p>
                  <div className="settings-room-actions">
                    <button
                      type="button"
                      className="settings-room-link-btn"
                      onClick={handleCopyLink}
                    >
                      <Share2 size={15} />
                      <span>Copiar Link de Convite Direto</span>
                    </button>
                  </div>
                </div>

                <div className="settings-danger-zone">
                  <div className="settings-danger-info">
                    <h4>Sair da Missão Atual</h4>
                    <p>
                      Encerra sua sessão na base marciana e retorna ao centro de lançamento na
                      Terra.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="settings-btn-danger"
                    onClick={() => {
                      onClose();
                      onLeaveRoom?.();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Sair da Sala</span>
                  </button>
                </div>
              </div>
            )}

            {/* SUB-PAINEL: VÍDEO */}
            {tab === 'video' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Gráficos & Desempenho</h3>
                  <p>Ajuste a qualidade visual para melhor fluidez no seu dispositivo.</p>
                </div>

                {/* Opções de Vídeo: Baixo / Médio / Alto */}
                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Nível de Qualidade Visual</span>
                    <small>
                      {video.quality === 'low' &&
                        'Baixo · Recomendado para celulares e telas pequenas'}
                      {video.quality === 'medium' &&
                        'Médio · Padrão equilibrado para PC / Notebook'}
                      {video.quality === 'high' &&
                        'Alto · Fidelidade gráfica máxima com sombras detalhadas'}
                    </small>
                  </div>
                  <div
                    className="settings-tier-selector"
                    role="radiogroup"
                    aria-label="Qualidade gráfica"
                  >
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'low' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'low' })}
                      aria-pressed={video.quality === 'low'}
                    >
                      Baixo
                    </button>
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'medium' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'medium' })}
                      aria-pressed={video.quality === 'medium'}
                    >
                      Médio
                    </button>
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'high' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'high' })}
                      aria-pressed={video.quality === 'high'}
                    >
                      Alto
                    </button>
                  </div>
                </div>

                {/* Post-Processing */}
                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Pós-processamento (Post-Processing)</span>
                    <small>
                      Filtros de atmosfera marciana, vinheta e correção tonal ACES Filmic.
                    </small>
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

                {/* Anti-aliasing (Suavização) */}
                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Suavização de Serrilhado (Anti-aliasing)</span>
                    <small>
                      Suaviza arestas poligonais do terreno, habitats e painéis solares.
                    </small>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={video.antialiasing}
                      onChange={(e) => onVideoChange({ ...video, antialiasing: e.target.checked })}
                    />
                    <span className="toggle-switch" />
                  </label>
                </div>

                {/* Linha de Contorno */}
                {outline && onOutlineChange && (
                  <>
                    <div className="settings-item">
                      <div className="settings-item-label">
                        <span>Linha de Contorno</span>
                        <small>
                          Realça a silhueta de astronautas, rover, equipamentos e da base.
                          {video.quality === 'low' && ' Indisponível no gráfico baixo.'}
                        </small>
                      </div>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={outline.enabled}
                          onChange={(e) =>
                            onOutlineChange({ ...outline, enabled: e.target.checked })
                          }
                        />
                        <span className="toggle-switch" />
                      </label>
                    </div>
                    {outline.enabled && (
                      <div className="settings-slider-item">
                        <div className="slider-header">
                          <span>Espessura do Contorno</span>
                          <span className="slider-value">{outline.strength.toFixed(1)}×</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.1"
                          value={outline.strength}
                          onChange={(e) =>
                            onOutlineChange({ ...outline, strength: Number(e.target.value) })
                          }
                          className="settings-range"
                          aria-label="Espessura do contorno"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Movimento Reduzido */}
                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Reduzir Movimento de Câmera</span>
                    <small>
                      Diminui a inércia dos controles orbitais para maior conforto visual.
                    </small>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={video.reducedMotion}
                      onChange={(e) => onVideoChange({ ...video, reducedMotion: e.target.checked })}
                    />
                    <span className="toggle-switch" />
                  </label>
                </div>
              </div>
            )}

            {/* SUB-PAINEL: VOLUME / ÁUDIO */}
            {tab === 'audio' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Sons & Ambiência Espacial</h3>
                  <p>
                    Controle os volumes de navegação, propulsão da nave e som ambiente de Marte.
                  </p>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Silenciar Todos os Sons</span>
                    <small>Desativa qualquer saída de áudio do simulador.</small>
                  </div>
                  <button
                    type="button"
                    className={`mute-btn ${audio.muted ? 'is-muted' : ''}`}
                    onClick={() => onAudioChange({ ...audio, muted: !audio.muted })}
                  >
                    {audio.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    <span>{audio.muted ? 'Mutado' : 'Áudio Ativo'}</span>
                  </button>
                </div>

                <div className="settings-slider-item">
                  <div className="slider-header">
                    <span>Volume Geral (Master)</span>
                    <span className="slider-value">
                      {audio.muted ? '0%' : `${audio.masterVolume}%`}
                    </span>
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
                    <span>Efeitos Sonoros (SFX & Propulsão)</span>
                    <span className="slider-value">
                      {audio.muted ? '0%' : `${audio.sfxVolume}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={audio.muted}
                    value={audio.sfxVolume}
                    onChange={(e) => onAudioChange({ ...audio, sfxVolume: Number(e.target.value) })}
                    className="settings-range"
                  />
                </div>

                <div className="settings-slider-item">
                  <div className="slider-header">
                    <span>Música Ambiente</span>
                    <span className="slider-value">
                      {audio.muted ? '0%' : `${audio.musicVolume}%`}
                    </span>
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

            {/* SUB-PAINEL: GERAL / JOGO */}
            {tab === 'gameplay' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Jogabilidade & Interface</h3>
                  <p>Preferências de assistência, acessibilidade e visualização.</p>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Exibir Dicas de Controle na Tela</span>
                    <small>
                      Mostra a barra inferior com comandos de caminhada, rotação e limpeza.
                    </small>
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
                    <small>Aumenta a separação de bordas e textos para maior clareza visual.</small>
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
                    <small>Comunicações da base e telemetria marciana.</small>
                  </div>
                  <span className="settings-badge">Português (Brasil)</span>
                </div>
              </div>
            )}

            {/* SUB-PAINEL: SOBRE */}
            {tab === 'about' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>Nossa Missão</h3>
                  <p>Mars Outpost · NASA Space Apps Challenge Fortaleza</p>
                </div>

                <div className="settings-about-body">
                  <p>
                    O <strong>Mars Outpost</strong> é um simulador interativo e educativo que
                    explora o desafio de construir e manter bases científicas sustentáveis em Marte.
                  </p>
                  <p>
                    Com modelos modulares em 3D, simulação de recursos vitais (oxigênio, água,
                    energia solar) e dados de missões reais da NASA, o projeto convida os
                    exploradores a vivenciar a ciência por trás da colonização espacial.
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
          <div className="game-settings-footer-in-game">
            {inGame && roomCode && (
              <button type="button" className="game-settings-quick-invite" onClick={handleCopy}>
                <Share2 size={15} />
                <span>Copiar Código: {roomCode}</span>
              </button>
            )}
          </div>
          <button type="button" className="game-settings-done" onClick={onClose}>
            Concluir
          </button>
        </footer>
      </div>
    </dialog>
  );
}
