import * as THREE from 'three';

/**
 * Céu e luz de Marte pela hora local do sol (nascer 06:00, pôr 18:00).
 * De dia o céu é cor de caramelo (poeira em suspensão). No crepúsculo, a região em volta do Sol
 * fica AZULADA — a poeira fina espalha mais a luz azul na direção do Sol.
 * À noite: céu azul-escuro marciano com estrelas.
 */
export interface SkyState {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  zenith: THREE.Color;
  horizon: THREE.Color;
  glow: THREE.Color;
  /** 0 = dia pleno, 1 = noite fechada */
  night: number;
  /** 0..1, pico no nascer/pôr do sol */
  twilight: number;
}

const C = (hex: number) => new THREE.Color(hex);
const DAY_ZENITH = C(0xb98a62);
const DAY_HORIZON = C(0xe0b48c);
const DUSK_ZENITH = C(0x4a3b44);
const DUSK_HORIZON = C(0x9a7461);
const DUSK_GLOW = C(0x7fa6c9);
const NIGHT_ZENITH = C(0x0b0f1c);
const NIGHT_HORIZON = C(0x1d2233);
const STORM = C(0xab7557);

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

export function marsSky(localHour: number, storm = 0): SkyState {
  const h = ((localHour % 24) + 24) % 24;
  const elev = Math.sin(((h - 6) * Math.PI) / 12); // -1..1, 0 no nascer/pôr
  const day = smooth(-0.08, 0.25, elev);
  const night = 1 - smooth(-0.22, 0.02, elev);
  const twilight = Math.max(0, 1 - Math.abs(elev) / 0.28) * (1 - night * 0.6);
  // Sol: nasce a leste (+X), passa alto ao meio-dia, põe-se a oeste (-X)
  const az = ((h - 6) / 12) * Math.PI;
  const sunDir = new THREE.Vector3(Math.cos(az), Math.max(0.08, elev), 0.35).normalize();
  const zenith = NIGHT_ZENITH.clone()
    .lerp(DUSK_ZENITH, 1 - night)
    .lerp(DAY_ZENITH, day);
  const horizon = NIGHT_HORIZON.clone()
    .lerp(DUSK_HORIZON, 1 - night)
    .lerp(DAY_HORIZON, day);
  const glow = DUSK_GLOW.clone().lerp(C(0xf3dcc0), day * (1 - twilight));
  if (storm > 0) {
    zenith.lerp(STORM, storm * 0.8);
    horizon.lerp(STORM, storm * 0.8);
  }
  const sunColor = C(0xffe9cf).lerp(C(0xffc79a), twilight).lerp(C(0x9fb4e0), night);
  return {
    sunDir,
    sunColor,
    sunIntensity: (0.45 + day * 2.1) * (1 - storm * 0.8),
    hemiSky: C(0xffd9b8).lerp(C(0x7d90c4), night),
    hemiGround: C(0x5a2414).lerp(C(0x3a2a35), night),
    hemiIntensity: 0.7 + day * 0.55,
    zenith,
    horizon,
    glow,
    night,
    twilight,
  };
}

/** Domo de céu marciano com degradê físico, brilho do Sol e estrelas à noite. */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private stars: THREE.Points | null = null;

  constructor(radius = 380, withStars = true) {
    this.mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        glow: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        twilight: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 zenith;
        uniform vec3 horizon;
        uniform vec3 glow;
        uniform vec3 sunDir;
        uniform float twilight;
        varying vec3 vDir;
        void main() {
          float up = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(up, 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col = mix(col, glow, pow(s, 6.0) * (0.35 + twilight * 0.65));
          col += glow * pow(s, 64.0) * 0.6;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), this.mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    if (withStars) {
      const n = 900;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection();
        v.y = Math.abs(v.y) * 0.9 + 0.05;
        v.normalize().multiplyScalar(radius * 0.95);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.stars = new THREE.Points(
        g,
        new THREE.PointsMaterial({
          color: 0xdfe6ff,
          size: 1.6,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          fog: false,
        }),
      );
      this.mesh.add(this.stars);
    }
  }

  setStarsVisible(visible: boolean) {
    if (this.stars) {
      this.stars.visible = visible;
    }
  }

  update(sky: SkyState) {
    const u = this.mat.uniforms;
    u.zenith!.value.copy(sky.zenith);
    u.horizon!.value.copy(sky.horizon);
    u.glow!.value.copy(sky.glow);
    u.sunDir!.value.copy(sky.sunDir);
    u.twilight!.value = sky.twilight;
    if (this.stars && this.stars.visible) {
      (this.stars.material as THREE.PointsMaterial).opacity = sky.night * 0.92;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.stars?.geometry.dispose();
    if (this.stars?.material instanceof THREE.Material) {
      this.stars.material.dispose();
    }
  }
}
