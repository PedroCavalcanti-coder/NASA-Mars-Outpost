import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from './palette';

// Original low-poly scene. Unlike the isometric game, this camera looks up from the pad.
const mat = (color: number, emissive = 0) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive,
    roughness: 0.86,
    metalness: 0.08,
    flatShading: true,
  });
const smooth = (a: number, b: number, t: number) => THREE.MathUtils.smoothstep(t, a, b);
type Puff = { age: number; life: number; x: number; z: number; angle: number; size: number };

export class LaunchScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 350);
  private rocket = new THREE.Group();
  private flames = new THREE.Group();
  private glow = new THREE.PointLight(0xffa348, 0, 25, 1.5);
  private smoke: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private dummy = new THREE.Object3D();
  private launchAt: number | null = null;
  private raf = 0;
  private previous = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private materials: THREE.Material[] = [];
  private baseCamera = new THREE.Vector3(14, 6.3, 27);
  private halo: THREE.Mesh;
  private hovering = false;
  private finished = false;
  private elapsed = 0;
  private rng = 179;

  constructor(
    private container: HTMLElement,
    private target: HTMLButtonElement,
    private onFlight: (progress: number) => void,
    private onComplete: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.FogExp2(0x8fb8c2, 0.006);
    this.scene.add(new THREE.HemisphereLight(0xb4d6ff, 0x657957, 2.3));
    const sun = new THREE.DirectionalLight(0xffdfb9, 4);
    sun.position.set(-12, 14, 11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 18, bottom: -12, far: 70 });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8bb8ef, 2.7);
    rim.position.set(7, 9, -10);
    this.scene.add(rim);
    const ivory = mat(0xfff0de),
      gray = mat(0x9baac8),
      dark = mat(PALETTE.dark),
      orange = mat(0xee7725),
      navy = mat(PALETTE.solar),
      metal = mat(0x667eaa),
      ground = mat(0x47764d),
      concrete = mat(0xa4a5b4),
      lamp = mat(0x82eeff, 0x28c8ff);
    this.materials.push(ivory, gray, dark, orange, navy, metal, ground, concrete, lamp);
    const site = new THREE.Group();
    this.scene.add(site);
    this.box(site, ground, [240, 0.8, 220], [0, -1.15, -35]);
    this.makeLandscape(site);
    // Raised platform, hazard markings and blue guidance lights.
    const yellow = mat(0xffb829);
    this.materials.push(yellow);
    this.box(site, concrete, [12, 0.3, 9], [0, -0.85, 0]);
    for (const x of [-4, 4]) {
      this.box(site, yellow, [2.2, 0.4, 0.16], [x, -0.34, 4.03]);
      for (let i = 0; i < 4; i++)
        this.beam(
          site,
          dark,
          [x - 0.9 + i * 0.5, -0.54, 4.13],
          [x - 0.65 + i * 0.5, -0.14, 4.13],
          0.15,
        );
    }
    for (const x of [-4.8, 4.8]) {
      this.box(site, metal, [0.55, 0.6, 0.5], [x, 0.05, 2.6]);
      this.box(site, lamp, [0.25, 0.33, 0.08], [x, 0.1, 2.88]);
    }
    this.box(site, concrete, [11, 0.7, 8], [0, -0.4, 0]);
    this.box(site, dark, [7, 0.22, 6], [0, 0.05, 0]);
    this.box(site, metal, [3, 0.28, 8], [0, 0.25, -0.8]);
    this.box(site, dark, [2.1, 0.3, 8], [0, 0.3, -0.8]);
    for (const x of [-4.5, 4.5]) {
      for (let i = 0; i < 9; i++)
        this.box(site, i % 2 ? orange : ivory, [0.2, 0.1, 0.4], [x, 0, i * 0.8 - 3]);
      for (const z of [-3.4, 3.4]) this.box(site, lamp, [0.24, 0.13, 0.24], [x, 0.12, z]);
    }
    for (const x of [-2, 2]) {
      this.box(site, metal, [0.65, 1.05, 1.5], [x, 0.7, -0.6]);
      this.box(site, orange, [0.15, 0.25, 1.55], [x, 1.1, -0.6]);
    }
    // Lattice tower, railings, lightning mast and service gantry.
    const tx = -3.45,
      tz = -1.8;
    for (const x of [-0.8, 0.8])
      for (const z of [-0.8, 0.8]) this.box(site, gray, [0.14, 9.4, 0.14], [tx + x, 4.3, tz + z]);
    for (let level = 0; level < 6; level++) {
      const y = level * 1.5;
      this.box(site, metal, [1.95, 0.18, 1.95], [tx, y, tz]);
      for (const z of [-0.8, 0.8]) {
        this.beam(site, gray, [tx - 0.8, y, tz + z], [tx + 0.8, y + 1.5, tz + z], 0.08);
        this.beam(site, metal, [tx + 0.8, y, tz + z], [tx - 0.8, y + 1.5, tz + z], 0.065);
      }
      this.beam(site, gray, [tx - 0.8, y, tz - 0.8], [tx - 0.8, y + 1.5, tz + 0.8], 0.08);
      this.box(site, orange, [2.05, 0.07, 0.08], [tx, y + 0.65, tz + 0.95]);
      this.box(site, lamp, [0.12, 0.12, 0.12], [tx + 0.82, y + 0.3, tz + 0.82]);
    }
    this.box(site, gray, [0.11, 3.1, 0.11], [tx - 0.3, 10.45, tz]);
    this.box(site, lamp, [0.15, 0.18, 0.15], [tx - 0.3, 12, tz]);
    this.box(site, gray, [2.6, 0.14, 0.7], [-1.65, 7, -1.8]);
    this.box(site, orange, [2.65, 0.07, 0.08], [-1.65, 7.45, -1.42]);
    for (let i = 0; i < 3; i++) {
      const x = 6.5 + i * 2.05;
      this.box(site, metal, [1.9, 0.22, 2.2], [x, -0.55, -2.5]);
      this.cylinder(site, gray, 0.8, 0.8, 2.8, [x, 0.92, -2.5]);
      this.cylinder(site, ivory, 0.14, 0.8, 0.6, [x, 2.62, -2.5]);
      this.box(site, orange, [0.24, 1.7, 0.13], [x, 0.9, -1.7]);
      this.box(site, dark, [0.8, 0.15, 0.8], [x, -0.45, -2.5]);
    }
    this.box(site, metal, [5.8, 0.35, 0.35], [8.55, 0.1, -3.2]);
    this.batch(site);
    // Swept-wing explorer: ivory orbiter, warm external tank and twin boosters.
    this.scene.add(this.rocket);
    this.cylinder(this.rocket, orange, 0.78, 0.78, 5.9, [0, 4.35, -0.88]);
    this.cylinder(this.rocket, orange, 0, 0.78, 1.6, [0, 8.1, -0.88]);
    for (const y of [2, 3.8, 6.8]) this.cylinder(this.rocket, gray, 0.8, 0.8, 0.08, [0, y, -0.88]);
    this.cylinder(this.rocket, ivory, 0.59, 0.7, 4.85, [0, 4.8, 0.34]);
    this.cylinder(this.rocket, ivory, 0.17, 0.59, 1.4, [0, 7.93, 0.34]);
    this.cylinder(this.rocket, dark, 0, 0.17, 0.52, [0, 8.89, 0.34]);
    this.cylinder(this.rocket, dark, 0.61, 0.63, 0.17, [0, 7.18, 0.34]);
    this.box(this.rocket, navy, [0.62, 0.28, 0.1], [0, 7.65, 0.87]);
    this.box(this.rocket, gray, [0.65, 0.06, 0.12], [0, 7.84, 0.89]);
    this.box(this.rocket, orange, [0.34, 0.38, 0.08], [0, 5.8, 0.99]);
    this.box(this.rocket, ivory, [0.08, 0.24, 0.1], [0, 5.8, 1.045]);
    this.box(this.rocket, ivory, [0.2, 0.07, 0.1], [0, 5.8, 1.045]);
    for (const side of [-1, 1]) {
      const wing = new THREE.Shape();
      wing.moveTo(side * 0.48, 5.4);
      wing.lineTo(side * 2.16, 2.6);
      wing.lineTo(side * 1.9, 2.35);
      wing.lineTo(side * 0.44, 2.7);
      wing.closePath();
      this.mesh(
        this.rocket,
        new THREE.ExtrudeGeometry(wing, { depth: 0.16, bevelEnabled: false }),
        ivory,
      ).position.z = 0.22;
      this.beam(this.rocket, dark, [side * 0.53, 5.3, 0.4], [side * 2.05, 2.65, 0.4], 0.095);
      this.box(this.rocket, orange, [0.36, 0.12, 0.2], [side * 1.5, 2.68, 0.4]);
      this.cylinder(this.rocket, ivory, 0.31, 0.34, 4.9, [side * 1.23, 4.15, -0.65]);
      this.cylinder(this.rocket, ivory, 0, 0.31, 1.05, [side * 1.23, 7.12, -0.65]);
      for (const y of [2.05, 3, 5.85])
        this.cylinder(this.rocket, dark, 0.35, 0.35, 0.13, [side * 1.23, y, -0.65]);
      this.cylinder(this.rocket, orange, 0.35, 0.35, 0.26, [side * 1.23, 1.8, -0.65]);
      this.cylinder(this.rocket, dark, 0.23, 0.4, 0.55, [side * 1.23, 1.4, -0.65]);
    }
    for (const x of [-0.32, 0.32])
      this.cylinder(this.rocket, dark, 0.19, 0.29, 0.5, [x, 2.15, 0.35]);
    this.batch(this.rocket);
    this.rocket.add(this.flames);
    const outer = new THREE.MeshBasicMaterial({
        color: 0xff7630,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
      inner = new THREE.MeshBasicMaterial({ color: 0xffefc6, toneMapped: false });
    this.materials.push(outer, inner);
    for (const position of [
      [-1.23, 1.15, -0.65],
      [1.23, 1.15, -0.65],
      [-0.32, 1.92, 0.35],
      [0.32, 1.92, 0.35],
    ]) {
      const jet = new THREE.Group();
      jet.position.fromArray(position);
      for (const [radius, length, material] of [
        [0.36, 3.2, outer],
        [0.23, 2.5, inner],
      ] as const) {
        const flame = this.mesh(jet, new THREE.ConeGeometry(radius, length, 7), material);
        flame.rotation.z = Math.PI;
        flame.position.y = -length / 2;
      }
      this.flames.add(jet);
    }
    this.flames.visible = false;
    this.glow.position.set(0, 1.4, 0);
    this.scene.add(this.glow);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf8d3a0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    this.materials.push(haloMat);
    this.halo = this.mesh(this.scene, new THREE.RingGeometry(2.35, 2.39, 64), haloMat);
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.44;
    const smokeMat = mat(0xc5bbb6);
    this.materials.push(smokeMat);
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), smokeMat, 100);
    this.smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.smoke.frustumCulled = false;
    for (let i = 0; i < 100; i++) {
      this.puffs.push({ age: -i * 0.035, life: 4.5, x: 0, z: 0, angle: 0, size: 0 });
      this.smoke.setColorAt(
        i,
        new THREE.Color().setHSL(0.07 + this.random() * 0.04, 0.13, 0.53 + this.random() * 0.24),
      );
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.smoke.setMatrixAt(i, this.dummy.matrix);
    }
    this.scene.add(this.smoke);
    this.makeStars();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    target.addEventListener('pointerenter', this.enter);
    target.addEventListener('pointerleave', this.leave);
    target.addEventListener('focus', this.enter);
    target.addEventListener('blur', this.leave);
    document.addEventListener('visibilitychange', this.visibility);
    this.raf = requestAnimationFrame(this.frame);
  }
  setReducedMotion(reduced: boolean) {
    if (this.launchAt === null) this.reduced = reduced;
  }
  setQuality(quality: 'low' | 'medium' | 'high' | 'standard') {
    const isLow = quality === 'low';
    const isHigh = quality === 'high';
    this.renderer.shadowMap.enabled = !isLow;
    this.renderer.setPixelRatio(isLow ? 1 : isHigh ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1.5));
    this.resize();
  }
  setAntialiasing(enabled: boolean) {
    this.renderer.setPixelRatio(enabled ? Math.min(devicePixelRatio, 1.75) : 1);
    this.resize();
  }
  setPostProcessing(enabled: boolean) {
    this.renderer.toneMapping = enabled ? THREE.ACESFilmicToneMapping : THREE.LinearToneMapping;
  }
  private makeLandscape(site: THREE.Group) {
    const grass = mat(0x679153),
      meadow = mat(0x557e48),
      hills = mat(0x427c5b),
      distantHills = mat(0x548a8a),
      rock = mat(0x79857b),
      bark = mat(0x6a5943),
      leaves = mat(0x38734c),
      lightLeaves = mat(0x5b8e52),
      water = mat(0x467fa3),
      sand = mat(0xc0b58b),
      asphalt = mat(0x525f6a),
      marking = mat(0xd4d8c7),
      cloud = mat(0xe9f1f7);
    this.materials.push(
      grass,
      meadow,
      hills,
      distantHills,
      rock,
      bark,
      leaves,
      lightLeaves,
      water,
      sand,
      asphalt,
      marking,
      cloud,
    );

    // A coastal spaceport on Earth. The pad and launch hardware keep their layout.
    this.box(site, water, [240, 0.08, 48], [0, -0.69, -74]);
    this.box(site, sand, [240, 0.04, 3], [0, -0.71, -49]);
    for (let i = 0; i < 13; i++) {
      const hill = this.mesh(
        site,
        new THREE.IcosahedronGeometry(1, 1),
        i % 3 ? hills : distantHills,
      );
      const height = 3 + this.random() * 4;
      hill.position.set((i - 6) * 16, -1.6, -42 - this.random() * 16);
      hill.scale.set(10 + this.random() * 6, height, 6 + this.random() * 4);
      hill.rotation.y = i * 0.7;
    }

    // Faceted lawns and a service road keep the launch area clear.
    for (let i = 0; i < 24; i++) {
      const patch = this.mesh(
        site,
        new THREE.CircleGeometry(2 + this.random() * 6, 6),
        i % 2 ? grass : meadow,
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = this.random() * Math.PI;
      patch.position.set((this.random() - 0.5) * 90, -0.742, (this.random() - 0.5) * 65);
    }
    this.box(site, asphalt, [4.8, 0.06, 40], [0, -0.69, 24]);
    for (let i = 0; i < 9; i++) this.box(site, marking, [0.12, 0.015, 1.4], [0, -0.65, 7 + i * 4]);

    // Small stands of rounded cartoon trees sit beyond the safety perimeter.
    for (let i = 0; i < 34; i++) {
      const x = (this.random() - 0.5) * 78,
        z = -12 - this.random() * 23,
        height = 1.6 + this.random() * 2;
      this.cylinder(site, bark, 0.11, 0.18, height * 0.55, [x, -0.75 + height * 0.275, z]);
      for (let crown = 0; crown < 2; crown++) {
        const canopy = this.mesh(
          site,
          new THREE.IcosahedronGeometry(1, 1),
          crown ? lightLeaves : leaves,
        );
        canopy.position.set(x + crown * 0.35, -0.75 + height * (crown ? 0.85 : 0.65), z);
        canopy.scale.set(height * 0.4, height * 0.45, height * 0.4);
        canopy.rotation.y = i * 0.8;
      }
    }
    for (let i = 0; i < 25; i++) {
      const x = (this.random() - 0.5) * 85,
        z = (this.random() - 0.5) * 65;
      if (Math.abs(x) < 13 && z > -7) continue;
      const boulder = this.mesh(
        site,
        new THREE.IcosahedronGeometry(0.2 + this.random() * 0.5, 0),
        rock,
      );
      boulder.position.set(x, -0.68, z);
      boulder.scale.set(1.4, 0.65, 1);
      boulder.rotation.y = this.random() * Math.PI;
    }

    // Puffy low-poly clouds share the scene's light and perspective.
    for (const [x, y, z, size] of [
      [-32, 14, -53, 1.6],
      [-9, 18, -62, 1.9],
      [17, 12, -47, 1.3],
      [40, 17, -60, 1.7],
    ] as const) {
      for (let puff = 0; puff < 5; puff++) {
        const piece = this.mesh(site, new THREE.IcosahedronGeometry(1, 1), cloud);
        piece.position.set(x + (puff - 2) * size * 1.3, y + (puff % 2) * size * 0.5, z);
        piece.scale.set(size * 1.6, size * (puff % 2 ? 1.05 : 0.65), size);
        piece.castShadow = false;
      }
    }
  }
  private random() {
    this.rng = (this.rng * 1664525 + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }
  private mesh<G extends THREE.BufferGeometry, M extends THREE.Material>(
    parent: THREE.Object3D,
    geometry: G,
    material: M,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private box(
    parent: THREE.Object3D,
    material: THREE.Material,
    dimensions: [number, number, number],
    position: [number, number, number],
  ) {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(...dimensions), material);
    mesh.position.fromArray(position);
    return mesh;
  }
  private cylinder(
    parent: THREE.Object3D,
    material: THREE.Material,
    top: number,
    bottom: number,
    height: number,
    position: [number, number, number],
  ) {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(top, bottom, height, 8), material);
    mesh.position.fromArray(position);
    return mesh;
  }
  private beam(
    parent: THREE.Object3D,
    material: THREE.Material,
    a: number[],
    b: number[],
    width: number,
  ) {
    const from = new THREE.Vector3().fromArray(a),
      to = new THREE.Vector3().fromArray(b);
    const mesh = this.mesh(
      parent,
      new THREE.BoxGeometry(width, from.distanceTo(to), width),
      material,
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
  }
  private batch(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
      geometry.deleteAttribute('uv');
      const vertices = geometry.index ? geometry.toNonIndexed() : geometry;
      if (vertices !== geometry) geometry.dispose();
      const bucket = buckets.get(child.material) ?? [];
      bucket.push(vertices);
      buckets.set(child.material, bucket);
      child.geometry.dispose();
    });
    group.clear();
    for (const [material, geometries] of buckets) {
      const merged = mergeGeometries(geometries);
      if (merged) this.mesh(group, merged, material);
      for (const geometry of geometries) geometry.dispose();
    }
  }
  private makeStars() {
    const positions = [],
      colors = [];
    for (let i = 0; i < 65; i++) {
      positions.push(
        (this.random() - 0.5) * 200,
        15 + this.random() * 85,
        -80 - this.random() * 35,
      );
      const l = 0.35 + this.random() * 0.5;
      colors.push(l, l * 0.96, l * 0.87);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.19,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      fog: false,
    });
    this.materials.push(material);
    this.scene.add(new THREE.Points(geometry, material));
  }
  private resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    const mobile = w < 760;
    this.camera.aspect = w / h;
    this.camera.fov = mobile ? 43 : 36;
    this.baseCamera.set(mobile ? 16 : 12.5, mobile ? 2.8 : 3.7, mobile ? 34 : 25);
    if (mobile && w / h < 0.6) this.baseCamera.multiplyScalar(0.85);
    this.camera.setViewOffset(w, h, mobile ? 0 : -w * 0.18, mobile ? h * 0.14 : 0, w, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.finished) this.renderer.render(this.scene, this.camera);
  }
  private enter = () => {
    this.hovering = true;
  };
  private leave = () => {
    this.hovering = false;
  };
  private visibility = () => {
    this.previous = 0;
    if (!document.hidden && !this.finished && !this.disposed) {
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.frame);
    }
  };
  launch() {
    if (this.launchAt === null) {
      this.launchAt = this.elapsed;
      this.target.disabled = true;
    }
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = this.previous && !document.hidden ? Math.min((now - this.previous) / 1000, 0.15) : 0;
    this.previous = now;
    if (document.hidden) return;
    this.elapsed += dt;
    const flying = this.launchAt !== null,
      t = this.launchAt === null ? 0 : this.elapsed - this.launchAt;
    const duration = this.reduced ? 1.4 : 6.3,
      lift = flying && !this.reduced ? Math.max(0, t - 0.8) ** 2 * 0.95 : 0;
    this.rocket.position.y = lift;
    this.rocket.rotation.z = flying && !this.reduced ? -smooth(2.5, 6, t) * 0.1 : 0;
    const follow = Math.max(0, lift - 2.5) * 0.62;
    this.camera.position.copy(this.baseCamera);
    this.camera.position.y += follow;
    this.camera.lookAt(0, 4.6 + follow, 0);
    this.halo.visible = !flying;
    (this.halo.material as THREE.MeshBasicMaterial).opacity = this.hovering ? 0.85 : 0.28;
    this.halo.scale.setScalar(this.reduced ? 1 : 1 + Math.sin(this.elapsed * 1.6) * 0.035);
    if (flying) {
      this.flames.visible = true;
      this.flames.scale.y = smooth(0, 0.6, t) * (this.reduced ? 1 : 0.94 + Math.sin(t * 25) * 0.06);
      this.glow.intensity = 80 * smooth(0, 0.7, t);
      this.glow.position.y = 1 + lift;
      this.smokePuffs(Math.min(dt, 0.15), lift, t);
      this.onFlight(Math.min(1, t / duration));
      if (t >= duration && !this.finished) {
        this.finished = true;
        this.onComplete();
      }
    }
    this.renderer.render(this.scene, this.camera);
    if (!flying) this.positionTarget();
    this.container.dataset.sceneReady = 'true';
    this.container.dataset.drawCalls = String(this.renderer.info.render.calls);
    if (!this.finished) this.raf = requestAnimationFrame(this.frame);
  };
  private smokePuffs(dt: number, lift: number, t: number) {
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      if (!p) continue;
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age > p.life || p.size === 0) {
        p.age = 0;
        p.life = 3.4 + this.random() * 1.8;
        p.angle = this.random() * Math.PI * 2;
        p.x = (this.random() - 0.5) * 2;
        p.z = (this.random() - 0.5) * 1.6;
        p.size = 0.5 + this.random() * 0.7;
      }
      const age = p.age,
        scale = p.size * (0.5 + age * 0.85) * (1 - smooth(0.72, 1, age / p.life));
      this.dummy.position.set(
        p.x + Math.cos(p.angle) * age * 2.3,
        0.1 + age * 0.35 + (t > 2.4 ? lift * 0.32 : 0),
        p.z + Math.sin(p.angle) * age * 1.8,
      );
      this.dummy.scale.set(scale, scale * 0.78, scale);
      this.dummy.rotation.set(i * 2.7, i * 1.4, i * 0.7);
      this.dummy.updateMatrix();
      this.smoke.setMatrixAt(i, this.dummy.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
  }
  private positionTarget() {
    const top = new THREE.Vector3(0, 9.3, 0).project(this.camera),
      bottom = new THREE.Vector3(0, 1.5, 0).project(this.camera),
      left = new THREE.Vector3(-2.2, 4, 0).project(this.camera),
      right = new THREE.Vector3(2.2, 4, 0).project(this.camera);
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    Object.assign(this.target.style, {
      left: `${((left.x + 1) / 2) * w - 18}px`,
      top: `${((1 - top.y) / 2) * h - 15}px`,
      width: `${Math.max(90, ((right.x - left.x) / 2) * w + 36)}px`,
      height: `${Math.max(160, ((top.y - bottom.y) / 2) * h + 30)}px`,
    });
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.visibility);
    this.target.removeEventListener('pointerenter', this.enter);
    this.target.removeEventListener('pointerleave', this.leave);
    this.target.removeEventListener('focus', this.enter);
    this.target.removeEventListener('blur', this.leave);
    const geometries = new Set<THREE.BufferGeometry>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points)
        geometries.add(object.geometry);
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of new Set(this.materials)) material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
