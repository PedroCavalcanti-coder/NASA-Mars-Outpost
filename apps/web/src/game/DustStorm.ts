/**
 * Uniforms COMPARTILHADOS por todos os materiais com a poeira (névoa de borda + tempestade).
 * Cada material recebe estes mesmos objetos `{ value }`, então basta atualizar `.value` aqui
 * para toda a cena reagir no mesmo quadro.
 */
export interface DustStormUniforms {
  /** intensidade da tempestade percebida pelo jogador (0..1) */
  dustStormStrength: { value: number };
  dustStormTime: { value: number };
  /** 0..1: quanto da poeira é removida de superfícies internas (jogador dentro da base) */
  dustInteriorClear: { value: number };
  dustEdgeNear: { value: number };
  dustEdgeFar: { value: number };
}

export const dustUniforms: DustStormUniforms = {
  dustStormStrength: { value: 0 },
  dustStormTime: { value: 0 },
  dustInteriorClear: { value: 0 },
  dustEdgeNear: { value: 55 },
  dustEdgeFar: { value: 90 },
};

/** Haze contínuo de poeira movido a vento nos shaders de neblina da cena. */
export class DustStorm {
  readonly uniforms = dustUniforms;

  /**
   * @param strength tempestade (0..1) já atenuada conforme o jogador esteja dentro/fora
   * @param interiorClear 0 = jogador fora (interior também recebe poeira), 1 = dentro
   */
  update(strength: number, time: number, reduced: boolean, interiorClear: number) {
    this.uniforms.dustStormStrength.value = strength;
    this.uniforms.dustStormTime.value = reduced ? 0 : time;
    this.uniforms.dustInteriorClear.value = interiorClear;
  }
}

/**
 * Camada 2D sobre o canvas 3D: rajadas de areia atravessando a tela e uma bruma nas bordas.
 * Só aparece com o jogador FORA da base; dentro dela a intensidade cai suavemente a zero.
 */
export class DustStormOverlay {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D | null;
  private streaks: Array<{
    x: number;
    y: number;
    len: number;
    speed: number;
    a: number;
    w: number;
  }> = [];
  private w = 1;
  private h = 1;
  private level = 0;
  private acc = 0;
  private time = 0;

  constructor(private readonly container: HTMLElement) {
    this.ctx = this.canvas.getContext('2d');
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.4s linear',
      mixBlendMode: 'normal',
    } as Partial<CSSStyleDeclaration>);
    this.canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(this.canvas);
    this.resize();
  }

  resize() {
    const cw = this.container.clientWidth || 1;
    const ch = this.container.clientHeight || 1;
    // resolução reduzida: é só poeira, e o custo de desenho cai muito
    const scale = 0.5;
    this.w = Math.max(2, Math.floor(cw * scale));
    this.h = Math.max(2, Math.floor(ch * scale));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.streaks = [];
  }

  private spawn(count: number) {
    while (this.streaks.length < count) {
      this.streaks.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        len: 30 + Math.random() * 120,
        speed: 500 + Math.random() * 900,
        a: 0.08 + Math.random() * 0.3,
        w: 0.7 + Math.random() * 1.6,
      });
    }
  }

  /** `level` 0..1: força da tempestade vista pelo jogador. */
  update(dt: number, level: number, reduced: boolean) {
    this.level += (level - this.level) * Math.min(1, dt * 3);
    const visible = this.level > 0.02;
    this.canvas.style.opacity = visible ? '1' : '0';
    if (!visible || !this.ctx) return;

    // 30 quadros por segundo bastam
    this.acc += dt;
    if (this.acc < 1 / 30) return;
    const step = this.acc;
    this.acc = 0;
    this.time += step;

    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    // bruma: mais densa nas bordas
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.25,
      w / 2,
      h / 2,
      Math.hypot(w, h) * 0.6,
    );
    g.addColorStop(0, `rgba(205,140,90,${0.1 * this.level})`);
    g.addColorStop(1, `rgba(190,120,75,${0.5 * this.level})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // rajadas: o vento sopra da esquerda-cima para a direita-baixo
    const count = reduced ? 25 : Math.round(110 * this.level + 20);
    this.spawn(count);
    this.streaks.length = Math.min(this.streaks.length, count);
    const dx = Math.cos(0.38);
    const dy = Math.sin(0.38);
    ctx.lineCap = 'round';
    for (const s of this.streaks) {
      s.x += dx * s.speed * step * (reduced ? 0.2 : 1);
      s.y += dy * s.speed * step * (reduced ? 0.2 : 1);
      if (s.x - s.len > w || s.y - s.len > h) {
        s.x = -s.len - Math.random() * w * 0.3;
        s.y = Math.random() * h - h * 0.2;
      }
      ctx.strokeStyle = `rgba(238,196,150,${s.a * this.level})`;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - dx * s.len, s.y - dy * s.len);
      ctx.stroke();
    }
  }

  dispose() {
    this.canvas.remove();
  }
}
