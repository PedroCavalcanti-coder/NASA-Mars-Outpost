/**
 * Definição de uma ação para o painel de desenvolvimento/debug.
 */
export interface DevActionDefinition {
  /** Identificador único da ação (ex: 'teleport-infirmary', 'fill-oxygen'). */
  id: string;
  /** Rótulo amigável exibido no botão da ação ou função que o retorna dinamicamente. */
  label: string | (() => string);
  /** Descrição opcional detalhando a ação. */
  description?: string;
  /** Grupo ou categoria para organização no painel (ex: 'Jogador', 'Recursos', 'Ambiente'). */
  group?: string;
  /** Se a ação está atualmente ativa/selecionada. */
  isActive?: () => boolean;
  /** Função executada ao acionar a ação de debug. */
  run: () => unknown;
}

const actions = new Map<string, DevActionDefinition>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error('[DevActions] Erro ao notificar ouvinte:', err);
    }
  }
}

/**
 * Registra uma nova ação de desenvolvedor. O painel Dev exibirá e executará tudo que for registrado aqui.
 * Retorna uma função para desregistrar a ação.
 */
export function registerDevAction(action: DevActionDefinition): () => void {
  actions.set(action.id, action);
  notify();
  return () => {
    unregisterDevAction(action.id);
  };
}

/**
 * Desregistra uma ação de desenvolvimento pelo seu id.
 */
export function unregisterDevAction(id: string): void {
  if (actions.delete(id)) {
    notify();
  }
}

/**
 * Retorna todas as ações de desenvolvimento registradas no momento.
 */
export function getDevActions(): readonly DevActionDefinition[] {
  return Array.from(actions.values()).map((a) => {
    const evaluatedLabel = typeof a.label === 'function' ? a.label() : a.label;
    return {
      ...a,
      label: evaluatedLabel,
    };
  });
}

/**
 * Alias de compatibilidade para getDevActions.
 */
export const getRegisteredDevActions = getDevActions;

/**
 * Inscreve um ouvinte para atualizações no catálogo de ações Dev.
 */
export function subscribeDevActions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Limpa todas as ações registradas (útil para testes).
 */
export function _clearDevActions(): void {
  actions.clear();
  notify();
}
