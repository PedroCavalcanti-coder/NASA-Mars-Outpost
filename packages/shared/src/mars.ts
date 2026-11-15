/**
 * Tempo marciano. Um Sol (dia solar de Marte) dura 24 h 39 min 35,2 s, ~2,7% a mais que o dia
 * da Terra. No jogo um Sol dura `GAME_SOL_SECONDS` segundos reais; o relógio da HUD mostra as
 * horas e os minutos do Sol (de 00:00 até 24:39), e não "24 horas certinhas".
 */
export const MARS_SOL_MINUTES = 24 * 60 + 39.5867;

/** Duração do Sol marciano em texto, para a HUD ("24h 39min"). */
export const MARS_SOL_LABEL = '24h 39min';

/**
 * Hora do dia do jogo (0..24, fração do Sol × 24) -> relógio do Sol marciano "HH:MM"
 * (00:00 até 24:39).
 */
export function formatSolClock(hour: number): string {
  const fraction = (((hour % 24) + 24) % 24) / 24;
  const total = Math.floor(fraction * MARS_SOL_MINUTES);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
