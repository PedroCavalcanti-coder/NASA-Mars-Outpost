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

import { seeded } from '../tasks/rules';

export const EVENT_FIRST_SOL = 4;
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
  Record<'energy' | 'supplies' | 'materials' | 'oxygen' | 'research', number>
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
  /** dica curta do que a escolha envolve ("gasta materiais", "arriscado") */
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
  weight: number;
  choices: EventChoice[];
}

export const GAME_EVENTS: readonly GameEventDef[] = [
  // ------------------------------------------------------------------ grandes
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
            text: 'A poeira entrou nos equipamentos expostos: perdemos materiais.',
            deltas: { materials: -14 },
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
          deltas: { research: 8, energy: -8 },
          effects: [
            { type: 'storm', strength: 0.7 },
            { type: 'dust', amount: 0.3 },
          ],
        },
      },
    ],
  },
  {
    id: 'micrometeorite',
    kind: 'major',
    title: 'Micrometeorito no casco',
    icon: '☄️',
    body: 'Um alarme de pressão soa: um micrometeorito perfurou o casco de um módulo. O ar está escapando devagar.',
    weight: 2,
    choices: [
      {
        id: 'repair',
        label: 'Reparar agora com placas novas',
        hint: 'gasta materiais',
        outcome: {
          tone: 'info',
          text: 'O casco foi remendado a tempo. Quase nada de ar se perdeu.',
          deltas: { materials: -12 },
        },
      },
      {
        id: 'tape',
        label: 'Selar com fita de emergência',
        hint: 'barato · pode falhar',
        outcome: {
          tone: 'info',
          text: 'A fita segurou. Reparo improvisado, mas funcionou.',
          deltas: { materials: -4 },
        },
        risk: {
          chance: 0.5,
          outcome: {
            tone: 'bad',
            text: 'A fita descolou e parte do ar vazou antes de a equipe consertar de vez.',
            deltas: { materials: -4, oxygen: -14 },
          },
        },
      },
      {
        id: 'ignore',
        label: 'Esperar e ver se estabiliza',
        hint: 'perde oxigênio',
        outcome: {
          tone: 'bad',
          text: 'O vazamento continuou até a pressão se estabilizar sozinha.',
          deltas: { oxygen: -10 },
        },
      },
    ],
  },
  {
    id: 'solar_flare',
    kind: 'major',
    title: 'Erupção solar',
    icon: '☀️',
    body: 'Uma erupção solar forte vai atingir Marte, que quase não tem campo magnético. A radiação sobe rápido.',
    weight: 2,
    choices: [
      {
        id: 'bunker',
        label: 'Abrigar a equipe no módulo blindado',
        hint: 'seguro · gasta energia',
        outcome: {
          tone: 'info',
          text: 'Todos esperaram no abrigo. Ninguém se feriu.',
          deltas: { energy: -8 },
        },
      },
      {
        id: 'record',
        label: 'Registrar a erupção com os instrumentos',
        hint: 'ciência · arriscado',
        outcome: {
          tone: 'good',
          text: 'Dados raros da radiação em Marte chegaram à Terra!',
          deltas: { research: 12 },
        },
        risk: {
          chance: 0.4,
          outcome: {
            tone: 'bad',
            text: 'A radiação corrompeu parte dos sensores e dos dados.',
            deltas: { research: -6, materials: -6 },
          },
        },
      },
      {
        id: 'work',
        label: 'Seguir trabalhando',
        hint: 'muito arriscado',
        outcome: {
          tone: 'info',
          text: 'Passou sem grandes danos, desta vez.',
        },
        risk: {
          chance: 0.6,
          outcome: {
            tone: 'bad',
            text: 'A radiação danificou equipamentos e a equipe se abrigou tarde demais.',
            deltas: { research: -8, supplies: -8 },
          },
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
          deltas: { supplies: 22, materials: 16, energy: -6 },
        },
      },
      {
        id: 'foot',
        label: 'Ir a pé com tanques extras',
        hint: 'lento · gasta oxigênio',
        outcome: {
          tone: 'good',
          text: 'A equipe carregou os caixotes mais leves.',
          deltas: { supplies: 14, materials: 8, oxygen: -6 },
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
        hint: 'gasta materiais',
        outcome: {
          tone: 'info',
          text: 'Peças trocadas. O reciclador voltou ao normal.',
          deltas: { materials: -10 },
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
          deltas: { research: 7 },
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
          deltas: { research: 12, energy: -7 },
        },
      },
      {
        id: 'photo',
        label: 'Só fotografar e enviar à Terra',
        hint: 'barato',
        outcome: {
          tone: 'good',
          text: 'As fotos agradaram aos cientistas na Terra.',
          deltas: { research: 6 },
        },
      },
      {
        id: 'mine',
        label: 'Extrair minerais da área',
        hint: 'materiais',
        outcome: {
          tone: 'good',
          text: 'A equipe extraiu bons minerais, mas deixou a área revirada.',
          deltas: { materials: 14, research: 2, energy: -5 },
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
          deltas: { research: 3, energy: -2 },
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
        hint: 'materiais',
        outcome: {
          tone: 'good',
          text: 'Peças úteis para consertos futuros.',
          deltas: { materials: 8 },
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
          deltas: { research: 4, energy: -2 },
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
        hint: 'materiais',
        outcome: {
          tone: 'good',
          text: 'Fusível novo. A rede ficou mais eficiente.',
          deltas: { materials: -2, energy: 6 },
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
          deltas: { research: 2 },
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
  if (seeded(seed, sol, 701) < MAJOR_EVENT_CHANCE) {
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
