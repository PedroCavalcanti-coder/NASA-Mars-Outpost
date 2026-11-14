import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type BaseFullLayout, BaseGrid, STORM_SAFE_RADIUS } from './BaseGrid';

/** Cena mínima: uma parede com um vão de 2 m, uma caixa (móvel) e um piso baixo. */
function buildScene() {
  const root = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, name: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.name = name;
    root.add(m);
    return m;
  };
  // parede em z = 0 de ponta a ponta do mapa, com vão entre x = -1 e x = 1
  box(79, 3, 0.3, -40.5, 1.5, 0, 'Parede_A');
  box(79, 3, 0.3, 40.5, 1.5, 0, 'Parede_B');
  // móvel isolado
  box(2, 1, 2, 0, 0.5, 8, 'Movel');
  // piso (não bloqueia: abaixo da faixa do corpo)
  box(30, 0.1, 30, 0, 0.05, 0, 'Piso');
  // coisas que NÃO devem bloquear
  box(4, 3, 4, 8, 1.5, 10, 'Base_Nave');
  box(10, 0.4, 10, 0, 3.8, 5, 'Base_Telhado');
  root.updateMatrixWorld(true);
  return root;
}

const layout: BaseFullLayout = {
  id: 'jezero',
  name: 'teste',
  description: '',
  bounds: { x0: -2, y0: -2, x1: 2, y1: 2 },
  rooms: [],
  corridors: [],
  pad: [0, 20],
};

function makeGrid() {
  const grid = new BaseGrid(layout);
  grid.buildNavigation(buildScene(), {
    skip: (n) => /_Nave$|_Telhado$/.test(n),
    seed: new THREE.Vector3(0, 0, 14),
    vehicleSeed: new THREE.Vector3(-20, 0, 14),
  });
  return grid;
}

describe('BaseGrid (navegação)', () => {
  it('bloqueia paredes e móveis, mas não o piso', () => {
    const g = makeGrid();
    expect(g.isWalkable(-5, 0)).toBe(false); // dentro da parede
    expect(g.isWalkable(5, 0)).toBe(false);
    expect(g.isWalkable(0, 0)).toBe(true); // vão
    expect(g.isWalkable(0, 8)).toBe(false); // móvel
    expect(g.isWalkable(-5, 5)).toBe(true); // piso livre
  });

  it('ignora o que o jogo manda ignorar (nave que decola, teto)', () => {
    const g = makeGrid();
    expect(g.isWalkable(8, 10)).toBe(true);
    expect(g.isWalkable(0, 5)).toBe(true);
  });

  it('contorna a parede pelo vão: o caminho nunca atravessa célula bloqueada', () => {
    const g = makeGrid();
    const { path } = g.findPath(new THREE.Vector3(-8, 0, 12), new THREE.Vector3(-8, 0, -12));
    expect(path.length).toBeGreaterThan(1);
    const last = path[path.length - 1]!;
    expect(Math.hypot(last.x + 8, last.z + 12)).toBeLessThan(0.5);
    // todos os trechos têm linha de visada livre e a linha cruza a parede (z = 0) pelo vão
    let prev = new THREE.Vector3(-8, 0, 12);
    let crossedAt: number | null = null;
    for (const p of path) {
      expect(g.lineClear(prev.x, prev.z, p.x, p.z)).toBe(true);
      if ((prev.z - 0) * (p.z - 0) < 0) {
        const t = (0 - prev.z) / (p.z - prev.z);
        crossedAt = prev.x + (p.x - prev.x) * t;
      }
      prev = p;
    }
    expect(crossedAt).not.toBeNull();
    expect(Math.abs(crossedAt ?? 99)).toBeLessThan(1);
  });

  it('clique dentro da parede leva ao ponto livre mais próximo', () => {
    const g = makeGrid();
    const { path } = g.findPath(new THREE.Vector3(-8, 0, 12), new THREE.Vector3(-5, 0, 0));
    const last = path[path.length - 1]!;
    expect(g.isWalkable(last.x, last.z)).toBe(true);
    expect(Math.hypot(last.x + 5, last.z)).toBeLessThan(1.5);
  });

  it('desvia de outro jogador (bloqueio dinâmico)', () => {
    const g = makeGrid();
    const blocker = (x: number, z: number) => Math.hypot(x + 8, z - 6) < 1;
    const { path } = g.findPath(
      new THREE.Vector3(-8, 0, 12),
      new THREE.Vector3(-8, 0, 2),
      false,
      blocker,
    );
    const last = path[path.length - 1]!;
    expect(Math.hypot(last.x + 8, last.z - 2)).toBeLessThan(0.5);
    for (const p of path) expect(blocker(p.x, p.z)).toBe(false);
  });

  it('na tempestade o destino é puxado para o perímetro seguro', () => {
    const g = makeGrid();
    const { path, clampedByStorm } = g.findPath(
      new THREE.Vector3(0, 0, 14),
      new THREE.Vector3(70, 0, 0),
      true,
    );
    expect(clampedByStorm).toBe(true);
    const last = path[path.length - 1];
    if (last) expect(Math.hypot(last.x, last.z)).toBeLessThanOrEqual(STORM_SAFE_RADIUS);
  });

  it('o rover (mais largo) não passa pelo vão de 2 m que o astronauta atravessa', () => {
    const g = makeGrid();
    expect(g.isWalkable(0, 0, 'foot')).toBe(true);
    expect(g.isWalkable(0, 0, 'vehicle')).toBe(false);
    // o carro anda no seu lado da parede, mas não chega ao outro
    const { path } = g.findPath(
      new THREE.Vector3(-20, 0, 14),
      new THREE.Vector3(-20, 0, -14),
      false,
      undefined,
      'vehicle',
    );
    const last = path[path.length - 1];
    expect(!last || last.z > 1).toBe(true);
  });

  it('sólido de verdade: parede é sólida; a folga do corpo perto dela, não', () => {
    const g = makeGrid();
    expect(g.isSolid(-5, 0)).toBe(true);
    expect(g.isSolid(-5, 0.45)).toBe(false); // livre de objeto, só dentro da folga
    expect(g.isWalkable(-5, 0.45)).toBe(false);
  });

  it('o heliponto vem em metros do modelo, não em tiles', () => {
    const g = makeGrid();
    // pad [0, 20] m no modelo => 15 unidades no mundo (escala 0,75), centro do mapa em 0
    const pad = g.getPadWorldPosition();
    expect(pad.x).toBeCloseTo(0, 5);
    expect(pad.z).toBeCloseTo(-15, 5);
  });
});
