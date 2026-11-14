import * as THREE from 'three';
import { dustUniforms } from './DustStorm';

// Os materiais podem ser compartilhados: o patch é feito uma única vez por material e guarda se o
// material é "interno" (poeira limpa quando o jogador está dentro) ou "externo".
const patched = new WeakMap<THREE.Material, 0 | 1>();
// Material que já nasceu externo e também é usado por uma peça interna: ganha um gêmeo interno.
const interiorTwins = new WeakMap<THREE.Material, THREE.Material>();

export function setEdgeFog(near: number, far: number) {
  dustUniforms.dustEdgeNear.value = near;
  dustUniforms.dustEdgeFar.value = far;
}

/**
 * Poeira em coordenadas de mundo:
 * - névoa radial que encobre a borda do mapa e as montanhas distantes;
 * - tempestade de areia (lençóis de poeira levados pelo vento), controlada por
 *   `dustStormStrength` (uniform COMPARTILHADO, atualizado pelo jogo a cada quadro);
 * - superfícies internas (`userData.isInterior`) perdem a poeira quando o jogador está dentro da
 *   base (`dustInteriorClear` -> 1): o ambiente fechado fica limpo.
 */
export function applyBoundaryFog(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const interiorFlag: 0 | 1 = object.userData?.isInterior ? 1 : 0;

    const materials: THREE.Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];

    materials.forEach((material, slot) => {
      if (material instanceof THREE.ShaderMaterial) return;
      const known = patched.get(material);
      if (known === interiorFlag) return;
      if (known !== undefined) {
        // o mesmo material em peça interna e externa: cada lado usa a sua versão
        let twin = interiorTwins.get(material);
        if (!twin) {
          twin = material.clone();
          interiorTwins.set(material, twin);
          patchMaterial(twin, interiorFlag);
        }
        if (Array.isArray(object.material)) object.material[slot] = twin;
        else object.material = twin;
        return;
      }
      patchMaterial(material, interiorFlag);
    });
  });
}

function patchMaterial(material: THREE.Material, interiorFlag: 0 | 1) {
  patched.set(material, interiorFlag);
  const original = material.onBeforeCompile;
  const key = material.customProgramCacheKey();

  material.onBeforeCompile = function (shader, renderer) {
    original.call(this, shader, renderer);
    Object.assign(shader.uniforms, dustUniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <fog_pars_vertex>',
        `#include <fog_pars_vertex>
            #ifdef USE_FOG
              varying vec3 vDustWorld;
            #endif`,
      )
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
            #ifdef USE_FOG
              vec4 dustPosition = vec4(transformed, 1.0);
              #ifdef USE_BATCHING
                dustPosition = batchingMatrix * dustPosition;
              #endif
              #ifdef USE_INSTANCING
                dustPosition = instanceMatrix * dustPosition;
              #endif
              vDustWorld = (modelMatrix * dustPosition).xyz;
            #endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <fog_pars_fragment>',
        `#include <fog_pars_fragment>
            #ifdef USE_FOG
              varying vec3 vDustWorld;
              uniform float dustStormStrength;
              uniform float dustStormTime;
              uniform float dustInteriorClear;
              uniform float dustEdgeNear;
              uniform float dustEdgeFar;

              float marsDustHash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
              }
              float marsDustNoise(vec2 p) {
                vec2 cell = floor(p);
                vec2 f = fract(p);
                vec2 blend = f * f * (3.0 - 2.0 * f);
                return mix(
                  mix(marsDustHash(cell), marsDustHash(cell + vec2(1.0, 0.0)), blend.x),
                  mix(marsDustHash(cell + vec2(0.0, 1.0)), marsDustHash(cell + vec2(1.0)), blend.x),
                  blend.y
                );
              }
            #endif`,
      )
      .replace(
        '#include <fog_fragment>',
        `
            #ifdef USE_FOG
              float dustWisp = sin(vDustWorld.x * 0.18 + sin(vDustWorld.z * 0.13) * 1.8)
                * cos(vDustWorld.z * 0.14 - vDustWorld.x * 0.07);
              float dustRadius = length(vDustWorld.xz) + dustWisp * 2.4;
              float edgeFog = smoothstep(dustEdgeNear, dustEdgeFar, dustRadius);

              float stormFog = 0.0;
              if (dustStormStrength > 0.001) {
                vec2 windPosition = vDustWorld.xz - vec2(5.5, -2.2) * dustStormTime;
                windPosition = vec2(
                  dot(windPosition, vec2(0.927, -0.375)),
                  dot(windPosition, vec2(0.375, 0.927))
                ) + vec2(34.7, 19.3);
                float broad = marsDustNoise(windPosition * vec2(0.035, 0.11));
                vec2 warped = windPosition + vec2(broad * 9.0, broad * 4.0);
                float detail = marsDustNoise(warped * vec2(0.09, 0.32));
                float wisps = marsDustNoise(warped * vec2(0.18, 0.65));
                float sheets = smoothstep(0.2, 0.75, broad * 0.62 + detail * 0.28 + wisps * 0.10);
                float groundDust = exp(-max(vDustWorld.y, 0.0) * 0.16);
                float density = (0.28 + sheets * 1.35) * mix(0.7, 1.0, groundDust);
                float pathLength = clamp(vFogDepth * 0.03, 0.8, 2.6);
                stormFog = 1.0 - exp(-density * pathLength * dustStormStrength);
              }

              float totalDust = max(edgeFog, stormFog);
              ${interiorFlag ? 'totalDust *= 1.0 - dustInteriorClear;' : ''}

              gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, totalDust);
            #endif`,
      );
  };
  material.customProgramCacheKey = () => `${key}|mars-boundary-dust-v4|interior:${interiorFlag}`;
  material.needsUpdate = true;
}
