/** Código de sala de 6 caracteres sem letras ambíguas (0/O, 1/I): ~1 bilhão de combinações. */
export function newRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    crypto.getRandomValues(new Uint32Array(6)),
    (v) => alphabet[v % alphabet.length],
  ).join('');
}
