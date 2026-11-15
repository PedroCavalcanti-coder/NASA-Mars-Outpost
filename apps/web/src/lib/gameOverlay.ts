/**
 * Há uma tela por cima da base (minigame) bloqueando o jogo?
 *
 * O `Game` marca a interface da base com `inert` enquanto um minigame está aberto; os atalhos
 * globais (andar, pausar/velocidade, painéis da HUD) consultam isto para não reagir às teclas
 * que o minigame usa (setas, Espaço etc.).
 */
export function isGameOverlayOpen(): boolean {
  return (
    typeof document !== 'undefined' && document.querySelector('.game__interface[inert]') !== null
  );
}

let cachedAt = 0;
let cachedValue = false;

/** Igual a `isGameOverlayOpen`, mas consulta o DOM no máximo a cada 150 ms (para o laço da simulação). */
export function isGameOverlayOpenCached(): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - cachedAt > 150) {
    cachedAt = now;
    cachedValue = isGameOverlayOpen();
  }
  return cachedValue;
}
