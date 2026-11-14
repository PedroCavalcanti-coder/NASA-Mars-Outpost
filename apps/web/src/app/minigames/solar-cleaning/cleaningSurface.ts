export type BrushPoint = { x: number; y: number };

/** Small, fixed occupancy grid. Only newly cleaned dust counts toward completion. */
export class CleaningSurface {
  readonly initialDust: number;
  private remaining: number;
  private readonly dust: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly columns: number,
    readonly rows: number,
    coverage: Uint8Array,
  ) {
    if (columns * rows !== coverage.length || Math.min(width, height, columns, rows) <= 0) {
      throw new Error('Invalid cleaning surface');
    }
    this.dust = Uint8Array.from(coverage, (value) => (value ? 1 : 0));
    this.initialDust = this.dust.reduce((total, value) => total + value, 0);
    this.remaining = this.initialDust;
  }

  get complete() {
    // Clear the last tiny specks automatically; never demand pixel hunting.
    return this.remaining <= this.initialDust * 0.015;
  }

  get remainingDust() {
    return this.remaining;
  }

  sweep(from: BrushPoint, to: BrushPoint, radius: number) {
    if (![from.x, from.y, to.x, to.y, radius].every(Number.isFinite) || radius <= 0) return 0;
    const cellWidth = this.width / this.columns;
    const cellHeight = this.height / this.rows;
    const left = Math.max(0, Math.floor((Math.min(from.x, to.x) - radius) / cellWidth));
    const right = Math.min(
      this.columns - 1,
      Math.floor((Math.max(from.x, to.x) + radius) / cellWidth),
    );
    const top = Math.max(0, Math.floor((Math.min(from.y, to.y) - radius) / cellHeight));
    const bottom = Math.min(
      this.rows - 1,
      Math.floor((Math.max(from.y, to.y) + radius) / cellHeight),
    );
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    let cleaned = 0;

    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        const index = row * this.columns + column;
        if (!this.dust[index]) continue;
        const x = (column + 0.5) * cellWidth;
        const y = (row + 0.5) * cellHeight;
        const t = lengthSquared
          ? Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / lengthSquared))
          : 0;
        if ((x - from.x - t * dx) ** 2 + (y - from.y - t * dy) ** 2 > radius * radius) continue;
        this.dust[index] = 0;
        this.remaining--;
        cleaned++;
      }
    }
    return cleaned;
  }
}
