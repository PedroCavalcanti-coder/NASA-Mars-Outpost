import { MAX_SOLS, RESEARCH_GOAL } from '@mars/sim';
import { History, LogOut, RotateCcw, Skull, Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useMission } from '../../../store/mission';
import { L } from '../../../lib/i18n';

interface Props {
  /** cria um mundo novo (sala nova, missão do zero) */
  onRestart: () => void;
  onExit: () => void;
  /** há um salvamento deste mundo para voltar? */
  canRestore?: boolean;
  /** volta ao último salvamento */
  onRestore?: () => void;
  restoring?: boolean;
  restoreError?: string;
}

/** Tela de fim de partida: vitória (100% dos dados) ou derrota (moral zerada / sóis esgotados). */
export function MissionEnd({
  onRestart,
  onExit,
  canRestore = false,
  onRestore,
  restoring = false,
  restoreError = '',
}: Props) {
  const s = useMission((m) => m.state);
  const restart = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (s.status !== 'playing') restart.current?.focus();
  }, [s.status]);
  if (s.status === 'playing') return null;
  const won = s.status === 'won';

  return (
    <div
      className="mission-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-end-title"
    >
      <div className={`mission-end__card ${won ? 'is-won' : 'is-lost'}`}>
        <div className="mission-end__icon" aria-hidden="true">
          {won ? <Trophy size={40} /> : <Skull size={40} />}
        </div>
        <span className="mission-end__kicker">{won ? L('MISSÃO CUMPRIDA', 'MISSION ACCOMPLISHED') : L('MISSÃO ENCERRADA', 'MISSION OVER')}</span>
        <h2 id="mission-end-title">
          {won
            ? L('A pesquisa chegou a 100%!', 'Research reached 100%!')
            : s.lossReason === 'oxygen'
              ? L('A missão não pode ser concluída', 'The mission cannot be completed')
              : s.lossReason === 'morale'
                ? L('A tripulação foi evacuada', 'The crew was evacuated')
                : L('Os sóis da campanha acabaram', 'The campaign\'s sols are over')}
        </h2>
        <p>
          {won
            ? L(`A base enviou todos os dados científicos à Terra no sol ${s.sol} de ${MAX_SOLS}.`, `The base sent all the science data to Earth on sol ${s.sol} of ${MAX_SOLS}.`)
            : s.lossReason === 'oxygen'
              ? L('O oxigênio da base chegou a zero: o suporte à vida falhou. Troque o filtro de ar todo dia e mantenha a energia ligada. Você pode criar um mundo novo ou voltar ao último save.', 'The base oxygen reached zero: life support failed. Change the air filter every day and keep the power on. You can create a new world or go back to the last save.')
              : s.lossReason === 'morale'
                ? L('Sem moral, a equipe não conseguiu manter a base. Cuide da energia e dos mantimentos.', 'Without morale, the crew could not keep the base running. Take care of power and supplies.')
                : L(`A janela de retorno chegou com ${s.research} de ${RESEARCH_GOAL} pontos de dados.`, `The return window arrived with ${s.research} of ${RESEARCH_GOAL} data points.`)}
        </p>
        {restoreError && (
          <p className="mission-end__error" role="alert">
            {restoreError}
          </p>
        )}

        <dl className="mission-end__stats">
          <div>
            <dt>{L('Dados', 'Data')}</dt>
            <dd>{Math.round((s.research / RESEARCH_GOAL) * 100)}%</dd>
          </div>
          <div>
            <dt>Sol</dt>
            <dd>
              {s.sol}/{MAX_SOLS}
            </dd>
          </div>
          <div>
            <dt>{L('Moral', 'Morale')}</dt>
            <dd>{s.morale}%</dd>
          </div>
          <div>
            <dt>{L('Instalações', 'Facilities')}</dt>
            <dd>{s.facilities.solar + s.facilities.greenhouse + s.facilities.lab}</dd>
          </div>
        </dl>

        <div className="mission-end__buttons">
          <button type="button" className="game__action-btn" onClick={onRestart} ref={restart}>
            <RotateCcw size={18} />
            <span>{won ? L('Jogar de novo', 'Play again') : L('Criar mundo novo', 'Create a new world')}</span>
          </button>
          {!won && canRestore && (
            <button
              type="button"
              className="game__action-btn"
              onClick={onRestore}
              disabled={restoring}
            >
              <History size={18} />
              <span>{restoring ? 'Carregando…' : L('Voltar ao último save', 'Back to the last save')}</span>
            </button>
          )}
          <button
            type="button"
            className="game__action-btn game__action-btn--exit"
            onClick={onExit}
          >
            <LogOut size={18} />
            <span>{L('Voltar à Terra', 'Back to Earth')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
