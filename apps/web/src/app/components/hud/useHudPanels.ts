/**
 * Hook reativo para acompanhar os painéis registrados na HUD.
 */

import { useSyncExternalStore } from 'react';
import {
  getRegisteredPanels,
  type HudGroup,
  type HudPanelDefinition,
  subscribeHudPanels,
} from './registry';

// Snapshot estável em cache para cumprir o contrato do useSyncExternalStore
let cachedSnapshot: readonly HudPanelDefinition[] = getRegisteredPanels();
let lastRawPanels: readonly HudPanelDefinition[] = cachedSnapshot;

function getSnapshot(): readonly HudPanelDefinition[] {
  const current = getRegisteredPanels();
  if (current.length !== lastRawPanels.length || current.some((p, i) => p !== lastRawPanels[i])) {
    lastRawPanels = current;
    cachedSnapshot = current;
  }
  return cachedSnapshot;
}

export function useHudPanels(): readonly HudPanelDefinition[] {
  return useSyncExternalStore(subscribeHudPanels, getSnapshot, getSnapshot);
}

export function useGroupPanels(group: HudGroup): HudPanelDefinition[] {
  const panels = useHudPanels();
  return panels.filter((p) => p.group === group);
}
