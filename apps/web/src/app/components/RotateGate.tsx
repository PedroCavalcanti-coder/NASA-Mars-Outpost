import { Maximize, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsTouch } from './hud/TouchControls';
import './rotateGate.css';

/** Lado menor (em px CSS) abaixo do qual o aparelho conta como celular; tablets ficam livres. */
const PHONE_MAX_SHORT_SIDE = 600;

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

function isPhonePortrait(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return h > w && Math.min(w, h) < PHONE_MAX_SHORT_SIDE;
}

/** Tela cheia + trava na horizontal (Android/Chrome). No iPhone não existe; aí só resta girar. */
const canAutoRotate =
  typeof document !== 'undefined' &&
  typeof document.documentElement.requestFullscreen === 'function' &&
  typeof (screen.orientation as LockableOrientation | undefined)?.lock === 'function';

async function enterLandscape(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    await (screen.orientation as LockableOrientation).lock?.('landscape');
  } catch {
    // o navegador recusou: o aviso continua até a pessoa girar o aparelho
  }
}

/**
 * O site inteiro é na horizontal no celular: em pé, um aviso cobre a tela até o aparelho ser
 * girado. Computadores e tablets não são afetados.
 */
export function RotateGate() {
  const touch = useIsTouch();
  const [portrait, setPortrait] = useState(isPhonePortrait);

  useEffect(() => {
    const update = () => setPortrait(isPhonePortrait());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => {
    if (!touch) return;
    // onde o navegador deixa sem gesto (app instalado / já em tela cheia), trava na horizontal
    void (screen.orientation as LockableOrientation | undefined)
      ?.lock?.('landscape')
      ?.catch(() => {});
  }, [touch]);

  const blocked = touch && portrait;

  // com o aviso na tela, o site por trás não recebe foco, toque nem leitor de tela, e não rola
  useEffect(() => {
    if (!blocked) return;
    const root = document.getElementById('root');
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    if (root) root.inert = true;
    html.style.overflow = 'hidden';
    // <dialog> abertos (personalizar astronauta, configurações) ficam na camada de cima: escondidos
    html.setAttribute('data-portrait-blocked', '');
    return () => {
      html.removeAttribute('data-portrait-blocked');
      if (root) root.inert = false;
      html.style.overflow = prevOverflow;
    };
  }, [blocked]);

  if (!blocked) return null;
  // fora do #root, que fica inert
  return createPortal(
    <div className="rotate-gate" role="alertdialog" aria-modal="true" aria-label="Gire o aparelho">
      <RotateCw size={54} aria-hidden="true" />
      <h2>Gire o celular</h2>
      <p>O Mars Outpost é na horizontal. Deite o aparelho para ver tudo direitinho.</p>
      {canAutoRotate && (
        <button type="button" className="rotate-gate__button" onClick={() => void enterLandscape()}>
          <Maximize size={18} aria-hidden="true" />
          Tela cheia na horizontal
        </button>
      )}
    </div>,
    document.body,
  );
}
