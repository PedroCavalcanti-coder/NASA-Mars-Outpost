import type { SystemContext } from './context';

/**
 * Interface que todo sistema do jogo deve implementar para se plugar ao ciclo de vida
 * e à simulação do BaseViewer sem necessidade de alterar o código do viewer.
 */
export interface GameSystem {
  readonly id: string;
  update(dt: number, ctx: SystemContext): void;
  dispose(): void;
}

const activeRegistries = new Set<GameSystemRegistry>();
const globalSystems = new Map<string, GameSystem>();

/**
 * Registro de subsistemas de jogo.
 * Responsável por gerenciar o ciclo de vida, ordenação e despacho de atualizações (`update`)
 * e descarte idempotente (`dispose`).
 */
export class GameSystemRegistry {
  private systems: GameSystem[] = [];
  private disposed = false;

  constructor(includeGlobal = true) {
    activeRegistries.add(this);
    if (includeGlobal) {
      for (const sys of globalSystems.values()) {
        this.registerSystem(sys);
      }
    }
  }

  /**
   * Registra um novo subsistema. Se já houver um com o mesmo `id`, o anterior é descartado.
   * Retorna uma função para desregistrar o sistema.
   */
  registerSystem(system: GameSystem): () => void {
    if (this.disposed) return () => {};
    // mesmo objeto registrado de novo: não descarta (seria reaproveitado já "morto")
    if (this.getSystem(system.id) !== system) {
      this.unregisterSystem(system.id);
      this.systems.push(system);
    }
    // só remove se o id ainda for deste objeto (não derruba um substituto posterior)
    return () => {
      if (this.getSystem(system.id) === system) this.unregisterSystem(system.id);
    };
  }

  /**
   * Remove um sistema pelo `id`, chamando seu método `dispose()`.
   */
  unregisterSystem(id: string): void {
    const idx = this.systems.findIndex((s) => s.id === id);
    if (idx !== -1) {
      const [removed] = this.systems.splice(idx, 1);
      try {
        removed?.dispose();
      } catch (err) {
        console.error(`[GameSystemRegistry] Erro ao descartar sistema "${id}":`, err);
      }
    }
  }

  /**
   * Busca um sistema registrado pelo `id`.
   */
  getSystem(id: string): GameSystem | undefined {
    return this.systems.find((s) => s.id === id);
  }

  /**
   * Retorna todos os sistemas registrados nesta instância na ordem de registro.
   */
  getSystems(): readonly GameSystem[] {
    return this.systems;
  }

  /**
   * Atualiza todos os sistemas na ordem exata em que foram registrados.
   */
  update(dt: number, ctx: SystemContext): void {
    if (this.disposed) return;
    for (const sys of this.systems) {
      sys.update(dt, ctx);
    }
  }

  /**
   * Descarta todos os sistemas e marca o registro como descartado.
   * A chamada é idempotente: chamadas adicionais não repetem o dispose nem lançam erros.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    activeRegistries.delete(this);
    const toDispose = [...this.systems];
    this.systems = [];
    for (const sys of toDispose) {
      try {
        sys.dispose();
      } catch (err) {
        console.error(`[GameSystemRegistry] Erro ao descartar sistema "${sys.id}":`, err);
      }
    }
  }
}

/**
 * Registro global de sistemas.
 * Permite que módulos externos registrem sistemas em tempo de importação ou inicialização.
 * Os sistemas serão repassados automaticamente aos registros ativos e futuros.
 */
export function registerSystem(system: GameSystem): () => void {
  globalSystems.set(system.id, system);
  for (const reg of activeRegistries) {
    reg.registerSystem(system);
  }
  return () => {
    globalSystems.delete(system.id);
    for (const reg of activeRegistries) {
      reg.unregisterSystem(system.id);
    }
  };
}

/**
 * Limpa todos os sistemas globais registrados (utilizado primariamente em testes unitários).
 */
export function _clearGlobalSystems(): void {
  globalSystems.clear();
  activeRegistries.clear();
}
