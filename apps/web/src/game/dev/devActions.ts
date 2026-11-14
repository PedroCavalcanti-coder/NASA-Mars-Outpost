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

/** Ação já com o rótulo resolvido, pronta para exibir no painel Dev. */
export interface ResolvedDevAction extends Omit<DevActionDefinition, 'label'> {
  label: string;
}

const actions = new Map<string, DevActionDefinition>();
const listeners = new Set<() => void>();
/**
 * Snapshot estável (mesma referência até a próxima mudança): exigido pelo
 * `useSyncExternalStore`, que entra em loop se cada leitura devolver um array novo.
 */
let snapshot: readonly ResolvedDevAction[] = [];

function resolve(a: DevActionDefinition): ResolvedDevAction {
  let label: string;
  try {
    label = typeof a.label === 'function' ? a.label() : a.label;
  } catch (err) {
    console.error(`[DevActions] Erro ao resolver rótulo de "${a.id}":`, err);
    label = a.id;
  }
  return { ...a, label };
}

function notify(): void {
  snapshot = Array.from(actions.values(), resolve);
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
 * Retorna todas as ações de desenvolvimento registradas, com rótulos resolvidos.
 * A referência só muda quando o catálogo muda ou `refreshDevActions()` é chamado.
 */
export function getDevActions(): readonly ResolvedDevAction[] {
  return snapshot;
}

/**
 * Reavalia rótulos dinâmicos e `isActive` (ex.: "Pausar" ↔ "Retomar") e avisa os ouvintes.
 */
export function refreshDevActions(): void {
  notify();
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
