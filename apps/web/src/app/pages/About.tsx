import { BookOpen, Compass, Cpu, HeartHandshake, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import '../../styles/publicPages.css';

export default function About() {
  return (
    <div className="public-page">
      <div className="public-page-bg" />

      {/* Header */}
      <header className="public-page-header">
        <div className="public-header-brands">
          <Link to="/" className="public-brand">
            <img
              src="/assets/branding/mars-outpost-logo.svg"
              alt=""
              className="public-brand-mark"
            />
            <img
              src="/assets/branding/mars-outpost-wordmark.svg"
              alt="Mars Outpost"
              className="public-brand-name"
            />
          </Link>
          <span className="public-brand-divider" aria-hidden="true" />
          <img
            src="/assets/branding/space-apps-challenge.png"
            alt="Space Apps Challenge"
            className="public-space-apps-logo"
          />
        </div>

        <nav className="public-nav">
          <Link to="/" className="public-nav-link">
            Início
          </Link>
          <Link to="/centro" className="public-nav-link">
            Centro
          </Link>
          <Link to="/suporte" className="public-nav-link">
            Suporte
          </Link>
          <Link to="/sobre" className="public-nav-link is-active">
            Sobre
          </Link>
          <Link to="/jogar" className="public-nav-cta">
            <Rocket size={16} /> Jogar
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="public-main-content">
        <section className="public-hero">
          <span className="public-eyebrow">
            <Sparkles size={15} /> NOSSA MISSÃO E PROPÓSITO
          </span>
          <h1>Sobre o Mars Outpost</h1>
          <p>
            Um projeto educacional e imersivo criado para o NASA Space Apps Challenge de Fortaleza,
            unindo ciência espacial, visualização 3D e gamificação da sobrevivência em Marte.
          </p>
        </section>

        {/* Pilares do Projeto */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
            marginBottom: 44,
          }}
        >
          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <BookOpen size={24} color="#ffb511" />
              <h2 style={{ fontSize: 20, margin: 0 }}>Educação Científica</h2>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55 }}>
              O objetivo principal é aproximar conceitos reais de astrofísica, biologia de plantas
              espaciais e engenharia aeroespacial do público geral de forma intuitiva, lúdica e
              visual.
            </p>
          </div>

          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Compass size={24} color="#78ace1" />
              <h2 style={{ fontSize: 20, margin: 0 }}>Geografia Planetária Real</h2>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55 }}>
              Todas as 8 bases do jogo estão situadas em locais autênticos de Marte: cratera Jezero,
              Utopia Planitia, cratera Gale, Olympus Mons, Valles Marineris, Hellas, Elysium e
              Arcadia Planitia.
            </p>
          </div>

          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Cpu size={24} color="#7fd6a0" />
              <h2 style={{ fontSize: 20, margin: 0 }}>Arquitetura Tecnológica</h2>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55 }}>
              Construído com tecnologias modernas: React 19, TypeScript, Three.js para renderização
              3D acelerada por hardware, shaders customizados e modelos comprimidos com Meshopt para
              carregamento ultrarrápido.
            </p>
          </div>
        </div>

        {/* Detalhes e Disclaimer */}
        <section className="public-card" style={{ marginBottom: 36, padding: '32px 36px' }}>
          <h2 style={{ fontSize: 24, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={24} color="#ffb511" /> Declaração de Independência e Inspiração
          </h2>
          <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
            O <strong>Mars Outpost</strong> é um projeto independente concebido por entusiastas de
            tecnologia e exploração espacial no âmbito do hackathon global <em>NASA Space Apps Challenge</em>,
            na etapa local de Fortaleza.
          </p>
          <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Utilizamos dados e referências abertas disponibilizados pela NASA, JPL e agências
            espaciais internacionais para recriar as condições de Marte com rigor educativo. O
            projeto não possui endosso, afiliação direta ou patrocínio oficial da NASA.
          </p>
        </section>

        {/* Chamada para Ação */}
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Link to="/jogar" className="public-nav-cta" style={{ fontSize: 17, padding: '12px 32px' }}>
            <Rocket size={20} /> Embarcar na Missão Agora
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="public-footer">
        <span>MARS OUTPOST · PROJETO INDEPENDENTE PARA O NASA SPACE APPS CHALLENGE</span>
        <div className="public-footer-links">
          <Link to="/">Início</Link>
          <Link to="/centro">Centro</Link>
          <Link to="/suporte">Suporte</Link>
          <Link to="/sobre">Sobre</Link>
        </div>
      </footer>
    </div>
  );
}
