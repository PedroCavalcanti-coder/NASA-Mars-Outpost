import { GAME_NAME } from '@mars/shared';
import { describeSim } from '@mars/sim';

export function App() {
  return (
    <main className="home">
      <span className="eyebrow">Hackathon NASA · Fortaleza</span>
      <h1>{GAME_NAME}</h1>
      <p>Estamos construindo o jogo agora. Volte em breve.</p>
      <small>{describeSim()}</small>
    </main>
  );
}
