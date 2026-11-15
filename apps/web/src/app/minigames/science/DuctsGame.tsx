import { X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import '../missions/missions.css';
import { L } from '../../../lib/i18n';

const CLUMPS = 9;
/** cada bola de poeira precisa de 2 escovadas */
const HITS = 2;

/**
 * Dutos de ar entupidos (crítico do dia): toque nas bolas de poeira dentro dos 3 dutos até o ar
 * voltar a correr. Cada bola precisa de duas escovadas.
 */
export default function DuctsGame({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: (r: { quality: number }) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const clumps = useMemo(
    () =>
      Array.from({ length: CLUMPS }, (_, i) => ({
        id: i,
        duct: i % 3,
        x: 10 + ((i * 37) % 80),
        size: 36 + ((i * 13) % 18),
      })),
    [],
  );
  const [hits, setHits] = useState<number[]>(() => clumps.map(() => 0));
  const cleared = hits.filter((h) => h >= HITS).length;
  const done = cleared >= CLUMPS;
  const reported = useRef(false);

  return (
    <main className="msn-mg" aria-label={L('Limpar os dutos de ar', 'Clean the air ducts')}>
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>{L('🌬️ Crítico: dutos de ar entupidos!', '🌬️ Critical: air ducts clogged!')}</h2>
            <p>{L('Toque nas bolas de poeira dentro dos dutos (2 vezes cada) até o ar voltar a correr.', 'Tap the dust balls inside the ducts (2 times each) until the air flows again.')}</p>
          </div>
          <button ref={closeButton} type="button" className="msn-mg__close" onClick={close} aria-label={L('Fechar', 'Close')}>
            <X size={18} />
          </button>
        </div>
        <div className="sci-row">
          <span>{L('Dutos limpos:', 'Ducts cleared:')} {cleared}/{CLUMPS}</span>
          <span>{done ? L('💨 Ar correndo!', '💨 Air flowing!') : L('⚠️ Ar parado', '⚠️ Air stopped')}</span>
        </div>
        <div className="sci-meter" aria-hidden="true">
          <i style={{ width: `${(cleared / CLUMPS) * 100}%` }} />
        </div>

        {done ? (
          <div className="msn-mg__result">
            <strong>{L('Ventilação liberada! A tripulação respira melhor.', 'Ventilation clear! The crew breathes better.')}</strong>
            <button
              type="button"
              className="msn-mg__btn"
              onClick={() => {
                if (reported.current) return;
                reported.current = true;
                onComplete?.({ quality: 1 });
                close();
              }}
            >
              {L('Ligar a ventilação', 'Turn on the ventilation')}
            </button>
          </div>
        ) : (
          <div className="sci-stage" style={{ display: 'grid', gridTemplateRows: 'repeat(3,1fr)', gap: 10, padding: 10, background: '#2b3138' }}>
            {[0, 1, 2].map((duct) => (
              <div
                key={duct}
                style={{
                  position: 'relative',
                  borderRadius: 999,
                  background: 'linear-gradient(180deg,#8d969f,#5f6870 45%,#4a5259)',
                  boxShadow: 'inset 0 4px 10px #0007',
                }}
              >
                {clumps
                  .filter((c) => c.duct === duct && hits[c.id]! < HITS)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="sci-bubble is-bad"
                      style={{
                        left: `${c.x}%`,
                        top: '50%',
                        width: c.size,
                        height: c.size,
                        opacity: hits[c.id] ? 0.55 : 1,
                        background: '#a37548',
                      }}
                      aria-label={L('Bola de poeira', 'Dust ball')}
                      onClick={() => setHits((h) => h.map((v, i) => (i === c.id ? v + 1 : v)))}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}

        <p className="sci-fact">
          <b>{L('CIÊNCIA DE VERDADE', 'REAL SCIENCE')}</b>{L('A poeira de Marte é mais fina que talco e gruda em tudo por eletricidade estática. Na Estação Espacial, os astronautas aspiram os filtros de ar toda semana: sem isso, o ar para de circular e o gás carbônico se acumula perto do rosto.', 'Mars dust is finer than talcum powder and sticks to everything with static electricity. On the Space Station, astronauts vacuum the air filters every week: without that, the air stops moving and carbon dioxide builds up near your face.')}
        </p>
      </section>
    </main>
  );
}
