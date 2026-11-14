/**
 * Barra Essencial Superior da HUD.
 *
 * Sempre visível na parte superior, compacta e não intrusiva.
 * Exibe a identidade da base, barra de O₂, relógio/sol de Marte,
 * alertas ativos (tempestade, frio, apagão) e botão para menu de sistema.
 */

import { Menu } from 'lucide-react';
import { Link } from 'react-router';
import { DefaultAlertSlot, DefaultClockSlot, DefaultOxygenSlot } from './panels/EssentialSlots';
import { useGroupPanels } from './useHudPanels';

interface EssentialBarProps {
  marsTime: {
    sol: number;
    formatted: string;
    isDay: boolean;
  };
  stormActive: boolean;
  onOpenSystemMenu: () => void;
  onRequestLeave: () => void;
}

export function EssentialBar({
  marsTime,
  stormActive,
  onOpenSystemMenu,
  onRequestLeave,
}: EssentialBarProps) {
  // Painéis registrados dinamicamente no grupo 'essencial' (Conversa 3: Relógio, Conversa 5: Oxigênio)
  const registeredEssential = useGroupPanels('essencial');

  const customOxygen = registeredEssential.find(
    (p) => p.id === 'oxygen' || p.id === 'astronaut-oxygen',
  );
  const customClock = registeredEssential.find(
    (p) => p.id === 'clock' || p.id === 'game-clock' || p.id === 'mars-clock',
  );

  return (
    <header className="hud-essential-bar">
      <div className="hud-essential-bar__left">
        <Link
          to="/"
          className="hud-essential-bar__brand"
          aria-label="Mars Outpost — Início"
          onClick={(e) => {
            e.preventDefault();
            onRequestLeave();
          }}
        >
          <img
            className="hud-essential-bar__logo"
            src="/assets/branding/mars-outpost-logo.svg"
            alt=""
            width={32}
            height={32}
          />
          <span className="hud-essential-bar__wordmark">MARS OUTPOST</span>
        </Link>
      </div>

      <div className="hud-essential-bar__center">
        {/* Slot de Oxigênio (Conversa 5 ou padrão) */}
        {customOxygen ? <customOxygen.component /> : <DefaultOxygenSlot oxygenLevel={100} />}

        {/* Slot de Relógio Marciano (Conversa 3 ou padrão) */}
        {customClock ? <customClock.component /> : <DefaultClockSlot marsTime={marsTime} />}

        {/* Alerta Ativo Compacto */}
        <DefaultAlertSlot stormActive={stormActive} marsTime={marsTime} />
      </div>

      <div className="hud-essential-bar__right">
        <button
          type="button"
          className="hud-essential-bar__menu-btn"
          onClick={onOpenSystemMenu}
          title="Menu do Sistema e Configurações (O)"
          aria-label="Abrir menu do sistema"
        >
          <Menu size={18} />
          <span className="hud-essential-bar__menu-text">Menu</span>
        </button>
      </div>
    </header>
  );
}
