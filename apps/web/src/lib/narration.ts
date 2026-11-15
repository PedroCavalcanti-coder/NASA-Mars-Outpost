import { useA11y } from './accessibility';
import { getLang } from './i18n';

/**
 * Narração por voz do próprio navegador (Web Speech API): sem custo, sem servidor e sem arquivos
 * de áudio. Lê o texto no idioma do jogo (pt-BR ou inglês) quando a pessoa liga a opção em
 * Configurações > Acessibilidade.
 */
export const narrationSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.slice(0, 2);
  return (
    voices.find((v) => v.lang === lang && v.localService) ??
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(base))
  );
}

/** Tira emojis e símbolos que a voz leria em voz alta ("foguete", "seta"...). */
const clean = (text: string) =>
  text
    .replace(/\p{Extended_Pictographic}|[️‍]/gu, ' ')
    .replace(/[•·→⬆▶◀★]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Lê o texto em voz alta. `interrupt` corta o que estiver sendo lido (use em falas novas). */
export function speak(text: string, interrupt = true) {
  if (!narrationSupported() || !useA11y.getState().narrate) return;
  const line = clean(text);
  if (!line) return;
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();
  else if (synth.pending) return; // não acumula avisos em fila
  const lang = getLang() === 'pt' ? 'pt-BR' : 'en-US';
  const u = new SpeechSynthesisUtterance(line);
  u.lang = lang;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  u.rate = useA11y.getState().narrateSlow ? 0.85 : 1;
  u.pitch = 1.05;
  synth.speak(u);
}

/** Botão "Ouvir": lê o texto agora, mesmo com a narração automática desligada. */
export function speakNow(text: string) {
  if (!narrationSupported()) return;
  const was = useA11y.getState().narrate;
  useA11y.setState({ narrate: true });
  speak(text, true);
  useA11y.setState({ narrate: was });
}

export function stopSpeaking() {
  if (narrationSupported()) window.speechSynthesis.cancel();
}
