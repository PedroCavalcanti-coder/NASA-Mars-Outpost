import {
  BookOpen,
  Compass,
  Cpu,
  HeartHandshake,
  Rocket,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
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
          <Link to="/" className="public-nav-cta">
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
        <div className="public-grid-3">
          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <BookOpen size={24} color="#ffb511" />
              <h2 style={{ fontSize: 20, margin: 0 }}>Educação Científica</h2>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55, margin: 0 }}>
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
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55, margin: 0 }}>
              Todas as 8 bases do jogo estão situadas em locais autênticos de Marte: cratera Jezero,
              Utopia Planitia, cratera Gale, Olympus Mons, Valles Marineris, Hellas, Elysium e
              Arcadia Planitia.
            </p>
          </div>

          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Cpu size={24} color="#7fd6a0" />
              <h2 style={{ fontSize: 20, margin: 0 }}>Engenharia 3D em Tempo Real</h2>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55, margin: 0 }}>
              Desenvolvido com Three.js e WebGL moderno, renderizando shaders dinâmicos de poeira
              marciana, ciclos de dia e noite solares e personalização completa de trajes espaciais.
            </p>
          </div>
        </div>

        {/* Declaração e Agradecimentos */}
        <section className="public-card" style={{ padding: '36px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <ShieldCheck size={28} color="#ffb511" />
            <h2 style={{ fontSize: 24, margin: 0 }}>NASA Space Apps Challenge 2026</h2>
          </div>
          <p style={{ color: '#d0e2fc', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 16px' }}>
            O <strong>Mars Outpost</strong> é um projeto independente desenvolvido por entusiastas e
            estudantes de ciência espacial e tecnologia para o hackathon global NASA Space Apps
            Challenge Fortaleza.
          </p>
          <p style={{ color: '#d0e2fc', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 24px' }}>
            Não há afiliação governamental formal, endosso ou patrocínio comercial direto da NASA.
            Todos os logotipos e menções da NASA e do Space Apps Challenge são marcas registradas de
            seus respectivos proprietários e são utilizados aqui para fins educativos e de submissão
            no evento.
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              borderRadius: 30,
              background: 'rgba(120, 172, 225, 0.15)',
              border: '1px solid rgba(120, 172, 225, 0.35)',
              color: '#cde4ff',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <HeartHandshake size={18} color="#ffd63c" /> Feito com paixão pela exploração espacial
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="public-footer">
        <div>© 2026 Mars Outpost · NASA Space Apps Challenge Fortaleza</div>
        <div className="public-footer-links">
          <Link to="/">Início</Link>
          <Link to="/centro">Centro</Link>
          <Link to="/suporte">Suporte</Link>
          <Link to="/sobre">Sobre</Link>
          <Link to="/">Jogar</Link>
        </div>
      </footer>
    </div>
  );
}
