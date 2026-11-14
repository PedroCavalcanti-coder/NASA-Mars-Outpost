import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ClockRoomDelegate,
  GameClock,
  hoursToLMST,
  isDaytime,
  SOL_DURATION_SECONDS,
  simTimeToSolHour,
} from './clock';

beforeEach(() => {
  GameClock.reset();
});

describe('GameClock (Relógio do Jogo)', () => {
  it('inicializa no estado padrão correto (não pausado, 1x, tempo zero)', () => {
    const clock = new GameClock();
    expect(clock.isPaused()).toBe(false);
    expect(clock.getScale()).toBe(1);
    expect(clock.effectiveScale()).toBe(1);
    expect(clock.now()).toBe(0);
    expect(clock.canControl()).toBe(true);

    const snapshot = clock.getSnapshot();
    expect(snapshot.paused).toBe(false);
    expect(snapshot.scale).toBe(1);
    expect(snapshot.effectiveScale).toBe(1);
    expect(snapshot.canControl).toBe(true);
  });

  it('calcula effectiveScale corretamente quando pausado e despausado', () => {
    const clock = new GameClock();

    clock.setScale(2);
    expect(clock.effectiveScale()).toBe(2);

    clock.setPaused(true);
    expect(clock.effectiveScale()).toBe(0);

    clock.setPaused(false);
    expect(clock.effectiveScale()).toBe(2);

    clock.setScale(3);
    expect(clock.effectiveScale()).toBe(3);

    clock.setPaused(true);
    expect(clock.effectiveScale()).toBe(0);
  });

  it('alterna pausa com togglePaused', () => {
    const clock = new GameClock();
    expect(clock.isPaused()).toBe(false);

    clock.togglePaused();
    expect(clock.isPaused()).toBe(true);
    expect(clock.effectiveScale()).toBe(0);

    clock.togglePaused();
    expect(clock.isPaused()).toBe(false);
    expect(clock.effectiveScale()).toBe(1);
  });

  it('valida e ajusta escalas inválidas de tempo', () => {
    const clock = new GameClock();

    clock.setScale(2);
    expect(clock.getScale()).toBe(2);

    clock.setScale(3);
    expect(clock.getScale()).toBe(3);

    // Valores fora de 1|2|3 devem cair no padrão 1
    // @ts-expect-error teste com valor inválido
    clock.setScale(5);
    expect(clock.getScale()).toBe(1);

    // @ts-expect-error teste com valor negativo
    clock.setScale(-1);
    expect(clock.getScale()).toBe(1);
  });

  it('avança simTime proporcionalmente à escala e congela quando pausado', () => {
    const clock = new GameClock();

    // 10 segundos a 1x
    clock.tick(10);
    expect(clock.now()).toBe(10);

    // 10 segundos a 2x
    clock.setScale(2);
    clock.tick(10);
    expect(clock.now()).toBe(30); // 10 + 20

    // 10 segundos a 3x
    clock.setScale(3);
    clock.tick(10);
    expect(clock.now()).toBe(60); // 30 + 30

    // Pausado: simTime NÃO deve avançar
    clock.setPaused(true);
    clock.tick(10);
    expect(clock.now()).toBe(60);

    // Despausado a 1x
    clock.setPaused(false);
    clock.setScale(1);
    clock.tick(5);
    expect(clock.now()).toBe(65);
  });

  it('notifica ouvintes (listeners) ao mudar pausa ou escala', () => {
    const clock = new GameClock();
    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);

    clock.setPaused(true);
    expect(listener).toHaveBeenCalledTimes(1);

    clock.setScale(2);
    expect(listener).toHaveBeenCalledTimes(2);

    // Se o valor não mudar, não deve notificar novamente
    clock.setScale(2);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    clock.setPaused(false);
    expect(listener).toHaveBeenCalledTimes(2); // cancelado
  });

  it('reseta o relógio com o método reset', () => {
    const clock = new GameClock();
    clock.setPaused(true);
    clock.setScale(3);
    clock.tick(50);

    clock.reset();
    expect(clock.isPaused()).toBe(false);
    expect(clock.getScale()).toBe(1);
    expect(clock.now()).toBe(0);
    expect(clock.effectiveScale()).toBe(1);
  });
});

describe('GameClock - Multiplayer e Autoridade', () => {
  it('permite controle livre quando sozinho na sala', () => {
    const clock = new GameClock();
    const sendTime = vi.fn();
    const mockRoom: ClockRoomDelegate = {
      isCoordinator: () => true,
      playerCount: () => 1,
      sendTime,
    };

    clock.attachRoom(mockRoom);
    expect(clock.canControl()).toBe(true);

    const ok = clock.setPaused(true);
    expect(ok).toBe(true);
    expect(clock.isPaused()).toBe(true);
    expect(sendTime).toHaveBeenCalledWith(true, 1);
  });

  it('permite controle ao coordenador em sala cheia e transmite à rede', () => {
    const clock = new GameClock();
    const sendTime = vi.fn();
    const mockRoom: ClockRoomDelegate = {
      isCoordinator: () => true,
      playerCount: () => 3,
      sendTime,
    };

    clock.attachRoom(mockRoom);
    expect(clock.canControl()).toBe(true);

    clock.setScale(3);
    expect(sendTime).toHaveBeenCalledWith(false, 3);
  });

  it('bloqueia controle de jogador comum (não coordenador) em sala com mais de 1 pessoa', () => {
    const clock = new GameClock();
    const sendTime = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockRoom: ClockRoomDelegate = {
      isCoordinator: () => false,
      playerCount: () => 2,
      sendTime,
    };

    clock.attachRoom(mockRoom);
    expect(clock.canControl()).toBe(false);

    // Tentativa de pausar deve ser bloqueada
    const okPause = clock.setPaused(true);
    expect(okPause).toBe(false);
    expect(clock.isPaused()).toBe(false);
    expect(sendTime).not.toHaveBeenCalled();

    // Tentativa de mudar escala deve ser bloqueada
    const okScale = clock.setScale(2);
    expect(okScale).toBe(false);
    expect(clock.getScale()).toBe(1);
    expect(sendTime).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('aceita atualização remota (setFromRemote) mesmo sem autoridade local e sem eco de rede', () => {
    const clock = new GameClock();
    const sendTime = vi.fn();
    const mockRoom: ClockRoomDelegate = {
      isCoordinator: () => false,
      playerCount: () => 3,
      sendTime,
    };

    clock.attachRoom(mockRoom);
    clock.setFromRemote(true, 2);

    expect(clock.isPaused()).toBe(true);
    expect(clock.getScale()).toBe(2);
    expect(clock.effectiveScale()).toBe(0);
    // Não deve reenviar à rede o que veio da rede
    expect(sendTime).not.toHaveBeenCalled();
  });
});

describe('Conversão Hora / Sol e Helpers Marcianos', () => {
  it('converte horas decimais para string LMST HH:MM', () => {
    expect(hoursToLMST(9)).toBe('09:00');
    expect(hoursToLMST(9.5)).toBe('09:30');
    expect(hoursToLMST(18.75)).toBe('18:45');
    expect(hoursToLMST(0)).toBe('00:00');
    expect(hoursToLMST(24)).toBe('00:00');
    expect(hoursToLMST(25.5)).toBe('01:30');
  });

  it('identifica corretamente período diurno e noturno', () => {
    expect(isDaytime(6)).toBe(true);
    expect(isDaytime(12)).toBe(true);
    expect(isDaytime(17.99)).toBe(true);
    expect(isDaytime(18)).toBe(false); // Noite
    expect(isDaytime(22)).toBe(false);
    expect(isDaytime(0)).toBe(false);
    expect(isDaytime(5.99)).toBe(false);
  });

  it('calcula Sol e hora a partir de segundos acumulados', () => {
    // Começa às 09:00 no Sol 1
    const t0 = simTimeToSolHour(0);
    expect(t0.sol).toBe(1);
    expect(t0.hour).toBe(9);
    expect(t0.formatted).toBe('09:00');
    expect(t0.isDay).toBe(true);

    // Metade de um Sol (300 s reais) = +12 horas marcianas -> 09:00 + 12h = 21:00 (Noite)
    const tHalf = simTimeToSolHour(SOL_DURATION_SECONDS / 2);
    expect(tHalf.sol).toBe(1);
    expect(tHalf.hour).toBe(21);
    expect(tHalf.formatted).toBe('21:00');
    expect(tHalf.isDay).toBe(false);

    // 1 Sol completo (600 s) = +24 horas marcianas -> Sol 2, 09:00
    const t1 = simTimeToSolHour(SOL_DURATION_SECONDS);
    expect(t1.sol).toBe(2);
    expect(t1.hour).toBe(9);
    expect(t1.formatted).toBe('09:00');
  });
});
