/**
 * Barra Essencial Superior da HUD.
 *
 * Sempre visível na parte superior, compacta e não intrusiva.
 * Exibe a identidade da base, barra de O₂, relógio/sol de Marte,
 * alertas ativos (tempestade, frio, apagão) e botão para menu de sistema.
 */

import { Menu } from 'lucide-react';
import './essentialLayout.css';
import type { ComponentType } from 'react';
import {
  BatterySlot,
  DefaultOxygenSlot,
  DoseSlot,
  ResearchSlot,
  ResourceSlot,
} from './panels/EssentialSlots';
import { EventOrb } from './panels/EventOrb';
import { MarsCycleContext } from './panels/OxygenOrb';
import { useGroupPanels } from './useHudPanels';
import { L } from '../../../lib/i18n';

interface EssentialBarProps {
  marsTime: {
    sol: number;
    hour?: number;
    formatted: string;
    isDay: boolean;
  };
  stormActive: boolean;
  onOpenSystemMenu: () => void;
}

export function EssentialBar({ marsTime, stormActive, onOpenSystemMenu }: EssentialBarProps) {
  // Painéis registrados dinamicamente no grupo 'essencial' (Conversa 3: Relógio, Conversa 5: Oxigênio)
  const registeredEssential = useGroupPanels('essencial');

  const customOxygen = registeredEssential.find(
    (p) => p.id === 'oxygen' || p.id === 'astronaut-oxygen',
  );
  const customClock = registeredEssential.find(
    (p) => p.id === 'clock' || p.id === 'game-clock' || p.id === 'mars-clock',
  );
  // o relógio registrado recebe a hora de Marte da HUD (o registro tipa painéis sem props)
  const CustomClock = customClock?.component as
    | ComponentType<{ marsTime?: EssentialBarProps['marsTime']; hideTimeDisplay?: boolean }>
    | undefined;

  return (
    <>
      <button
        type="button"
        className="hud-essential-bar__menu-btn"
        data-bit-target="settings"
        onClick={onOpenSystemMenu}
        title={L('Menu do Sistema e Configurações (O)', 'System Menu and Settings (O)')}
        aria-label={L('Abrir menu do sistema', 'Open system menu')}
      >
        <Menu size={24} />
      </button>
      <div className="hud-energy-anchor">
        <div className="hud-resource-row">
          <BatterySlot />
          <ResourceSlot kind="supplies" />
          <ResourceSlot kind="armor" />
          <DoseSlot />
        </div>
        <ResearchSlot />
      </div>
      <div className="hud-oxygen-anchor">
        <MarsCycleContext.Provider value={marsTime}>
          {customOxygen ? <customOxygen.component /> : <DefaultOxygenSlot oxygenLevel={100} />}
        </MarsCycleContext.Provider>
        <div className="hud-event-controls">
          <EventOrb stormActive={stormActive} isDay={marsTime.isDay} />
          {CustomClock && <CustomClock marsTime={marsTime} hideTimeDisplay />}
        </div>
      </div>
    </>
  );
}
