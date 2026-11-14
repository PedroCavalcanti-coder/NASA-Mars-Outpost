import { type ComponentType, type ReactNode, useSyncExternalStore } from 'react';

/**
 * Grupos de painéis permitidos na HUD.
 */
export type HudGroup = 'essencial' | 'recursos' | 'missao' | 'sistema' | 'dev';

/**
 * Definição de um painel da HUD registrado por módulos de jogo.
 */
export interface HudPanelDefinition {
  /** Identificador único do painel (ex: 'oxygen', 'status', 'dev-tools'). */
  id: string;
  /** Grupo no qual o painel será alocado na HUD. */
  group: HudGroup;
  /** Título legível exibido no cabeçalho ou tooltip. */
  title: string;
  /** Ordem de exibição (menor vem primeiro). */
  order?: number;
  /** Atalho de teclado opcional (ex: 'M', 'O', '1'). */
  shortcut?: string;
  /** Ícone exibido no botão ou aba do painel. */
  icon?: ComponentType<{ size?: number; className?: string }> | ReactNode;
  /** Componente React que renderiza o conteúdo do painel. */
  component: ComponentType;
  /** Se o painel deve iniciar aberto por padrão. */
  defaultOpen?: boolean;
}

const panels = new Map<string, HudPanelDefinition>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error('[HUD Registry] Erro ao notificar ouvinte:', err);
    }
  }
}

/**
 * Registra um novo painel para ser renderizado pela HUD (Conversa 1).
 * Retorna uma função para desregistrar o painel quando ele não for mais necessário.
 */
export function registerPanel(panel: HudPanelDefinition): () => void {
  panels.set(panel.id, panel);
  notify();
  return () => {
    unregisterPanel(panel.id);
  };
}

/**
 * Desregistra um painel pelo id.
 */
export function unregisterPanel(id: string): void {
  if (panels.delete(id)) {
    notify();
  }
}

/**
 * Retorna todos os painéis atualmente registrados ordenados por `order` ascendente.
 */
export function getPanels(): readonly HudPanelDefinition[] {
  return Array.from(panels.values()).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Alias para getPanels() para compatibilidade.
 */
export const getRegisteredPanels = getPanels;

/**
 * Retorna os painéis pertencentes a um determinado grupo, ordenados por `order`.
 */
export function getPanelsByGroup(group: HudGroup): HudPanelDefinition[] {
  return getPanels().filter((p) => p.group === group);
}

/**
 * Permite que componentes (como a própria HUD) se inscrevam para reagir a novos registros.
 */
export function subscribeHudPanels(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Limpa todos os painéis registrados (utilitário para testes unitários).
 */
export function _clearHudPanels(): void {
  panels.clear();
  notify();
}

/**
 * Hook React para obter a lista reativa de painéis registrados (opcionalmente filtrados por grupo).
 */
export function useHudPanels(group?: HudGroup): HudPanelDefinition[] {
  return useSyncExternalStore(subscribeHudPanels, () =>
    group ? getPanelsByGroup(group) : (getRegisteredPanels() as HudPanelDefinition[]),
  );
}
