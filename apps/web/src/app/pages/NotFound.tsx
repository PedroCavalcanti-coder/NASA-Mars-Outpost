import { ButtonLink } from '../../ui/Button';

export default function NotFound() {
  return (
    <main className="notfound">
      <span className="eyebrow">Sinal perdido</span>
      <h1>404</h1>
      <p className="text-mute">
        Essa página não existe, ou a equipe de Marte ainda não a construiu.
      </p>
      <ButtonLink to="/" variant="primary">
        Voltar à base
      </ButtonLink>
    </main>
  );
}
