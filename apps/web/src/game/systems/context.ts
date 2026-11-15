import type * as THREE from 'three';

/**
 * Contexto da simulação exposto a todos os GameSystems a cada quadro.
 * Dados de estado são somente leitura para garantir desacoplamento.
 * Ações permitem aos sistemas interferir de forma controlada no jogador e na cena.
 */
export interface SystemContext {
  /** Posição atual do jogador local no mundo (somente leitura). */
  readonly playerPosition: Readonly<{ x: number; y: number; z: number }>;

  /** Se o jogador local está dentro das instalações da base (cômodo ou corredor). */
  readonly insideBase: boolean;

  /** Se o jogador local está dirigindo um veículo (rover). */
  readonly driving: boolean;

  /**
   * Missão automática do rover: o astronauta viaja na cabine pressurizada e o tanque do traje
   * não gasta (o custo de oxigênio da missão já sai do estoque da base).
   */
  readonly sheltered?: boolean;

  /** Fator de noite no ambiente marciano (0.0 = dia pleno, 1.0 = noite fechada). */
  readonly night: number;

  /** Intensidade atual da tempestade de poeira (0.0 = sem tempestade, 1.0 = tempestade máxima). */
  readonly storm: number;

  /** Modo de câmera atual ('follow' segue o jogador, 'free' câmera livre). */
  readonly cameraMode: 'follow' | 'free';

  /**
   * Faz o relógio do mundo avançar até a hora dada (0..24), como ao dormir.
   * Devolve quantas horas passaram (0 se não for permitido, ex.: outro jogador coordena a sala).
   */
  sleepUntil(hour: number): number;

  // ---- Ações permitidas para os sistemas ----

  /**
   * Teletransporta o jogador para o ponto especificado,
   * encaixando no ponto navegável mais próximo e zerando caminho/velocidade.
   */
  teleportPlayerTo(point: { x: number; y?: number; z: number }): void;

  /**
   * Define o multiplicador de velocidade do astronauta (multiplica MAX_SPEED).
   */
  setPlayerSpeedScale(scale: number): void;

  /**
   * Bloqueia ou desbloqueia a saída da base: impede que o A* e o teclado
   * saiam dos cômodos/corredores para o exterior.
   */
  blockExitFromBase(on: boolean): void;

  /**
   * Coloca o astronauta para dormir ou o acorda:
   * impede novos comandos e toca a animação de Idle.
   */
  setPlayerSleeping(on: boolean): void;

  /**
   * Transiciona uma sobreposição preta sobre a tela para efeito de fade/escurecimento.
   * @param opacity Opacidade alvo entre 0 (transparente) e 1 (totalmente preto).
   * @param ms Duração da transição em milissegundos.
   */
  fadeScreen(opacity: number, ms: number): void;

  /**
   * Obtém a coordenada 3D do centro da enfermaria (sala com kind 'Medicina').
   * Se a base não possuir sala de Medicina, usa a de 'Habitacao'; fallback: primeiro cômodo.
   */
  getInfirmaryPoint(): THREE.Vector3;
}
