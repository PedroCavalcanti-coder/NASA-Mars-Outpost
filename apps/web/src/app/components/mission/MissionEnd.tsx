import { MAX_SOLS, RESEARCH_GOAL } from '@mars/sim';
import { History, LogOut, RotateCcw, Skull, Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useMission } from '../../../store/mission';

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
        <span className="mission-end__kicker">{won ? 'MISSÃO CUMPRIDA' : 'MISSÃO ENCERRADA'}</span>
        <h2 id="mission-end-title">
          {won
            ? 'A pesquisa chegou a 100%!'
            : s.lossReason === 'oxygen'
              ? 'A missão não pode ser concluída'
              : s.lossReason === 'morale'
                ? 'A tripulação foi evacuada'
                : 'Os sóis da campanha acabaram'}
        </h2>
        <p>
          {won
            ? `A base enviou todos os dados científicos à Terra no sol ${s.sol} de ${MAX_SOLS}.`
            : s.lossReason === 'oxygen'
              ? 'O oxigênio da base chegou a zero: o suporte à vida falhou. Troque o filtro de ar todo dia e mantenha a energia ligada. Você pode criar um mundo novo ou voltar ao último save.'
              : s.lossReason === 'morale'
                ? 'Sem moral, a equipe não conseguiu manter a base. Cuide da energia e dos mantimentos.'
                : `A janela de retorno chegou com ${s.research} de ${RESEARCH_GOAL} pontos de dados.`}
        </p>
        {restoreError && (
          <p className="mission-end__error" role="alert">
            {restoreError}
          </p>
        )}

        <dl className="mission-end__stats">
          <div>
            <dt>Dados</dt>
            <dd>{Math.round((s.research / RESEARCH_GOAL) * 100)}%</dd>
          </div>
          <div>
            <dt>Sol</dt>
            <dd>
              {s.sol}/{MAX_SOLS}
            </dd>
          </div>
          <div>
            <dt>Moral</dt>
            <dd>{s.morale}%</dd>
          </div>
          <div>
            <dt>Instalações</dt>
            <dd>{s.facilities.solar + s.facilities.greenhouse + s.facilities.lab}</dd>
          </div>
        </dl>

        <div className="mission-end__buttons">
          <button type="button" className="game__action-btn" onClick={onRestart} ref={restart}>
            <RotateCcw size={18} />
            <span>{won ? 'Jogar de novo' : 'Criar mundo novo'}</span>
          </button>
          {!won && canRestore && (
            <button
              type="button"
              className="game__action-btn"
              onClick={onRestore}
              disabled={restoring}
            >
              <History size={18} />
              <span>{restoring ? 'Carregando…' : 'Voltar ao último save'}</span>
            </button>
          )}
          <button
            type="button"
            className="game__action-btn game__action-btn--exit"
            onClick={onExit}
          >
            <LogOut size={18} />
            <span>Voltar à Terra</span>
          </button>
        </div>
      </div>
    </div>
  );
}
