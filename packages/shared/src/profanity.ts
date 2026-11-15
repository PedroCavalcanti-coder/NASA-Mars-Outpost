/**
 * Filtro de palavrões e ofensas (português e inglês) para o chat e os apelidos. Um jogo para
 * crianças de 7 a 12 anos não deixa passar: o servidor confere TUDO, o cliente só avisa antes.
 *
 * Cuidado com falsos positivos ("computador" tem "puta", "cuidado" começa com "cu"): palavras
 * curtas só valem como palavra inteira; as longas e inconfundíveis valem em qualquer lugar.
 */

/** palavra inteira (ou com plural/diminutivo: começa com o radical) */
const WORDS = [
  'cu', 'pau', 'rola', 'pica', 'puta', 'puto', 'putinha', 'porra', 'merda', 'bosta', 'foda', 'fodase', 'foder',
  'fdp', 'pqp', 'vsf', 'tnc', 'crl', 'bct', 'kct', 'viado', 'veado', 'otario', 'idiota', 'imbecil', 'burro',
  'retardado', 'mongol', 'lixo', 'vagabundo', 'vagabunda', 'piranha', 'safado', 'safada', 'babaca', 'cuzao',
  'nazi', 'nazista', 'sex', 'sexo', 'nude', 'nudes', 'porno',
  'fuck', 'fucking', 'shit', 'bitch', 'ass', 'asshole', 'bastard', 'dick', 'cock', 'pussy', 'cunt', 'whore',
  'slut', 'fag', 'faggot', 'retard', 'rape', 'nigga', 'nigger', 'idiot', 'stupid', 'moron', 'dumb',
];
/** inconfundíveis: valem mesmo no meio de uma frase sem espaços ("vaisefuder") */
const ANYWHERE = [
  'caralho', 'buceta', 'boceta', 'arrombad', 'filhodaputa', 'filhadaputa', 'vaitomarnocu', 'vtnc', 'desgraca',
  'fuckyou', 'motherfuck', 'bullshit', 'asshole', 'nigger', 'faggot', 'pornografia',
];

const SUFFIXES = ['s', 'es', 'inha', 'inho', 'ona', 'ao'];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[01345 7@$!]/g, (c) => LEET[c] ?? ' ')
    // "fooooda" -> "fooda": letras repetidas 3+ vezes viram 2
    .replace(/([a-z])\1{2,}/g, '$1$1');
}

export function hasProfanity(text: string): boolean {
  const n = normalize(text);
  const tokens = n.split(/[^a-z]+/).filter(Boolean);
  // "fooda"/"puuta": também testa a versão com letras repetidas reduzidas a uma
  const squeezed = tokens.map((t) => t.replace(/([a-z])\1+/g, '$1'));
  for (const list of [tokens, squeezed]) {
    for (const token of list) {
      for (const w of WORDS) {
        if (token === w) return true;
        // plural e diminutivo: "putas", "putinha", "shits"
        if (w.length >= 4 && SUFFIXES.some((x) => token === w + x)) return true;
      }
    }
  }
  const compact = n.replace(/[^a-z]/g, '');
  const compactSqueezed = compact.replace(/([a-z])\1+/g, '$1');
  return ANYWHERE.some((w) => compact.includes(w) || compactSqueezed.includes(w.replace(/([a-z])\1+/g, '$1')));
}

/** Troca cada palavra ofensiva por asteriscos (mantém o resto da frase). */
export function maskProfanity(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => (/\s/.test(part) || !hasProfanity(part) ? part : '*'.repeat(Math.max(3, part.length))))
    .join('');
}

export const PROFANITY_MESSAGE = 'Mensagem não permitida. Vamos manter a conversa educada! 😊';
export const PROFANITY_NICK_MESSAGE = 'Esse apelido não é permitido. Escolha um apelido educado.';
