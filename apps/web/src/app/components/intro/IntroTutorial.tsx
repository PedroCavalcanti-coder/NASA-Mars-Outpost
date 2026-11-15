import { type ReactElement, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../../../lib/i18n';
import { narrationSupported, speak, speakNow, stopSpeaking } from '../../../lib/narration';
import { BitCharacter } from '../bit/BitCharacter';
import './intro.css';

/**
 * Tutorial de abertura. Enquanto está aberto o personagem fica parado (a interface do jogo fica
 * `inert`) e o jogador lê painéis curtos, com figuras: por que estamos em Marte, o objetivo,
 * as bases e os eventos sorteados, o clima, o dia e a noite, os minigames, a radiação, os reparos
 * e como salvar. Cada painel tem poucas palavras, para crianças de 7 a 12 anos.
 */
interface Slide {
  id: string;
  title: [string, string];
  lines: Array<[string, string]>;
  figure: () => ReactElement;
  bit: 'excited' | 'thinking' | 'warning' | 'idle' | 'celebrating';
}

function Scene({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="intro__scene" role="img" aria-label={label}>
      {children}
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    id: 'why',
    title: ['Bem-vindo a Marte!', 'Welcome to Mars!'],
    lines: [
      ['Você e seus amigos são astronautas. Viajaram meses até Marte, o planeta vermelho.', 'You and your friends are astronauts. You travelled for months to Mars, the red planet.'],
      ['Missão: estudar o solo e procurar sinais de vida bem pequenininha (micróbios). Marte já teve vida?', 'Mission: study the soil and look for signs of tiny life (microbes). Did Mars ever have life?'],
    ],
    figure: () => (
      <Scene label={L('Foguete indo da Terra até Marte', 'A rocket flying from Earth to Mars')}>
        <span className="intro__planet intro__planet--earth">🌍</span>
        <span className="intro__path" aria-hidden="true">· · · · ·</span>
        <span className="intro__rocket">🚀</span>
        <span className="intro__planet intro__planet--mars">🔴</span>
      </Scene>
    ),
    bit: 'excited',
  },
  {
    id: 'goal',
    title: ['Seu objetivo', 'Your goal'],
    lines: [
      ['1) SOBREVIVER: mantenha oxigênio, energia, comida e blindagem da base acima de zero.', '1) SURVIVE: keep the base\'s oxygen, power, food and shielding above zero.'],
      ['2) COMPLETAR A PESQUISA: faça as missões de pesquisa até a barra chegar a 100%.', '2) FINISH THE RESEARCH: do the research missions until the bar reaches 100%.'],
    ],
    figure: () => (
      <Scene label={L('Recursos e barra de pesquisa', 'Resources and the research bar')}>
        <div className="intro__chips" aria-hidden="true">
          <span>🫁</span>
          <span>⚡</span>
          <span>🌾</span>
          <span>🛡️</span>
        </div>
        <div className="intro__bar" aria-hidden="true">
          <i />
          <b>🔬 100%</b>
        </div>
      </Scene>
    ),
    bit: 'thinking',
  },
  {
    id: 'random',
    title: ['Tudo muda a cada jogo', 'Every game is different'],
    lines: [
      ['A base é sorteada: cada partida tem uma base diferente. Explore para descobrir onde fica cada coisa!', 'The base is drawn at random: every game has a different base. Explore to find where everything is!'],
      ['Os eventos também são sorteados. Ninguém sabe o que vem amanhã.', 'Events are random too. Nobody knows what comes tomorrow.'],
    ],
    figure: () => (
      <Scene label={L('Dados e bases diferentes', 'Dice and different bases')}>
        <span className="intro__big intro__spin">🎲</span>
        <span className="intro__big">🏠</span>
        <span className="intro__big">🏗️</span>
      </Scene>
    ),
    bit: 'excited',
  },
  {
    id: 'weather',
    title: ['Eventos e clima', 'Events and weather'],
    lines: [
      ['Tempestades de poeira, nevascas de gelo seco, chuva de meteoros e explosões do Sol podem atingir a base.', 'Dust storms, dry-ice blizzards, meteor showers and solar flares can hit the base.'],
      ['Quando um aparece, um tablet pede uma decisão. Todos votam! Quanto mais astronautas na sala (até 4), mais eventos de clima.', 'When one shows up, a tablet asks for a decision. Everyone votes! The more astronauts in the room (up to 4), the more weather events.'],
    ],
    figure: () => (
      <Scene label={L('Tempestade, meteoros e Sol', 'Storm, meteors and the Sun')}>
        <span className="intro__big">🌪️</span>
        <span className="intro__big">☄️</span>
        <span className="intro__big">☀️</span>
        <span className="intro__big">❄️</span>
      </Scene>
    ),
    bit: 'warning',
  },
  {
    id: 'daynight',
    title: ['Dia e noite', 'Day and night'],
    lines: [
      ['Um dia marciano (um “Sol”) passa rápido. De dia há luz para os painéis solares e dá para trabalhar lá fora.', 'A Martian day (a “Sol”) goes by fast. By day there is light for the solar panels and you can work outside.'],
      ['À noite faz muito frio lá fora: fique dentro da base e cuide das tarefas internas. O rover só sai de dia!', 'At night it is freezing outside: stay in the base and do indoor jobs. The rover only goes out by day!'],
    ],
    figure: () => (
      <Scene label={L('Sol e Lua', 'Sun and Moon')}>
        <div className="intro__sky" aria-hidden="true">
          <span className="intro__sky-day">☀️ {L('Dia: sair, rover, reparos', 'Day: go out, rover, repairs')}</span>
          <span className="intro__sky-night">🌙 {L('Noite: ficar dentro', 'Night: stay inside')}</span>
        </div>
      </Scene>
    ),
    bit: 'idle',
  },
  {
    id: 'missions',
    title: ['Missões do dia', 'Missions of the day'],
    lines: [
      ['Todo dia chegam missões novas para manter a base funcionando: oxigênio, água, ar limpo, horta, painéis solares, antena…', 'New missions arrive every day to keep the base running: oxygen, water, clean air, garden, solar panels, antenna…'],
      ['Procure o marcador amarelo com “!”, chegue perto e aperte o botão. Cada missão é um minigame com ciência de verdade!', 'Look for the yellow “!” marker, walk up to it and press the button. Each mission is a minigame with real science!'],
    ],
    figure: () => (
      <Scene label={L('Ícones das missões', 'Mission icons')}>
        <span className="intro__mark">❗</span>
        <span className="intro__big">🫁</span>
        <span className="intro__big">💧</span>
        <span className="intro__big">🌱</span>
        <span className="intro__big">☀️</span>
        <span className="intro__big">📡</span>
      </Scene>
    ),
    bit: 'excited',
  },
  {
    id: 'radiation',
    title: ['Radiação ☢️', 'Radiation ☢️'],
    lines: [
      ['Marte não tem um escudo de ar como a Terra. Lá fora a radiação do Sol pode fazer mal.', 'Mars has no thick air shield like Earth. Outside, radiation from the Sun can be harmful.'],
      ['Explosões solares deixam a radiação ALTA: espere dentro da base até o aviso ficar verde. Em outros eventos você pode sair, mas gastando oxigênio.', 'Solar flares make radiation HIGH: wait inside the base until the warning turns green. In other events you can go out, but it uses oxygen.'],
    ],
    figure: () => (
      <Scene label={L('Medidor de radiação', 'Radiation meter')}>
        <div className="intro__gauge" aria-hidden="true">
          <span className="intro__gauge-ok">{L('Seguro', 'Safe')}</span>
          <span className="intro__gauge-mid">{L('Atenção', 'Careful')}</span>
          <span className="intro__gauge-bad">{L('Perigo', 'Danger')}</span>
          <i />
        </div>
        <span className="intro__big">☢️</span>
      </Scene>
    ),
    bit: 'warning',
  },
  {
    id: 'repairs',
    title: ['Reparos e rover', 'Repairs and rover'],
    lines: [
      ['Quando a blindagem da base racha, o conserto é feito do LADO DE FORA, com traje, em 5 tipos de minigame. Veja antes se a radiação está segura!', 'When the base shielding cracks, the fix is done OUTSIDE, in a suit, with 5 kinds of minigame. Check first that radiation is safe!'],
      ['O rover leva você numa expedição com neblina para achar 3 rochas com o radar. Se o tempo acabar, você volta sem perder nada.', 'The rover takes you on a foggy expedition to find 3 rocks with the radar. If time runs out you come back without losing anything.'],
    ],
    figure: () => (
      <Scene label={L('Chave inglesa e rover', 'Wrench and rover')}>
        <span className="intro__big">🔧</span>
        <span className="intro__big">🚙</span>
        <span className="intro__big">🪨</span>
      </Scene>
    ),
    bit: 'thinking',
  },
  {
    id: 'save',
    title: ['Salvar e enviar à Terra', 'Saving and sending to Earth'],
    lines: [
      ['Salvar: abra o menu ⚙️ e aperte “Salvar o Mundo”. O jogo também salva sozinho a cada 10 minutos.', 'To save: open the ⚙️ menu and press “Save the World”. The game also saves by itself every 10 minutes.'],
      ['Enviar dados: no computador de enlace com a Terra, mande a pesquisa que você já fez. O que foi enviado fica protegido dos eventos!', 'To send data: at the Earth-link computer, send the research you have done. Anything already sent is protected from events!'],
    ],
    figure: () => (
      <Scene label={L('Salvar e enviar dados', 'Save and send data')}>
        <span className="intro__big">💾</span>
        <span className="intro__path" aria-hidden="true">→</span>
        <span className="intro__big">📡</span>
        <span className="intro__path" aria-hidden="true">→</span>
        <span className="intro__big">🌍</span>
      </Scene>
    ),
    bit: 'idle',
  },
  {
    id: 'controls',
    title: ['Como jogar', 'How to play'],
    lines: [
      ['Computador: andar com W A S D ou setas, ou clicar no chão. Q abre os emojis e T abre as tarefas.', 'Computer: walk with W A S D or the arrows, or click the floor. Q opens emojis and T opens tasks.'],
      ['Celular e tablet: use a bolinha da tela para andar. Toque no B.I.T. a qualquer hora para pedir ajuda. Boa missão!', 'Phone and tablet: use the on-screen stick to walk. Tap B.I.T. any time to ask for help. Good luck!'],
    ],
    figure: () => (
      <Scene label={L('Teclado e joystick', 'Keyboard and joystick')}>
        <span className="intro__big">⌨️</span>
        <span className="intro__big">🕹️</span>
        <span className="intro__big">🧑‍🚀</span>
      </Scene>
    ),
    bit: 'celebrating',
  },
];

export const INTRO_SLIDE_COUNT = SLIDES.length;
const DONE_KEY = 'mo_intro_done';

export function introSeenBefore() {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberIntro() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* opcional */
  }
}

export function IntroTutorial({ onClose, canSkip }: { onClose: () => void; canSkip: boolean }) {
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const next = useRef<HTMLButtonElement>(null);
  const slide = SLIDES[index]!;
  const last = index === SLIDES.length - 1;

  const finish = () => {
    rememberIntro();
    onClose();
  };

  // o foco fica no botão principal (teclado e leitores de tela)
  // biome-ignore lint/correctness/useExhaustiveDependencies: refoca a cada painel
  useEffect(() => next.current?.focus(), [index]);

  // narração: lê o painel atual (título e frases)
  useEffect(() => {
    speak([L(slide.title[0], slide.title[1]), ...slide.lines.map((l) => L(l[0], l[1]))].join('. '));
    return () => stopSpeaking();
  }, [slide]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        if (last) finish();
        else setIndex((n) => n + 1);
      } else if (event.key === 'ArrowLeft') setIndex((n) => Math.max(0, n - 1));
      else if (event.key === 'Escape' && canSkip) finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return createPortal(
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby={titleId} data-slide={slide.id}>
      <div className="intro__card">
        <div className="intro__figure">{slide.figure()}</div>
        <div className="intro__body">
          <p className="intro__step">
            {L('Passo', 'Step')} {index + 1}/{SLIDES.length}
          </p>
          <h2 id={titleId}>{L(slide.title[0], slide.title[1])}</h2>
          {slide.lines.map((line) => (
            <p key={line[0]} className="intro__text">
              {L(line[0], line[1])}
            </p>
          ))}
        </div>
        <div className="intro__bit" aria-hidden="true">
          <BitCharacter expression={slide.bit} />
        </div>
        <div className="intro__dots" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <i key={s.id} className={i === index ? 'is-on' : i < index ? 'is-done' : ''} />
          ))}
        </div>
        <div className="intro__actions">
          {narrationSupported() && (
            <button
              type="button"
              className="intro__btn intro__btn--listen"
              onClick={() => speakNow([L(slide.title[0], slide.title[1]), ...slide.lines.map((l) => L(l[0], l[1]))].join('. '))}
            >
              🔊 {L('Ouvir', 'Listen')}
            </button>
          )}
          {index > 0 && (
            <button type="button" className="intro__btn" onClick={() => setIndex((n) => n - 1)}>
              ◀ {L('Voltar', 'Back')}
            </button>
          )}
          {canSkip && !last && (
            <button type="button" className="intro__btn intro__btn--ghost" onClick={finish}>
              {L('Pular', 'Skip')}
            </button>
          )}
          <button
            ref={next}
            type="button"
            className="intro__btn intro__btn--go"
            onClick={() => (last ? finish() : setIndex((n) => n + 1))}
          >
            {last ? L('Começar a missão! 🚀', 'Start the mission! 🚀') : `${L('Próximo', 'Next')} ▶`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
