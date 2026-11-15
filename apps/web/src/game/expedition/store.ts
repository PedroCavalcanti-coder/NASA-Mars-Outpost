import { create } from 'zustand';

export interface RadarRock {
  x: number;
  z: number;
  /** alguém está levando esta pedra */
  carried: boolean;
}

/** O que a tela mostra durante a expedição (o BaseViewer atualiza ~10 vezes por segundo). */
export interface ExpeditionHud {
  active: boolean;
  /** tempo que falta (ms) no momento `stamp` (performance.now) */
  leftMs: number;
  stamp: number;
  total: number;
  loaded: number;
  /** o jogador local está carregando uma pedra */
  carrying: boolean;
  /** o jogador local está dentro do rover */
  inCar: boolean;
  me: { x: number; z: number; yaw: number };
  car: { x: number; z: number };
  /** pedras que ainda estão no chão (ou nas mãos de alguém) */
  rocks: RadarRock[];
  /** 0..1: círculo de "pegando a pedra" */
  pick: number;
}

const idle: ExpeditionHud = {
  active: false,
  leftMs: 0,
  stamp: 0,
  total: 3,
  loaded: 0,
  carrying: false,
  inCar: true,
  me: { x: 0, z: 0, yaw: 0 },
  car: { x: 0, z: 0 },
  rocks: [],
  pick: 0,
};

export const useExpedition = create<ExpeditionHud>(() => idle);
export const resetExpedition = () => useExpedition.setState(idle, true);
