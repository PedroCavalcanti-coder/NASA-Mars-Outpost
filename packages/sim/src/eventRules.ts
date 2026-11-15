/**
 * Eventos da base (funções puras, sem Three.js nem React).
 *
 * Todo evento abre um tablet com uma situação e algumas opções: cada opção tem um resultado
 * (recursos, pesquisa e/ou um efeito no mundo). Regras:
 *  - nenhum evento acontece nos 3 primeiros Sóis (`EVENT_FIRST_SOL`);
 *  - a partir do Sol 4 há um evento FÁCIL por dia (pequenas escolhas, baixo risco);
 *  - e, com alguma chance, um evento GRANDE (tempestade, avaria, erupção…) com riscos de verdade.
 * O sorteio depende só da semente da sala e do Sol: todos os jogadores veem o mesmo evento.
 */

import { seeded } from './operations';

/** eventos fáceis começam no 2º Sol; os difíceis (grandes), a partir do 4º */
export const EVENT_FIRST_SOL = 2;
export const MAJOR_FIRST_SOL = 4;
/** chance de um evento grande no dia, além do fácil */
export const MAJOR_EVENT_CHANCE = 0.45;

export type EventKind = 'easy' | 'major';

/** Efeitos no mundo 3D que o `BaseViewer` sabe aplicar. */
export type WorldEffect =
  | { type: 'storm'; strength: number }
  | { type: 'storm_end' }
  | { type: 'dust'; amount: number }
  | { type: 'clean_panels' }
  | { type: 'clog_filter' }
  | { type: 'wilt_crop' };

export type EventDeltas = Partial<
  Record<'energy' | 'supplies' | 'oxygen' | 'armor' | 'research', number>
>;

export interface EventOutcome {
  tone: 'good' | 'bad' | 'info';
  /** o que aconteceu (mostrado no tablet depois da escolha) */
  text: string;
  deltas?: EventDeltas;
  effects?: WorldEffect[];
}

export interface EventChoice {
  id: string;
  label: string;
  /** dica curta do que a escolha envolve ("gasta energia", "arriscado") */
  hint: string;
  outcome: EventOutcome;
  /** com esta chance (0..1) o resultado é `risk.outcome` em vez do normal */
  risk?: { chance: number; outcome: EventOutcome };
}

export interface GameEventDef {
  id: string;
  kind: EventKind;
  title: string;
  icon: string;
  body: string;
  /** foto real da NASA (em /assets/events) e seu crédito */
  image?: string;
  credit?: string;
  /** "Detecção orbital": o que o satélite viu */
  orbital?: string;
  /** "Você sabia?": o fato histórico por trás do evento */
  history?: string;
  sourceUrl?: string;
  /** efeito visual em tela (ver EventFx) */
  fx?: 'blizzard' | 'meteor' | 'radiation' | 'dust_devil' | 'ice_clouds';
  weight: number;
  choices: EventChoice[];
}

export const GAME_EVENTS: readonly GameEventDef[] = [
  // ------------------------------------------------------------------ grandes
  // ------------------------------------------------------------------ NASA (com foto e fato real)
  {
    id: 'co2_blizzard',
    kind: 'major',
    title: 'Nevasca de CO₂',
    icon: '❄️',
    fx: 'blizzard',
    image: '/assets/events/co2_blizzard.jpg',
    credit: 'NASA/JPL-Caltech · PIA16138',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA16138',
    orbital:
      'O satélite detectou uma frente de nuvens de gelo seco sobre a base. A temperatura cai a −125 °C e flocos de CO₂ devem cobrir os painéis e o casco.',
    history:
      'Em Marte neva gelo seco: em 2012 a sonda MRO da NASA confirmou neve de dióxido de carbono, com cristais em forma de cubo, caindo perto do polo.',
    body: 'Uma nevasca de dióxido de carbono se aproxima. Como a base deve se preparar?',
    weight: 3,
    choices: [
      {
        id: 'heat',
        label: 'Aquecer a base',
        hint: 'seguro · gasta energia',
        outcome: {
          tone: 'info',
          text: 'A base aqueceu os módulos e a nevasca passou sem danos.',
          deltas: { energy: -10 },
        },
      },
      {
        id: 'collect',
        label: 'Coletar gelo',
        hint: 'ciência · arriscado',
        outcome: {
          tone: 'good',
          text: 'A equipe coletou flocos de CO₂ para análise. Dados raros!',
          deltas: { research: 3, energy: -6 },
        },
        risk: {
          chance: 0.3,
          outcome: {
            tone: 'bad',
            text: 'O frio rachou parte da blindagem durante a coleta.',
            deltas: { armor: -15, energy: -4 },
          },
        },
      },
      {
        id: 'ignore',
        label: 'Ignorar',
        hint: 'tática · arriscado',
        outcome: {
          tone: 'info',
          text: 'A nevasca passou. O gelo desgastou um pouco a blindagem.',
          deltas: { armor: -5 },
        },
        risk: {
          chance: 0.3,
          outcome: {
            tone: 'bad',
            text: 'O gelo travou os sistemas e rachou o casco.',
            deltas: { energy: -12, armor: -20, supplies: -6 },
          },
        },
      },
    ],
  },
  {
    id: 'meteor_shower',
    kind: 'major',
    title: 'Chuva de meteoritos',
    icon: '☄️',
    fx: 'meteor',
    image: '/assets/events/meteor_shower.jpg',
    credit: 'NASA/JPL-Caltech/UArizona · PIA25583',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA25583',
    orbital:
      'Múltiplos fragmentos de meteoritos em rota de colisão com o setor Norte. Impacto iminente. Todos os sistemas devem ser preparados.',
    history:
      'O módulo InSight da NASA detectou impactos de meteoroides em Marte com seu sismógrafo, registrando "martemotos". Um impacto de 2021 abriu uma cratera de 150 m que expôs gelo de água.',
    body: 'Fragmentos de meteoritos vão atingir a região da base. O que fazer?',
    weight: 2,
    choices: [
      {
        id: 'shelter',
        label: 'Abrigo reforçado',
        hint: 'seguro · gasta energia',
        outcome: {
          tone: 'info',
          text: 'Todos se abrigaram. A blindagem absorveu os impactos menores.',
          deltas: { armor: -10, energy: -8 },
        },
      },
      {
        id: 'record',
        label: 'Gravar impactos',
        hint: 'ciência · arriscado',
        outcome: {
          tone: 'good',
          text: 'O sismógrafo gravou os impactos de perto. Ótimos dados!',
          deltas: { research: 4, energy: -5 },
        },
        risk: {
          chance: 0.4,
          outcome: {
            tone: 'bad',
            text: 'Um fragmento atingiu o casco enquanto gravávamos.',
            deltas: { armor: -20, energy: -5 },
          },
        },
      },
      {
        id: 'reinforce',
        label: 'Reforçar casco',
        hint: 'gasta energia',
        outcome: {
          tone: 'good',
          text: 'Placas extras reforçaram o casco antes do impacto.',
          deltas: { armor: 5, energy: -7 },
        },
      },
    ],
  },
  {
    id: 'radiation_storm',
    kind: 'major',
    title: 'Tempestade de radiação solar',
    icon: '☢️',
    fx: 'radiation',
    image: '/assets/events/radiation_storm.jpg',
    credit: 'NASA/JPL-Caltech · PIA26302',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA26302',
    orbital:
      'Uma erupção solar de classe X atinge Marte. Sem campo magnético, a radiação sobe rápido na superfície. Sensores podem saturar.',
    history:
      'Em maio de 2024 uma tempestade solar histórica encheu de "neve" (pontos de radiação) as imagens do Curiosity, enquanto a MAVEN registrou auroras globais.',
    body: 'A radiação solar vai atravessar a atmosfera fina de Marte. Qual a resposta?',
    weight: 2,
    choices: [
      {
        id: 'module',
        label: 'Módulo blindado',
        hint: 'seguro · gasta energia',
        outcome: {
          tone: 'info',
          text: 'A equipe esperou no módulo blindado. A blindagem foi desgastada.',
          deltas: { armor: -10, energy: -10 },
        },
      },
      {
        id: 'sensors',
        label: 'Manter sensores ligados',
        hint: 'ciência · arriscado',
        outcome: {
          tone: 'good',
          text: 'Dados raros da radiação em Marte chegaram à Terra!',
          deltas: { research: 4 },
        },
        risk: {
          chance: 0.45,
          outcome: {
            tone: 'bad',
            text: 'A radiação queimou sensores e corrompeu dados.',
            deltas: { armor: -15, research: -3, oxygen: -8 },
          },
        },
      },
      {
        id: 'panels_off',
        label: 'Desligar painéis',
        hint: 'tática · custo certo',
        outcome: {
          tone: 'info',
          text: 'Painéis desligados: nada queimou, mas a base gastou reservas.',
          deltas: { energy: -15, supplies: -4 },
        },
      },
    ],
  },
  {
    id: 'giant_dust_devil',
    kind: 'major',
    title: 'Redemoinho gigante',
    icon: '🌀',
    fx: 'dust_devil',
    image: '/assets/events/giant_dust_devil.jpg',
    credit: 'NASA/JPL-Caltech/UArizona · PIA15545',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA15545',
    orbital:
      'Um redemoinho de poeira de grande porte cruza o campo solar em direção à base. A poeira pode cobrir ou limpar os painéis.',
    history:
      'Redemoinhos de poeira (dust devils) marcianos podem ter quilômetros de altura. Em 2005 o rover Spirit teve os painéis solares limpos por rajadas assim.',
    body: 'Um redemoinho de poeira vem na direção da base.',
    weight: 2,
    choices: [
      {
        id: 'protect',
        label: 'Proteger a base',
        hint: 'seguro · gasta energia',
        outcome: {
          tone: 'info',
          text: 'A equipe fechou as entradas. O redemoinho passou sem danos.',
          deltas: { energy: -3 },
        },
      },
      {
        id: 'film',
        label: 'Filmar',
        hint: 'ciência · arriscado',
        outcome: {
          tone: 'good',
          text: 'Imagens raras do redemoinho de perto!',
          deltas: { research: 3, energy: -4 },
        },
        risk: {
          chance: 0.35,
          outcome: {
            tone: 'bad',
            text: 'A poeira entrou na despensa e estragou mantimentos.',
            deltas: { supplies: -10 },
          },
        },
      },
      {
        id: 'clean',
        label: 'Limpar painéis',
        hint: 'tática · arriscado',
        outcome: {
          tone: 'good',
          text: 'A rajada varreu a poeira de todos os painéis!',
          effects: [{ type: 'clean_panels' }],
        },
        risk: {
          chance: 0.35,
          outcome: {
            tone: 'bad',
            text: 'A rajada arrancou placas do casco e trouxe mais poeira.',
            deltas: { armor: -10, energy: -4 },
            effects: [{ type: 'dust', amount: 0.2 }],
          },
        },
      },
    ],
  },
  {
    id: 'ice_clouds',
    kind: 'major',
    title: 'Nuvens de gelo iridescentes',
    icon: '🌫️',
    fx: 'ice_clouds',
    image: '/assets/events/ice_clouds.jpg',
    credit: 'NASA/JPL-Caltech/MSSS · PIA24662',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA24662',
    orbital:
      'Nuvens de cristais de CO₂ congelado surgem acima de 60 km de altitude. O céu fica colorido ao pôr do sol.',
    history:
      'Em 2021 o Curiosity fotografou nuvens iridescentes ("madrepérola") de gelo de CO₂ sobre a cratera Gale, a mais de 60 km de altura.',
    body: 'Nuvens iridescentes cobrem o céu. Vale estudá-las?',
    weight: 2,
    choices: [
      {
        id: 'photo',
        label: 'Fotografar',
        hint: 'ciência · sem risco',
        outcome: {
          tone: 'good',
          text: 'Fotos lindas enviadas à Terra.',
          deltas: { research: 2 },
        },
      },
      {
        id: 'analyze',
        label: 'Analisar o gelo',
        hint: 'ciência · gasta energia',
        outcome: {
          tone: 'good',
          text: 'A análise confirmou cristais de CO₂.',
          deltas: { research: 3, energy: -5 },
        },
      },
      {
        id: 'expedition',
        label: 'Expedição ao gelo',
        hint: 'tática · arriscado',
        outcome: {
          tone: 'good',
          text: 'O rover trouxe gelo derretido: água para a horta.',
          deltas: { supplies: 10, energy: -3 },
        },
        risk: {
          chance: 0.2,
          outcome: {
            tone: 'bad',
            text: 'O rover atolou e a equipe gastou reservas no resgate.',
            deltas: { supplies: -4, oxygen: -6, armor: -5 },
          },
        },
      },
    ],
  },

  {
    id: 'dust_storm',
    kind: 'major',
    title: 'Tempestade de poeira a caminho',
    icon: '🌪️',
    body: 'O satélite de órbita detectou uma frente de poeira avançando sobre a base. Os ventos devem cobrir os painéis solares em poucas horas.',
    weight: 3,
    choices: [
      {
        id: 'shelter',
        label: 'Recolher tudo e se abrigar',
        hint: 'seguro · gasta energia',
        outcome: {
          tone: 'info',
          text: 'A equipe guardou o equipamento e esperou dentro da base. A tempestade veio fraca.',
          deltas: { energy: -6 },
          effects: [
            { type: 'storm', strength: 0.45 },
            { type: 'dust', amount: 0.15 },
          ],
        },
      },
      {
        id: 'carry_on',
        label: 'Manter o trabalho normal',
        hint: 'arriscado',
        outcome: {
          tone: 'bad',
          text: 'A tempestade veio forte. Os painéis ficaram cobertos de poeira.',
          effects: [
            { type: 'storm', strength: 0.85 },
            { type: 'dust', amount: 0.4 },
          ],
        },
        risk: {
          chance: 0.35,
          outcome: {
            tone: 'bad',
            text: 'A poeira entrou nos equipamentos expostos: perdemos peças.',
            deltas: { energy: -7 },
            effects: [
              { type: 'storm', strength: 0.9 },
              { type: 'dust', amount: 0.5 },
            ],
          },
        },
      },
      {
        id: 'measure',
        label: 'Aproveitar para medir a tempestade',
        hint: 'ciência · gasta energia',
        outcome: {
          tone: 'good',
          text: 'Os sensores registraram a frente de poeira de perto. Ótimos dados!',
          deltas: { research: 3, energy: -8 },
          effects: [
            { type: 'storm', strength: 0.7 },
            { type: 'dust', amount: 0.3 },
          ],
        },
      },
    ],
  },
  {
    id: 'supply_drop',
    kind: 'major',
    title: 'Cápsula de carga da Terra',
    icon: '📦',
    body: 'Uma cápsula de carga pousou a alguns quilômetros da base. Dá para buscar tudo, mas o caminho é longo.',
    weight: 2,
    choices: [
      {
        id: 'rover',
        label: 'Buscar com o rover',
        hint: 'rápido · gasta energia',
        outcome: {
          tone: 'good',
          text: 'O rover trouxe a carga inteira: mantimentos e peças.',
          deltas: { supplies: 30, energy: -6 },
        },
      },
      {
        id: 'foot',
        label: 'Ir a pé com tanques extras',
        hint: 'lento · gasta oxigênio',
        outcome: {
          tone: 'good',
          text: 'A equipe carregou os caixotes mais leves.',
          deltas: { supplies: 18, oxygen: -6 },
        },
      },
      {
        id: 'leave',
        label: 'Deixar a carga para depois',
        hint: 'sem custo',
        outcome: {
          tone: 'info',
          text: 'A carga ficou onde está. Uma parte foi coberta pela poeira.',
          deltas: { supplies: 6 },
        },
      },
    ],
  },
  {
    id: 'recycler',
    kind: 'major',
    title: 'Falha no reciclador de ar',
    icon: '🫁',
    body: 'O reciclador de ar apitou: o filtro principal está saturado. Se nada for feito, ele deixa de produzir oxigênio.',
    weight: 2,
    choices: [
      {
        id: 'swap',
        label: 'Trocar peças do reciclador',
        hint: 'gasta energia',
        outcome: {
          tone: 'info',
          text: 'Peças trocadas. O reciclador voltou ao normal.',
          deltas: { energy: -5 },
        },
      },
      {
        id: 'bypass',
        label: 'Fazer um desvio provisório',
        hint: 'arriscado',
        outcome: {
          tone: 'info',
          text: 'O desvio funcionou por enquanto.',
        },
        risk: {
          chance: 0.5,
          outcome: {
            tone: 'bad',
            text: 'O desvio falhou e o filtro entupiu: troque-o para voltar a produzir oxigênio.',
            effects: [{ type: 'clog_filter' }],
          },
        },
      },
      {
        id: 'wait',
        label: 'Deixar para a próxima troca',
        hint: 'entope o filtro',
        outcome: {
          tone: 'bad',
          text: 'O filtro entupiu. Faça a troca do filtro para a base voltar a produzir oxigênio.',
          effects: [{ type: 'clog_filter' }],
        },
      },
    ],
  },
  {
    id: 'crop_blight',
    kind: 'major',
    title: 'Mofo na horta',
    icon: '🥀',
    body: 'Manchas escuras apareceram nas folhas de um canteiro. O mofo pode se espalhar pela estufa.',
    weight: 1,
    choices: [
      {
        id: 'treat',
        label: 'Tratar todos os canteiros',
        hint: 'gasta mantimentos',
        outcome: {
          tone: 'info',
          text: 'O tratamento conteve o mofo. A horta está salva.',
          deltas: { supplies: -6 },
        },
      },
      {
        id: 'cut',
        label: 'Arrancar só o canteiro doente',
        hint: 'perde 1 canteiro',
        outcome: {
          tone: 'bad',
          text: 'O canteiro doente foi descartado. O resto escapou.',
          effects: [{ type: 'wilt_crop' }],
        },
      },
      {
        id: 'study',
        label: 'Estudar o mofo antes de agir',
        hint: 'ciência · arriscado',
        outcome: {
          tone: 'good',
          text: 'A análise rendeu um bom estudo sobre cultivo em Marte.',
          deltas: { research: 2 },
          effects: [{ type: 'wilt_crop' }],
        },
      },
    ],
  },
  {
    id: 'geology',
    kind: 'major',
    title: 'Camadas raras à vista',
    icon: '🪨',
    body: 'A câmera do rover registrou camadas de rocha sedimentar muito antigas a poucos metros da base.',
    weight: 2,
    choices: [
      {
        id: 'probe',
        label: 'Coletar amostras com a sonda',
        hint: 'ciência · gasta energia',
        outcome: {
          tone: 'good',
          text: 'Amostras de camadas raras coletadas e catalogadas.',
          deltas: { research: 4, energy: -7 },
        },
      },
      {
        id: 'photo',
        label: 'Só fotografar e enviar à Terra',
        hint: 'barato',
        outcome: {
          tone: 'good',
          text: 'As fotos agradaram aos cientistas na Terra.',
          deltas: { research: 2 },
        },
      },
      {
        id: 'mine',
        label: 'Extrair minerais da área',
        hint: 'peças',
        outcome: {
          tone: 'good',
          text: 'A equipe extraiu bons minerais, mas deixou a área revirada.',
          deltas: { research: 1, energy: -5, supplies: 7 },
        },
      },
    ],
  },

  // ------------------------------------------------------------------ fáceis (todo dia)
  {
    id: 'earth_message',
    kind: 'easy',
    title: 'Mensagem da Terra',
    icon: '📡',
    body: 'Chegou um vídeo de alunos de uma escola na Terra, curiosos sobre a vida na base. Como responder?',
    weight: 2,
    choices: [
      {
        id: 'video',
        label: 'Gravar um vídeo de resposta',
        hint: 'gasta um pouco de energia',
        outcome: {
          tone: 'good',
          text: 'A resposta viralizou entre os alunos. A divulgação científica agradece!',
          deltas: { research: 1, energy: -2 },
        },
      },
      {
        id: 'text',
        label: 'Responder com um texto curto',
        hint: 'sem custo',
        outcome: {
          tone: 'info',
          text: 'Mensagem enviada. Rápido e simples.',
          deltas: { research: 1 },
        },
      },
    ],
  },
  {
    id: 'dust_devil',
    kind: 'easy',
    title: 'Redemoinho de poeira',
    icon: '🌀',
    body: 'Um pequeno redemoinho de poeira cruza o campo solar. Ele pode sujar ou limpar os painéis.',
    weight: 2,
    choices: [
      {
        id: 'watch',
        label: 'Deixar passar',
        hint: 'sem custo',
        outcome: { tone: 'info', text: 'O redemoinho passou e foi embora.' },
      },
      {
        id: 'steer',
        label: 'Abrir os painéis para a rajada',
        hint: 'arriscado',
        outcome: {
          tone: 'good',
          text: 'A rajada varreu a poeira de todos os painéis!',
          effects: [{ type: 'clean_panels' }],
        },
        risk: {
          chance: 0.35,
          outcome: {
            tone: 'bad',
            text: 'A rajada trouxe ainda mais poeira.',
            effects: [{ type: 'dust', amount: 0.2 }],
          },
        },
      },
    ],
  },
  {
    id: 'spare_rations',
    kind: 'easy',
    title: 'Caixa esquecida no armazém',
    icon: '🍱',
    body: 'Ao arrumar o armazém, a equipe achou uma caixa de rações e peças que ninguém lembrava.',
    weight: 2,
    choices: [
      {
        id: 'rations',
        label: 'Guardar as rações',
        hint: 'mantimentos',
        outcome: {
          tone: 'good',
          text: 'Rações extras para a tripulação.',
          deltas: { supplies: 8 },
        },
      },
      {
        id: 'parts',
        label: 'Separar as peças',
        hint: 'peças',
        outcome: {
          tone: 'good',
          text: 'Peças úteis para consertos futuros.',
          deltas: { supplies: 4 },
        },
      },
    ],
  },
  {
    id: 'curious_rock',
    kind: 'easy',
    title: 'Rocha curiosa',
    icon: '🔭',
    body: 'Uma rocha de cor diferente apareceu perto da base depois do vento da madrugada.',
    weight: 2,
    choices: [
      {
        id: 'analyze',
        label: 'Analisar no laboratório',
        hint: 'gasta energia',
        outcome: {
          tone: 'good',
          text: 'Resultado interessante: mais um dado para a Terra.',
          deltas: { research: 1, energy: -2 },
        },
      },
      {
        id: 'ignore',
        label: 'Ignorar',
        hint: 'sem custo',
        outcome: { tone: 'info', text: 'Era só uma rocha comum, ao que parece.' },
      },
    ],
  },
  {
    id: 'power_surge',
    kind: 'easy',
    title: 'Oscilação na rede',
    icon: '⚡',
    body: 'A tensão da rede elétrica oscila sem motivo claro. Um técnico sugere ações rápidas.',
    weight: 2,
    choices: [
      {
        id: 'reset',
        label: 'Reiniciar o inversor',
        hint: 'sem custo',
        outcome: {
          tone: 'info',
          text: 'O inversor reiniciou e a rede se estabilizou.',
          deltas: { energy: 2 },
        },
      },
      {
        id: 'replace',
        label: 'Trocar um fusível',
        hint: 'peças',
        outcome: {
          tone: 'good',
          text: 'Fusível novo. A rede ficou mais eficiente.',
          deltas: { energy: 5 },
        },
      },
    ],
  },
  {
    id: 'ice_find',
    kind: 'easy',
    title: 'Gelo no subsolo',
    icon: '🧊',
    body: 'O radar do rover achou um bolsão de gelo raso perto do caminho de volta.',
    weight: 1,
    choices: [
      {
        id: 'melt',
        label: 'Derreter e filtrar o gelo',
        hint: 'gasta energia',
        outcome: {
          tone: 'good',
          text: 'Água extra para a horta e para a cozinha.',
          deltas: { supplies: 6, energy: -3 },
        },
      },
      {
        id: 'note',
        label: 'Marcar no mapa',
        hint: 'sem custo',
        outcome: {
          tone: 'good',
          text: 'Local anotado para os cientistas.',
          deltas: { research: 1 },
        },
      },
    ],
  },
];

export interface ScheduledEvent {
  def: GameEventDef;
  sol: number;
}

function pickWeighted(
  pool: readonly GameEventDef[],
  seed: number,
  sol: number,
  salt: number,
): GameEventDef {
  const total = pool.reduce((n, e) => n + e.weight, 0);
  let roll = seeded(seed, sol, salt) * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll < 0) return e;
  }
  return pool[pool.length - 1]!;
}

/**
 * Eventos do Sol, na ordem em que aparecem (grande primeiro). Vazio nos 3 primeiros Sóis.
 * Determinístico: depende só da semente da sala e do Sol.
 */
export function eventsForSol(seed: number, sol: number): GameEventDef[] {
  if (sol < EVENT_FIRST_SOL) return [];
  const list: GameEventDef[] = [];
  if (sol >= MAJOR_FIRST_SOL && seeded(seed, sol, 701) < MAJOR_EVENT_CHANCE) {
    list.push(
      pickWeighted(
        GAME_EVENTS.filter((e) => e.kind === 'major'),
        seed,
        sol,
        711,
      ),
    );
  }
  list.push(
    pickWeighted(
      GAME_EVENTS.filter((e) => e.kind === 'easy'),
      seed,
      sol,
      721,
    ),
  );
  return list;
}

/** Resultado final da escolha (aplica o sorteio de risco). */
export function resolveChoice(choice: EventChoice, roll: number): EventOutcome {
  if (choice.risk && roll < choice.risk.chance) return choice.risk.outcome;
  return choice.outcome;
}
