import { useMissionBoard } from '../../../game/missions/store';

/**
 * Véu de poeira sobre a cena enquanto o rover some na tempestade (coleta de solo): quanto mais
 * longe da base, mais opaco. Não bloqueia cliques nem a HUD.
 */
export function MissionVeil() {
  const veil = useMissionBoard((s) => s.veil);
  if (veil <= 0) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4,
        pointerEvents: 'none',
        opacity: veil,
        transition: 'opacity 0.4s ease',
        background:
          'radial-gradient(ellipse at 50% 55%, #c98a5fcc 0%, #a9694aee 55%, #7d4630f5 100%)',
      }}
    />
  );
}
