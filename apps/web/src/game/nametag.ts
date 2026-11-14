import * as THREE from 'three';

/** Plaqueta holográfica com o nome, sempre voltada para a câmera (sem depender da profundidade). */
export function createNametag(name: string, isLocal: boolean): THREE.Sprite | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const w = 256;
  const h = 64;
  const r = 16;
  ctx.fillStyle = 'rgba(10, 20, 42, 0.88)';
  ctx.strokeStyle = isLocal ? '#ffb511' : '#78ace1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(28, 32, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#4ade80';
  ctx.fill();

  ctx.font = 'bold 22px Barlow, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.toUpperCase().slice(0, 14), 44, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, fog: false }),
  );
  sprite.scale.set(1.6, 0.4, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function disposeNametag(sprite: THREE.Sprite | null) {
  if (!sprite) return;
  sprite.material.map?.dispose();
  sprite.material.dispose();
  sprite.removeFromParent();
}

/**
 * Balão de emoji sobre a cabeça: aparece com um "pop" (fade-in), flutua e some (fade-out) depois
 * de alguns segundos. O tempo anda com o relógio da simulação, não com o da tela.
 */
export class EmoteBubble {
  private static readonly FADE_IN = 0.25;
  private static readonly HOLD = 2.6;
  private static readonly FADE_OUT = 0.7;

  private readonly sprite: THREE.Sprite;
  private readonly baseY: number;
  private t = -1;

  constructor(baseY: number) {
    this.baseY = baseY;
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        transparent: true,
        depthTest: false,
        fog: false,
        opacity: 0,
      }),
    );
    this.sprite.renderOrder = 12;
    this.sprite.visible = false;
    this.sprite.scale.set(0.9, 0.9, 1);
  }

  attach(parent: THREE.Object3D) {
    parent.add(this.sprite);
  }

  /** Mostra `emoji` (reinicia a animação se já havia um). */
  show(emoji: string) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // balão arredondado com o emoji no centro
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.strokeStyle = 'rgba(255, 181, 17, 0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2 - 4, size / 2 - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '68px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 2);

    const mat = this.sprite.material;
    mat.map?.dispose();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
    this.t = 0;
    this.sprite.visible = true;
  }

  update(dt: number) {
    if (this.t < 0) return;
    this.t += dt;
    const { FADE_IN, HOLD, FADE_OUT } = EmoteBubble;
    const total = FADE_IN + HOLD + FADE_OUT;
    if (this.t >= total) {
      this.t = -1;
      this.sprite.visible = false;
      this.sprite.material.opacity = 0;
      return;
    }
    let opacity = 1;
    let scale = 1;
    if (this.t < FADE_IN) {
      const k = this.t / FADE_IN;
      opacity = k;
      scale = 0.5 + 0.7 * k - 0.2 * k * k; // pop: passa de 1 e assenta
    } else if (this.t > FADE_IN + HOLD) {
      opacity = 1 - (this.t - FADE_IN - HOLD) / FADE_OUT;
    }
    const float = Math.min(1, this.t / total) * 0.35;
    this.sprite.material.opacity = Math.max(0, Math.min(1, opacity));
    this.sprite.scale.set(0.9 * scale, 0.9 * scale, 1);
    this.sprite.position.set(0, this.baseY + float, 0);
  }

  dispose() {
    this.sprite.material.map?.dispose();
    this.sprite.material.dispose();
    this.sprite.removeFromParent();
  }
}
