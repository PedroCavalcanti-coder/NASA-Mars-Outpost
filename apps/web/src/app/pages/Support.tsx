import { CheckCircle2, HelpCircle, LifeBuoy, MessageSquare, MousePointer, Rocket, Send } from 'lucide-react';
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
    a: 'Arraste com o botão esquerdo para girar a câmera em órbita; arraste com o botão direito (ou toque com dois dedos) para mover o enquadramento; use a roda do mouse (ou pinça na tela) para aproximar ou afastar o zoom.',
  },
  {
    q: 'O jogo está lento ou travando no meu dispositivo. Como resolver?',
    a: 'Acesse o menu de Configurações na página inicial, vá na aba "Vídeo" e selecione a qualidade "Baixo". Isso reduzirá a resolução de sombras e efeitos pesados, garantindo fluidez mesmo em celulares e notebooks modestos.',
  },
  {
    q: 'Quais são as 8 bases marcianas disponíveis?',
    a: 'O simulador conta com bases em Jezero, Utopia, Gale, Olympus, Valles Marineris, Hellas, Elysium e Arcadia. A cada nova partida, uma das bases é sorteada com relevo, estufas, painéis solares e habitats fiéis.',
  },
  {
    q: 'Os dados científicos apresentados são reais?',
    a: 'Sim! As distâncias, duração do Sol (dia marciano), composição da atmosfera, dados de radiação e tecnologia MOXIE são baseados em pesquisas e missões reais da NASA e JPL.',
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
          <Link to="/jogar" className="public-nav-cta">
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 28,
          }}
        >
          {/* FAQs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 24, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <HelpCircle size={22} color="#ffb511" /> Perguntas Frequentes
            </h2>

            {FAQS.map((faq) => (
              <div key={faq.q} className="public-card" style={{ padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#ffb511' }}>{faq.q}</h3>
                <p style={{ margin: 0, color: '#c9dcf7', fontSize: 14, lineHeight: 1.5 }}>{faq.a}</p>
              </div>
            ))}
          </div>

          {/* Form de Contato / Relato de Bug */}
          <div>
            <h2 style={{ fontSize: 24, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label
                      htmlFor="support-subject"
                      style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8fbbe9', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}
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
                        border: '1.5px solid #78ace180',
                        background: '#0d1a3c',
                        color: '#ffffff',
                        fontSize: 15,
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="support-email"
                      style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8fbbe9', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}
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
                        border: '1.5px solid #78ace180',
                        background: '#0d1a3c',
                        color: '#ffffff',
                        fontSize: 15,
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="support-msg"
                      style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8fbbe9', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    >
                      Detalhes da Mensagem
                    </label>
                    <textarea
                      id="support-msg"
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Descreva o que ocorreu ou sua sugestão..."
                      required
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1.5px solid #78ace180',
                        background: '#0d1a3c',
                        color: '#ffffff',
                        fontSize: 15,
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      minHeight: 48,
                      border: '2px solid #ffb511',
                      borderRadius: 24,
                      background: 'linear-gradient(135deg, #ffd63c, #ffb511)',
                      color: '#0a1532',
                      font: '700 15px "Barlow", sans-serif',
                      cursor: 'pointer',
                      marginTop: 4,
                      boxShadow: '0 4px 15px rgba(255, 181, 17, 0.3)',
                    }}
                  >
                    <Send size={18} /> Transmitir Mensagem
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="public-footer">
        <span>MARS OUTPOST · SUPORTE E ENGENHARIA</span>
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
