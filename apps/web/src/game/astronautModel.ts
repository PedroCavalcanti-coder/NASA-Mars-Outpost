import {
  ACCESSORY_IDS,
  MARK_BASE_CELL,
  MARK_SLOTS,
  SUIT_COLORS,
  SUIT_PARTS,
  type SuitColorId,
  type SuitConfig,
  type SuitPart,
} from '@mars/shared';
import * as THREE from 'three';

/** Volta ao astronauta antigo se o v2 der problema (um lugar só para trocar). */
export const USE_ASTRONAUT_V2 = true;

export const ASTRONAUT_MODEL_URL = USE_ASTRONAUT_V2
  ? '/assets/modelos/astronaut_v2.glb'
  : '/assets/modelos/astronaut.glb';

/** Pasta das texturas trocáveis do v2 (cores por família, atlas de marcas e de rostos). */
export const ASTRONAUT_TEXTURE_DIR = '/assets/modelos/astronauta_v2';
export const ASTRONAUT_MARKS_ATLAS = `${ASTRONAUT_TEXTURE_DIR}/emblemas.png`;

/** Cada peça usa uma família de textura: `casco` (placas) ou `tecido` (trama). */
type Family = 'casco' | 'tecido';
const PART_FAMILY: Record<SuitPart, Family> = {
  helmet: 'casco',
  boots: 'casco',
  backpack: 'casco',
  suit: 'tecido',
  vest: 'tecido',
  gloves: 'tecido',
};

/**
 * No v2 cada peça tem material próprio e os acessórios reaproveitam o nome do material da
 * peça que seguem (a lanterna usa `AST2_Capacete`, a antena `AST2_Mochila`...). Por isso a cor é
 * aplicada pelo nome do material, e os acessórios acompanham a peça sozinhos.
 */
const MATERIAL_PART: Record<string, SuitPart> = {
  AST2_Capacete: 'helmet',
  AST2_Traje: 'suit',
  AST2_Colete: 'vest',
  AST2_Luvas: 'gloves',
  AST2_Botas: 'boots',
  AST2_Mochila: 'backpack',
};

// ------------------------------------------------------------------ texturas compartilhadas

interface CacheEntry {
  texture: THREE.Texture;
  ready: boolean;
  failed: boolean;
  waiters: Array<() => void>;
}
const textureCache = new Map<string, CacheEntry>();
const textureLoader = new THREE.TextureLoader();

/** Textura da família/cor (cache global; nunca descarte). `onReady` roda quando terminar de carregar. */
function suitTexture(family: Family, colorId: string, onReady?: () => void): CacheEntry {
  const key = `${family}_${colorId}`;
  let entry = textureCache.get(key);
  if (!entry) {
    const created: CacheEntry = {
      texture: new THREE.Texture(),
      ready: false,
      failed: false,
      waiters: [],
    };
    entry = created;
    textureCache.set(key, created);
    textureLoader.load(
      `${ASTRONAUT_TEXTURE_DIR}/cores/${key}.png`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.flipY = false; // igual às texturas do glTF
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        created.texture = tex;
        created.ready = true;
        for (const w of created.waiters.splice(0)) w();
      },
      undefined,
      () => {
        created.failed = true;
        created.waiters.length = 0;
      },
    );
  }
  if (onReady && !entry.ready && !entry.failed) entry.waiters.push(onReady);
  return entry;
}

function isStandard(m: THREE.Material): m is THREE.MeshStandardMaterial {
  return (m as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
}

/** Pinta uma peça: textura da cor escolhida (ou a neutra tingida enquanto carrega / se falhar). */
function paintMaterial(m: THREE.MeshStandardMaterial, part: SuitPart, colorId: SuitColorId) {
  const family = PART_FAMILY[part];
  const key = `${family}_${colorId}`;
  m.userData.suitKey = key;
  const entry = suitTexture(family, colorId, () => {
    if (m.userData.suitKey !== key) return; // a cor mudou enquanto carregava
    m.map = suitTexture(family, colorId).texture;
    m.color.set('#ffffff');
    m.needsUpdate = true;
  });
  if (entry.ready) {
    m.map = entry.texture;
    m.color.set('#ffffff');
  } else {
    // fallback: textura neutra tingida (comportamento anterior) até a da cor chegar
    const neutral = suitTexture(family, 'neutro', () => {
      if (m.userData.suitKey !== key || entry.ready) return;
      m.map = suitTexture(family, 'neutro').texture;
      m.needsUpdate = true;
    });
    m.map = neutral.ready ? neutral.texture : null;
    m.color.set(SUIT_COLORS[colorId].hex);
  }
  m.needsUpdate = true;
}

// ------------------------------------------------------------------ preparo do modelo clonado

/** Nomes exatos dos nós de acessório e de decalque de marca no GLB. */
const ACCESSORY_NODES = new Set<string>([
  ...ACCESSORY_IDS.map((id) => `acc_${id}`),
  ...MARK_SLOTS.map((slot) => `acc_emblema_${slot}`),
]);

/** Texturas clonadas por modelo (rosto e marcas): quem criou o ator precisa descartá-las. */
export interface ModelTextures {
  face: THREE.Texture[];
  all: THREE.Texture[];
}

export function meshMaterials(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * Deixa o clone do modelo pronto: materiais próprios por malha, acessórios escondidos,
 * texturas do rosto e das marcas clonadas (trocar `offset` não pode afetar outros jogadores).
 */
export function prepareModel(model: THREE.Object3D): ModelTextures {
  const textures: ModelTextures = { face: [], all: [] };
  model.traverse((o) => {
    // só o nó do acessório: as malhas filhas (uma por material) ficam visíveis
    if (ACCESSORY_NODES.has(o.name)) o.visible = false;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
    for (const m of meshMaterials(mesh)) {
      if (!isStandard(m)) continue;
      if (m.name === 'M_Rosto') {
        for (const slot of ['map', 'emissiveMap'] as const) {
          const src = m[slot];
          if (!src) continue;
          const t = src.clone();
          t.needsUpdate = true;
          m[slot] = t;
          textures.face.push(t);
          textures.all.push(t);
        }
      } else if (m.name === 'AST2_Emblema' && m.map) {
        const t = m.map.clone();
        t.needsUpdate = true;
        m.map = t;
        textures.all.push(t);
      }
    }
  });
  return textures;
}

/** Célula `c` do atlas 4×2: `repeat (0.25, 0.5)`; no glTF (`flipY = false`) a linha de cima é v = 0. */
export function setFaceExpression(textures: ModelTextures, cell: number) {
  const c = Math.max(0, Math.min(7, Math.round(cell)));
  for (const t of textures.face) {
    t.repeat.set(0.25, 0.5);
    t.offset.set((c % 4) * 0.25, c < 4 ? 0 : 0.5);
  }
}

/** Mostra a marca `markId` num decalque cuja UV já aponta para a célula `baseCell`. */
function setMark(mesh: THREE.Mesh, baseCell: number, markId: number) {
  const row = (c: number) => (c < 4 ? 0 : 1);
  for (const m of meshMaterials(mesh)) {
    if (!isStandard(m) || !m.map) continue;
    m.map.offset.set(((markId % 4) - (baseCell % 4)) * 0.25, (row(markId) - row(baseCell)) * 0.5);
  }
}

/** Aplica cores, acessórios e marcas do traje ao modelo (atores e prévia usam o mesmo caminho). */
export function applySuitAppearance(root: THREE.Object3D, suit: SuitConfig) {
  if (!USE_ASTRONAUT_V2) {
    // modelo antigo: cada peça é um nó `color_<peça>` tingido
    for (const part of SUIT_PARTS) {
      root.getObjectByName(`color_${part}`)?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const m of meshMaterials(mesh)) {
          if (isStandard(m)) m.color.set(SUIT_COLORS[suit[part]].hex);
        }
      });
    }
    return;
  }

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of meshMaterials(mesh)) {
      const part = MATERIAL_PART[m.name];
      if (part && isStandard(m)) paintMaterial(m, part, suit[part]);
    }
  });

  for (const id of ACCESSORY_IDS) {
    const node = root.getObjectByName(`acc_${id}`);
    if (node) node.visible = suit.accessories.includes(id);
  }
  for (const slot of MARK_SLOTS) {
    const node = root.getObjectByName(`acc_emblema_${slot}`);
    if (!node) continue;
    const mark = suit.marks[slot];
    node.visible = mark !== undefined && mark !== null;
    if (node.visible) {
      node.traverse((c) => {
        if ((c as THREE.Mesh).isMesh)
          setMark(c as THREE.Mesh, MARK_BASE_CELL[slot], mark as number);
      });
    }
  }
}
