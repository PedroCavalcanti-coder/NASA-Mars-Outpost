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

export function useHudPanels(): readonly HudPanelDefinition[] {
  return useSyncExternalStore(subscribeHudPanels, getRegisteredPanels, getRegisteredPanels);
}

export function useGroupPanels(group: HudGroup): HudPanelDefinition[] {
  const panels = useHudPanels();
  return panels.filter((p) => p.group === group);
}
