export type Expression = 'idle' | 'talking' | 'thinking' | 'excited' | 'warning' | 'celebrating';
import { getLang } from '../../lib/i18n';

/**
 * O B.I.T. segue o idioma do jogo (inglês por padrão). As gravações de voz são em inglês: em
 * português ele mostra só o texto.
 */
export const bitLanguage = () => getLang();
/** Fala da linha no idioma atual. */
export const lineText = (line: { text: string; en?: string }) =>
  getLang() === 'en' ? (line.en ?? line.text) : line.text;

export interface Line {
  /** fala em português (o que aparece no balão) */
  text: string;
  /** fala original em inglês, com voz gravada em /assets/audio/bit/en */
  en?: string;
  expression: Expression;
  /** `false` = fala ainda sem gravação de voz (o B.I.T. só mostra o texto) */
  voice?: boolean;
}
export const LINES = {
  hudOxygen: {
    text: 'Esta esfera azul mostra o oxigênio do traje do seu astronauta. Ele gasta lá fora, até dentro do rover. Entre na base para encher de novo enquanto a base tiver oxigênio!',
    en: "This blue sphere shows the oxygen in your astronaut's suit. It drains outside, even in the rover. Head inside to refill while the base has oxygen!",
    expression: 'thinking',
  },
  hudCycle: {
    text: 'O anel em volta do oxigênio mostra o dia e a noite de Marte. O triângulo aponta a hora do dia. Um dia em Marte se chama sol!',
    en: 'The ring around your oxygen shows the Martian day and night cycle. The triangle points to where we are in the day. A day on Mars is called a sol!',
    expression: 'thinking',
  },
  hudEnergy: {
    text: 'Este raio mostra a energia da base. Os painéis solares geram energia de dia, e a bateria mantém tudo funcionando à noite.',
    en: "This lightning gauge shows the base's energy reserve. Solar panels make power in daylight, and the battery keeps our equipment running at night.",
    expression: 'thinking',
  },
  hudSupplies: {
    text: 'Este marcador mostra a comida e a água da base. Cuidar da horta e colher plantas saudáveis alimenta a tripulação.',
    en: 'This gauge shows our food and water supplies. Caring for the garden and harvesting healthy plants helps feed our crew.',
    expression: 'thinking',
  },
  hudResearch: {
    text: 'Esta barra mostra a nossa pesquisa. As missões de pesquisa nos ajudam a entender Marte e chegar ao objetivo da missão!',
    en: 'This bar tracks our research. Collecting samples helps us learn about Mars and move toward our mission goal!',
    expression: 'thinking',
  },
  hudEvents: {
    text: 'Este painel mostra o que acontece em volta da base, como tempestades de poeira ou frio extremo. Olhe aqui quando o tempo mudar!',
    en: 'This display shows what is happening around the base, like dust storms or extreme cold. Check it when conditions change!',
    expression: 'thinking',
  },
  hudSpeed: {
    text: 'Estes botões controlam o tempo. Pausa para tudo, e 1, 2 ou 3 vezes muda a velocidade. Numa sala com amigos, só o coordenador mexe aqui.',
    en: 'These buttons control time. Pause stops the simulation, and one, two or three times changes its speed. In a shared room, only the coordinator can change these controls.',
    expression: 'thinking',
  },
  hudCrew: {
    text: 'Aqui ficam o código da sala e quantos somos. Até quatro exploradores dividem uma base. Convide um amigo com o código da sala!',
    en: 'Here is our room code and crew count. Up to four explorers can share a base. You can invite a friend using the room code.',
    expression: 'thinking',
  },
  hudChat: {
    text: 'Este é o chat da tripulação. Escreva aqui para combinar uma tarefa ou pedir ajuda a um colega.',
    en: 'This is our crew chat. Write a message here to plan a task or ask a teammate for help.',
    expression: 'thinking',
  },
  hudSettings: {
    text: 'Este menu abre som, gráficos, salvar e sair. Toque em mim quando quiser rever os painéis!',
    en: 'This menu opens sound, graphics and game settings. You can also leave the expedition here. Tap me whenever you want to explore the displays again!',
    expression: 'thinking',
  },
  welcome: {
    text: 'Oi, explorador! Eu sou o B.I.T., seu parceiro de missão. Vamos descobrir a nossa base em Marte juntos!',
    en: "Hi, explorer! I'm B.I.T., your mission buddy. Let's discover our Mars base together!",
    expression: 'excited',
  },
  move: {
    text: 'Tente andar um pouco! Clique no chão ou use as setas ou W A S D.',
    en: 'Try walking a few steps! Click the ground, or use the arrow keys or W A S D.',
    expression: 'idle',
  },
  moveTouch: {
    text: 'Tente andar um pouco! Toque num lugar livre do chão.',
    en: 'Try walking a few steps! Tap an open spot on the ground.',
    expression: 'idle',
  },
  moved: {
    text: 'Isso aí! Podemos explorar no seu ritmo. Toque em mim quando precisar de ajuda.',
    en: 'There you go! We can explore at your pace. Tap me whenever you need a hand.',
    expression: 'celebrating',
  },
  oxygen: {
    text: 'O filtro de ar precisa de cuidado. Leve a sujeira solta até a abertura de descarte para o ar passar.',
    en: 'Our air filter needs care. Move the loose debris into the disposal opening to clear the way for air.',
    expression: 'thinking',
  },
  solar: {
    text: 'A poeira tapa a luz do Sol nas células solares. Passe a escova nas partes sujas!',
    en: 'Dust blocks sunlight from reaching the solar cells. Sweep the brush across the dusty patches!',
    expression: 'thinking',
  },
  greenhouse: {
    text: 'Estas plantas estão com sede. Segure o controle de rega para cada canteiro se recuperar.',
    en: 'These plants look thirsty. Hold the watering control to help each garden bed recover.',
    expression: 'thinking',
  },
  drill: {
    text: 'Vamos descobrir o que tem debaixo de Marte! Perfure até a camada pedida e colete a amostra.',
    en: 'We can discover what is beneath Mars! Drill toward the requested layer, then collect a sample.',
    expression: 'excited',
  },
  plant: {
    text: 'Uma muda nova! A água ajuda a crescer. Vamos precisar cuidar dela antes de colher.',
    en: 'A new seedling! Water helps it grow. We will need to care for it before harvesting.',
    expression: 'excited',
  },
  harvest: {
    text: 'Comida fresca, plantada em Marte! O seu cuidado ajudou estas plantas a alimentar a tripulação.',
    en: 'Fresh food, grown on Mars! Your care helped these plants feed our crew.',
    expression: 'celebrating',
  },
  solarDone: {
    text: 'Olha as células azuis! Com menos poeira, o painel pega mais luz do Sol.',
    en: 'Look at those blue cells! With less dust, our panel can collect more sunlight.',
    expression: 'celebrating',
  },
  oxygenDone: {
    text: 'Filtro limpo! O ar passa de novo. Lembre: o suporte à vida também precisa de energia.',
    en: 'A clear filter! Air can pass through again. Our life support also needs power to work.',
    expression: 'celebrating',
  },
  greenhouseDone: {
    text: 'Plantas felizes! Continue cuidando da horta a cada novo dia marciano.',
    en: 'Happy plants! Keep caring for the garden as new Martian days begin.',
    expression: 'celebrating',
  },
  drillDone: {
    text: 'Amostra coletada! Estudar estas camadas ajuda a entender Marte.',
    en: 'Sample collected! Studying these layers helps us understand Mars.',
    expression: 'celebrating',
  },
  drillMiss: {
    text: 'Essa amostra é de outra camada! Da próxima vez, confira a camada pedida antes de coletar.',
    en: 'A sample from a different layer! Next time, watch the target layer before collecting.',
    expression: 'thinking',
  },
  rover: {
    text: 'Pronto para explorar de rover? Clique no chão ou use as teclas de movimento. Aperte E para descer.',
    en: 'Ready to explore on wheels? Click the ground or use the movement keys. Press E to step out.',
    expression: 'excited',
  },
  roverTouch: {
    text: 'Pronto para explorar de rover? Toque no chão para dirigir. Use o botão Sair para descer.',
    en: 'Ready to explore on wheels? Tap the ground to drive. Use the exit button to step out.',
    expression: 'excited',
  },
  low: {
    text: 'O tanque de ar está acabando. Vamos entrar na base para encher!',
    en: "Your air tank is getting low. Let's head inside the base to refill it!",
    expression: 'warning',
  },
  recovered: {
    text: 'Seguro aqui dentro. O tanque enche enquanto a base tiver oxigênio.',
    en: "You're safe inside. Your tank can refill while the base has oxygen available.",
    expression: 'idle',
  },
  storm: {
    text: 'Tempestade de poeira! O vento faz o oxigênio do traje acabar mais rápido. Melhor ficar dentro.',
    en: 'A dust storm! Winds use up our suit oxygen faster. Staying inside is a good idea.',
    expression: 'warning',
  },
  blackout: {
    text: 'A base ficou sem energia. Confira os painéis solares quando for seguro sair.',
    en: 'The base has run out of power. Check our solar panels when it is safe to go outside.',
    expression: 'warning',
  },
  difficulty: {
    text: 'Esse caminho não deu. Tente um lugar livre ali perto. A gente acha outro jeito juntos!',
    en: 'That path did not work. Try an open spot nearby. We can find another way together!',
    expression: 'thinking',
  },
  solarHint: {
    text: 'Procure as manchas laranja que sobraram. Passe a escova nesses pontos.',
    en: 'Look for the orange patches that remain. Move the brush across those spots.',
    expression: 'thinking',
  },
  oxygenHint: {
    text: 'Pegue um pedaço solto e leve até a abertura de descarte. Você também pode tocar no pedaço e depois na abertura.',
    en: 'Pick up a loose piece and move it into the disposal opening. You can also select a piece, then select the opening.',
    expression: 'thinking',
  },
  greenhouseHint: {
    text: 'Segure a rega no canteiro com sede. Confira os outros canteiros também!',
    en: 'Hold the watering control for the thirsty garden bed. Check the other beds too!',
    expression: 'thinking',
  },
  drillHint: {
    text: 'Se a broca esquentar demais, solte o controle e espere esfriar. Pare na camada pedida antes de coletar.',
    en: 'If the drill is too hot, release the control and let it cool. Stop in the requested layer before collecting.',
    expression: 'thinking',
  },
  explore: {
    text: 'Procure um “!” amarelo perto dos equipamentos. Escolha algo para fazer e eu vou junto!',
    en: 'Look for a task marker near equipment. Choose something to explore, and I will come along!',
    expression: 'idle',
  },
  success: {
    text: 'Conseguimos, explorador! Cada descoberta e cada cuidado ajudaram a nossa missão.',
    en: 'We did it, explorer! Every discovery and every bit of care helped our mission.',
    expression: 'celebrating',
  },
  ended: {
    text: 'A tripulação está voltando em segurança. Aprendemos muito juntos. Podemos tentar outra expedição!',
    en: 'Our crew is heading to safety. We learned a lot together. We can try another expedition!',
    expression: 'idle',
  },
  newDay: {
    text: 'Novo sol, novas missões! Siga os “!” amarelos pela base: cada um é uma missão de hoje. O que não for feito some amanhã.',
    en: "A new sol, new missions! Follow the yellow “!” markers around the base: each one is a mission for today. Anything left undone disappears tomorrow.",
    expression: 'excited',
    voice: false,
  },
  critical: {
    text: 'Alerta crítico! Algo quebrou na base. Siga o “!” e conserte rápido, antes que piore!',
    en: 'Critical alert! Something broke in the base. Follow the “!” and fix it fast, before it gets worse!',
    expression: 'warning',
    voice: false,
  },
  saved: {
    text: 'Mundo salvo! Você pode voltar quando quiser pelo “Meus mundos”.',
    en: 'World saved! You can come back anytime from “My worlds”.',
    expression: 'celebrating',
    voice: false,
  },
  goal: {
    text: 'Nossa missão: estudar o solo de Marte e procurar sinais de microrganismos. Para concluí-la você precisa ganhar pontos de pesquisa nas missões de pesquisa, até a barra chegar a 100%.',
    en: 'Our mission: study Martian soil and look for signs of microorganisms. To finish it you must earn research points from the research missions until the bar reaches 100%.',
    expression: 'excited',
    voice: false,
  },
  resources: {
    text: 'Para manter a tripulação viva você gerencia tudo: oxigênio, energia, mantimentos e blindagem. Nada é de graça: o que economiza energia hoje pode custar oxigênio amanhã. Faça as missões do dia para repor os recursos!',
    en: 'To keep the crew alive you manage everything: oxygen, power, supplies and shielding. Nothing is free: what saves power today may cost oxygen tomorrow. Do the missions of the day to refill your resources!',
    expression: 'thinking',
    voice: false,
  },
  events: {
    text: 'Cuidado: eventos como tempestades de poeira, meteoritos e radiação solar podem atingir a base e até estragar a pesquisa que ainda não foi enviada à Terra. Decida com calma e mantenha a blindagem forte!',
    en: 'Careful: events like dust storms, meteorites and solar radiation can hit the base and even ruin research that has not been sent to Earth yet. Decide wisely and keep your shielding strong!',
    expression: 'warning',
    voice: false,
  },
  save: {
    text: 'Você pode salvar o jogo quando quiser: abra o menu (engrenagem) e aperte “Salvar o Mundo”. O jogo também salva sozinho a cada 10 minutos. Depois, volte por “Meus mundos”.',
    en: 'You can save the game anytime: open the menu (gear) and press “Save the World”. The game also saves on its own every 10 minutes. Later, come back from “My worlds”.',
    expression: 'idle',
    voice: false,
  },
  sendData: {
    text: 'Dados parciais podem ir para a Terra! No computador do enlace com a Terra, envie a pesquisa que você já tem. O que foi enviado fica protegido dos eventos, mesmo que a missão ainda não tenha terminado.',
    en: 'Partial data can go to Earth! At the Earth-link computer, send the research you have so far. Whatever was sent is protected from events, even if the mission is not finished yet.',
    expression: 'excited',
    voice: false,
  },
  moxie: {
    text: 'O MOXIE precisa de calor! Segure “Aquecer” para deixar o forno na faixa verde e toque nas moléculas de CO₂. Quente demais, ele desliga para esfriar.',
    en: 'MOXIE needs heat! Hold “Heat” to keep the oven in the green zone and tap the CO₂ molecules. If it gets too hot, it shuts down to cool off.',
    expression: 'excited',
    voice: false,
  },
  water: {
    text: 'Procure a pá com gelo! Escolha uma, e o forno derrete o gelo em vapor e depois em água. Solo seco não rende nada.',
    en: 'Look for the scoop with ice! Pick one, and the oven melts the ice into vapor and then into water. Dry soil gives nothing.',
    expression: 'thinking',
    voice: false,
  },
  antenna: {
    text: 'Gire a antena até a sua onda verde ficar igual à onda amarela da Terra. Segure firme até a trava do sinal encher.',
    en: 'Turn the antenna until your green wave matches the yellow wave from Earth. Hold it steady until the signal lock fills up.',
    expression: 'thinking',
    voice: false,
  },
  lab: {
    text: 'Hora da análise! Pare o cursor na faixa verde, três vezes. Quanto mais acertos, melhores os resultados.',
    en: 'Time for analysis! Stop the cursor in the green zone, three times. The more you hit, the better the results.',
    expression: 'thinking',
    voice: false,
  },
  power: {
    text: 'Vamos conferir a rede elétrica: pare o cursor na faixa verde três vezes para trocar os fusíveis e equilibrar a energia.',
    en: 'Let us check the power grid: stop the cursor in the green zone three times to swap the fuses and balance the power.',
    expression: 'thinking',
    voice: false,
  },
  medical: {
    text: 'Hora do exame da tripulação! Pare o cursor na faixa verde, três vezes, para registrar a saúde de todos.',
    en: 'Time for the crew checkup! Stop the cursor in the green zone, three times, to record everyone\'s health.',
    expression: 'idle',
    voice: false,
  },
  upload: {
    text: 'Toque só nos cartões de ciência (não nos jogos, músicas ou fotos do almoço) e aperte “Enviar”. Assim a pesquisa fica protegida na Terra!',
    en: 'Tap only the science cards (not games, music or lunch photos) and press “Send”. That way the research is safe on Earth!',
    expression: 'excited',
    voice: false,
  },
  scout: {
    text: 'Dirija o rover para os lados, desvie de pedras e buracos e pegue os pontos amarelos. Três batidas encerram a corrida. Depois, conserte o rover com o maçarico: toque em cada ponto quando o anel encostar nele.',
    en: 'Steer the rover left and right, dodge rocks and holes and grab the yellow points. Three crashes end the run. Then repair the rover with the welding torch: tap each spot when the ring touches it.',
    expression: 'excited',
    voice: false,
  },
  ducts: {
    text: 'Toque duas vezes em cada bola de poeira para limpar os dutos e deixar o ar correr de novo. Rápido!',
    en: 'Tap each dust ball twice to clean the ducts and let the air flow again. Quick!',
    expression: 'warning',
    voice: false,
  },
  oxygenReal: {
    text: 'Na vida real: a Estação Espacial faz oxigênio da água com eletricidade e tira o CO₂ do ar com filtros. Um sistema de suporte à vida como este mantém a tripulação respirando.',
    en: 'In real life: the Space Station makes oxygen from water with electricity and removes CO₂ from the air with filters. A life support system like this keeps the crew breathing.',
    expression: 'thinking',
    voice: false,
  },
  solarReal: {
    text: 'Na vida real: em 2018 a poeira cobriu os painéis do rover Opportunity e acabou com a missão dele. Já os redemoinhos de poeira limparam os painéis do Spirit várias vezes!',
    en: 'In real life: in 2018 dust covered the Opportunity rover\'s panels and ended its mission. Dust devils, on the other hand, cleaned Spirit\'s panels several times!',
    expression: 'thinking',
    voice: false,
  },
  greenhouseReal: {
    text: 'Na vida real: astronautas da Estação Espacial já cultivaram alface, rabanete e pimenta no sistema Veggie. Comida fresca dá vitaminas e levanta o ânimo da tripulação.',
    en: 'In real life: astronauts on the Space Station have grown lettuce, radishes and peppers in the Veggie system. Fresh food gives vitamins and lifts the crew\'s mood.',
    expression: 'thinking',
    voice: false,
  },
  drillReal: {
    text: 'Na vida real: o Curiosity já fez mais de 40 furos em rochas marcianas, e o Perseverance guarda amostras em tubos para trazê-las à Terra. O solo e as rochas podem guardar pistas de microrganismos antigos!',
    en: 'In real life: Curiosity has drilled more than 40 holes in Martian rocks, and Perseverance seals samples in tubes to bring them to Earth. Soil and rocks may hold clues about ancient microorganisms!',
    expression: 'thinking',
    voice: false,
  },
  moxieReal: {
    text: 'Na vida real: o MOXIE viajou no rover Perseverance e, em 2021, fez oxigênio do ar de Marte: uns 6 gramas por hora, o bastante para um cachorro pequeno respirar. No futuro pode dar ar e combustível de foguete.',
    en: 'In real life: MOXIE rode on the Perseverance rover and, in 2021, made oxygen from Mars air: about 6 grams per hour, enough for a small dog to breathe. One day it could provide air and rocket fuel.',
    expression: 'thinking',
    voice: false,
  },
  waterReal: {
    text: 'Na vida real: Marte tem gelo escondido sob a poeira. A sonda MRO viu camadas de gelo a poucos metros de profundidade. Astronautas poderiam derretê-lo para beber, regar plantas e até fazer combustível.',
    en: 'In real life: Mars has ice hidden under the dust. The MRO orbiter saw ice sheets just a few meters deep. Astronauts could melt it to drink, water plants and even make fuel.',
    expression: 'thinking',
    voice: false,
  },
  antennaReal: {
    text: 'Na vida real: as antenas da Deep Space Network, na Califórnia, na Espanha e na Austrália, se revezam para falar com Marte enquanto a Terra gira. Uma mensagem leva de 4 a 24 minutos para chegar.',
    en: 'In real life: the Deep Space Network antennas in California, Spain and Australia take turns talking to Mars as Earth spins. A message takes 4 to 24 minutes to arrive.',
    expression: 'thinking',
    voice: false,
  },
  labReal: {
    text: 'Na vida real: o Curiosity tem um laboratório dentro dele, o SAM, que esquenta pó de rocha e analisa os gases para saber do que Marte é feito e se ele já teve ingredientes para a vida.',
    en: 'In real life: Curiosity has a lab inside it, SAM, that heats rock powder and analyzes the gases to learn what Mars is made of and whether it once had the ingredients for life.',
    expression: 'thinking',
    voice: false,
  },
  powerReal: {
    text: 'Na vida real: na Estação Espacial, os painéis solares geram energia no Sol e as baterias seguram a estação em até 16 pores do sol por dia. Uma base em Marte também precisa de um orçamento de energia cuidadoso.',
    en: 'In real life: on the Space Station, solar arrays make power in sunlight and batteries carry the station through up to 16 sunsets a day. A Mars base also needs a careful power budget.',
    expression: 'thinking',
    voice: false,
  },
  medicalReal: {
    text: 'Na vida real: no espaço os ossos e os músculos enfraquecem, por isso astronautas se exercitam cerca de 2 horas por dia. Os dados de saúde ajudam a planejar a viagem a Marte.',
    en: 'In real life: in space bones and muscles get weaker, so astronauts exercise about 2 hours a day. Health data helps plan the trip to Mars.',
    expression: 'thinking',
    voice: false,
  },
  uploadReal: {
    text: 'Na vida real: rovers guardam os dados e os enviam quando uma sonda em órbita passa por cima; minutos depois a Terra recebe. Dado que não foi enviado pode se perder, por isso enviar protege a pesquisa.',
    en: 'In real life: rovers store their data and send it when an orbiter passes overhead; minutes later Earth gets it. Data that was not sent can be lost, so sending protects the research.',
    expression: 'thinking',
    voice: false,
  },
  scoutReal: {
    text: 'Na vida real: rovers andam devagar e com cuidado, e pedras pontudas podem furar as rodas (as do Curiosity ganharam buracos). Por isso a equipe na Terra planeja cada rota e testa e repara as peças com soldas e ferramentas.',
    en: 'In real life: rovers drive slowly and carefully, and sharp rocks can puncture wheels (Curiosity\'s got holes). That is why the team on Earth plans every route and tests and repairs parts with welding and tools.',
    expression: 'thinking',
    voice: false,
  },
  ductsReal: {
    text: 'Na vida real: na Estação Espacial os astronautas limpam filtros e saídas de ar com frequência. Sem ar circulando, o CO₂ se acumula em volta do rosto.',
    en: 'In real life: on the Space Station astronauts clean filters and air vents often. Without moving air, CO₂ builds up around the face.',
    expression: 'thinking',
    voice: false,
  },
} satisfies Record<string, Line>;
export type LineId = keyof typeof LINES;
