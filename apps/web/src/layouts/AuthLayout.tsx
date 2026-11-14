import { ArrowLeft, Sparkles } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { Logo } from '../ui/Logo';

/** Login, cadastro e recuperação: arte cósmica à esquerda e painel do formulário. */
export function AuthLayout() {
  return (
    <div className="auth">
      <aside className="auth__art" aria-hidden>
        <div className="auth__art-copy">
          <span
            className="eyebrow"
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ffb511' }}
          >
            <Sparkles size={14} /> Diário de Missão · Sol 1
          </span>
          <p>
            “Habitat pressurizado. Painéis solares limpos. Quatro tripulantes prontos. Agora começa
            a parte difícil: manter tudo funcionando.”
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            <img
              src="/assets/branding/mars-outpost-logo.svg"
              alt=""
              width={38}
              height={38}
              style={{ objectFit: 'contain' }}
            />
            <span
              style={{ fontSize: 13, color: '#8fbbe9', letterSpacing: '0.12em', fontWeight: 700 }}
            >
              MARS OUTPOST · EXPEDIÇÃO ARES
            </span>
          </div>
        </div>
      </aside>

      <section className="auth__side">
        <header className="auth__top">
          <Logo />
          <Link to="/" className="auth__back">
            <ArrowLeft size={18} /> Voltar ao site
          </Link>
        </header>
        <div className="auth__card panel">
          <Outlet />
        </div>
        <p className="auth__legal">
          Projeto educativo independente desenvolvido para o NASA Space Apps Challenge Fortaleza.
        </p>
      </section>
    </div>
  );
}
