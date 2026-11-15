import {
  BookOpen,
  Compass,
  Cpu,
  HeartHandshake,
  Rocket,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { DONKI_SOURCE, MARS_SITES, MARS_TREK_URL, RADIATION_SOURCES } from '@mars/shared';
import { Link } from 'react-router';
import { GAME_EVENTS } from '../../game/events/events';
import '../../styles/publicPages.css';
import { L } from '../../lib/i18n';

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
            {L('Início', 'Home')}
          </Link>
          <Link to="/centro" className="public-nav-link">
            {L('Centro', 'Center')}
          </Link>
          <Link to="/suporte" className="public-nav-link">
            {L('Suporte', 'Support')}
          </Link>
          <Link to="/sobre" className="public-nav-link is-active">
            {L('Sobre', 'About')}
          </Link>
          <Link to="/" className="public-nav-cta">
            <Rocket size={16} /> {L('Jogar', 'Play')}
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="public-main-content">
        <section className="public-hero">
          <span className="public-eyebrow">
            <Sparkles size={15} /> {L('NOSSA MISSÃO E PROPÓSITO', 'OUR MISSION AND PURPOSE')}
          </span>
          <h1>{L('Sobre o Mars Outpost', 'About Mars Outpost')}</h1>
          <p>
            {L('Um projeto educacional e imersivo criado para o NASA Space Apps Challenge de Fortaleza, unindo ciência espacial, visualização 3D e gamificação da sobrevivência em Marte.', 'An educational, immersive project made for the NASA Space Apps Challenge in Fortaleza, mixing space science, 3D visuals and a game about surviving on Mars.')}
          </p>
        </section>

        {/* Pilares do Projeto */}
        <div className="public-grid-3">
          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <BookOpen size={24} color="#ffb511" />
              <h2 style={{ fontSize: 20, margin: 0 }}>{L('Educação Científica', 'Science Education')}</h2>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55, margin: 0 }}>
              {L('O objetivo principal é aproximar conceitos reais de astrofísica, biologia de plantas espaciais e engenharia aeroespacial do público geral de forma intuitiva, lúdica e visual.', 'The main goal is to bring real concepts of astrophysics, space plant biology and aerospace engineering to everyone in an intuitive, playful and visual way.')}
            </p>
          </div>

          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Compass size={24} color="#78ace1" />
              <h2 style={{ fontSize: 20, margin: 0 }}>{L('Geografia Planetária Real', 'Real Planetary Geography')}</h2>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55, margin: 0 }}>
              {L('Todas as 8 bases do jogo estão situadas em locais autênticos de Marte: cratera Jezero, Utopia Planitia, cratera Gale, Olympus Mons, Valles Marineris, Hellas, Elysium e Arcadia Planitia.', 'All 8 bases in the game are at real places on Mars: Jezero Crater, Utopia Planitia, Gale Crater, Olympus Mons, Valles Marineris, Hellas, Elysium and Arcadia Planitia.')}
            </p>
          </div>

          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Cpu size={24} color="#7fd6a0" />
              <h2 style={{ fontSize: 20, margin: 0 }}>{L('Engenharia 3D em Tempo Real', 'Real-Time 3D Engineering')}</h2>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 15, lineHeight: 1.55, margin: 0 }}>
              {L('Desenvolvido com Three.js e WebGL moderno, renderizando shaders dinâmicos de poeira marciana, ciclos de dia e noite solares e personalização completa de trajes espaciais.', 'Built with Three.js and modern WebGL, rendering dynamic Mars dust shaders, solar day-night cycles and full spacesuit customization.')}
            </p>
          </div>
        </div>

        {/* Fontes e créditos: de onde vem cada dado real do jogo */}
        <section className="public-card" id="fontes" style={{ padding: '36px 32px' }}>
          <h2 style={{ fontSize: 24, margin: '0 0 8px' }}>{L('Fontes e créditos dos dados reais', 'Sources and credits for the real data')}</h2>
          <p style={{ color: '#d0e2fc', fontSize: 15, lineHeight: 1.55, margin: '0 0 16px' }}>
            {L('Nada aqui é inventado sem aviso: estes são os dados reais usados no jogo e onde você pode conferir cada um. Os números são cópias curadas, sem chamada a APIs ao vivo.', 'Nothing here is made up without saying so: these are the real data used in the game and where you can check each one. Numbers are curated copies, with no live API calls.')}
          </p>
          <h3 style={{ fontSize: 17, margin: '12px 0 6px' }}>☢️ {L('Radiação e clima espacial', 'Radiation and space weather')}</h3>
          <ul style={{ color: '#c9dcf7', fontSize: 14.5, lineHeight: 1.6 }}>
            <li>
              <a href={DONKI_SOURCE.url} target="_blank" rel="noreferrer noopener">{DONKI_SOURCE.name}</a> {L('— explosões solares dos eventos de radiação', '— solar flares used in radiation events')}
            </li>
            {RADIATION_SOURCES.map((r) => (
              <li key={r.label}>
                <a href={r.url} target="_blank" rel="noreferrer noopener">{r.label}</a>
              </li>
            ))}
          </ul>
          <h3 style={{ fontSize: 17, margin: '12px 0 6px' }}>🗺️ {L('Mapas e lugares de Marte', 'Mars maps and places')}</h3>
          <ul style={{ color: '#c9dcf7', fontSize: 14.5, lineHeight: 1.6 }}>
            <li>
              <a href={MARS_TREK_URL} target="_blank" rel="noreferrer noopener">NASA Mars Trek</a> {L('— mapas e coordenadas', '— maps and coordinates')}
            </li>
            {Object.values(MARS_SITES).map((m) => (
              <li key={m.name}>
                {m.name} ({m.lat}°, {m.lon}°)
              </li>
            ))}
          </ul>
          <h3 style={{ fontSize: 17, margin: '12px 0 6px' }}>📸 {L('Eventos, fotos e fatos', 'Events, photos and facts')}</h3>
          <ul style={{ color: '#c9dcf7', fontSize: 14.5, lineHeight: 1.6 }}>
            {GAME_EVENTS.filter((e) => e.sourceUrl).map((e) => (
              <li key={e.id}>
                {e.icon} {L(e.title, e.title)}{' '}
                {e.credit && <span>({e.credit}) </span>}
                <a href={e.sourceUrl} target="_blank" rel="noreferrer noopener">{L('fonte', 'source')}</a>
              </li>
            ))}
          </ul>
          <p style={{ color: '#9fb6d8', fontSize: 13, margin: '12px 0 0' }}>
            {L('Também usamos fatos publicados pela NASA sobre MOXIE, Perseverance, Curiosity, a Estação Espacial e a Deep Space Network nos cartões “Você sabia?” e na vida real dos minigames.', 'We also use facts published by NASA about MOXIE, Perseverance, Curiosity, the Space Station and the Deep Space Network in the “Did you know?” cards and the real-life notes of the minigames.')}
          </p>
        </section>

        {/* Declaração e Agradecimentos */}
        <section className="public-card" style={{ padding: '36px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <ShieldCheck size={28} color="#ffb511" />
            <h2 style={{ fontSize: 24, margin: 0 }}>{L('NASA Space Apps Challenge 2026', 'NASA Space Apps Challenge 2026')}</h2>
          </div>
          <p style={{ color: '#d0e2fc', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 16px' }}>
            O <strong>Mars Outpost</strong> {L('é um projeto independente desenvolvido por entusiastas e estudantes de ciência espacial e tecnologia para o hackathon global NASA Space Apps Challenge Fortaleza.', 'is an independent project built by space science and technology enthusiasts and students for the global NASA Space Apps Challenge hackathon in Fortaleza.')}
          </p>
          <p style={{ color: '#d0e2fc', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 24px' }}>
            {L('Não há afiliação governamental formal, endosso ou patrocínio comercial direto da NASA. Todos os logotipos e menções da NASA e do Space Apps Challenge são marcas registradas de seus respectivos proprietários e são utilizados aqui para fins educativos e de submissão no evento.', 'There is no formal government affiliation, endorsement or direct commercial sponsorship from NASA. All NASA and Space Apps Challenge logos and mentions belong to their owners and are used here for education and event submission.')}
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
            <HeartHandshake size={18} color="#ffd63c" /> {L('Feito com paixão pela exploração espacial', 'Made with passion for space exploration')}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="public-footer">
        <div>© 2026 Mars Outpost · NASA Space Apps Challenge Fortaleza</div>
        <div className="public-footer-links">
          <Link to="/">{L('Início', 'Home')}</Link>
          <Link to="/centro">{L('Centro', 'Center')}</Link>
          <Link to="/suporte">{L('Suporte', 'Support')}</Link>
          <Link to="/sobre">{L('Sobre', 'About')}</Link>
          <Link to="/">{L('Jogar', 'Play')}</Link>
        </div>
      </footer>
    </div>
  );
}
