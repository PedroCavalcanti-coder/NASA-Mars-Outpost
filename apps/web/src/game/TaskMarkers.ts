import * as THREE from 'three';
import type { DailyTask } from './tasks/rules';

/** Marcadores clicáveis, ancorados aos equipamentos de cada tarefa. */
export class TaskMarkers {
  private readonly markers = new Map<
    string,
    { sprite: THREE.Sprite; opacity: number; active: boolean; task: DailyTask }
  >();
  private readonly textures = new Map<string, THREE.CanvasTexture>();

  constructor(private readonly scene: THREE.Scene) {}

  private textureFor() {
    const cached = this.textures.get('marker');
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#20394b';
    ctx.fillStyle = '#ffbd36';
    ctx.beginPath();
    ctx.moveTo(64, 150);
    ctx.bezierCurveTo(52, 129, 12, 99, 12, 61);
    ctx.arc(64, 61, 52, Math.PI, 0);
    ctx.bezierCurveTo(116, 99, 76, 129, 64, 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff8df';
    ctx.beginPath();
    ctx.arc(64, 61, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20394b';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 64, 63);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set('marker', texture);
    return texture;
  }

  sync(
    tasks: DailyTask[],
    position: (kind: DailyTask['kind'], index: number) => THREE.Vector3 | null,
  ) {
    for (const marker of this.markers.values()) marker.active = false;
    for (const task of tasks) {
      if (task.done) continue;
      const point = position(task.kind, task.index);
      if (!point) continue;
      const key = task.kind === 'crop' || task.kind === 'plant'
        ? 'greenhouse'
        : `${task.kind}:${task.index}`;
      // A estufa usa um único ponto; prioriza a primeira tarefa pendente.
      if (this.markers.get(key)?.active) continue;
      let marker = this.markers.get(key);
      if (!marker) {
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
        sprite.scale.set(1.54, 1.92, 1);
        // A ponta desenhada termina em y=150 no canvas de 160px.
        sprite.center.set(0.5, 10 / 160);
        sprite.position.copy(point);
        this.scene.add(sprite);
        marker = { sprite, opacity: 0, active: true, task };
        this.markers.set(key, marker);
      }
      marker.active = true;
      marker.task = task;
      marker.sprite.position.copy(point);
    }
  }

  pick(raycaster: THREE.Raycaster): DailyTask | null {
    const active = [...this.markers.values()].filter((m) => m.active && m.opacity > 0.15);
    const hit = raycaster.intersectObjects(active.map((m) => m.sprite))[0];
    return hit ? (active.find((m) => m.sprite === hit.object)?.task ?? null) : null;
  }

  update(
    dt: number,
    insideHabitat: boolean,
    playerVisible: boolean,
    isInside: (x: number, z: number) => boolean,
  ) {
    for (const [key, marker] of this.markers) {
      marker.opacity = THREE.MathUtils.clamp(
        marker.opacity +
          (marker.active &&
          playerVisible &&
          (insideHabitat || !isInside(marker.sprite.position.x, marker.sprite.position.z))
            ? 1
            : -1) *
            dt *
            3,
        0,
        1,
      );
      (marker.sprite.material as THREE.SpriteMaterial).opacity = marker.opacity;
      if (!marker.active && marker.opacity === 0) {
        marker.sprite.removeFromParent();
        (marker.sprite.material as THREE.Material).dispose();
        this.markers.delete(key);
      }
    }
  }

  dispose() {
    for (const marker of this.markers.values()) {
      marker.sprite.removeFromParent();
      (marker.sprite.material as THREE.Material).dispose();
    }
    this.markers.clear();
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}
