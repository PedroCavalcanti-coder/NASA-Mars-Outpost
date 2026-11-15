import { CheckCircle2, HelpCircle, LifeBuoy, MessageSquare, Rocket } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import '../../styles/publicPages.css';

const FAQS = [
  {
    q: 'Preciso criar conta para jogar?',
    a: 'Não! O Mars Outpost permite decolar e jogar imediatamente sem conta. Basta escolher o apelido do astronauta no momento do lançamento.',
  },
  {
    q: 'Como funcionam os controles na cena 3D?',
    a: 'Clique com o botão esquerdo no solo para mover seu astronauta ou interagir com painéis solares; arraste com o botão esquerdo para girar a maquete da base; arraste com o botão direito para mover o foco e use a roda do mouse para aproximar.',
  },
  {
    q: 'O jogo está lento ou travando no meu dispositivo. Como resolver?',
    a: 'Acesse o menu de Configurações (ícone de engrenagem), vá na aba "Vídeo" e selecione a qualidade "Baixo". Isso ajustará sombras e efeitos para máxima fluidez em celulares e notebooks.',
  },
  {
    q: 'Quais são as 8 bases marcianas disponíveis?',
    a: 'O simulador conta com bases em Jezero, Utopia, Gale, Olympus, Valles Marineris, Hellas, Elysium e Arcadia. A cada partida você pode explorar uma base diferente ou sortear outra diretamente pelo HUD.',
  },
  {
    q: 'Os dados científicos apresentados são reais?',
    a: 'Sim! As distâncias, ciclo de Sol (dia marciano de 24h), tecnologias de suporte de vida (MOXIE) e topografia planetária foram modeladas com base em dados de missões reais da NASA.',
  },
];

export default function Support() {
  const [sent, setSent] = useState(false);
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSent(true);
  };

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
          <Link to="/suporte" className="public-nav-link is-active">
            Suporte
          </Link>
          <Link to="/sobre" className="public-nav-link">
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
            <LifeBuoy size={15} /> CENTRAL DE AJUDA & TELEMETRIA
          </span>
          <h1>Suporte da Missão</h1>
          <p>
            Dúvidas frequentes sobre compatibilidade, controles da nave, desempenho gráfico e canal
            direto de contato com os desenvolvedores da missão.
          </p>
        </section>

        {/* Grid: FAQs e Formulário de Contato */}
        <div className="public-grid-2">
          {/* FAQs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2
              style={{
                fontSize: 24,
                margin: '0 0 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <HelpCircle size={22} color="#ffb511" /> Perguntas Frequentes
            </h2>

            {FAQS.map((faq) => (
              <div key={faq.q} className="public-card" style={{ padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#ffb511' }}>{faq.q}</h3>
                <p style={{ margin: 0, color: '#c9dcf7', fontSize: 14, lineHeight: 1.5 }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          {/* Form de Contato */}
          <div>
            <h2
              style={{
                fontSize: 24,
                margin: '0 0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <MessageSquare size={22} color="#78ace1" /> Relatar Problema ou Dúvida
            </h2>

            <div className="public-card">
              {sent ? (
                <div style={{ textAlign: 'center', padding: '28px 12px' }}>
                  <CheckCircle2 size={48} color="#7fd6a0" style={{ marginBottom: 14 }} />
                  <h3 style={{ fontSize: 22, margin: '0 0 8px' }}>Transmissão Enviada!</h3>
                  <p style={{ color: '#c9dcf7', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
                    Obrigado pelo seu relato. Nossa equipe de controle de missão analisará as
                    informações para aprimorar o Mars Outpost.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setMessage('');
                      setSubject('');
                    }}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 20,
                      border: '1px solid #78ace1',
                      background: 'rgba(28, 62, 130, 0.6)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Enviar outra mensagem
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div>
                    <label
                      htmlFor="support-subject"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#8fbbe9',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Assunto
                    </label>
                    <input
                      id="support-subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Ex: Lentidão no navegador, sugestão de base..."
                      required
                      style={{
                        width: '100%',
                        height: 44,
                        padding: '0 14px',
                        borderRadius: 10,
                        border: '1.5px solid rgba(120, 172, 225, 0.4)',
                        background: '#0d1a3c',
                        color: '#ffffff',
                        fontSize: 15,
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="support-email"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#8fbbe9',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Seu E-mail (Opcional)
                    </label>
                    <input
                      id="support-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="astronauta@exemplo.com"
                      style={{
                        width: '100%',
                        height: 44,
                        padding: '0 14px',
                        borderRadius: 10,
                        border: '1.5px solid rgba(120, 172, 225, 0.4)',
                        background: '#0d1a3c',
                        color: '#ffffff',
                        fontSize: 15,
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="support-msg"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#8fbbe9',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Mensagem ou Relato
                    </label>
                    <textarea
                      id="support-msg"
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Descreva com detalhes o que aconteceu..."
                      required
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1.5px solid rgba(120, 172, 225, 0.4)',
                        background: '#0d1a3c',
                        color: '#ffffff',
                        fontSize: 15,
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      alignSelf: 'flex-start',
                      padding: '10px 24px',
                      borderRadius: 30,
                      border: '2px solid #ffb511',
                      background: 'linear-gradient(135deg, #ffd63c, #ffb511)',
                      color: '#08122c',
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(255, 181, 17, 0.35)',
                      transition: 'all 0.2s',
                    }}
                  >
                    Transmitir Mensagem
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
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
