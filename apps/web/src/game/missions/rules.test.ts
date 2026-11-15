import { describe, expect, it } from 'vitest';
import {
  describeDirection,
  gardenComplete,
  MISSIONS,
  missionBlock,
  missionCountFor,
  missionsForSol,
  roomLabel,
  soilReward,
  stationRoomIndex,
} from './rules';

const rich = { energy: 100, supplies: 90, materials: 90, oxygen: 90, night: 0, blackout: false };

describe('missões do dia', () => {
  it('sozinho são 4 missões diferentes; cada jogador a mais traz mais uma', () => {
    expect(missionCountFor(1)).toBe(4);
    expect(missionCountFor(2)).toBe(5);
    expect(missionCountFor(4)).toBe(7);
    for (let sol = 1; sol <= 40; sol++) {
      const list = missionsForSol(12345, sol, 1);
      expect(list).toHaveLength(4);
      expect(new Set(list).size).toBe(4);
      // no máximo uma missão pesada (o rover) por dia
      expect(list.filter((id) => MISSIONS[id].heavy).length).toBeLessThanOrEqual(1);
    }
  });

  it('o sorteio mistura manutenção (oxigênio, água, ventilação, horta, painéis) e pesquisa', () => {
    const seen = new Set<string>();
    for (let sol = 1; sol <= 30; sol++) for (const id of missionsForSol(3, sol, 1)) seen.add(id);
    for (const id of ['oxygen_moxie', 'water_extract', 'air_filter', 'garden_care', 'solar_clean', 'lab_analysis'])
      expect(seen.has(id)).toBe(true);
  });

  it('é determinístico e as primeiras da fila não mudam quando mais gente entra', () => {
    const solo = missionsForSol(99, 3, 1);
    expect(missionsForSol(99, 3, 1)).toEqual(solo);
    expect(missionsForSol(99, 3, 4).slice(0, 4)).toEqual(solo);
  });

  it('varia ao longo dos Sóis', () => {
    const seen = new Set<string>();
    for (let sol = 1; sol <= 15; sol++) seen.add(missionsForSol(7, sol, 1).join());
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('custo e restrições', () => {
  it('sem recurso suficiente não dá para fazer', () => {
    expect(missionBlock(MISSIONS.soil_robot, { ...rich, oxygen: 5 })).toMatch(/oxigênio/);
    expect(missionBlock(MISSIONS.soil_robot, rich)).toBeNull();
  });

  it('a limpeza dos painéis não pode ser feita à noite (o rover tem janela própria: 2h às 16h)', () => {
    expect(missionBlock(MISSIONS.solar_clean, { ...rich, night: 0.9 })).toMatch(/dia/);
    expect(missionBlock(MISSIONS.antenna_calibration, { ...rich, night: 0.9 })).toBeNull();
  });

  it('apagão bloqueia o que gasta energia', () => {
    expect(missionBlock(MISSIONS.drill, { ...rich, blackout: true })).toMatch(/Apagão/);
  });

  it('a coleta rende muito mais que as outras', () => {
    expect(soilReward(0)).toBeGreaterThanOrEqual(MISSIONS.lab_analysis.research);
  });
});

describe('horta', () => {
  it('completa só quando todos os plantados foram cuidados hoje', () => {
    expect(gardenComplete([1, 0, 2], [3, 0, 3], 3)).toBe(true);
    expect(gardenComplete([1, 0, 2], [3, 0, 2], 3)).toBe(false);
    expect(gardenComplete([0, 0], [0, 0], 3)).toBe(false);
  });
});

describe('onde fica', () => {
  it('direção e distância até a estação (norte = -z)', () => {
    expect(describeDirection(0, 0, 0, -10).text).toBe('10 m a norte');
    expect(describeDirection(0, 0, 10, 0).text).toBe('10 m a leste');
    expect(describeDirection(0, 0, -7, 7).text).toMatch(/sudoeste/);
    expect(describeDirection(0, 0, 1, 1).text).toBe('aqui');
  });

  it('escolhe o cômodo preferido e cai em outro quando a base não tem', () => {
    const rooms = [{ kind: 'Habitacao' }, { kind: 'Laboratorio' }, { kind: 'Comunicacoes' }];
    expect(stationRoomIndex(rooms, 'lab')).toBe(1);
    expect(stationRoomIndex(rooms, 'comms')).toBe(2);
    expect(stationRoomIndex(rooms, 'medical')).toBe(0); // sem enfermaria: alojamento
    const bare = [{ kind: 'Estufa' }, { kind: 'Garagem' }];
    expect(stationRoomIndex(bare, 'power', [0])).toBe(1);
  });

  it('nomes dos cômodos em português', () => {
    expect(roomLabel('CentralEnergia')).toBe('Central de energia');
    expect(roomLabel('Medicina')).toBe('Enfermaria');
  });
});
