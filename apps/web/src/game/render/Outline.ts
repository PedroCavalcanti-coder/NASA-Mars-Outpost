/**
 * Sistema de Linha de Contorno (Outline System).
 *
 * Arquitetura híbrida de alto desempenho para estilo visual low-poly isométrico em Marte:
 * 1. Casco Invertido (Inverted Hull): Aplicado em astronautas, rover e equipamentos.
 *    - Renderização de faces traseiras (BackSide) expandidas ao longo da normal da geometria.
 *    - Custo quase zero de processamento e memória, com suporte nativo a SkinnedMesh (ossos do astronauta).
 *    - Suporta iluminação e névoa atmosférica (boundaryFog) sem quebrar sombras nem cliques.
 *
 * 2. Detecção de Bordas por Normais e Profundidade (Base Edge Detection):
 *    - Pós-processamento exclusivo para o modelo arquitetônico da base marciana.
 *    - Captura descontinuidades geométricas entre telhados e paredes em um único buffer compacto (RGBA).
 *    - Acompanha perfeitamente a transparência do InteriorFader (tetos abertos e paredes translúcidas).
 *    - Não interfere com sombras sob demanda, névoa nem tempestades de poeira.
 */

import * as THREE from 'three';

export interface OutlineOptions {
  /** Linha de contorno habilitada ou desabilitada */
  enabled: boolean;
  /** Espessura e intensidade do traço (padrão 1.0, escala entre 0.2 e 2.5) */
  strength: number;
  /** Cor do contorno em formato hexadecimal (ex.: '#0f141c') */
  color: string;
  /** Nível de qualidade gráfica do simulador */
  quality?: 'low' | 'medium' | 'high';
  /** Preferência de movimento reduzido para acessibilidade */
  reducedMotion?: boolean;
}

export const DEFAULT_OUTLINE_OPTIONS: OutlineOptions = {
  enabled: false,
  strength: 1.0,
  color: '#0f141c',
  quality: 'medium',
  reducedMotion: false,
};

// ============================================================================
// 1. SHADERS DO CASCO INVERTIDO (INVERTED HULL)
// ============================================================================

/**
 * Cria o material do casco invertido para objetos dinâmicos (astronautas, veículos, equipamentos).
 * Utiliza expansão ao longo da normal no espaço de visão para manter a silhueta uniforme
 * sob a projeção isométrica (câmera ortográfica), sem z-fighting.
 */
function createInvertedHullMaterial(
  _isSkinned: boolean,
  colorHex: string,
  thickness: number,
): THREE.ShaderMaterial {
  const color = new THREE.Color(colorHex);

  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 1.5,
    uniforms: {
      outlineThickness: { value: thickness },
      outlineColor: { value: color },
      outlineOpacity: { value: 1.0 },
      ...THREE.UniformsLib.fog,
    },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      #include <fog_pars_vertex>

      uniform float outlineThickness;

      void main() {
        #include <skinbase_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>

        #include <begin_vertex>
        #include <skinning_vertex>

        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);

        #ifdef USE_SKINNING
          vec3 n = (viewMatrix * vec4(transformedNormal, 0.0)).xyz;
        #else
          vec3 n = normalMatrix * objectNormal;
        #endif

        // Expande os vértices no plano da tela (espaço de visão)
        vec2 dir = length(n.xy) > 0.001 ? normalize(n.xy) : vec2(0.0, 1.0);
        mvPosition.xy += dir * outlineThickness;

        gl_Position = projectionMatrix * mvPosition;

        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      uniform float outlineOpacity;

      #include <common>
      #include <fog_pars_fragment>

      void main() {
        gl_FragColor = vec4(outlineColor, outlineOpacity);
        #include <fog_fragment>
      }
    `,
  });
}

// ============================================================================
// 2. GERENCIADOR DE CASCOS INVERTIDOS (OBJETOS DINÂMICOS)
// ============================================================================

interface HullEntry {
  mesh: THREE.Mesh;
  hull: THREE.Mesh;
  baseThickness: number;
}

export class InvertedHullManager {
  private readonly entries = new Map<THREE.Mesh, HullEntry>();
  private readonly sharedMaterials = new Map<string, THREE.ShaderMaterial>();
  private options: OutlineOptions = { ...DEFAULT_OUTLINE_OPTIONS };

  constructor(options?: Partial<OutlineOptions>) {
    if (options) this.updateOptions(options);
  }

  updateOptions(next: Partial<OutlineOptions>) {
    this.options = { ...this.options, ...next };
    const effectiveColor = new THREE.Color(this.options.color);
    const visible = this.options.enabled && this.options.quality !== 'low';

    for (const entry of this.entries.values()) {
      const mat = entry.hull.material as THREE.ShaderMaterial;
      const thickness = mat.uniforms.outlineThickness;
      if (thickness) thickness.value = entry.baseThickness * this.options.strength;
      const color = mat.uniforms.outlineColor;
      if (color) (color.value as THREE.Color).copy(effectiveColor);
      entry.hull.visible = visible && entry.mesh.visible;
    }
  }

  /**
   * Adiciona objetos dinâmicos (astronauta, rover, equipamentos) ao sistema de contorno.
   * Cria duplicatas de malha com casco invertido vinculadas ao mesmo esqueleto (para SkinnedMesh).
   */
  addObject(root: THREE.Object3D, category: 'astronaut' | 'vehicle' | 'equipment' = 'equipment') {
    const baseThickness = category === 'astronaut' ? 0.024 : category === 'vehicle' ? 0.034 : 0.028;

    // Coleta antes de mexer na árvore: inserir irmãos durante o traverse altera a lista percorrida
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });

    for (const mesh of meshes) {
      if (mesh.userData.isOutlineHull) continue;

      // Evita aplicar em partículas, balões de emote e nametags
      if (
        mesh.userData.isParticle ||
        mesh.name.startsWith('nametag') ||
        mesh.name.startsWith('emote') ||
        mesh.type === 'Sprite'
      ) {
        continue;
      }

      if (this.entries.has(mesh)) continue;

      const isSkinned = Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh);
      const matKey = `${isSkinned ? 'skinned' : 'static'}_${category}`;
      let hullMat = this.sharedMaterials.get(matKey);
      if (!hullMat) {
        hullMat = createInvertedHullMaterial(
          isSkinned,
          this.options.color,
          baseThickness * this.options.strength,
        );
        this.sharedMaterials.set(matKey, hullMat);
      }

      let hull: THREE.Mesh;
      if (isSkinned) {
        const skinned = mesh as THREE.SkinnedMesh;
        const skinnedHull = new THREE.SkinnedMesh(mesh.geometry, hullMat);
        skinnedHull.bind(skinned.skeleton, skinned.bindMatrix);
        hull = skinnedHull;
      } else {
        hull = new THREE.Mesh(mesh.geometry, hullMat);
      }

      // Irmão da malha original: copia a matriz local dela. Filho (malha sem pai): identidade.
      hull.matrixAutoUpdate = false;
      if (mesh.parent) hull.matrix.copy(mesh.matrix);
      hull.castShadow = false;
      hull.receiveShadow = false;
      hull.frustumCulled = false;
      hull.raycast = () => {}; // Não intercepta cliques do mouse
      hull.userData.isOutlineHull = true;

      const visible = this.options.enabled && this.options.quality !== 'low';
      hull.visible = visible && mesh.visible;

      // Insere como filho ou irmão da malha original
      if (mesh.parent) {
        mesh.parent.add(hull);
      } else {
        mesh.add(hull);
      }

      this.entries.set(mesh, { mesh, hull, baseThickness });
    }
  }

  /** Remove um objeto rastreado e libera seus cascos invertidos */
  removeObject(root: THREE.Object3D) {
    // Coleta antes de remover: tirar irmãos durante o traverse pula/quebra a iteração
    const found: HullEntry[] = [];
    root.traverse((o) => {
      const entry = this.entries.get(o as THREE.Mesh);
      if (entry) found.push(entry);
    });
    for (const entry of found) {
      entry.hull.parent?.remove(entry.hull);
      this.entries.delete(entry.mesh);
    }
  }

  /** Sincroniza a visibilidade das silhuetas com a malha base */
  update() {
    const isEligible = this.options.enabled && this.options.quality !== 'low';
    for (const entry of this.entries.values()) {
      const shouldBeVisible = isEligible && entry.mesh.visible;
      if (entry.hull.visible !== shouldBeVisible) {
        entry.hull.visible = shouldBeVisible;
      }
      // Casco irmão acompanha a transformação local da malha (animações, rodas do rover)
      if (entry.hull.parent !== entry.mesh) {
        if (entry.mesh.matrixAutoUpdate) entry.mesh.updateMatrix();
        entry.hull.matrix.copy(entry.mesh.matrix);
      }
    }
  }

  dispose() {
    for (const entry of this.entries.values()) {
      entry.hull.parent?.remove(entry.hull);
    }
    this.entries.clear();
    for (const mat of this.sharedMaterials.values()) {
      mat.dispose();
    }
    this.sharedMaterials.clear();
  }
}

// ============================================================================
// 3. DETECÇÃO DE BORDAS NA BASE POR PÓS-PROCESSAMENTO (NORMALS/DEPTH)
// ============================================================================

/**
 * Shader de extração de normal, profundidade e opacidade em uma única passada.
 * Armazena no buffer RGBA:
 *  - R: normal.x codificada (0..1)
 *  - G: normal.y codificada (0..1)
 *  - B: profundidade normalizada (0..1)
 *  - A: opacidade do material (preserva transparência do InteriorFader)
 */
interface NormalDepthUniforms {
  [name: string]: THREE.IUniform;
  uOpacity: THREE.IUniform<number>;
  uNear: THREE.IUniform<number>;
  uFar: THREE.IUniform<number>;
}

function createBaseNormalDepthMaterial(uniforms: NormalDepthUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vViewNormal;
      varying float vViewDepth;

      #include <common>
      #include <morphtarget_pars_vertex>
      #include <skinning_pars_vertex>

      void main() {
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>

        #include <begin_vertex>
        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <project_vertex>

        vViewNormal = normalize(transformedNormal);
        vViewDepth = -mvPosition.z;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uNear;
      uniform float uFar;

      varying vec3 vViewNormal;
      varying float vViewDepth;

      void main() {
        vec3 n = normalize(vViewNormal);
        float depth = clamp((vViewDepth - uNear) / (uFar - uNear), 0.0, 1.0);
        gl_FragColor = vec4(n.xy * 0.5 + 0.5, depth, uOpacity);
      }
    `,
  });
}

/**
 * Shader de pós-processamento (filtro de Roberts Cross modificado) para detecção de arestas.
 * Detecta descontinuidades angulares de superfície e degraus de profundidade,
 * modulando a intensidade da linha pela transparência da parede ou teto.
 */
interface EdgeUniforms {
  [name: string]: THREE.IUniform;
  tNormalDepth: THREE.IUniform<THREE.Texture | null>;
  uResolution: THREE.IUniform<THREE.Vector2>;
  uOutlineColor: THREE.IUniform<THREE.Color>;
  uOutlineStrength: THREE.IUniform<number>;
  uNormalThreshold: THREE.IUniform<number>;
  uDepthThreshold: THREE.IUniform<number>;
}

function createBaseEdgeMaterial(uniforms: EdgeUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tNormalDepth;
      uniform vec2 uResolution;
      uniform vec3 uOutlineColor;
      uniform float uOutlineStrength;
      uniform float uNormalThreshold;
      uniform float uDepthThreshold;

      varying vec2 vUv;

      void main() {
        vec2 texel = (1.0 / uResolution) * max(0.8, min(1.6, uOutlineStrength));

        // Amostragem em cruz (Roberts Cross de 4 direções diagonais)
        vec4 s1 = texture2D(tNormalDepth, vUv + vec2( texel.x,  texel.y));
        vec4 s2 = texture2D(tNormalDepth, vUv + vec2(-texel.x, -texel.y));
        vec4 s3 = texture2D(tNormalDepth, vUv + vec2( texel.x, -texel.y));
        vec4 s4 = texture2D(tNormalDepth, vUv + vec2(-texel.x,  texel.y));

        float maxOpacity = max(max(s1.a, s2.a), max(s3.a, s4.a));
        if (maxOpacity <= 0.001) {
          discard;
        }

        // Gradiente de normais
        vec2 normDiff1 = s1.xy - s2.xy;
        vec2 normDiff2 = s3.xy - s4.xy;
        float normDist = sqrt(dot(normDiff1, normDiff1) + dot(normDiff2, normDiff2));

        // Gradiente de profundidade
        float depthDiff1 = s1.z - s2.z;
        float depthDiff2 = s3.z - s4.z;
        float depthDist = sqrt(depthDiff1 * depthDiff1 + depthDiff2 * depthDiff2);

        // Descontinuidade de silhueta (aresta contra o solo marciano)
        float alphaDiff1 = abs(s1.a - s2.a);
        float alphaDiff2 = abs(s3.a - s4.a);
        float silhouette = max(alphaDiff1, alphaDiff2);

        float edgeNormal = step(uNormalThreshold, normDist);
        float edgeDepth = step(uDepthThreshold, depthDist);
        float edgeSilhouette = step(0.12, silhouette);

        float edge = max(max(edgeNormal, edgeDepth), edgeSilhouette);
        if (edge <= 0.001) {
          discard;
        }

        // A opacidade final acompanha a transparência da estrutura (InteriorFader)
        float alpha = edge * maxOpacity * min(1.0, uOutlineStrength * 0.95);
        gl_FragColor = vec4(uOutlineColor, alpha);
      }
    `,
  });
}

/**
 * Layer exclusiva das malhas da base no passe de normais/profundidade.
 * As malhas continuam na layer 0 (render normal); a câmera só olha esta layer durante o passe.
 */
export const BASE_OUTLINE_LAYER = 7;

export class BaseOutlineRenderer {
  private normalTarget: THREE.WebGLRenderTarget | null = null;
  private readonly ndUniforms: NormalDepthUniforms = {
    uOpacity: { value: 1.0 },
    uNear: { value: 0.1 },
    uFar: { value: 500.0 },
  };
  private readonly edgeUniforms: EdgeUniforms = {
    tNormalDepth: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uOutlineColor: { value: new THREE.Color('#0f141c') },
    uOutlineStrength: { value: 1.0 },
    uNormalThreshold: { value: 0.22 },
    uDepthThreshold: { value: 0.006 },
  };
  private readonly prevClearColor = new THREE.Color();
  /** callbacks originais de onBeforeRender, restaurados ao trocar de modelo */
  private readonly prevOnBeforeRender = new Map<THREE.Mesh, THREE.Mesh['onBeforeRender']>();
  private readonly normalDepthMaterial: THREE.ShaderMaterial;
  private readonly edgeMaterial: THREE.ShaderMaterial;
  private readonly quadScene: THREE.Scene;
  private readonly quadCamera: THREE.OrthographicCamera;
  private readonly baseMeshes: THREE.Mesh[] = [];
  private width = 1;
  private height = 1;
  private pixelRatio = 1;

  constructor() {
    this.normalDepthMaterial = createBaseNormalDepthMaterial(this.ndUniforms);
    this.edgeMaterial = createBaseEdgeMaterial(this.edgeUniforms);

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMesh = new THREE.Mesh(quadGeo, this.edgeMaterial);
    quadMesh.frustumCulled = false;
    this.quadScene.add(quadMesh);
  }

  getRegisteredMeshes(): readonly THREE.Mesh[] {
    return this.baseMeshes;
  }

  /** Registra o modelo da base marciana para extração de bordas arquitetônicas */
  setBaseModel(model: THREE.Object3D) {
    this.clearBaseModel();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.isOutlineHull) return;

      // Pula equipamentos que já recebem o casco invertido (painéis, nave, antenas)
      if (/_Solar_\d+$|_Nave$|Antena|_Folha(Inf|Sup)$/.test(mesh.name)) return;

      mesh.userData.isBaseOutlineMesh = true;
      mesh.layers.enable(BASE_OUTLINE_LAYER);

      // Passa a opacidade atual (InteriorFader) ao shader, preservando o callback anterior
      const prev = mesh.onBeforeRender;
      this.prevOnBeforeRender.set(mesh, prev);
      mesh.onBeforeRender = (renderer, scene, camera, geom, material, group) => {
        if (material === this.normalDepthMaterial) {
          const orig = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          this.ndUniforms.uOpacity.value =
            orig && typeof orig.opacity === 'number' ? orig.opacity : 1.0;
          // o mesmo material é reutilizado em sequência: força o reenvio do uniform
          (material as THREE.ShaderMaterial).uniformsNeedUpdate = true;
        }
        prev.call(mesh, renderer, scene, camera, geom, material, group);
      };

      this.baseMeshes.push(mesh);
    });
  }

  /** Desfaz o registro do modelo atual (layer e callbacks originais). */
  private clearBaseModel() {
    for (const mesh of this.baseMeshes) {
      mesh.layers.disable(BASE_OUTLINE_LAYER);
      const prev = this.prevOnBeforeRender.get(mesh);
      if (prev) mesh.onBeforeRender = prev;
      mesh.userData.isBaseOutlineMesh = undefined;
    }
    this.prevOnBeforeRender.clear();
    this.baseMeshes.length = 0;
  }

  setSize(width: number, height: number, pixelRatio = 1) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.pixelRatio = pixelRatio;

    const targetW = Math.max(1, Math.floor(this.width * this.pixelRatio));
    const targetH = Math.max(1, Math.floor(this.height * this.pixelRatio));

    if (
      !this.normalTarget ||
      this.normalTarget.width !== targetW ||
      this.normalTarget.height !== targetH
    ) {
      this.normalTarget?.dispose();
      this.normalTarget = new THREE.WebGLRenderTarget(targetW, targetH, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
      });
      this.edgeUniforms.tNormalDepth.value = this.normalTarget.texture;
      this.edgeUniforms.uResolution.value.set(targetW, targetH);
    }
  }

  updateOptions(options: OutlineOptions) {
    this.edgeUniforms.uOutlineColor.value.set(options.color);
    this.edgeUniforms.uOutlineStrength.value = options.strength;
  }

  /** Executa o passe de extração e desenha as arestas da base diretamente no canvas */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    if (!this.normalTarget || this.baseMeshes.length === 0) return;

    // Atualiza parâmetros de câmera no shader de profundidade
    const cam = camera as THREE.OrthographicCamera | THREE.PerspectiveCamera;
    if (typeof cam.near === 'number' && typeof cam.far === 'number' && cam.far > cam.near) {
      this.ndUniforms.uNear.value = cam.near;
      this.ndUniforms.uFar.value = cam.far;
    }

    // Guarda todo o estado do renderer/cena/câmera que o passe altera
    const prevRenderTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.getClearColor(this.prevClearColor);
    const prevClearAlpha = renderer.getClearAlpha();
    const prevOverride = scene.overrideMaterial;
    const prevBackground = scene.background;
    const prevLayerMask = camera.layers.mask;

    try {
      // 1. Uma única passada da cena, vendo só a layer da base, no buffer de normais/profundidade
      renderer.setRenderTarget(this.normalTarget);
      renderer.setClearColor(0x8080ff, 0.0);
      renderer.clear();
      renderer.autoClear = false;
      scene.overrideMaterial = this.normalDepthMaterial;
      scene.background = null;
      camera.layers.set(BASE_OUTLINE_LAYER);
      renderer.render(scene, camera);
    } finally {
      camera.layers.mask = prevLayerMask;
      scene.overrideMaterial = prevOverride;
      scene.background = prevBackground;
      renderer.setClearColor(this.prevClearColor, prevClearAlpha);
      renderer.setRenderTarget(prevRenderTarget);
    }

    // 2. Aplica o filtro de bordas com blending sobre a imagem da cena
    renderer.render(this.quadScene, this.quadCamera);
    renderer.autoClear = prevAutoClear;
  }

  dispose() {
    this.normalTarget?.dispose();
    this.normalTarget = null;
    this.clearBaseModel();
    this.normalDepthMaterial.dispose();
    this.edgeMaterial.dispose();
    for (const child of this.quadScene.children) {
      (child as THREE.Mesh).geometry?.dispose();
    }
  }
}

// ============================================================================
// 4. SISTEMA INTEGRADO DE OUTLINE (COORDENADOR GERAL)
// ============================================================================

export class OutlineSystem {
  private readonly hullManager: InvertedHullManager;
  private readonly baseRenderer: BaseOutlineRenderer;
  private options: OutlineOptions;
  private lastCostMs = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    initialOptions?: Partial<OutlineOptions>,
  ) {
    this.options = { ...DEFAULT_OUTLINE_OPTIONS, ...initialOptions };
    this.hullManager = new InvertedHullManager(this.options);
    this.baseRenderer = new BaseOutlineRenderer();
    this.baseRenderer.updateOptions(this.options);
    this.syncSize();
  }

  /** Atualiza as configurações de linha de contorno em tempo real */
  updateOptions(patch: Partial<OutlineOptions>) {
    this.options = { ...this.options, ...patch };
    this.hullManager.updateOptions(this.options);
    this.baseRenderer.updateOptions(this.options);
  }

  /** Atualiza perfil de qualidade gráfica e movimento reduzido */
  setQuality(quality: 'low' | 'medium' | 'high', reducedMotion = false) {
    this.updateOptions({ quality, reducedMotion });
    this.syncSize();
  }

  /** Registra a base marciana para o contorno por pós-processamento */
  initBase(model: THREE.Object3D) {
    this.baseRenderer.setBaseModel(model);

    // Equipamentos fixos da base recebem casco invertido imediato
    model.traverse((o) => {
      if (/_Solar_\d+$|_Nave$|Antena/.test(o.name)) {
        this.hullManager.addObject(o, 'equipment');
      }
    });
  }

  /** Registra objetos dinâmicos móveis (astronautas e veículos) */
  addDynamicObject(
    root: THREE.Object3D,
    category: 'astronaut' | 'vehicle' | 'equipment' = 'equipment',
  ) {
    this.hullManager.addObject(root, category);
  }

  /** Remove um objeto dinâmico rastreado */
  removeDynamicObject(root: THREE.Object3D) {
    this.hullManager.removeObject(root);
  }

  /** Redimensiona o render target acompanhando a resolução da tela */
  syncSize() {
    if (!this.renderer?.domElement) return;
    const w = this.renderer.domElement.clientWidth || 1;
    const h = this.renderer.domElement.clientHeight || 1;
    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const dpr =
      this.options.quality === 'low'
        ? 0.75
        : this.options.quality === 'medium'
          ? Math.min(devicePixelRatio, 1.25)
          : Math.min(devicePixelRatio, 1.75);

    this.baseRenderer.setSize(w, h, dpr);
  }

  /**
   * Chamado no loop de renderização do BaseViewer.
   * Executa a atualização de cascos e o pós-processamento das bordas da base.
   */
  render() {
    if (!this.options.enabled || this.options.quality === 'low') {
      this.hullManager.update();
      this.lastCostMs = 0;
      return;
    }

    const t0 = performance.now();
    this.hullManager.update();
    this.baseRenderer.render(this.renderer, this.scene, this.camera);
    this.lastCostMs = performance.now() - t0;
  }

  /** Custo estimado da última passada em milissegundos por quadro */
  get costMs(): number {
    return this.lastCostMs;
  }

  dispose() {
    this.hullManager.dispose();
    this.baseRenderer.dispose();
  }
}
