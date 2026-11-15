/**
 * Curiosidades da base: ao chegar perto de um objeto aparece uma janela (no estilo dos eventos)
 * com a história real dele, foto de arquivo e a fonte. Cada uma aparece uma vez por navegador.
 * Todo fato abaixo vem da legenda/descrição da própria imagem ou da página citada na fonte.
 */

export interface LoreLink {
  label: string;
  url: string;
}

export interface LoreDef {
  id: LoreId;
  title: string;
  icon: string;
  image: string;
  credit: string;
  /** texto principal (o que é e como foi/é usado) */
  body: string;
  /** "Você sabia?" */
  fact: string;
  links: LoreLink[];
}

export type LoreId = 'rover' | 'garden' | 'solar' | 'oxygen' | 'drill' | 'antenna';

export const LORE: Record<LoreId, LoreDef> = {
  rover: {
    id: 'rover',
    title: 'O carro da Lua',
    icon: '🚙',
    image: '/assets/lore/rover.jpg',
    credit: 'NASA · Apollo 15 · AS15-86-11603',
    body: 'O Veículo Lunar (LRV) foi o carro dirigido por astronautas na Lua. Estreou na missão Apollo 15, em 31 de julho de 1971, no sítio Hadley-Apennine, e permitiu explorar bem além do alcance de uma caminhada. Aqui você usa o rover para ir buscar amostras de solo, como as equipes de hoje fazem com robôs.',
    fact: 'Em Marte, o primeiro rover foi o Sojourner, que chegou em 1997 com a missão Pathfinder e abriu caminho para o Spirit, o Opportunity e o Curiosity.',
    links: [
      { label: 'Foto no acervo da NASA', url: 'https://images.nasa.gov/details/as15-86-11603' },
      {
        label: 'Sojourner e seus sucessores',
        url: 'https://photojournal.jpl.nasa.gov/catalog/PIA04422',
      },
    ],
  },
  garden: {
    id: 'garden',
    title: 'Cultivar comida no espaço',
    icon: '🥬',
    image: '/assets/lore/garden.jpg',
    credit: 'NASA · Christina Koch na Estação Espacial · iss059e035668',
    body: 'Na Estação Espacial Internacional, o sistema Veggie (e o experimento PONDS) cultiva alface e outras folhas para os astronautas comerem e para análises na Terra. Plantar em Marte seguiria a mesma ideia: água, luz certa e cuidado todo dia, como na sua horta.',
    fact: 'A Agência Espacial Canadense (CSA) reuniu um material para estudantes e professores sobre produção de alimentos na Lua e em lugares remotos, ligando a saúde dos astronautas ao benefício para quem vive na Terra. Ele inclui atividades como a "Interplanetary Farming" e a "Tomatosphere".',
    links: [
      {
        label: 'Material da Agência Espacial Canadense (CSA)',
        url: 'https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/',
      },
      { label: 'Foto no acervo da NASA', url: 'https://images.nasa.gov/details/iss059e035668' },
    ],
  },
  solar: {
    id: 'solar',
    title: 'Poeira nos painéis solares',
    icon: '☀️',
    image: '/assets/lore/solar.jpg',
    credit: 'NASA/JPL-Caltech/UArizona · PIA21457',
    body: 'A poeira marciana cobre os painéis solares e reduz a energia que eles geram. Por isso a base precisa de limpeza frequente, e é isso que você faz aqui.',
    fact: 'Os redemoinhos de poeira de Marte já limparam a poeira dos painéis dos rovers Opportunity e Spirit, melhorando a produção de energia deles.',
    links: [
      {
        label: 'Imagem e legenda da NASA',
        url: 'https://photojournal.jpl.nasa.gov/catalog/PIA21457',
      },
    ],
  },
  oxygen: {
    id: 'oxygen',
    title: 'Fazer oxigênio em Marte',
    icon: '🫁',
    image: '/assets/lore/oxygen.jpg',
    credit: 'NASA/JPL-Caltech · MOXIE · PIA24203',
    body: 'O MOXIE, instrumento dentro do rover Perseverance, foi feito para converter o dióxido de carbono da atmosfera de Marte em oxigênio. Seu filtro de ar também precisa de cuidado: sem manutenção, a produção de oxigênio da base para.',
    fact: 'A ideia é que, no futuro, astronautas possam usar essa tecnologia para produzir oxigênio no próprio Marte, em vez de levar tudo da Terra.',
    links: [
      {
        label: 'Imagem e legenda da NASA',
        url: 'https://photojournal.jpl.nasa.gov/catalog/PIA24203',
      },
    ],
  },
  drill: {
    id: 'drill',
    title: 'Perfurar rochas de outro planeta',
    icon: '🪨',
    image: '/assets/lore/drill.jpg',
    credit: 'NASA/JPL-Caltech/MSSS · PIA19104',
    body: 'O rover Curiosity tem uma broca na ponta do braço robótico. Antes de fazer um furo completo, ele faz um "mini-teste" para ver se a rocha serve para coletar amostra, como a equipe faz na sondagem da base.',
    fact: 'Até agosto de 2024 o Curiosity tinha coletado 42 amostras de rocha em pó, a primeira delas, "John Klein", em 9 de fevereiro de 2013.',
    links: [
      {
        label: 'Imagem do teste de perfuração',
        url: 'https://photojournal.jpl.nasa.gov/catalog/PIA19104',
      },
      {
        label: 'Os 42 furos do Curiosity',
        url: 'https://photojournal.jpl.nasa.gov/catalog/PIA26403',
      },
    ],
  },
  antenna: {
    id: 'antenna',
    title: 'Falando com Marte',
    icon: '📡',
    image: '/assets/lore/antenna.jpg',
    credit: 'NASA/JPL-Caltech · Deep Space Network · PIA13277',
    body: 'As naves e rovers falam com a Terra pela Deep Space Network, da NASA. A antena gigante de 70 metros de Goldstone (Califórnia) é conhecida como a "antena de Marte". Por isso a confirmação dos seus dados demora a voltar: o sinal leva minutos para atravessar o espaço.',
    fact: 'A antena de 70 m de Canberra (Austrália) é a única que consegue enviar comandos à Voyager 2.',
    links: [
      {
        label: 'A "antena de Marte" de Goldstone',
        url: 'https://photojournal.jpl.nasa.gov/catalog/PIA13277',
      },
      {
        label: 'Canberra e a Voyager 2',
        url: 'https://photojournal.jpl.nasa.gov/catalog/PIA23682',
      },
    ],
  },
};
