import { Cookie } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getConsent, renewConsent, setConsent } from '../../lib/consent';
import './cookieConsent.css';

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
    <section className="cookie-consent" aria-label="Cookie de salvamento">
      <Cookie size={22} aria-hidden="true" className="cookie-consent__icon" />
      <p>
        Posso guardar um <strong>cookie</strong> neste navegador? Ele cria uma chave que liga você
        aos mundos que salvar, para continuar de onde parou. Sem ele, dá para jogar, mas não salvar.
      </p>
      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__no" onClick={() => choose('no')}>
          Agora não
        </button>
        <button type="button" className="cookie-consent__yes" onClick={() => choose('yes')}>
          Permitir
        </button>
      </div>
    </section>
  );
}
