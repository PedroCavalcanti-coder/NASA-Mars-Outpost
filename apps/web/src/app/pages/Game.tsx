import { Navigate } from 'react-router';
import { getGuestName } from '../../lib/guest';
import { ButtonLink } from '../../ui/Button';
import { Logo } from '../../ui/Logo';

/** Página do jogo (placeholder: o jogo ainda será construído). Acessível sem conta. */
export default function Game() {
  const name = getGuestName();
  if (!name) return <Navigate to="/" replace />;
  return (
    <main className="notfound">
      <Logo />
      <span className="eyebrow">Astronauta {name}</span>
      <h1>Jogo</h1>
      <ButtonLink to="/" variant="ghost">
        Voltar ao início
      </ButtonLink>
    </main>
  );
}
