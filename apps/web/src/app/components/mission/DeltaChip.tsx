/** Número que sobe e some ao lado de um indicador (+6, −8). Remonte com uma `key` nova para repetir. */
export function DeltaChip({ value }: { value: number }) {
  return (
    <span className={`delta-chip ${value > 0 ? 'is-up' : 'is-down'}`} aria-hidden="true">
      {value > 0 ? `+${value}` : `−${Math.abs(value)}`}
    </span>
  );
}
