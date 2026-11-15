import { useEffect } from 'react';
import { useMinigameResult } from '../../../game/minigameResult';
import { chime } from '../../../lib/chime';
import { L } from '../../../lib/i18n';
import './feedback.css';

/** Cartão de resultado: estrelas, som de vitória e um fato real. Some sozinho. */
export function MinigameResult() {
  const result = useMinigameResult((s) => s.result);
  useEffect(() => {
    if (!result) return;
    chime(result.stars === 3 ? [523, 659, 784, 1047] : result.stars === 2 ? [523, 659, 784] : [440, 523]);
    const id = window.setTimeout(() => useMinigameResult.setState({ result: null }), 6500);
    return () => window.clearTimeout(id);
  }, [result]);
  if (!result) return null;
  return (
    <div className="mg-result" role="status" key={result.key} onClick={() => useMinigameResult.setState({ result: null })}>
      <div className="mg-result__stars" aria-label={`${result.stars}/3`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= result.stars ? 'is-on' : ''} style={{ animationDelay: `${n * 140}ms` }}>★</span>
        ))}
      </div>
      <strong>{L(result.title[0], result.title[1])}</strong>
      <p>💡 {L(result.fact[0], result.fact[1])}</p>
    </div>
  );
}
