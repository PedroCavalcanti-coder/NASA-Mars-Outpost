import {
  ACCESSORIES,
  ACCESSORY_IDS,
  type AccessoryId,
  cloneSuit,
  MARK_SLOT_NAMES,
  MARK_SLOTS,
  MARKS,
  MAX_ACCESSORIES,
  type MarkId,
  type MarkSlot,
  NAME_MAX,
  NAME_MIN,
  randomSuit,
  SUIT_COLOR_IDS,
  SUIT_COLORS,
  SUIT_PART_NAMES,
  SUIT_PARTS,
  SUIT_PRESETS,
  type SuitConfig,
  type SuitPart,
} from '@mars/shared';
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Dices,
  Rocket,
  User,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ASTRONAUT_MARKS_ATLAS } from '../../../game/astronautModel';
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
  const presetIndex = SUIT_PRESETS.findIndex((p) =>
    SUIT_PARTS.every((part) => p.suit[part] === suit[part]),
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setName(user?.name ?? getGuestName() ?? '');
      setSuit(readSuitPreference());
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, user]);

  const cycleColor = (part: SuitPart, direction: number) => {
    setSelectedPart(part);
    setSuit((prev) => {
      const index = SUIT_COLOR_IDS.indexOf(prev[part]);
      return {
        ...prev,
        [part]: SUIT_COLOR_IDS[(index + direction + SUIT_COLOR_IDS.length) % SUIT_COLOR_IDS.length],
      };
    });
  };
  const cyclePreset = (direction: number) => {
    const index = presetIndex < 0 ? (direction > 0 ? -1 : 0) : presetIndex;
    const preset = SUIT_PRESETS[(index + direction + SUIT_PRESETS.length) % SUIT_PRESETS.length];
    // o estilo muda só as cores: acessórios e marcas escolhidos continuam
    if (preset) {
      setSuit((prev) => ({
        ...cloneSuit(preset.suit),
        accessories: prev.accessories,
        marks: prev.marks,
      }));
    }
  };
  const toggleAccessory = (id: AccessoryId) =>
    setSuit((prev) => {
      const has = prev.accessories.includes(id);
      if (!has && prev.accessories.length >= MAX_ACCESSORIES) return prev;
      return {
        ...prev,
        accessories: has ? prev.accessories.filter((a) => a !== id) : [...prev.accessories, id],
      };
    });
  const setMark = (slot: MarkSlot, mark: MarkId | null) =>
    setSuit((prev) => {
      const marks = { ...prev.marks };
      if (mark === null) delete marks[slot];
      else marks[slot] = mark;
      return { ...prev, marks };
    });
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    if (finalName.length < NAME_MIN || finalName.length > NAME_MAX) return;
    saveGuestName(finalName);
    saveSuitPreference(suit);
    onClose();
    onLaunch(finalName, suit);
  };

  return (
    <dialog
      ref={dialogRef}
      className="suit-modal-dialog"
      aria-labelledby="suit-modal-title"
      onClose={onClose}
    >
      <div className="suit-modal-content">
        {open && <SuitPreview suit={suit} />}
        <header className="suit-screen-header">
          <button
            type="button"
            className="suit-back-btn"
            onClick={onClose}
            aria-label="Fechar janela"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
        </header>

        <form onSubmit={handleSubmit} className="suit-modal-form">
          <div className="suit-hud">
            <div className="suit-hud-heading">
              <h2 id="suit-modal-title">Astronauta</h2>
            </div>

            <div className="suit-name-field">
              <label htmlFor="astronaut-nickname" className="suit-field-label">
                Seu nome
              </label>
              <div className="suit-input-wrap">
                <User size={16} aria-hidden="true" />
                <input
                  id="astronaut-nickname"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={NAME_MIN}
                  maxLength={NAME_MAX}
                  placeholder="Nome do astronauta"
                  autoComplete="nickname"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="suit-preset-row">
              <button
                type="button"
                className="suit-arrow"
                onClick={() => cyclePreset(-1)}
                aria-label="Estilo anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <span className="suit-field-label">Estilo do traje</span>
                <strong>
                  {presetIndex < 0 ? 'Personalizado' : SUIT_PRESETS[presetIndex]?.name}
                </strong>
              </div>
              <button
                type="button"
                className="suit-arrow"
                onClick={() => cyclePreset(1)}
                aria-label="Próximo estilo"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="suit-parts-selector">
              {SUIT_PARTS.map((part) => (
                <div
                  key={part}
                  className={`suit-part-row ${selectedPart === part ? 'is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="suit-arrow"
                    onClick={() => cycleColor(part, -1)}
                    aria-label={`Cor anterior de ${SUIT_PART_NAMES[part]}`}
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <button
                    type="button"
                    className="suit-part-btn"
                    onClick={() => setSelectedPart(part)}
                    aria-pressed={selectedPart === part}
                  >
                    <span>{part === 'backpack' ? 'Mochila' : SUIT_PART_NAMES[part]}</span>
                    <span className="suit-part-color">
                      <i style={{ background: SUIT_COLORS[suit[part]].hex }} />
                      <span>{SUIT_COLORS[suit[part]].name}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="suit-arrow"
                    onClick={() => cycleColor(part, 1)}
                    aria-label={`Próxima cor de ${SUIT_PART_NAMES[part]}`}
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              ))}
            </div>

            <div className="suit-palette-field">
              <span className="suit-field-label">Cor de {SUIT_PART_NAMES[selectedPart]}</span>
              <div className="suit-palette-grid">
                {SUIT_COLOR_IDS.map((id) => (
                  <button
                    type="button"
                    key={id}
                    className={`suit-color-swatch ${suit[selectedPart] === id ? 'is-active' : ''}`}
                    style={{ backgroundColor: SUIT_COLORS[id].hex }}
                    onClick={() => setSuit((prev) => ({ ...prev, [selectedPart]: id }))}
                    title={SUIT_COLORS[id].name}
                    aria-label={SUIT_COLORS[id].name}
                    aria-pressed={suit[selectedPart] === id}
                  >
                    {suit[selectedPart] === id && <Check size={15} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="suit-extras-field">
              <span className="suit-field-label">
                Acessórios{' '}
                <small>
                  {suit.accessories.length}/{MAX_ACCESSORIES}
                </small>
              </span>
              <div className="suit-accessory-grid">
                {ACCESSORY_IDS.map((id) => {
                  const on = suit.accessories.includes(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      className={`suit-accessory-btn ${on ? 'is-active' : ''}`}
                      onClick={() => toggleAccessory(id)}
                      aria-pressed={on}
                      disabled={!on && suit.accessories.length >= MAX_ACCESSORIES}
                    >
                      <span className="suit-accessory-check" aria-hidden="true">
                        {on && <Check size={13} strokeWidth={3} />}
                      </span>
                      {ACCESSORIES[id].name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="suit-extras-field">
              <span className="suit-field-label">Marcas</span>
              {MARK_SLOTS.map((slot) => (
                <div key={slot} className="suit-mark-row">
                  <span className="suit-mark-slot">{MARK_SLOT_NAMES[slot]}</span>
                  <div className="suit-mark-options">
                    <button
                      type="button"
                      className={`suit-mark-btn ${suit.marks[slot] == null ? 'is-active' : ''}`}
                      onClick={() => setMark(slot, null)}
                      aria-pressed={suit.marks[slot] == null}
                      title="Sem marca"
                      aria-label={`Sem marca no ${MARK_SLOT_NAMES[slot]}`}
                    >
                      <Ban size={15} />
                    </button>
                    {MARKS.map((name, i) => (
                      <button
                        type="button"
                        key={name}
                        className={`suit-mark-btn ${suit.marks[slot] === i ? 'is-active' : ''}`}
                        onClick={() => setMark(slot, i as MarkId)}
                        aria-pressed={suit.marks[slot] === i}
                        title={name}
                        aria-label={`${name} no ${MARK_SLOT_NAMES[slot]}`}
                      >
                        <i
                          style={{
                            backgroundImage: `url(${ASTRONAUT_MARKS_ATLAS})`,
                            backgroundSize: '400% 200%',
                            backgroundPosition: `${((i % 4) * 100) / 3}% ${i < 4 ? 0 : 100}%`,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="suit-random-btn" onClick={() => setSuit(randomSuit())}>
              <Dices size={16} /> Sortear combinação
            </button>
            <div className="suit-modal-actions">
              <button type="button" className="suit-cancel-btn" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="suit-launch-btn"
                disabled={name.trim().length < NAME_MIN}
              >
                <Rocket size={18} /> Iniciar missão <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
}
