import { create } from 'zustand';

export interface MinigameOutcome {
  key: number;
  stars: 1 | 2 | 3;
  fact: [string, string];
  title: [string, string];
}

export const useMinigameResult = create<{ result: MinigameOutcome | null }>(() => ({ result: null }));

const FACTS: Record<string, { title: [string, string]; fact: [string, string] }> = {
  solar: { title: ['Painel limpo!', 'Panel cleaned!'], fact: ['Poeira em cima dos painéis rouba energia. Em 2018, a poeira encerrou a missão do rover Opportunity.', 'Dust on panels steals power. In 2018, dust ended the Opportunity rover mission.'] },
  oxygen: { title: ['Ar limpo!', 'Clean air!'], fact: ['Na Estação Espacial, filtros tiram o CO₂ do ar para a tripulação respirar.', 'On the Space Station, filters remove CO₂ from the air so the crew can breathe.'] },
  greenhouse: { title: ['Horta regada!', 'Garden watered!'], fact: ['Astronautas já cultivaram alface e pimenta na Estação Espacial.', 'Astronauts have grown lettuce and peppers on the Space Station.'] },
  drill: { title: ['Amostra coletada!', 'Sample collected!'], fact: ['O Curiosity já furou mais de 40 rochas em Marte procurando pistas de vida antiga.', 'Curiosity has drilled more than 40 rocks on Mars looking for clues of ancient life.'] },
  moxie: { title: ['Oxigênio feito!', 'Oxygen made!'], fact: ['O MOXIE fez oxigênio do ar de Marte em 2021, a bordo do Perseverance.', 'MOXIE made oxygen from Martian air in 2021, aboard Perseverance.'] },
  water: { title: ['Água pronta!', 'Water ready!'], fact: ['Há gelo de água escondido sob a poeira de Marte.', 'There is water ice hidden under the dust of Mars.'] },
  upload: { title: ['Dados enviados!', 'Data sent!'], fact: ['Os dados de Marte levam de 4 a 24 minutos para chegar à Terra.', 'Data from Mars takes 4 to 24 minutes to reach Earth.'] },
  ducts: { title: ['Dutos limpos!', 'Ducts cleaned!'], fact: ['Sem ar circulando, o CO₂ se acumula em volta do rosto dos astronautas.', 'Without moving air, CO₂ builds up around the face of an astronaut.'] },
  station: { title: ['Missão cumprida!', 'Mission accomplished!'], fact: ['Cada missão aqui imita um trabalho real de astronautas e cientistas da NASA.', 'Every mission here mimics real work by NASA astronauts and scientists.'] },
};

let n = 0;
export function showMinigameResult(kind: string, quality: number) {
  const f = FACTS[kind] ?? FACTS.station!;
  const stars = quality >= 0.85 ? 3 : quality >= 0.5 ? 2 : 1;
  useMinigameResult.setState({ result: { key: ++n, stars, ...f } });
}
