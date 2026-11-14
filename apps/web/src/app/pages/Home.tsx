import { Rocket, Shield, Users, Zap } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../store/auth';
import { Button, ButtonLink } from '../../ui/Button';
import { Logo } from '../../ui/Logo';
import { MarsScene } from '../../ui/MarsScene';
import { PlayModal } from './PlayModal';

const FEATURES = [
  {
    icon: Zap,
    title: 'Energia, água, ar e comida',
    text: 'Equilibre os sistemas que mantêm a tripulação viva e veja as consequências de cada decisão.',
  },
  {
    icon: Users,
    title: 'Cooperação de 1 a 4 jogadores',
    text: 'Cada pessoa assume um papel. Planejem juntos, dividam tarefas e respondam a emergências.',
  },
  {
    icon: Shield,
    title: 'Ciência por trás do jogo',
    text: 'Poeira, radiação, atmosfera rarefeita: conceitos reais explicados de forma simples.',
  },
];

export default function Home() {
  const user = useAuth((s) => s.user);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="home">
      <PlayModal open={playing} onClose={() => setPlaying(false)} />
      <section className="home__hero">
        <nav className="home__nav">
          <Logo />
          <div className="home__nav-actions">
            {user ? (
              <ButtonLink to="/central" variant="primary">
                Ir para a central
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost">
                  Entrar
                </ButtonLink>
                <ButtonLink to="/cadastro" variant="primary">
                  Criar conta
                </ButtonLink>
              </>
            )}
          </div>
        </nav>
        <MarsScene className="home__scene" />
        <div className="home__content">
          <span className="eyebrow">Hackathon NASA · Fortaleza</span>
          <h1>
            Mars <em>Outpost</em>
          </h1>
          <p className="home__lead">
            Jogo educativo cooperativo de gerenciamento e sobrevivência: monte a equipe, cuide da
            base e enfrente Marte, uma decisão de cada vez.
          </p>
          <div className="home__cta">
            <Button variant="primary" size="lg" icon={<Rocket />} onClick={() => setPlaying(true)}>
              Jogar
            </Button>
            {!user && (
              <ButtonLink to="/cadastro" variant="ghost" size="lg">
                Criar conta
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <section className="home__features" aria-label="Destaques">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <article key={title} className="card feature">
            <span className="feature__icon">
              <Icon size={22} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <footer className="home__foot">
        Projeto independente criado para o NASA Space Apps Challenge. Não há endosso nem parceria
        oficial da NASA.
      </footer>
    </div>
  );
}
