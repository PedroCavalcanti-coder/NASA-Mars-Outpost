/**
 * Idioma do jogo. Padrão: inglês (o hackathon é internacional); português do Brasil nas
 * Configurações. A escolha fica no navegador; trocar recarrega a página (o jogo volta para a
 * mesma sala), então os textos não precisam se inscrever em mudanças.
 *
 * Duas formas de traduzir:
 *  - `L('Texto em português', 'English text')`: par direto, no próprio componente;
 *  - `t('Texto em português')`: busca no dicionário EN (textos que vêm de dados ou do servidor).
 */
import { EN } from './i18n.en';

export type Lang = 'en' | 'pt';
const KEY = 'mo_lang';

/** Idioma do aparelho: português ou espanhol começam em PT-BR; o resto, em inglês. */
export function deviceLang(languages: readonly string[] | undefined): Lang {
  const first = (languages ?? [])[0]?.toLowerCase() ?? '';
  return first.startsWith('pt') || first.startsWith('es') ? 'pt' : 'en';
}

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    // quem já escolheu nas Configurações manda; senão vale o idioma do aparelho
    if (saved === 'pt' || saved === 'en') return saved;
  } catch {
    /* sem armazenamento: usa o idioma do aparelho */
  }
  if (typeof navigator === 'undefined') return 'en';
  return deviceLang(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

let current: Lang = typeof window === 'undefined' ? 'en' : readLang();
if (typeof document !== 'undefined') document.documentElement.lang = current === 'pt' ? 'pt-BR' : 'en';

export const getLang = (): Lang => current;
export const isEnglish = () => current === 'en';

/** Troca o idioma e recarrega a página (o jogo retoma a mesma sala). */
export function setLang(lang: Lang) {
  if (lang === current) return;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* navegação privada: vale só nesta página */
  }
  current = lang;
  if (typeof window !== 'undefined') window.location.reload();
}

/** Par direto: devolve o texto do idioma atual. */
export const L = (pt: string, en: string): string => (current === 'pt' ? pt : en);

/** Traduções com números no meio ("Painel solar limpo (1/2)"). */
const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^Painel solar limpo \((\d+)\/(\d+)\)$/, (m) => `Solar panel cleaned (${m[1]}/${m[2]})`],
  [/^Missão do dia: (.+)$/, (m) => `Mission of the day: ${t(m[1]!)}`],
  [/^(.+) \(dev\)$/, (m) => `${t(m[1]!)} (dev)`],
  [/^☢️ Dose da tripulação passou de (\d+) mSv$/, (m) => `☢️ Crew dose passed ${m[1]} mSv`],
  [/^🌄 O rover só sai entre (\d+)h e (\d+)h: precisa voltar antes de anoitecer\.$/, (m) => `🌄 The rover only goes out between ${m[1]}:00 and ${m[2]}:00: it must be back before nightfall.`],
  [/^🌄 O reconhecimento só vale entre (\d+)h e (\d+)h\.$/, (m) => `🌄 The scouting run only counts between ${m[1]}:00 and ${m[2]}:00.`],
  [/^Fique dentro da base por cerca de (\d+) horas de Marte\. Quando o aviso ficar verde, é seguro sair\.$/, (m) => `Stay inside the base for about ${m[1]} Mars hours. When the warning turns green, it is safe to go out.`],
  [/^As 3 pedras estão a bordo! Previsão do radar para amanhã: (.+)\.$/, (m) => `All 3 rocks are on board! Radar forecast for tomorrow: ${t(m[1]!)}.`],
  [/^Convite enviado a (.+): (.+)\.$/, (m) => `Invite sent to ${m[1]}: ${t(m[2]!)}.`],
  [/^📡 Ainda não há dados para enviar: (\d+)\/(\d+) pontos de pesquisa novos\.$/, (m) => `📡 No data to send yet: ${m[1]}/${m[2]} new research points.`],
  [/^(.+): nenhuma missão sua aqui hoje\.$/, (m) => `${t(m[1]!)}: none of your missions here today.`],
  [/^🧪 (\d+) amostras de solo! Volte à base, saia do rover e leve-as a um computador \((.+)\)\.$/, (m) => `🧪 ${m[1]} soil samples! Go back to the base, leave the rover and take them to a computer (${t(m[2]!)}).`],
  [/^Código exclusivo (.+) copiado! Compartilhe com seu amigo \(máx 4 jogadores\)\.$/, (m) => `Room code ${m[1]} copied! Share it with your friend (max 4 players).`],
  [/^Não foi possível copiar\. Selecione o código manualmente: (.+)$/, (m) => `Could not copy. Select the code manually: ${m[1]}`],
  [/^Tarefa não registrada: (.+)$/, (m) => `Task not recorded: ${t(m[1]!)}`],
  [/^Dev: (.+)$/, (m) => `Dev: ${t(m[1]!)}`],
  [/^(\d+) m a (.+)$/, (m) => `${m[1]} m ${m[2]}`],
  [/^☀️ Sol (\d+)\. Missões: (.+)\. Siga os marcadores amarelos com “!” na base ou abra a aba Tarefas \(T\) e use “Ir”\.$/, (m) => `☀️ Sol ${m[1]}. Missions: ${m[2]!.split(' · ').map((x) => x.replace(/^(.+?) \((.+)\)$/, (_a, b, c) => `${t(b)} (${c})`)).join(' · ')}. Follow the yellow “!” markers on the base or open the Tasks tab (T) and use “Go”.`],
  [/^☀️ Sol (\d+): confira as tarefas do dia \(tecla T\)\.$/, (m) => `☀️ Sol ${m[1]}: check today's tasks (press T).`],
];

const missing = new Set<string>();

/** "texto" -> “texto” (o dicionário usa aspas curvas; parte dos dados usa retas). */
function curly(text: string) {
  let open = true;
  return text.replace(/"/g, () => {
    const mark = open ? '“' : '”';
    open = !open;
    return mark;
  });
}

/** Busca no dicionário; sem tradução, mostra o português (e avisa uma vez no console em dev). */
export function t(pt: string | undefined | null): string {
  if (!pt) return '';
  if (current === 'pt') return pt;
  const hit = EN[pt] ?? EN[curly(pt)];
  if (hit) return hit;
  for (const [re, fn] of PATTERNS) {
    const m = pt.match(re);
    if (m) return fn(m);
  }
  if (import.meta.env?.DEV && !missing.has(pt)) {
    missing.add(pt);
    console.debug('[i18n] sem tradução:', pt);
  }
  return pt;
}

/** Locale para datas e números. */
export const locale = () => (current === 'pt' ? 'pt-BR' : 'en-US');
