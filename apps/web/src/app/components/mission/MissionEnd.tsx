import { MAX_SOLS, RESEARCH_GOAL } from '@mars/sim';
import { LogOut, RotateCcw, Skull, Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useMission } from '../../../store/mission';

interface Props {
  onRestart: () => void;
  onExit: () => void;
}

/** Tela de fim de partida: vitória (100% dos dados) ou derrota (moral zerada / sóis esgotados). */
export function MissionEnd({ onRestart, onExit }: Props) {
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
            : s.lossReason === 'morale'
              ? 'A tripulação foi evacuada'
              : 'Os sóis da campanha acabaram'}
        </h2>
        <p>
          {won
            ? `A base enviou todos os dados científicos à Terra no sol ${s.sol} de ${MAX_SOLS}.`
            : s.lossReason === 'morale'
              ? 'Sem moral, a equipe não conseguiu manter a base. Cuide da energia e dos mantimentos.'
              : `A janela de retorno chegou com ${s.research} de ${RESEARCH_GOAL} pontos de dados.`}
        </p>

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
            <span>Jogar de novo</span>
          </button>
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
