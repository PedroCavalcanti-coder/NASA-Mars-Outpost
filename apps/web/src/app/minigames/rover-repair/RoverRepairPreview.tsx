import { Check, X } from 'lucide-react';
import { usePreviewClose } from '../usePreviewClose';
import { RoverRepairIllustration } from './RoverRepairIllustration';
import './roverRepair.css';

/** Can be mounted by a future rover interaction through onClose. */
export default function RoverRepairPreview({ onClose }: { onClose?: () => void }) {
  const { close, closeButton } = usePreviewClose(onClose);
  return (
    <main className="rover-repair-preview" aria-label="Reparo do rover">
      <RoverRepairIllustration />
      <button
        className="rover-repair-finish"
        type="button"
        disabled
        aria-label="Concluir reparo (indisponível na prévia visual)"
        title="Conclusão disponível quando o reparo for implementado"
      >
        <Check size={26} aria-hidden="true" />
      </button>
      <button
        ref={closeButton}
        className="rover-repair-close"
        type="button"
        onClick={close}
        aria-label="Fechar prévia"
        title="Fechar prévia (Esc)"
      >
        <X size={22} aria-hidden="true" />
      </button>
    </main>
  );
}
