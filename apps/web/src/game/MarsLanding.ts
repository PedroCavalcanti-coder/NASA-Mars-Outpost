import * as THREE from 'three';

type Spark = {
  angle: number;
  radius: number;
  speed: number;
  age: number;
  drift: number;
};

export class MarsLanding {
  readonly scene = new THREE.Scene();
  private dust: THREE.InstancedMesh;
  private shadow: THREE.Mesh;
  private capsule = new THREE.Group();
  private dummy = new THREE.Object3D();
  private materials: THREE.Material[] = [];

  // Paraquedas Supersônico Físico & Dinâmico
  private parachuteGroup = new THREE.Group();
  private canopyMesh: THREE.Mesh;
  private canopyGeom: THREE.BufferGeometry;
  private canopyPosAttr: THREE.BufferAttribute;
  private linesMesh: THREE.LineSegments;
  private linesGeom: THREE.BufferGeometry;
  private linesPosAttr: THREE.BufferAttribute;
  private apexDrogue: THREE.Mesh;

  // Efeitos de Reentrada Hipersônica & Plasma
  private plasmaGroup = new THREE.Group();
  private plasmaSheath: THREE.Mesh;
  private outerSheath: THREE.Mesh;
  private bowShock: THREE.Mesh;
  private bowMat: THREE.MeshBasicMaterial;
  private coneMat: THREE.MeshBasicMaterial;
  private outerConeMat: THREE.MeshBasicMaterial;
  private plasmaLight: THREE.PointLight;
  private sparks: THREE.InstancedMesh;
  private sparkData: Spark[] = [];
  private heatshieldMaterial: THREE.MeshStandardMaterial;

  constructor(rocket: THREE.Group, flames: THREE.Group) {
    rocket.removeFromParent();
    flames.visible = false;

    // Atmosfera marciana
    this.scene.background = new THREE.Color(0x9d6c64);
    this.scene.fog = new THREE.FogExp2(0x9d6c64, 0.009);
    this.scene.add(new THREE.HemisphereLight(0xf6d4bc, 0x60362c, 2.6));
    const sun = new THREE.DirectionalLight(0xffd5a0, 3.5);
    sun.position.set(-25, 18, 12);
    this.scene.add(sun);

    // Solo marciano e relevo
    const ground = this.material(0xb8613e);
    const hill = this.material(0x974d3d);
    const rock = this.material(0x7b4034);
    const sand = this.material(0xd18a5a);

    const soil = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), ground);
    soil.rotation.x = -Math.PI / 2;
    this.scene.add(soil);

    for (let i = 0; i < 28; i++) {
      const angle = i * 2.399;
      const radius = 38 + (i % 5) * 13;
      const mesa = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hill);
      mesa.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      mesa.scale.set(12 + (i % 3) * 5, 4 + (i % 5) * 2, 10 + (i % 4) * 3);
      this.scene.add(mesa);
    }

    for (let i = 0; i < 95; i++) {
      const angle = i * 2.399;
      const radius = 7 + ((i * 17) % 65);
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), i % 3 ? rock : sand);
      stone.position.set(Math.cos(angle) * radius, 0.15, Math.sin(angle) * radius);
      stone.rotation.set(i, i * 0.3, 0);
      const size = 0.15 + (i % 6) * 0.16;
      stone.scale.set(size * 1.5, size * 0.7, size);
      this.scene.add(stone);
    }

    const crater = new THREE.Mesh(new THREE.RingGeometry(5, 7, 48), sand);
    crater.rotation.x = -Math.PI / 2;
    crater.position.y = 0.015;
    this.scene.add(crater);

    // Sombra projetada no solo
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x321b19,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    this.materials.push(shadowMaterial);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(2.5, 32), shadowMaterial);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.scene.add(this.shadow);

    // Poeira levantada na aterrissagem
    const dustMaterial = new THREE.MeshBasicMaterial({
      color: 0xd6976c,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    this.materials.push(dustMaterial);
    this.dust = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), dustMaterial, 90);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);

    // Cápsula espacial
    const ivory = this.material(0xf0e6d3);
    const orange = this.material(0xe76b32);
    const window = this.material(0x2a6586);

    // Escudo térmico com suporte a incandescência emissiva
    this.heatshieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    this.materials.push(this.heatshieldMaterial);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 2, 2.6, 12), ivory);
    body.position.y = 1.6;
    this.capsule.add(body);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.7, 0.35, 12), this.heatshieldMaterial);
    base.position.y = 0.22;
    this.capsule.add(base);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.05, 0.5, 12), orange);
    hatch.position.y = 3.15;
    this.capsule.add(hatch);

    const rimMat = this.material(0x383e4a);
    for (const x of [-0.58, 0.58]) {
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, 1.9, 1.48);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.27, 12), window);
      glass.position.set(x, 1.9, 1.55);
      this.capsule.add(rim, glass);
    }

    // ---------- Efeitos de Plasma de Reentrada ----------
    this.bowMat = new THREE.MeshBasicMaterial({
      color: 0xffe899,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.materials.push(this.bowMat);
    const bowGeom = new THREE.SphereGeometry(2.15, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    this.bowShock = new THREE.Mesh(bowGeom, this.bowMat);
    this.bowShock.scale.set(1.06, 0.38, 1.06);
    this.bowShock.position.y = 0.12;
    this.plasmaGroup.add(this.bowShock);

    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0xff5a00,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(this.coneMat);
    const coneGeom = new THREE.CylinderGeometry(2.8, 1.85, 6.2, 16, 1, true);
    this.plasmaSheath = new THREE.Mesh(coneGeom, this.coneMat);
    this.plasmaSheath.position.y = 3.3;
    this.plasmaGroup.add(this.plasmaSheath);

    this.outerConeMat = new THREE.MeshBasicMaterial({
      color: 0xdf2200,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    this.materials.push(this.outerConeMat);
    const outerConeGeom = new THREE.CylinderGeometry(3.4, 2.15, 7.2, 14, 1, true);
    this.outerSheath = new THREE.Mesh(outerConeGeom, this.outerConeMat);
    this.outerSheath.position.y = 3.6;
    this.plasmaGroup.add(this.outerSheath);

    // Centelhas incandescentes na esteira de reentrada
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffea88,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.materials.push(sparkMat);
    this.sparks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.08, 0), sparkMat, 35);
    this.sparks.frustumCulled = false;
    this.plasmaGroup.add(this.sparks);

    for (let i = 0; i < 35; i++) {
      this.sparkData.push({
        angle: Math.random() * Math.PI * 2,
        radius: 1.2 + Math.random() * 0.9,
        speed: 7 + Math.random() * 11,
        age: Math.random(),
        drift: (Math.random() - 0.5) * 0.5,
      });
    }

    this.plasmaLight = new THREE.PointLight(0xff4400, 0, 30, 1.8);
    this.plasmaLight.position.set(0, 0.2, 0);
    this.capsule.add(this.plasmaLight);
    this.capsule.add(this.plasmaGroup);

    // ---------- Paraquedas Supersônico Físico & Dinâmico ----------
    const S = 24; // 24 setores radiais (alternando laranja e branco)
    const R = 6; // 6 anéis concêntricos da abertura ao bordo
    const nVerts = (R + 1) * (S + 1); // 175 vértices
    const pos = new Float32Array(nVerts * 3);
    const getIndex = (j: number, i: number) => j * (S + 1) + i;

    const orangeIndices: number[] = [];
    const whiteIndices: number[] = [];

    for (let j = 0; j < R; j++) {
      for (let i = 0; i < S; i++) {
        const v00 = getIndex(j, i);
        const v10 = getIndex(j, i + 1);
        const v01 = getIndex(j + 1, i);
        const v11 = getIndex(j + 1, i + 1);
        const target = i % 2 === 0 ? orangeIndices : whiteIndices;
        target.push(v00, v01, v10);
        target.push(v10, v01, v11);
      }
    }

    this.canopyGeom = new THREE.BufferGeometry();
    this.canopyPosAttr = new THREE.BufferAttribute(pos, 3);
    this.canopyGeom.setAttribute('position', this.canopyPosAttr);
    this.canopyGeom.setIndex([...orangeIndices, ...whiteIndices]);
    this.canopyGeom.addGroup(0, orangeIndices.length, 0);
    this.canopyGeom.addGroup(orangeIndices.length, whiteIndices.length, 1);

    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xeb5e28, // Laranja internacional NASA
      roughness: 0.84,
      metalness: 0.05,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf6f0e2, // Branco cru / nylon reforçado
      roughness: 0.86,
      metalness: 0.05,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    this.materials.push(orangeMat, whiteMat);
    this.canopyMesh = new THREE.Mesh(this.canopyGeom, [orangeMat, whiteMat]);
    this.canopyMesh.frustumCulled = false;
    this.parachuteGroup.add(this.canopyMesh);

    // Linhas de suspensão dinâmicas (24 cabos de suspensão + 4 tiras de ancoragem da cápsula)
    const lineCount = S + 4; // 28 linhas
    const linePos = new Float32Array(lineCount * 2 * 3); // 2 pontos por linha, 3 floats por ponto
    this.linesGeom = new THREE.BufferGeometry();
    this.linesPosAttr = new THREE.BufferAttribute(linePos, 3);
    this.linesGeom.setAttribute('position', this.linesPosAttr);

    const lineMat = new THREE.LineBasicMaterial({
      color: 0xded5c6,
      transparent: true,
      opacity: 0.85,
    });
    this.materials.push(lineMat);
    this.linesMesh = new THREE.LineSegments(this.linesGeom, lineMat);
    this.linesMesh.frustumCulled = false;
    this.parachuteGroup.add(this.linesMesh);

    // Pequeno piloto / bolsa de extração no ápice
    const drogueMat = this.material(0x2f343f);
    this.apexDrogue = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 8), drogueMat);
    this.parachuteGroup.add(this.apexDrogue);

    this.scene.add(this.parachuteGroup);
    this.scene.add(this.capsule);
  }

  private material(color: number) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    this.materials.push(material);
    return material;
  }

  update(time: number, camera: THREE.PerspectiveCamera, reduced: boolean) {
    const duration = reduced ? 4 : 11;
    const p = Math.min(1, time / duration);

    // -------------------------------------------------------------
    // CURVA DE TRAJETÓRIA UNIFICADA E 100% CONTÍNUA (SEM DEGRAUS)
    // -------------------------------------------------------------
    // u vai de 0 no início a 1.0 exatamente no momento do toque no solo (p = 0.82)
    const u = Math.min(1, p / 0.82);

    // 1. Altura contínua Y: descida aerodinâmica exponencial suave
    const height = 32 * (1 - u) ** 1.62;

    // 2. Toque no solo com amortecimento sutil de suspensão (apenas após u = 1.0)
    const touchdownBounce =
      p >= 0.82 && p < 0.90 ? Math.sin(((p - 0.82) / 0.08) * Math.PI) * 0.07 : 0;

    // Tranco de desaceleração na abertura do paraquedas supersônico
    const snatchTug =
      p >= 0.33 && p <= 0.42
        ? Math.sin(THREE.MathUtils.smoothstep(p, 0.33, 0.42) * Math.PI) * 0.32
        : 0;
    const currentY = height + touchdownBounce + snatchTug;

    // 3. Posição lateral X contínua: deslize aerodinâmico suave que converge a zero
    const lateralX = 4.2 * (1 - THREE.MathUtils.smoothstep(u, 0, 0.65));

    // 4. Intensidade contínua do plasma (surge em p=0, dissipa suavemente até p=0.36)
    const plasmaIntensity = reduced
      ? 0
      : (1 - THREE.MathUtils.smoothstep(p, 0.20, 0.36));

    // 5. Rotação / Atitude Z contínua:
    // Começa com ângulo de ataque hipersônico (0.24 rad = ~14 deg) e alinha suavemente para a vertical
    const reentryTilt = 0.24 * (1 - THREE.MathUtils.smoothstep(p, 0.18, 0.38));
    // Tremor aerodinâmico na reentrada
    const aeroFlutter =
      reduced ? 0 : Math.sin(time * 34) * 0.02 * plasmaIntensity;
    // Oscilação pendular suave sob o paraquedas (começa suave em 0.34 e cessa no solo)
    const pendulumEnvelope =
      THREE.MathUtils.smoothstep(p, 0.32, 0.44) * (1 - THREE.MathUtils.smoothstep(p, 0.72, 0.82));
    const pendulumSway =
      reduced ? 0 : Math.sin(time * 3.6) * 0.065 * pendulumEnvelope;

    this.capsule.position.set(lateralX, currentY, 0);
    this.capsule.rotation.z = reentryTilt + aeroFlutter + pendulumSway;

    // -------------------------------------------------------------
    // EFEITOS DE PLASMA (CONTÍNUOS E MODULADOS PELA INTENSIDADE)
    // -------------------------------------------------------------
    if (plasmaIntensity > 0) {
      this.plasmaGroup.visible = true;
      this.heatshieldMaterial.emissive.setHex(0xff3a00);
      this.heatshieldMaterial.emissiveIntensity =
        plasmaIntensity * 2.8 + Math.sin(time * 30) * 0.3 * plasmaIntensity;

      this.plasmaLight.intensity = 42 * plasmaIntensity;
      this.bowMat.opacity = 0.88 * plasmaIntensity;
      this.coneMat.opacity = 0.65 * plasmaIntensity;
      this.outerConeMat.opacity = 0.38 * plasmaIntensity;

      // Ondulação do cone de plasma
      const shockScale = 1 + Math.sin(time * 46) * 0.07;
      this.plasmaSheath.scale.set(shockScale, 1 + Math.cos(time * 38) * 0.1, shockScale);
      this.outerSheath.scale.set(shockScale * 1.04, 1 + Math.sin(time * 42) * 0.08, shockScale * 1.04);

      // Centelhas incandescentes na esteira
      for (let i = 0; i < this.sparkData.length; i++) {
        const s = this.sparkData[i]!;
        s.age = (s.age + 0.045 * s.speed) % 1;
        const rad = s.radius + s.age * 0.85;
        const sparkY = 0.3 + s.age * 6.2;
        this.dummy.position.set(
          Math.cos(s.angle) * rad + s.drift * s.age,
          sparkY,
          Math.sin(s.angle) * rad,
        );
        const sparkScale = (1 - s.age) * 1.3 * plasmaIntensity;
        this.dummy.scale.setScalar(sparkScale);
        this.dummy.updateMatrix();
        this.sparks.setMatrixAt(i, this.dummy.matrix);
      }
      this.sparks.instanceMatrix.needsUpdate = true;
    } else {
      this.plasmaGroup.visible = false;
      this.plasmaLight.intensity = 0;
      this.heatshieldMaterial.emissiveIntensity = 0;
    }

    // -------------------------------------------------------------
    // PARAQUEDAS SUPERSÔNICO REALISTA & DINÂMICO
    // -------------------------------------------------------------
    const deployFactor = THREE.MathUtils.smoothstep(p, 0.28, 0.40);
    if (deployFactor > 0) {
      this.parachuteGroup.visible = true;

      // 1. Abertura supersônica: esticamento de cabos e inflação elástica
      const pLines = THREE.MathUtils.smoothstep(p, 0.28, 0.33);
      const pBloom = THREE.MathUtils.smoothstep(p, 0.33, 0.40);
      const tetherDist = THREE.MathUtils.lerp(2.0, 11.2, pLines);

      // Efeito de inflação rápida com rebote elástico (aerodynamic opening shock)
      const elasticBounce = Math.sin(pBloom * Math.PI) * 0.22;
      let inflationScale = THREE.MathUtils.lerp(0.12, 1.0, pBloom) + elasticBounce;
      let depthScale = THREE.MathUtils.lerp(0.35, 1.0, pBloom) + elasticBounce * 0.5;

      // 2. Vôo e descida estável (0.40 <= p < 0.82)
      if (p >= 0.40 && p < 0.82) {
        // Respiração aerodinâmica natural da cúpula sob pressão atmosférica
        const breath = reduced
          ? 1.0
          : 1.0 + Math.sin(time * 7.5) * 0.024 + Math.cos(time * 11.2) * 0.012;
        inflationScale *= breath;
        depthScale *= reduced ? 1.0 : 1.0 + Math.sin(time * 8.2) * 0.026;
      }

      // 3. Colapso realista no solo marciano (p >= 0.82)
      const tau = THREE.MathUtils.smoothstep(p, 0.82, 0.96);

      // Ponto de fixação na cápsula (bridle) em coordenadas globais
      const rotZ = this.capsule.rotation.z;
      const bridleX = lateralX - Math.sin(rotZ) * 3.3;
      const bridleY = currentY + Math.cos(rotZ) * 3.3;
      const bridleZ = 0;

      // Vetor do vento marciano (direção para onde o paraquedas é levado)
      const windDirX = 0.92;
      const windDirZ = -0.38;
      const driftDist = tau * 8.5;

      // Posição do centro da cúpula no espaço global
      let canopyCenterX: number;
      let canopyCenterY: number;
      let canopyCenterZ: number;

      let tiltX = 0;
      let tiltZ = 0;
      let spreadFactor = 1.0;

      if (tau <= 0) {
        // Em vôo: a cúpula guia o balanço pendular
        canopyCenterX =
          lateralX - Math.sin(pendulumSway) * 3.6 + (reduced ? 0 : Math.sin(time * 1.6) * 0.25);
        canopyCenterY = currentY + 3.3 + tetherDist;
        canopyCenterZ = reduced ? 0 : Math.cos(time * 1.3) * 0.3;
        tiltZ = pendulumSway * 0.45;
        tiltX = reduced ? 0 : Math.sin(time * 1.8) * 0.035;
      } else {
        // No pouso: a cúpula desce suavemente flutuando ao vento em parábola elegante
        canopyCenterX = windDirX * driftDist;
        canopyCenterZ = windDirZ * driftDist;
        // Altura decresce em curva aerodinâmica suave até repousar sobre as dunas
        canopyCenterY = (3.3 + 11.2) * (1 - tau) ** 1.38 + 0.28;

        // Inclinação suave da cúpula acompanhando a direção do vento
        tiltZ = -tau * 0.52;
        tiltX = tau * 0.24;

        // Ao perder pressão de ar, a cúpula achata e esparrama pelo chão como tecido real
        depthScale = (1 - tau) * 1.0 + tau * 0.08;
        spreadFactor = 1.0 + tau * 0.28;
      }

      // Confluence link (anel de junção dos cabos da cápsula e da cúpula)
      let confluenceX: number;
      let confluenceY: number;
      let confluenceZ: number;

      if (tau <= 0) {
        confluenceX = THREE.MathUtils.lerp(bridleX, canopyCenterX, 0.16);
        confluenceY = THREE.MathUtils.lerp(bridleY, canopyCenterY, 0.16);
        confluenceZ = THREE.MathUtils.lerp(bridleZ, canopyCenterZ, 0.16);
      } else {
        confluenceX = THREE.MathUtils.lerp(bridleX, canopyCenterX, 0.28);
        confluenceY = Math.max(0.08, THREE.MathUtils.lerp(bridleY, canopyCenterY, 0.28));
        confluenceZ = THREE.MathUtils.lerp(bridleZ, canopyCenterZ, 0.28);
      }

      // Atualiza vértices da cúpula (deformação dinâmica da malha e assentamento no solo)
      const posAttr = this.canopyPosAttr.array as Float32Array;
      const skirtX: number[] = [];
      const skirtY: number[] = [];
      const skirtZ: number[] = [];

      for (let j = 0; j <= 6; j++) {
        const vj = j / 6;
        // Perfil hemisférico aerodinâmico
        const baseR =
          (0.65 + (5.25 - 0.65) * Math.sin(vj * (Math.PI / 2))) * inflationScale * spreadFactor;
        const baseDepth = -2.6 * (1 - Math.cos(vj * (Math.PI / 2))) * depthScale;

        for (let i = 0; i <= 24; i++) {
          const theta = (i / 24) * Math.PI * 2;
          // Ondulação aerodinâmica da tela durante o vôo
          const ripple = reduced
            ? 0
            : (1 - tau) * 0.06 * Math.sin(i * 4 + time * 14) * Math.sin(vj * Math.PI);
          const r = baseR + ripple;

          // Coordenada local da cúpula
          const lx = r * Math.cos(theta);
          const lz = r * Math.sin(theta);
          const ly = baseDepth;

          // Rotação da cúpula pelos ângulos tiltX e tiltZ
          const y1 = ly * Math.cos(tiltX) - lz * Math.sin(tiltX);
          const z1 = ly * Math.sin(tiltX) + lz * Math.cos(tiltX);
          const x2 = lx * Math.cos(tiltZ) - y1 * Math.sin(tiltZ);
          const y2 = lx * Math.sin(tiltZ) + y1 * Math.cos(tiltZ);
          const z2 = z1;

          let wx = canopyCenterX + x2;
          let wy = canopyCenterY + y2;
          let wz = canopyCenterZ + z2;

          // Se estiver assentando no solo (tau > 0): conformação com o terreno e dobras do tecido
          if (tau > 0) {
            const groundLimit = 0.04;
            if (wy < groundLimit) wy = groundLimit;

            // Dobras e rugas naturais do tecido deitado na areia marciana
            const fold = tau * 0.12 * Math.sin(i * 3.5 + j * 1.8) * Math.sin(vj * Math.PI);
            wy += Math.max(0, fold);

            // Farfalhar suave da brisa marciana nas bordas do tecido mesmo após pousar
            const breeze = reduced
              ? 0
              : tau * 0.038 * Math.sin(time * 4.2 + i * 2.8) * vj ** 1.3;
            wy += Math.max(0, breeze);
            wx += breeze * 0.4;
            wz -= breeze * 0.2;
          }

          const vIdx = (j * 25 + i) * 3;
          posAttr[vIdx] = wx;
          posAttr[vIdx + 1] = wy;
          posAttr[vIdx + 2] = wz;

          // Se for o bordo inferior (skirt, j = 6) e i < 24, guarda para as linhas de suspensão
          if (j === 6 && i < 24) {
            skirtX.push(wx);
            skirtY.push(wy);
            skirtZ.push(wz);
          }
        }
      }

      this.canopyPosAttr.needsUpdate = true;
      this.canopyGeom.computeVertexNormals();

      // Atualiza os cabos de suspensão (confluence -> skirt)
      const linesAttr = this.linesPosAttr.array as Float32Array;

      // 24 cabos principais
      for (let k = 0; k < 24; k++) {
        const offset = k * 6;
        linesAttr[offset] = confluenceX;
        linesAttr[offset + 1] = confluenceY;
        linesAttr[offset + 2] = confluenceZ;
        linesAttr[offset + 3] = skirtX[k] ?? confluenceX;
        linesAttr[offset + 4] = skirtY[k] ?? confluenceY;
        linesAttr[offset + 5] = skirtZ[k] ?? confluenceZ;
      }

      // 4 tiras de ancoragem da cápsula ao confluence
      const hatchOffsets: [number, number][] = [
        [-0.45, 0],
        [0.45, 0],
        [0, -0.45],
        [0, 0.45],
      ];
      for (let m = 0; m < 4; m++) {
        const offset = (24 + m) * 6;
        const [dx, dz] = hatchOffsets[m]!;
        // Ponto de ancoragem na escotilha da cápsula
        const hx = bridleX + (dx ?? 0) * Math.cos(rotZ);
        const hy = bridleY + (dx ?? 0) * Math.sin(rotZ);
        const hz = bridleZ + (dz ?? 0);

        linesAttr[offset] = hx;
        linesAttr[offset + 1] = hy;
        linesAttr[offset + 2] = hz;
        linesAttr[offset + 3] = confluenceX;
        linesAttr[offset + 4] = confluenceY;
        linesAttr[offset + 5] = confluenceZ;
      }

      this.linesPosAttr.needsUpdate = true;

      // Piloto de extração no topo do ápice da cúpula
      this.apexDrogue.position.set(
        canopyCenterX - Math.sin(tiltZ) * 0.4,
        canopyCenterY + Math.cos(tiltZ) * 0.4,
        canopyCenterZ,
      );
      this.apexDrogue.rotation.set(tiltX, 0, tiltZ);
      this.apexDrogue.scale.setScalar(THREE.MathUtils.lerp(1.0, 0.4, tau));
    } else {
      this.parachuteGroup.visible = false;
    }

    // -------------------------------------------------------------
    // SOMBRA E POEIRA NO SOLO
    // -------------------------------------------------------------
    const proximity = 1 - Math.min(1, height / 16);
    this.shadow.position.set(lateralX, 0.03, 0);
    this.shadow.scale.setScalar(1 + height * 0.12);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity =
      THREE.MathUtils.smoothstep(p, 0.25, 0.4) * (0.06 + proximity * 0.28);

    // Poeira levantada na desaceleração final e touchdown
    const dustFade =
      THREE.MathUtils.smoothstep(p, 0.76, 0.82) * (1 - THREE.MathUtils.smoothstep(p, 0.87, 0.99));
    (this.dust.material as THREE.MeshBasicMaterial).opacity = dustFade * 0.25;

    for (let i = 0; i < 90; i++) {
      const cycle = (time * 0.5 + i / 90) % 1;
      const angle = i * 2.399;
      const radius = 1.4 + cycle * 11;
      this.dummy.position.set(
        Math.cos(angle) * radius,
        0.2 + Math.sin(cycle * Math.PI) * 1.2,
        Math.sin(angle) * radius,
      );
      this.dummy.scale.setScalar((0.3 + cycle * 1.3) * dustFade);
      this.dummy.updateMatrix();
      this.dust.setMatrixAt(i, this.dummy.matrix);
    }
    this.dust.instanceMatrix.needsUpdate = true;

    // -------------------------------------------------------------
    // CÂMERA: ÓRBITA CINEMATOGRÁFICA 100% FLUIDA E CONTÍNUA
    // -------------------------------------------------------------
    camera.clearViewOffset();
    camera.fov = camera.aspect < 0.8 ? 53 : 43;
    camera.updateProjectionMatrix();

    // Órbita contínua ao redor da cápsula (sem saltos de ângulo!)
    const orbitAngle = reduced ? 0.42 : 0.42 + p * 0.28;
    const orbitDist = camera.aspect < 0.8 ? 32 : 28.5;
    const camShake = reduced ? 0 : plasmaIntensity * 0.16;

    const shakeX = (Math.sin(time * 68) + Math.cos(time * 88)) * camShake;
    const shakeY = (Math.cos(time * 74) + Math.sin(time * 102)) * camShake;

    camera.position.set(
      Math.sin(orbitAngle) * orbitDist + shakeX,
      7.5 + currentY * 0.55 + shakeY,
      Math.cos(orbitAngle) * orbitDist,
    );

    // Ponto de foco contínuo acompanhando a cápsula suavemente
    const collapseP = THREE.MathUtils.smoothstep(p, 0.82, 0.98);
    camera.lookAt(lateralX * 0.3, currentY + 3.2 - collapseP * 1.8, 0);

    return p >= 1;
  }

  dispose() {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments)
        object.geometry.dispose();
    });
    this.dust.dispose();
    this.sparks.dispose();
    for (const material of this.materials) material.dispose();
  }
}
