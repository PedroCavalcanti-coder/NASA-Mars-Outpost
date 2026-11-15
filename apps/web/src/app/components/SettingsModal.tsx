import { type ColorMode, useA11y } from '../../lib/accessibility';
import { useEasyMode } from '../../lib/easyMode';
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
import { getLang, L, setLang } from '../../lib/i18n';
import { copyText } from '../../lib/clipboard';
import type { OutlineSettings } from '../../lib/gameSettings';
import { toast } from '../../ui/toast';
import './settingsModal.css';

export interface VideoSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra';
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
  onCopyRoomCode?: () => boolean | Promise<boolean>;
  onLeaveRoom?: () => void;
  /** reabre o tutorial de abertura (só dentro do jogo) */
  onReplayTutorial?: () => void;
}

type TabId = 'video' | 'audio' | 'gameplay' | 'access' | 'room' | 'about';

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
  onReplayTutorial,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<TabId>(inGame ? 'room' : 'video');
  const [copied, setCopied] = useState(false);
  const a11y = useA11y();
  const easy = useEasyMode((s) => s.easy);
  const setEasy = useEasyMode((s) => s.set);

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

  const copyInvite = async (text: string, message: string) => {
    const ok = await copyText(text);
    toast(
      ok ? message : L('Não foi possível copiar. Selecione o código da sala manualmente.', 'Could not copy. Select the room code manually.'),
      ok ? 'ok' : 'error',
    );
    setCopied(ok);
    setTimeout(() => setCopied(false), 2600);
  };

  const handleCopy = async () => {
    if (onCopyRoomCode) {
      setCopied(await onCopyRoomCode());
      setTimeout(() => setCopied(false), 2600);
    } else if (roomCode) await copyInvite(roomCode, L(`Código da sala ${roomCode} copiado!`, `Room code ${roomCode} copied!`));
  };

  const handleCopyLink = () => {
    if (!roomCode) return;
    const link = `${window.location.origin}/jogar?sala=${encodeURIComponent(roomCode)}`;
    void copyInvite(link, L('Link de convite da sala copiado!', 'Room invite link copied!'));
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
            <span className="game-settings-kicker">{L('SISTEMA DA MISSÃO', 'MISSION SYSTEM')}</span>
            <h2 id="settings-dialog-title">{inGame ? L('Configurações & Sala', 'Settings & Room') : L('Configurações', 'Settings')}</h2>
          </div>
          <button
            type="button"
            className="game-settings-close"
            onClick={onClose}
            aria-label={L('Fechar configurações', 'Close settings')}
          >
            <X size={20} />
          </button>
        </header>

        <div className="game-settings-layout">
          {/* Menu Lateral de Sub-Painéis */}
          <nav className="game-settings-nav" aria-label={L('Seções de configurações', 'Settings sections')}>
            {inGame && (
              <button
                type="button"
                className={`game-nav-tab is-special ${tab === 'room' ? 'is-active' : ''}`}
                onClick={() => setTab('room')}
              >
                <Users size={18} />
                <span>{L('Sala & Convite', 'Room & Invite')}</span>
              </button>
            )}

            <button
              type="button"
              className={`game-nav-tab ${tab === 'video' ? 'is-active' : ''}`}
              onClick={() => setTab('video')}
            >
              <Monitor size={18} />
              <span>{L('Vídeo', 'Video')}</span>
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
              <span>{L('Geral', 'General')}</span>
            </button>

            <button
              type="button"
              className={`game-nav-tab ${tab === 'access' ? 'is-active' : ''}`}
              onClick={() => setTab('access')}
            >
              <HelpCircle size={18} />
              <span>{L('Acessibilidade', 'Accessibility')}</span>
            </button>
            <button
              type="button"
              className={`game-nav-tab ${tab === 'about' ? 'is-active' : ''}`}
              onClick={() => setTab('about')}
            >
              <HelpCircle size={18} />
              <span>{L('Sobre', 'About')}</span>
            </button>
          </nav>

          {/* Painel de Conteúdo com scroll seguro */}
          <div className="game-settings-panel">
            {/* SUB-PAINEL: SALA & CONVITE (EM JOGO) */}
            {tab === 'room' && inGame && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>{L('Sala & Convite da Expedição', 'Expedition Room & Invite')}</h3>
                  <p>{L('Compartilhe o código exclusivo desta sala para jogar junto com amigos.', 'Share this room\'s code to play with friends.')}</p>
                </div>

                <div className="settings-room-card">
                  <span className="settings-room-label">{L('CÓDIGO EXCLUSIVO DA SALA', 'ROOM CODE')}</span>
                  <div className="settings-room-code-display">
                    <code>{roomCode ?? 'MARS-OUTPOST-LOCAL'}</code>
                    <button
                      type="button"
                      className="settings-room-btn is-primary"
                      onClick={handleCopy}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? L('Código Copiado!', 'Code Copied!') : L('Copiar Código', 'Copy Code')}</span>
                    </button>
                  </div>
                  <p className="settings-room-instructions">
                    {L('Seu amigo pode entrar na sua sala clicando em', 'Your friend can join your room by clicking')}{' '}
                    <strong>{L('"Entrar em um mundo"', '“Join a world”')}</strong> {L(' na tela inicial e colando este código (máximo 4 jogadores).', ' on the home screen and pasting this code (up to 4 players).')}
                  </p>
                  <div className="settings-room-actions">
                    <button
                      type="button"
                      className="settings-room-link-btn"
                      onClick={handleCopyLink}
                    >
                      <Share2 size={15} />
                      <span>{L('Copiar Link de Convite Direto', 'Copy Direct Invite Link')}</span>
                    </button>
                  </div>
                </div>

                {onReplayTutorial && (
                  <div className="settings-room-actions">
                    <button
                      type="button"
                      className="settings-room-link-btn"
                      onClick={() => {
                        onClose();
                        onReplayTutorial();
                      }}
                    >
                      <span>📖 {L('Rever o tutorial', 'Watch the tutorial again')}</span>
                    </button>
                  </div>
                )}

                <div className="settings-danger-zone">
                  <div className="settings-danger-info">
                    <h4>{L('Sair da Missão Atual', 'Leave Current Mission')}</h4>
                    <p>
                      {L('Encerra sua sessão na base marciana e retorna ao centro de lançamento na Terra.', 'Ends your session on the Mars base and returns to the launch center on Earth.')}
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
                    <span>{L('Sair da Sala', 'Leave Room')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* SUB-PAINEL: VÍDEO */}
            {tab === 'video' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>{L('Gráficos & Desempenho', 'Graphics & Performance')}</h3>
                  <p>{L('Ajuste a qualidade visual para melhor fluidez no seu dispositivo.', 'Adjust visual quality for smoother play on your device.')}</p>
                </div>

                {/* Opções de Vídeo: Baixo / Médio / Alto */}
                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>{L('Nível de Qualidade Visual', 'Visual Quality Level')}</span>
                    <small>
                      {video.quality === 'low' &&
                        L('Baixo · Recomendado para celulares e telas pequenas', 'Low · Recommended for phones and small screens')}
                      {video.quality === 'medium' &&
                        L('Médio · Padrão equilibrado para PC / Notebook', 'Medium · Balanced default for PC / laptop')}
                      {video.quality === 'ultra' &&
                        L('Ultra · Resolução nativa e sombras em 8K (precisa de PC forte)', 'Ultra · Native resolution and 8K shadows (needs a strong PC)')}
                      {video.quality === 'high' &&
                        L('Alto · Fidelidade gráfica máxima com sombras detalhadas', 'High · Maximum graphics with detailed shadows')}
                    </small>
                  </div>
                  <div
                    className="settings-tier-selector"
                    role="radiogroup"
                    aria-label={L('Qualidade gráfica', 'Graphics quality')}
                  >
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'low' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'low' })}
                      aria-pressed={video.quality === 'low'}
                    >
                      {L('Baixo', 'Low')}
                    </button>
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'medium' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'medium' })}
                      aria-pressed={video.quality === 'medium'}
                    >
                      {L('Médio', 'Medium')}
                    </button>
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'high' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'high' })}
                      aria-pressed={video.quality === 'high'}
                    >
                      {L('Alto', 'High')}
                    </button>
                    <button
                      type="button"
                      className={`tier-btn ${video.quality === 'ultra' ? 'is-active' : ''}`}
                      onClick={() => onVideoChange({ ...video, quality: 'ultra' })}
                      aria-pressed={video.quality === 'ultra'}
                    >
                      {L('Ultra', 'Ultra')}
                    </button>
                  </div>
                </div>

                {/* Post-Processing */}
                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>{L('Pós-processamento (Post-Processing)', 'Post-processing')}</span>
                    <small>
                      {L('Filtros de atmosfera marciana, vinheta e correção tonal ACES Filmic.', 'Martian atmosphere filters, vignette and ACES Filmic tone mapping.')}
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
                    <span>{L('Suavização de Serrilhado (Anti-aliasing)', 'Anti-aliasing')}</span>
                    <small>
                      {L('Suaviza arestas poligonais do terreno, habitats e painéis solares.', 'Smooths the edges of terrain, habitats and solar panels.')}
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
                        <span>{L('Linha de Contorno', 'Outline')}</span>
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
                          <span>{L('Espessura do Contorno', 'Outline Thickness')}</span>
                          <span className="slider-value">{outline.strength.toFixed(1)}×</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="1"
                          step="0.1"
                          value={outline.strength}
                          onChange={(e) =>
                            onOutlineChange({ ...outline, strength: Number(e.target.value) })
                          }
                          className="settings-range"
                          aria-label={L('Espessura do contorno', 'Outline thickness')}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Movimento Reduzido */}
                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>{L('Reduzir Movimento de Câmera', 'Reduce Camera Motion')}</span>
                    <small>
                      {L('Diminui a inércia dos controles orbitais para maior conforto visual.', 'Reduces camera inertia for more visual comfort.')}
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
                  <h3>{L('Sons & Ambiência Espacial', 'Sound & Space Ambience')}</h3>
                  <p>
                    {L('Controle os volumes de navegação, propulsão da nave e som ambiente de Marte.', 'Control the volume of menus, rocket engines and Mars ambience.')}
                  </p>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>{L('Silenciar Todos os Sons', 'Mute All Sounds')}</span>
                    <small>{L('Desativa qualquer saída de áudio do simulador.', 'Turns off all game audio.')}</small>
                  </div>
                  <button
                    type="button"
                    className={`mute-btn ${audio.muted ? 'is-muted' : ''}`}
                    onClick={() => onAudioChange({ ...audio, muted: !audio.muted })}
                  >
                    {audio.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    <span>{audio.muted ? L('Mutado', 'Muted') : L('Áudio Ativo', 'Audio On')}</span>
                  </button>
                </div>

                <div className="settings-slider-item">
                  <div className="slider-header">
                    <span>{L('Volume Geral (Master)', 'Master Volume')}</span>
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
                    <span>{L('Efeitos Sonoros (SFX & Propulsão)', 'Sound Effects (SFX & Engines)')}</span>
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
                    <span>{L('Música Ambiente', 'Ambient Music')}</span>
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
                <label className="settings-row" style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0' }}>
                  <input type="checkbox" checked={easy} onChange={(e) => setEasy(e.target.checked)} />
                  <span>
                    <strong>{L('Modo fácil dos minigames', 'Easy mode for minigames')}</strong>
                    <br />
                    <small>{L('Mais tempo e margens maiores. Bom para os menores.', 'More time and bigger margins. Great for little ones.')}</small>
                  </span>
                </label>
                <div className="settings-section-head">
                  <h3>{L('Jogabilidade & Interface', 'Gameplay & Interface')}</h3>
                  <p>{L('Preferências de assistência, acessibilidade e visualização.', 'Assistance, accessibility and display preferences.')}</p>
                </div>

                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>{L('Exibir Dicas de Controle na Tela', 'Show Control Hints on Screen')}</span>
                    <small>
                      {L('Mostra a barra inferior com comandos de caminhada, rotação e limpeza.', 'Shows the bottom bar with walking, rotation and cleaning controls.')}
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
                    <span>{L('Modo Alto Contraste', 'High Contrast Mode')}</span>
                    <small>{L('Aumenta a separação de bordas e textos para maior clareza visual.', 'Increases edge and text contrast for clearer visuals.')}</small>
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
                    <span>Idioma / Language</span>
                    <small>
                      {L(
                        'Textos do jogo e do B.I.T. (em inglês, o B.I.T. fala com voz). Trocar recarrega a página e você volta para a mesma sala.',
                        'Game and B.I.T. text (in English, B.I.T. speaks out loud). Switching reloads the page and you return to the same room.',
                      )}
                    </small>
                  </div>
                  <div className="settings-lang" role="radiogroup" aria-label="Idioma / Language">
                    {(
                      [
                        ['en', 'English'],
                        ['pt', 'Português (Brasil)'],
                      ] as const
                    ).map(([code, label]) => (
                      <button
                        key={code}
                        type="button"
                        role="radio"
                        aria-checked={getLang() === code}
                        className={`settings-badge ${getLang() === code ? 'is-active' : ''}`}
                        onClick={() => setLang(code)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-PAINEL: ACESSIBILIDADE */}
            {tab === 'access' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>{L('Acessibilidade', 'Accessibility')}</h3>
                  <p>{L('Ajustes para jogar com mais conforto. Ficam guardados neste aparelho.', 'Settings for more comfortable play. They are saved on this device.')}</p>
                </div>
                <label style={{ display: 'grid', gap: 4, margin: '8px 0' }}>
                  <strong>{L('Cores para daltonismo', 'Colors for color blindness')}</strong>
                  <select value={a11y.colorMode} onChange={(e) => a11y.update({ colorMode: e.target.value as ColorMode })}>
                    <option value="none">{L('Desligado', 'Off')}</option>
                    <option value="protan">{L('Protanopia (sem vermelho)', 'Protanopia (no red)')}</option>
                    <option value="deutan">{L('Deuteranopia (sem verde)', 'Deuteranopia (no green)')}</option>
                    <option value="tritan">{L('Tritanopia (sem azul)', 'Tritanopia (no blue)')}</option>
                  </select>
                  <small>{L('Muda as cores do jogo todo para separar melhor vermelho, verde e azul.', 'Shifts the colors of the whole game to tell red, green and blue apart.')}</small>
                </label>
                {(
                  [
                    ['contrast', 'Alto contraste', 'High contrast', 'Cores mais fortes e foco do teclado bem visível.', 'Stronger colors and a very visible keyboard focus.'],
                    ['calm', 'Sem tremor e piscadas', 'No shaking or flashing', 'Desliga tremor de tela, neve, aurora e luzes piscando.', 'Turns off screen shake, snow, aurora and flashing lights.'],
                    ['bigTargets', 'Botões grandes', 'Big buttons', 'Aumenta os botões para tocar com mais facilidade.', 'Makes buttons bigger so they are easier to tap.'],
                    ['readable', 'Texto mais fácil de ler', 'Easier-to-read text', 'Letras mais fortes e mais espaçadas.', 'Bolder, more widely spaced letters.'],
                  ] as const
                ).map(([key, pt, en, dpt, den]) => (
                  <label key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0' }}>
                    <input type="checkbox" checked={a11y[key]} onChange={(e) => a11y.update({ [key]: e.target.checked })} />
                    <span>
                      <strong>{L(pt, en)}</strong>
                      <br />
                      <small>{L(dpt, den)}</small>
                    </span>
                  </label>
                ))}
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0' }}>
                  <input type="checkbox" checked={video.reducedMotion} onChange={(e) => onVideoChange({ ...video, reducedMotion: e.target.checked })} />
                  <span>
                    <strong>{L('Menos movimento', 'Reduced motion')}</strong>
                    <br />
                    <small>{L('Câmera e animações mais suaves.', 'Gentler camera and animations.')}</small>
                  </span>
                </label>
              </div>
            )}

            {/* SUB-PAINEL: SOBRE */}
            {tab === 'about' && (
              <div className="settings-section">
                <div className="settings-section-head">
                  <h3>{L('Nossa Missão', 'Our Mission')}</h3>
                  <p>Mars Outpost · NASA Space Apps Challenge Fortaleza</p>
                </div>

                <div className="settings-about-body">
                  <p>
                    O <strong>Mars Outpost</strong> {L('é um simulador interativo e educativo que explora o desafio de construir e manter bases científicas sustentáveis em Marte.', 'is an interactive educational simulator about the challenge of building and running sustainable science bases on Mars.')}
                  </p>
                  <p>
                    {L('Com modelos modulares em 3D, simulação de recursos vitais (oxigênio, água, energia solar) e dados de missões reais da NASA, o projeto convida os exploradores a vivenciar a ciência por trás da colonização espacial.', 'With modular 3D models, a simulation of vital resources (oxygen, water, solar power) and data from real NASA missions, it invites explorers to experience the science behind living in space.')}
                  </p>
                  <div className="settings-about-note">
                    {L('Projeto independente desenvolvido para o NASA Space Apps Challenge Fortaleza. Não há vínculo, endosso ou patrocínio oficial da NASA.', 'Independent project built for the NASA Space Apps Challenge Fortaleza. Not affiliated with, endorsed or sponsored by NASA.')}
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
            {L('Concluir', 'Done')}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
