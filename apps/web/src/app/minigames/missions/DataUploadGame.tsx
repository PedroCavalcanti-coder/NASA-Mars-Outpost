import { FileText, Folder, FolderOpen, Radio, Satellite, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import './missions.css';

/** Tempo (s) que cada arquivo de pesquisa leva para atravessar o espaço até a Terra. */
const SEND_SECONDS = 5;
/** Quem escolhe um arquivo que não é de pesquisa perde este tempo (s) com o enlace travado. */
const WRONG_LOCK_SECONDS = 2.5;

interface FileDef {
  name: string;
  size: string;
  research: boolean;
}

interface FolderDef {
  name: string;
  hint: string;
  files: FileDef[];
}

/**
 * Pastas do computador da base. Os dados da pesquisa estão em /pesquisa; o resto (sistema,
 * temporários e cópias) não deve ser enviado: gasta o enlace e atrasa tudo.
 * Os nomes seguem instrumentos e formatos reais: ChemCam e SAM (Curiosity), MOXIE (Perseverance),
 * RAD (radiação) e o padrão PDS4 de dados planetários da NASA.
 */
const FOLDERS: FolderDef[] = [
  {
    name: '/pesquisa/amostras',
    hint: 'Dados científicos das amostras',
    files: [
      { name: 'chemcam_espectros_sol014.dat', size: '2,4 MB', research: true },
      { name: 'sam_gases_rocha_cumberland.csv', size: '860 KB', research: true },
      { name: 'solo_granulometria_pds4.xml', size: '120 KB', research: true },
      { name: 'rascunho_anotacoes.tmp', size: '4 KB', research: false },
    ],
  },
  {
    name: '/pesquisa/atmosfera',
    hint: 'Dados científicos do ar e da radiação',
    files: [
      { name: 'moxie_producao_o2.h5', size: '1,1 MB', research: true },
      { name: 'rad_radiacao_solar.fits', size: '3,0 MB', research: true },
      { name: 'meteo_poeira_pressao.csv', size: '540 KB', research: true },
      { name: 'cache_grafico.bak', size: '12 MB', research: false },
    ],
  },
  {
    name: '/sistema',
    hint: 'Arquivos do computador (não são pesquisa)',
    files: [
      { name: 'boot_log.txt', size: '88 KB', research: false },
      { name: 'driver_antena.sys', size: '4,2 MB', research: false },
      { name: 'atualizacao_pendente.pkg', size: '31 MB', research: false },
    ],
  },
  {
    name: '/temporarios',
    hint: 'Cópias e sobras',
    files: [
      { name: 'copia_de_copia_final.zip', size: '22 MB', research: false },
      { name: 'foto_refeitorio.jpg', size: '3,3 MB', research: false },
      { name: 'teste_sinal_antigo.dat', size: '640 KB', research: false },
    ],
  },
];

const TOTAL = FOLDERS.flatMap((f) => f.files).filter((f) => f.research).length;

/**
 * Enlace com a Terra (inspirado na Deep Space Network da NASA): o jogador procura nas pastas os
 * arquivos da pesquisa e manda um a um para o computador na Terra. Cada arquivo demora a
 * atravessar o espaço. É essencial: os dados enviados ficam protegidos. Interromper no meio
 * corrompe o envio e obriga a recomeçar do início.
 */
export default function DataUploadGame({
  onClose,
  onComplete,
}: {
  /** chamado ao fechar (se o envio não terminou, o jogo marca como corrompido) */
  onClose?: () => void;
  onComplete?: () => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const [open, setOpen] = useState<number | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [sending, setSending] = useState<{ name: string; t: number } | null>(null);
  const [lock, setLock] = useState(0);
  const [error, setError] = useState('');
  const reported = useRef(false);
  const done = sent.length >= TOTAL;

  // arquivos aparecem sempre na mesma ordem dentro da pasta; só os de pesquisa contam
  const folder = open === null ? null : FOLDERS[open];

  // a transmissão avança com o relógio (sem pular: um arquivo por vez)
  useEffect(() => {
    if (!sending) return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - started) / 1000 / SEND_SECONDS;
      if (t >= 1) {
        window.clearInterval(id);
        setSent((list) => [...list, sending.name]);
        setSending(null);
      } else setSending({ name: sending.name, t });
    }, 80);
    return () => window.clearInterval(id);
    // biome-ignore lint/correctness/useExhaustiveDependencies: só reinicia ao trocar de arquivo
  }, [sending?.name]);

  // enlace travado depois de um arquivo errado
  useEffect(() => {
    if (lock <= 0) return;
    const id = window.setTimeout(() => setLock((l) => Math.max(0, l - 0.5)), 500);
    return () => window.clearTimeout(id);
  }, [lock]);

  // trocar de aba ou esconder a página no meio do envio também interrompe a transmissão
  useEffect(() => {
    if (done) return;
    const hidden = () => {
      if (document.hidden) close();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [done, close]);

  const pick = (f: FileDef) => {
    if (sending || lock > 0 || done || sent.includes(f.name)) return;
    if (!f.research) {
      setError(`"${f.name}" não é dado de pesquisa. O enlace travou por um instante.`);
      setLock(WRONG_LOCK_SECONDS);
      return;
    }
    setError('');
    setSending({ name: f.name, t: 0 });
  };

  const packets = useMemo(() => [0, 1, 2, 3, 4], []);

  return (
    <main className="msn-mg msn-mg--upload" aria-label="Enviar dados de pesquisa à Terra">
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card msn-up">
        <div className="msn-mg__head">
          <div>
            <h2>
              <Satellite size={18} aria-hidden="true" /> Enlace com a Terra
            </h2>
            <p>
              Abra as pastas, ache os <b>{TOTAL} arquivos de pesquisa</b> e toque em cada um para
              enviá-lo à Terra. Um por vez, e não feche no meio: o envio corrompe e recomeça do
              início.
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="msn-mg__close"
            onClick={close}
            aria-label="Interromper (o envio corrompe)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="msn-up__cols">
          <div className="msn-up__pane" aria-label="Computador da base em Marte">
            <h3>
              <Radio size={14} aria-hidden="true" /> Base · Marte
            </h3>
            <ul className="msn-up__folders">
              {FOLDERS.map((f, i) => (
                <li key={f.name}>
                  <button
                    type="button"
                    className={`msn-up__folder ${open === i ? 'is-open' : ''}`}
                    onClick={() => setOpen(open === i ? null : i)}
                  >
                    {open === i ? <FolderOpen size={16} /> : <Folder size={16} />}
                    <span>
                      <b>{f.name}</b>
                      <small>{f.hint}</small>
                    </span>
                  </button>
                  {open === i && (
                    <ul className="msn-up__files">
                      {f.files.map((file) => {
                        const gone = sent.includes(file.name);
                        return (
                          <li key={file.name}>
                            <button
                              type="button"
                              className="msn-up__file"
                              disabled={gone || !!sending || lock > 0}
                              onClick={() => pick(file)}
                            >
                              <FileText size={14} aria-hidden="true" />
                              <span>{file.name}</span>
                              <small>{gone ? 'enviado ✓' : file.size}</small>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="msn-up__link" aria-hidden="true">
            <div className="msn-up__packets">
              {packets.map((p) => (
                <i
                  key={p}
                  className={sending ? 'is-on' : ''}
                  style={{ animationDelay: `${p * 0.35}s` }}
                />
              ))}
            </div>
            <small>
              Atraso do sinal
              <br />
              (minutos-luz)
            </small>
          </div>

          <div className="msn-up__pane msn-up__pane--earth" aria-label="Computador na Terra">
            <h3>
              <Satellite size={14} aria-hidden="true" /> Terra · JPL
            </h3>
            <ul className="msn-up__received">
              {sent.map((n) => (
                <li key={n}>✓ {n}</li>
              ))}
              {sending && <li className="is-live">⇢ {sending.name}</li>}
              {!sent.length && !sending && <li className="is-empty">Nenhum arquivo recebido.</li>}
            </ul>
          </div>
        </div>

        <div className="msn-up__status" role="status" aria-live="polite">
          <div className="msn-up__bar" aria-hidden="true">
            <i
              style={{
                width: `${((sent.length + (sending ? sending.t : 0)) / TOTAL) * 100}%`,
              }}
            />
          </div>
          <span>
            {done
              ? 'Todos os arquivos chegaram à Terra!'
              : lock > 0
                ? '⚠ Enlace travado…'
                : sending
                  ? `Enviando ${sending.name}… ${Math.round(sending.t * 100)}%`
                  : `Arquivos enviados: ${sent.length}/${TOTAL}`}
          </span>
        </div>
        {error && !done && (
          <p className="msn-up__error" role="alert">
            {error}
          </p>
        )}

        {done && (
          <button
            type="button"
            className="msn-mg__btn"
            onClick={() => {
              if (reported.current) return;
              reported.current = true;
              onComplete?.();
              close();
            }}
          >
            Concluir envio
          </button>
        )}
      </section>
    </main>
  );
}
