import { ArrowLeft } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { Logo } from '../ui/Logo';
import { MarsScene } from '../ui/MarsScene';

/** Login, cadastro e recuperação: arte à esquerda (desktop) e cartão do formulário. */
export function AuthLayout() {
  return (
    <div className="auth">
      <aside className="auth__art" aria-hidden>
        <MarsScene />
        <div className="auth__art-copy">
          <span className="eyebrow">Diário de missão · Sol 1</span>
          <p>
            “Habitat pressurizado. Painéis solares limpos. Quatro tripulantes prontos. Agora começa
            a parte difícil: manter tudo funcionando.”
          </p>
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
          Projeto educativo independente, sem vínculo oficial com a NASA.
        </p>
      </section>
    </div>
  );
}
