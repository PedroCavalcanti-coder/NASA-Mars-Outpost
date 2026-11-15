import { Compass, Rocket } from 'lucide-react';
import { Link } from 'react-router';
import '../../styles/publicPages.css';
import { L } from '../../lib/i18n';

export default function NotFound() {
  return (
    <div className="public-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="public-page-bg" />
      <main
        className="public-card"
        style={{ maxWidth: 480, textAlign: 'center', margin: 24, padding: 36 }}
      >
        <span className="public-eyebrow" style={{ justifyContent: 'center' }}>
          <Compass size={15} /> {L('SINAL TELEMÉTRICO PERDIDO', 'TELEMETRY SIGNAL LOST')}
        </span>
        <h1 style={{ fontSize: 72, margin: '8px 0', color: '#ffb511', fontWeight: 800 }}>404</h1>
        <p style={{ color: '#c9dcf7', fontSize: 16, lineHeight: 1.5, marginBottom: 28 }}>
          {L('Essa coordenada não existe ou os módulos ainda não foram construídos pela equipe de Marte.', 'That coordinate does not exist or the modules have not been built by the Mars crew yet.')}
        </p>
        <Link to="/" className="public-nav-cta" style={{ justifyContent: 'center', width: '100%' }}>
          <Rocket size={18} /> {L('Retornar à Base Terrestre', 'Return to Earth Base')}
        </Link>
      </main>
    </div>
  );
}
