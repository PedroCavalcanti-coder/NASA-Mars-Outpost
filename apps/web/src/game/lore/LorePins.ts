import * as THREE from 'three';
import type { LoreId } from './lore';

/**
 * Gotas com "?" sobre lugares com curiosidade que não fazem parte de nenhuma missão agora.
 * Clicar abre a curiosidade; depois de lida, a gota some de vez.
 */
export class LorePins {
  private readonly pins = new Map<
    LoreId,
    { sprite: THREE.Sprite; opacity: number; active: boolean }
  >();
  private texture: THREE.CanvasTexture | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  private textureFor() {
    if (this.texture) return this.texture;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#20394b';
    ctx.fillStyle = '#5fb8ff';
    ctx.beginPath();
    ctx.moveTo(64, 150);
    ctx.bezierCurveTo(52, 129, 12, 99, 12, 61);
    ctx.arc(64, 61, 52, Math.PI, 0);
    ctx.bezierCurveTo(116, 99, 76, 129, 64, 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f2fbff';
    ctx.beginPath();
    ctx.arc(64, 61, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20394b';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 64, 64);
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    return this.texture;
  }

  /** Mostra exatamente estas gotas (as que ficarem de fora somem aos poucos). */
  sync(points: Map<LoreId, THREE.Vector3>) {
    for (const pin of this.pins.values()) pin.active = false;
    for (const [id, point] of points) {
      let pin = this.pins.get(id);
      if (!pin) {
        const material = new THREE.SpriteMaterial({
          map: this.textureFor(),
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
          fog: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.renderOrder = 10000;
        sprite.scale.set(1.3, 1.62, 1);
        sprite.center.set(0.5, 10 / 160);
        this.scene.add(sprite);
        pin = { sprite, opacity: 0, active: true };
        this.pins.set(id, pin);
      }
      pin.active = true;
      pin.sprite.position.copy(point);
    }
  }

  pick(raycaster: THREE.Raycaster): LoreId | null {
    const visible = [...this.pins.entries()].filter(([, p]) => p.active && p.opacity > 0.15);
    const hit = raycaster.intersectObjects(visible.map(([, p]) => p.sprite))[0];
    return hit ? (visible.find(([, p]) => p.sprite === hit.object)?.[0] ?? null) : null;
  }

  update(dt: number, show: (point: THREE.Vector3) => boolean) {
    for (const [id, pin] of this.pins) {
      const target = pin.active && show(pin.sprite.position) ? 1 : -1;
      pin.opacity = THREE.MathUtils.clamp(pin.opacity + target * dt * 3, 0, 1);
      (pin.sprite.material as THREE.SpriteMaterial).opacity = pin.opacity;
      if (!pin.active && pin.opacity === 0) {
        pin.sprite.removeFromParent();
        (pin.sprite.material as THREE.Material).dispose();
        this.pins.delete(id);
      }
    }
  }

  dispose() {
    for (const pin of this.pins.values()) {
      pin.sprite.removeFromParent();
      (pin.sprite.material as THREE.Material).dispose();
    }
    this.pins.clear();
    this.texture?.dispose();
    this.texture = null;
  }
}
