import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LifeSupportStations } from './LifeSupportStations';

describe('LifeSupportStations', () => {
  it('cria indicativos no piso e proxies para oxigênio e água a partir do modelo', () => {
    const model = new THREE.Group();
    const filterMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    filterMesh.name = 'Base_SuporteVida_0_FiltroAr_01';
    filterMesh.position.set(6, 1, -7);

    const tankMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1));
    tankMesh.name = 'Base_SuporteVida_0_TanqueSuporteVida_00';
    tankMesh.position.set(3, 1, -7);

    model.add(filterMesh);
    model.add(tankMesh);

    const lss = new LifeSupportStations();
    lss.setup(model, null);

    expect(lss.proxies.length).toBe(2);
    expect(lss.proxies[0]?.userData.pick?.kind).toBe('oxygen_station');
    expect(lss.proxies[1]?.userData.pick?.kind).toBe('water_station');

    expect(lss.oxygenPos).toBeDefined();
    expect(lss.waterPos).toBeDefined();
    expect(lss.oxygenPos?.x).toBeCloseTo(6);
    expect(lss.waterPos?.x).toBeCloseTo(3);

    // O grupo deve conter os contornos de piso (LineLoop) e os proxies
    const lineLoops = lss.group.children.filter((c) => c.type === 'LineLoop');
    expect(lineLoops.length).toBe(4); // 2 para oxigênio (externo + interno) e 2 para água

    // Teste de pulsação
    expect(() => lss.update(0.16)).not.toThrow();

    // Descarte
    expect(() => lss.dispose()).not.toThrow();
    expect(lss.proxies.length).toBe(0);
  });

  it('funciona com posições de fallback caso o modelo não tenha os móveis identificados', () => {
    const emptyModel = new THREE.Group();
    const lss = new LifeSupportStations();
    lss.setup(emptyModel, null);

    expect(lss.proxies.length).toBe(2);
    expect(lss.oxygenPos).toBeDefined();
    expect(lss.waterPos).toBeDefined();
    lss.dispose();
  });
});
