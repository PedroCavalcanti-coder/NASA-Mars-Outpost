import { Compass, Dices, Globe, Rocket, Shield, Users, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { BASE_IDS, type BaseId, baseThumbUrl, requestBase } from '../../lib/bases';
import '../../styles/publicPages.css';
import { L, t } from '../../lib/i18n';

const BASE_NAMES: Record<string, { title: string; region: string; desc: string }> = {
  jezero: {
    title: 'Cratera Jezero',
    region: 'Isidis Planitia',
    desc: 'Local de pouso do Perseverance, antigo leito de lago rico em sedimentos e minerais argilosos.',
  },
  utopia: {
    title: 'Utopia Planitia',
    region: 'Hemisfério Norte',
    desc: 'Vastas planícies com abundantes depósitos de gelo subterrâneo para extração de água.',
  },
  gale: {
    title: 'Cratera Gale',
    region: 'Aeolis Palus',
    desc: 'Ponto de exploração do Curiosity, com encostas do Monte Sharp expondo camadas geológicas históricas.',
  },
  olympus: {
    title: 'Olympus Mons',
    region: 'Planalto de Tharsis',
    desc: 'Ao sopé do maior vulcão do Sistema Solar, oferece tubos de lava naturais contra radiação.',
  },
  valles: {
    title: 'Valles Marineris',
    region: 'Canyon Equatorial',
    desc: 'O colossal desfiladeiro marciano com microclimas protegidos e grande pressão atmosférica local.',
  },
  hellas: {
    title: 'Hellas Planitia',
    region: 'Bacia de Impacto Sul',
    desc: 'A cratera mais profunda de Marte, com maior proteção contra radiação cósmica e ventos térmicos.',
  },
  elysium: {
    title: 'Elysium Planitia',
    region: 'Planície Vulcânica',
    desc: 'Região suave e estável investigada pela sonda InSight, ideal para construções modulares.',
  },
  arcadia: {
    title: 'Arcadia Planitia',
    region: 'Terras Baixas do Norte',
    desc: 'Planície com lençóis de gelo a poucos centímetros da superfície, vital para combustíveis.',
  },
};

export default function Center() {
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
          <Link to="/centro" className="public-nav-link is-active">
            {L('Centro', 'Center')}
          </Link>
          <Link to="/suporte" className="public-nav-link">
            {L('Suporte', 'Support')}
          </Link>
          <Link to="/sobre" className="public-nav-link">
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
            <Globe size={15} /> {L('CENTRO DE CONTROLE DE MISSÃO', 'MISSION CONTROL CENTER')}
          </span>
          <h1>{L('Comando da Expedição Ares', 'Ares Expedition Command')}</h1>
          <p>
            {L('Monitore os assentamentos humanos na superfície de Marte, conheça os 8 postos avançados modelados em 3D e prepare sua tripulação para a sobrevivência planetária.', 'Watch the human settlements on the surface of Mars, meet the 8 outposts modeled in 3D and get your crew ready to survive on another planet.')}
          </p>
        </section>

        {/* Telemetry Highlights */}
        <div className="public-grid-3">
          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Zap size={22} color="#ffb511" />
              <h3 style={{ margin: 0, fontSize: 18 }}>{L('Matriz Energética', 'Power Grid')}</h3>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              {L('Painéis solares fotovoltaicos otimizados e baterias de lítio de alta densidade alimentam os habitats contra as noites frias de até -125 °C.', 'Optimized solar panels and high-density lithium batteries power the habitats through cold nights down to -125 °C.')}
            </p>
          </div>

          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Shield size={22} color="#78ace1" />
              <h3 style={{ margin: 0, fontSize: 18 }}>{L('Suporte de Vida (ECLSS)', 'Life Support (ECLSS)')}</h3>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              {L('Sistemas de eletrólise MOXIE produzem oxigênio a partir do dióxido de carbono atmosférico, enquanto recicladores recuperam 98% da água.', 'MOXIE electrolysis systems make oxygen from atmospheric carbon dioxide, while recyclers recover 98% of the water.')}
            </p>
          </div>

          <div className="public-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Users size={22} color="#7fd6a0" />
              <h3 style={{ margin: 0, fontSize: 18 }}>{L('Tripulação e Estufas', 'Crew and Greenhouses')}</h3>
            </div>
            <p style={{ color: '#c9dcf7', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              {L('Estufas hidropônicas pressurizadas cultivam batatas, tomates e alfaces frescas para manter a nutrição e moral dos astronautas em solo marciano.', 'Pressurized hydroponic greenhouses grow fresh potatoes, tomatoes and lettuce to keep astronauts fed and in good spirits on Mars.')}
            </p>
          </div>
        </div>

        {/* The 8 Bases Catalog */}
        <section>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className="public-eyebrow">
              <Compass size={14} /> {L('TOPOGRAFIA RECONHECIDA', 'MAPPED TERRAIN')}
            </span>
            <h2 style={{ fontSize: 32, margin: '4px 0 8px', color: '#fff' }}>
              {L('As 8 Bases Marcianas em 3D', 'The 8 Mars Bases in 3D')}
            </h2>
            <p style={{ color: '#c5dcf7', maxWidth: 600, margin: '0 auto' }}>
              {L('Cada partida sorteia uma das regiões reais mapeadas por sondas e rovers da NASA.', 'Each game picks one of the real regions mapped by NASA probes and rovers.')}
            </p>
          </div>

          <div className="public-grid-bases">
            {BASE_IDS.map((id) => {
              const meta = BASE_NAMES[id] ?? {
                title: `Base ${id}`,
                region: 'Região Marciana',
                desc: 'Módulos de pesquisa e suporte de vida.',
              };
              return (
                <div
                  key={id}
                  className="public-card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <img
                    src={baseThumbUrl(id)}
                    alt={t(meta.title)}
                    style={{
                      width: '100%',
                      height: 160,
                      objectFit: 'cover',
                      borderBottom: '1px solid rgba(120, 172, 225, 0.3)',
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div
                    style={{
                      padding: '20px 22px',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <span
                      style={{
                        color: '#ffb511',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      {t(meta.region)}
                    </span>
                    <h3 style={{ margin: '0 0 8px', fontSize: 20 }}>{t(meta.title)}</h3>
                    <p
                      style={{
                        color: '#c5dcf7',
                        fontSize: 13,
                        lineHeight: 1.45,
                        flex: 1,
                        margin: '0 0 16px',
                      }}
                    >
                      {t(meta.desc)}
                    </p>
                    <Link
                      to="/"
                      onClick={() => requestBase(id as BaseId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '9px 16px',
                        borderRadius: 20,
                        border: '1.5px solid #78ace1',
                        background: 'rgba(28, 62, 130, 0.65)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      {L('Explorar Esta Base', 'Explore This Base')}
                    </Link>
                  </div>
                </div>
              );
            })}
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
