import { NAME_MAX, NAME_MIN } from '@mars/shared';
import {
  DEFAULT_SUIT,
  SUIT_COLOR_IDS,
  SUIT_COLORS,
  SUIT_PART_NAMES,
  SUIT_PARTS,
  SUIT_PRESETS,
  type SuitConfig,
  type SuitPart,
  randomSuit,
} from '@mars/shared';
import { Dices, Rocket, Sparkles, User, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { getGuestName, saveGuestName } from '../../../lib/guest';
import { readSuitPreference, saveSuitPreference } from '../../../lib/suitPreference';
import { useAuth } from '../../../store/auth';
import { SuitPreview } from './SuitPreview';
import './suitModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onLaunch: (astronautName: string, suit: SuitConfig) => void;
}

export function SuitModal({ open, onClose, onLaunch }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const user = useAuth((s) => s.user);

  const [name, setName] = useState('');
  const [suit, setSuit] = useState<SuitConfig>(() => readSuitPreference());
  const [selectedPart, setSelectedPart] = useState<SuitPart>('helmet');

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setName(user?.name ?? getGuestName() ?? '');
      setSuit(readSuitPreference());
      d.showModal();
    }
    if (!open && d.open) {
      d.close();
    }
  }, [open, user]);

  const handleRandomize = () => {
    setSuit(randomSuit());
  };

  const handleSelectPreset = (presetSuit: SuitConfig) => {
    setSuit({ ...presetSuit });
  };

  const handleColorChange = (colorId: typeof SUIT_COLOR_IDS[number]) => {
    setSuit((prev) => ({
      ...prev,
      [selectedPart]: colorId,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    if (finalName.length < NAME_MIN) return;

    saveGuestName(finalName);
    saveSuitPreference(suit);
    onClose();
    onLaunch(finalName, suit);
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click handles close
    <dialog
      ref={dialogRef}
      className="suit-modal-dialog"
      aria-labelledby="suit-modal-title"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      <div className="suit-modal-content">
        <header className="suit-modal-header">
          <div className="suit-modal-kicker">
            <Sparkles size={14} className="kicker-icon" />
            <span>MARS OUTPOST · IDENTIFICAÇÃO E TRAJE</span>
          </div>
          <button
            type="button"
            className="suit-modal-close"
            onClick={onClose}
            aria-label="Fechar janela"
          >
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="suit-modal-form">
          <div className="suit-modal-split">
            {/* Lado Esquerdo: 3D Preview e Presets */}
            <div className="suit-modal-preview-col">
              <h2 id="suit-modal-title">Seu Astronauta em Marte</h2>
              <p className="suit-modal-sub">
                Gire o modelo em 3D e personalize as cores do traje para a expedição.
              </p>

              <SuitPreview
                suit={suit}
                highlightPart={selectedPart}
                className="suit-modal-preview-canvas"
              />

              {/* Presets Rápidos */}
              <div className="suit-presets-wrap">
                <span className="suit-field-label">Estilos da Frota</span>
                <div className="suit-presets-grid">
                  {SUIT_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.name}
                      className="suit-preset-chip"
                      onClick={() => handleSelectPreset(p.suit)}
                    >
                      <span className="suit-preset-swatches">
                        <i style={{ background: SUIT_COLORS[p.suit.helmet].hex }} />
                        <i style={{ background: SUIT_COLORS[p.suit.vest].hex }} />
                        <i style={{ background: SUIT_COLORS[p.suit.boots].hex }} />
                      </span>
                      <span>{p.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="suit-preset-chip suit-preset-chip--rnd"
                    onClick={handleRandomize}
                    title="Sortear combinação de cores"
                  >
                    <Dices size={15} />
                    <span>Aleatório</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Lado Direito: Nome, Partes e Seletor de Cores */}
            <div className="suit-modal-controls-col">
              {/* Campo de Apelido do Jogador */}
              <div className="suit-name-field">
                <label htmlFor="astronaut-nickname" className="suit-field-label">
                  Apelido do Jogador
                </label>
                <div className="suit-input-wrap">
                  <User size={18} className="suit-input-icon" aria-hidden="true" />
                  <input
                    id="astronaut-nickname"
                    type="text"
                    className="suit-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    minLength={NAME_MIN}
                    maxLength={NAME_MAX}
                    placeholder="Seu nome de astronauta"
                    autoComplete="nickname"
                    required
                    autoFocus
                  />
                </div>
                <small className="suit-input-hint">
                  Aparecerá nos relatórios de missão da base marciana.
                </small>
              </div>

              {/* Seletor de Peça do Traje */}
              <div className="suit-parts-field">
                <span className="suit-field-label">1. Escolha a Peça</span>
                <div className="suit-parts-selector">
                  {SUIT_PARTS.map((partKey) => {
                    const isSelected = selectedPart === partKey;
                    const currentColor = SUIT_COLORS[suit[partKey]];
                    return (
                      <button
                        type="button"
                        key={partKey}
                        className={`suit-part-btn ${isSelected ? 'is-active' : ''}`}
                        onClick={() => setSelectedPart(partKey)}
                      >
                        <span
                          className="suit-part-indicator"
                          style={{ background: currentColor.hex }}
                        />
                        <span>{SUIT_PART_NAMES[partKey]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paleta de Cores para a Peça Selecionada */}
              <div className="suit-palette-field">
                <div className="suit-palette-header">
                  <span className="suit-field-label">2. Cor de {SUIT_PART_NAMES[selectedPart]}</span>
                  <span className="suit-active-color-name">
                    {SUIT_COLORS[suit[selectedPart]].name}
                  </span>
                </div>

                <div className="suit-palette-grid">
                  {SUIT_COLOR_IDS.map((cId) => {
                    const c = SUIT_COLORS[cId];
                    const isCurrent = suit[selectedPart] === cId;
                    return (
                      <button
                        type="button"
                        key={cId}
                        className={`suit-color-swatch ${isCurrent ? 'is-active' : ''}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => handleColorChange(cId)}
                        title={c.name}
                        aria-label={c.name}
                      >
                        {isCurrent && <span className="swatch-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botão de Jogar e Iniciar Missão */}
              <div className="suit-modal-actions">
                <button
                  type="submit"
                  className="suit-launch-btn"
                  disabled={name.trim().length < NAME_MIN}
                >
                  <span className="suit-btn-icon">
                    <Rocket size={24} />
                  </span>
                  <span className="suit-btn-text">
                    <strong>Jogar Agora</strong>
                    <small>Aterrissar na base marciana</small>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
}
