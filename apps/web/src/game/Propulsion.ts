import * as THREE from 'three';

/**
 * Efeito de propulsão da nave marciana: chama de reator em duas camadas (núcleo e envelope),
 * poeira marciana radial soprada ao redor da plataforma de pouso e iluminação dinâmica quente.
 */
const FLAME_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FLAME_FRAG = /* glsl */ `
uniform float uTime;
uniform float uThrottle;
uniform vec3 uHot;
uniform vec3 uCool;
varying vec2 vUv;
void main() {
  float t = 1.0 - vUv.y;
  float flick = 0.65 + 0.35 * sin(vUv.x * 38.0 + uTime * 32.0 + t * 9.0);
  float diamond = 0.75 + 0.25 * sin(t * 26.0 - uTime * 24.0);
  float a = pow(1.0 - t, 1.5) * flick * diamond * uThrottle;
  vec3 col = mix(uHot, uCool, smoothstep(0.0, 0.85, t));
  gl_FragColor = vec4(col * (1.2 + (1.0 - t)), a);
}`;

const DUST_VERT = /* glsl */ `
attribute float aAlpha;
attribute float aSize;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = dot(p, p) * 4.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(uColor, vAlpha * (1.0 - d) * (1.0 - d));
}`;

const N = 120;

export class Propulsion {
  readonly flame = new THREE.Group();
  readonly dust: THREE.Points;
  private readonly flameUniforms = {
    uTime: { value: 0 },
    uThrottle: { value: 0 },
  };
  private readonly coreMat: THREE.ShaderMaterial;
  private readonly outerMat: THREE.ShaderMaterial;
  private readonly light = new THREE.PointLight(0xffa458, 0, 40, 1.6);
  private readonly pos = new Float32Array(N * 3);
  private readonly vel = new Float32Array(N * 3);
  private readonly life = new Float32Array(N);
  private readonly alpha = new Float32Array(N);
  private readonly size = new Float32Array(N);
  private readonly dustMat: THREE.ShaderMaterial;
  private emit = 0;
  private seed = 1;

  constructor() {
    const mk = (hot: number, cool: number) =>
      new THREE.ShaderMaterial({
        vertexShader: FLAME_VERT,
        fragmentShader: FLAME_FRAG,
        uniforms: {
          ...this.flameUniforms,
          uHot: { value: new THREE.Color(hot) },
          uCool: { value: new THREE.Color(cool) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

    this.outerMat = mk(0xffc060, 0xff4a10);
    this.coreMat = mk(0xffffff, 0xffd070);

    const outer = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7.5, 16, 1, true), this.outerMat);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.7, 5.2, 12, 1, true), this.coreMat);

    for (const m of [outer, core]) {
      m.rotation.x = Math.PI;
      m.frustumCulled = false;
      m.renderOrder = 5;
      this.flame.add(m);
    }
    core.position.y = 0.6;
    this.light.position.set(0, -1.8, 0);
    this.flame.add(this.light);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));

    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        uScale: { value: 200 },
        uColor: { value: new THREE.Color(0xd08a54) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 4;
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  update(now: number, dt: number, throttle: number, altitude: number) {
    this.flameUniforms.uTime.value = now * 0.001;
    this.flameUniforms.uThrottle.value = throttle;
    this.light.intensity = throttle * 32;

    const near = Math.max(0, 1 - altitude / 18);
    const blow = throttle * near;
    this.dust.visible = blow > 0.02;

    this.emit += dt * 90 * blow;
    const canSpawn = Math.min(10, Math.floor(this.emit));
    this.emit -= canSpawn;

    let spawned = 0;
    for (let i = 0; i < N; i++) {
      if (this.life[i]! > 0) {
        this.life[i]! -= dt * 1.5;
        this.pos[i * 3]! += this.vel[i * 3]! * dt;
        this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
        this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
        this.vel[i * 3 + 1]! -= dt * 2.2;
        this.alpha[i] = Math.max(0, this.life[i]! * 0.7);
      } else if (spawned < canSpawn && blow > 0.05) {
        spawned++;
        const a = this.rand() * Math.PI * 2;
        const speed = 4 + this.rand() * 8 * blow;
        this.pos[i * 3] = (this.rand() - 0.5) * 1.5;
        this.pos[i * 3 + 1] = 0.15;
        this.pos[i * 3 + 2] = (this.rand() - 0.5) * 1.5;
        this.vel[i * 3] = Math.cos(a) * speed;
        this.vel[i * 3 + 1] = 0.8 + this.rand() * 2.0;
        this.vel[i * 3 + 2] = Math.sin(a) * speed;
        this.life[i] = 0.6 + this.rand() * 0.5;
        this.alpha[i] = 0.7;
        this.size[i] = 12 + this.rand() * 22;
      }
    }

    const geo = this.dust.geometry;
    geo.attributes.position!.needsUpdate = true;
    geo.attributes.aAlpha!.needsUpdate = true;
    geo.attributes.aSize!.needsUpdate = true;
  }

  dispose() {
    this.coreMat.dispose();
    this.outerMat.dispose();
    this.dustMat.dispose();
    this.dust.geometry.dispose();
  }
}
