import { Cookie } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getConsent, renewConsent, setConsent } from '../../lib/consent';
import './cookieConsent.css';
import { L } from '../../lib/i18n';

/**
 * Pergunta uma vez se o navegador pode guardar a chave que liga o jogador aos mundos salvos.
 * Dá para jogar sem aceitar, mas então o mundo não pode ser salvo (a menos que haja login).
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setVisible(true);
    else renewConsent();
  }, []);

  if (!visible) return null;

  const choose = (v: 'yes' | 'no') => {
    void setConsent(v);
    setVisible(false);
  };

  return (
    <section className="cookie-consent" aria-label={L('Cookie de salvamento', 'Save cookie')}>
      <Cookie size={22} aria-hidden="true" className="cookie-consent__icon" />
      <p>
        {L('Posso guardar um', 'Can I keep a')} <strong>{L('cookie', 'cookie')}</strong> {L('neste navegador? Ele cria uma chave que liga você aos mundos que salvar, para continuar de onde parou. Sem ele, dá para jogar, mas não salvar.', 'in this browser? It creates a key that links you to the worlds you save, so you can continue where you stopped. Without it, you can play but not save.')}
      </p>
      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__no" onClick={() => choose('no')}>
          {L('Agora não', 'Not now')}
        </button>
        <button type="button" className="cookie-consent__yes" onClick={() => choose('yes')}>
          {L('Permitir', 'Allow')}
        </button>
      </div>
    </section>
  );
}
