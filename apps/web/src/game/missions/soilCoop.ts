import { create } from 'zustand';

/** Estado da coleta de solo em dupla que o minigame mostra (o parceiro já terminou a parte dele?). */
export const useSoilCoop = create<{
  coop: boolean;
  partnerDone: boolean;
  reset: (coop: boolean) => void;
  setPartnerDone: (done: boolean) => void;
}>((set) => ({
  coop: false,
  partnerDone: false,
  reset: (coop) => set({ coop, partnerDone: false }),
  setPartnerDone: (partnerDone) => set({ partnerDone }),
}));
