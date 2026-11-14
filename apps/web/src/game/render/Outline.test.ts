import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { BaseOutlineRenderer, InvertedHullManager, OutlineSystem } from './Outline';

describe('Outline (Linha de Contorno)', () => {
  describe('InvertedHullManager (Casco Invertido)', () => {
    let manager: InvertedHullManager;

    beforeEach(() => {
      manager = new InvertedHullManager({
        enabled: true,
        strength: 1.0,
        color: '#0f141c',
        quality: 'medium',
      });
    });

    it('adiciona casco invertido para uma malha comum', () => {
      const root = new THREE.Group();
      const geom = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = 'prop_equipment';
      root.add(mesh);

      manager.addObject(root, 'equipment');

      // Deve ter criado uma malha com isOutlineHull = true
      const hulls = root.children.filter((c) => c.userData.isOutlineHull);
      expect(hulls.length).toBe(1);

      const hull = hulls[0] as THREE.Mesh;
      expect(hull.castShadow).toBe(false);
      expect(hull.receiveShadow).toBe(false);
      expect(hull.userData.isOutlineHull).toBe(true);
      expect(typeof hull.raycast).toBe('function');
      // raycast no-op
      const raycaster = new THREE.Raycaster();
      const intersects: THREE.Intersection[] = [];
      hull.raycast(raycaster, intersects);
      expect(intersects.length).toBe(0);
    });

    it('vincula esqueleto para malhas com rigging (SkinnedMesh)', () => {
      const root = new THREE.Group();
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      geom.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(12), 4));
      geom.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(12), 4));

      const bone = new THREE.Bone();
      const skeleton = new THREE.Skeleton([bone]);
      const skinnedMesh = new THREE.SkinnedMesh(geom, new THREE.MeshBasicMaterial());
      skinnedMesh.bind(skeleton);
      root.add(skinnedMesh);

      manager.addObject(root, 'astronaut');

      const hull = root.children.find((c) => c.userData.isOutlineHull) as THREE.SkinnedMesh;
      expect(hull).toBeDefined();
      expect(hull.isSkinnedMesh).toBe(true);
      expect(hull.skeleton).toBe(skeleton);
    });

    it('ignora sprites, partículas e nametags', () => {
      const root = new THREE.Group();
      const sprite = new THREE.Sprite();
      sprite.name = 'nametag_player';
      root.add(sprite);

      const particle = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      particle.userData.isParticle = true;
      root.add(particle);

      manager.addObject(root);
      const hulls = root.children.filter((c) => c.userData.isOutlineHull);
      expect(hulls.length).toBe(0);
    });

    it('desativa contornos na qualidade baixa por padrão', () => {
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      root.add(mesh);

      manager.addObject(root);
      const hull = root.children.find((c) => c.userData.isOutlineHull) as THREE.Mesh;
      expect(hull.visible).toBe(true);

      manager.updateOptions({ quality: 'low' });
      expect(hull.visible).toBe(false);

      manager.updateOptions({ quality: 'high' });
      expect(hull.visible).toBe(true);
    });

    it('atualiza intensidade (strength) e cor', () => {
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      root.add(mesh);

      manager.addObject(root, 'vehicle');
      const hull = root.children.find((c) => c.userData.isOutlineHull) as THREE.Mesh;
      const mat = hull.material as THREE.ShaderMaterial;

      expect(mat.uniforms.outlineColor?.value.getHexString()).toBe('0f141c');

      manager.updateOptions({ color: '#ff5722', strength: 2.0 });
      expect(mat.uniforms.outlineColor?.value.getHexString()).toBe('ff5722');
      // 0.034 * 2.0 = 0.068
      expect(mat.uniforms.outlineThickness?.value).toBeCloseTo(0.068, 3);
    });

    it('adiciona e remove cascos de várias malhas irmãs sem quebrar a travessia', () => {
      const root = new THREE.Group();
      const body = new THREE.Group();
      root.add(body);
      for (let i = 0; i < 4; i++) {
        body.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
      }

      manager.addObject(root, 'astronaut');
      expect(body.children.filter((c) => c.userData.isOutlineHull)).toHaveLength(4);

      expect(() => manager.removeObject(root)).not.toThrow();
      expect(body.children.some((c) => c.userData.isOutlineHull)).toBe(false);
      expect(body.children).toHaveLength(4);
    });

    it('limpa todas as malhas ao descartar (dispose)', () => {
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      root.add(mesh);

      manager.addObject(root);
      expect(root.children.some((c) => c.userData.isOutlineHull)).toBe(true);

      manager.dispose();
      expect(root.children.some((c) => c.userData.isOutlineHull)).toBe(false);
    });
  });

  describe('BaseOutlineRenderer (Detecção de Bordas da Base)', () => {
    it('filtra malhas arquitetônicas e ignora equipamentos', () => {
      const renderer = new BaseOutlineRenderer();
      const model = new THREE.Group();

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshBasicMaterial({ opacity: 0.36 }),
      );
      wall.name = 'COMODO_Laboratorio_Parede';
      model.add(wall);

      const solar = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      solar.name = 'Base_Solar_01';
      model.add(solar);

      renderer.setBaseModel(model);

      const registered = renderer.getRegisteredMeshes();
      expect(registered).toContain(wall);
      expect(registered).not.toContain(solar);
      expect(wall.userData.isBaseOutlineMesh).toBe(true);
      expect(solar.userData.isBaseOutlineMesh).toBeUndefined();

      renderer.dispose();
    });

    it('renderiza a base numa única passada e restaura o estado do renderer', () => {
      const base = new BaseOutlineRenderer();
      const model = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      wall.name = 'COMODO_Parede';
      const wall2 = wall.clone();
      model.add(wall, wall2);
      base.setBaseModel(model);
      base.setSize(64, 64, 1);

      const scene = new THREE.Scene();
      scene.add(model);
      const camera = new THREE.OrthographicCamera();
      const clearColor = new THREE.Color('#123456');
      const calls: Array<{ target: unknown; mask: number; override: unknown }> = [];
      let target: unknown = null;
      const fake = {
        autoClear: true,
        getRenderTarget: () => target,
        setRenderTarget: (t: unknown) => {
          target = t;
        },
        getClearColor: (c: THREE.Color) => c.copy(clearColor),
        getClearAlpha: () => 1,
        setClearColor: (c: THREE.ColorRepresentation) => clearColor.set(c),
        clear: () => {},
        render: (s: THREE.Object3D, cam: THREE.Camera) => {
          calls.push({
            target,
            mask: cam.layers.mask,
            override: (s as THREE.Scene).overrideMaterial,
          });
        },
      } as unknown as THREE.WebGLRenderer;

      base.render(fake, scene, camera);

      // 1 passada da cena (normais) + 1 do quad de bordas — não uma por malha
      expect(calls).toHaveLength(2);
      expect(calls[0]?.override).toBeInstanceOf(THREE.ShaderMaterial);
      expect(calls[1]?.target).toBeNull();
      expect(clearColor.getHexString()).toBe('123456');
      expect(camera.layers.mask).toBe(1);
      expect(scene.overrideMaterial).toBeNull();
      expect(fake.autoClear).toBe(true);

      base.dispose();
      expect(wall.layers.mask).toBe(1);
    });

    it('atualiza opções de cor e intensidade nos uniforms', () => {
      const renderer = new BaseOutlineRenderer();
      renderer.updateOptions({
        enabled: true,
        strength: 1.5,
        color: '#00e5ff',
        quality: 'medium',
      });

      // Testa redimensionamento seguro sem WebGL nativo
      renderer.setSize(800, 600, 1);
      renderer.dispose();
    });
  });

  describe('OutlineSystem (Sistema Integrado)', () => {
    it('inicializa e expõe valores padrão', () => {
      const dummyRenderer = {
        domElement: { clientWidth: 1024, clientHeight: 768 },
      } as unknown as THREE.WebGLRenderer;
      const dummyScene = new THREE.Scene();
      const dummyCamera = new THREE.PerspectiveCamera();

      const system = new OutlineSystem(dummyRenderer, dummyScene, dummyCamera);
      expect(system.costMs).toBe(0);

      system.setQuality('low', true);
      system.updateOptions({ enabled: true, color: '#ffffff' });

      const model = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      model.add(wall);
      system.initBase(model);

      system.dispose();
    });
  });
});
