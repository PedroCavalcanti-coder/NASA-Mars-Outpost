import type { BaseEventId } from '@mars/shared';
import { AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useBaseOps } from '../../../game/tasks/store';
import { L } from '../../../lib/i18n';

interface IncidentInfo {
  title: string;
  icon: string;
  image: string;
  /** o que é o fenômeno */
  what: string;
  /** o que acontece com a base agora */
  effect: string;
  /** caso real ligado ao fenômeno */
  real: string;
  link: { label: string; url: string };
}

/** Catástrofes e fenômenos da base: explicação, efeito e um caso real. */
const INCIDENTS: Record<BaseEventId, IncidentInfo> = {
  micrometeorite: {
    title: L('Chuva de micrometeoritos', 'Micrometeorite shower'),
    icon: '☄️',
    image: '/assets/events/meteor_shower.jpg',
    what: L('Grãos de rocha do espaço caem a dezenas de quilômetros por segundo. Marte tem pouca atmosfera para frear e queimar esses grãos.', 'Grains of space rock fall at tens of kilometers per second. Mars has too little air to slow them down and burn them up.'),
    effect: L('Uma fratura forte vai abrir na blindagem e vazar oxigênio. Corra para consertar!', 'A big crack will open in the shielding and leak oxygen. Hurry and fix it!'),
    real: L('Em dezembro de 2021, um meteorito abriu uma cratera de 150 metros em Marte. O sismômetro da sonda InSight sentiu o impacto e a sonda MRO fotografou a cratera.', 'In December 2021, a meteorite opened a 150-meter crater on Mars. InSight\'s seismometer felt the impact and the MRO orbiter photographed the crater.'),
    link: { label: L('Missão InSight (NASA)', 'InSight mission (NASA)'), url: 'https://science.nasa.gov/mission/insight/' },
  },
  dust_storm: {
    title: L('Tempestade de poeira', 'Dust storm'),
    icon: '🌪️',
    image: '/assets/events/giant_dust_devil.jpg',
    what: L('Ventos levantam a poeira fina de Marte e escurecem o céu. Algumas tempestades cobrem o planeta inteiro por semanas.', 'Winds lift Mars\' fine dust and darken the sky. Some storms cover the whole planet for weeks.'),
    effect: L('Os painéis solares sujam e geram menos energia, a visão fica ruim e a blindagem pode rachar.', 'The solar panels get dusty and make less power, it is hard to see and the shielding may crack.'),
    real: L('Em 2018, uma tempestade global de poeira cobriu os painéis do rover Opportunity, que ficou sem energia e encerrou a missão depois de 15 anos em Marte.', 'In 2018, a planet-wide dust storm covered the Opportunity rover\'s panels; it ran out of power and its mission ended after 15 years on Mars.'),
    link: { label: 'Rover Opportunity (NASA)', url: 'https://science.nasa.gov/mission/mer-opportunity/' },
  },
  thermal_crack: {
    title: L('Fratura térmica', 'Thermal crack'),
    icon: '🧊',
    image: '/assets/events/ice_clouds.jpg',
    what: L('À noite Marte chega a −80 °C e de dia esquenta. O metal encolhe e estica todos os dias, até rachar.', 'At night Mars drops to −80 °C and warms up in the day. Metal shrinks and stretches every day until it cracks.'),
    effect: L('Uma rachadura vai abrir na blindagem. Conserte antes que ela cresça.', 'A crack will open in the shielding. Fix it before it grows.'),
    real: L('As rodas de alumínio do rover Curiosity ganharam rachaduras e furos rodando sobre rochas pontudas. Em 2017 a NASA mudou o jeito de dirigir para poupar as rodas.', 'Curiosity\'s aluminum wheels got cracks and holes from driving over sharp rocks. In 2017 NASA changed how it drives to save the wheels.'),
    link: { label: 'Rover Curiosity (NASA)', url: 'https://science.nasa.gov/mission/msl-curiosity/' },
  },
  discovery: {
    title: L('Achado geológico', 'Geological find'),
    icon: '🪨',
    image: '/assets/lore/drill.jpg',
    what: L('Rochas de Marte guardam a história do planeta: água, vulcões e, quem sabe, sinais de vida antiga.', 'Mars rocks keep the planet\'s history: water, volcanoes and maybe signs of ancient life.'),
    effect: L('A equipe aproveita o material encontrado: a base ganha suprimentos.', 'The crew uses what it found: the base gets supplies.'),
    real: L('Em 2024, o rover Perseverance achou a rocha “Cheyava Falls”, com manchas que podem ter sido formadas por vida microscópica há bilhões de anos.', 'In 2024, the Perseverance rover found the rock “Cheyava Falls”, with spots that may have been made by microscopic life billions of years ago.'),
    link: { label: 'Rover Perseverance (NASA)', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
  },
  supply_drop: {
    title: L('Cápsula de mantimentos', 'Supply capsule'),
    icon: '🪂',
    image: '/assets/lore/rover.jpg',
    what: L('Uma cápsula de carga enviada da Terra pousa perto da base com comida e peças.', 'A cargo capsule sent from Earth lands near the base with food and parts.'),
    effect: L('Daqui a pouco a base recebe mais mantimentos.', 'Soon the base gets more supplies.'),
    real: L('Tudo que vai para Marte viaja meses: o rover Perseverance levou 203 dias da Terra até pousar na cratera Jezero, em fevereiro de 2021.', 'Everything sent to Mars travels for months: the Perseverance rover took 203 days from Earth to land in Jezero Crater, in February 2021.'),
    link: { label: L('Pouso do Perseverance (NASA)', 'Perseverance landing (NASA)'), url: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
  },
  cleaning_wind: {
    title: L('Vento de limpeza', 'Cleaning wind'),
    icon: '🍃',
    image: '/assets/lore/solar.jpg',
    what: L('Rajadas e redemoinhos de poeira às vezes varrem a sujeira dos equipamentos.', 'Gusts and dust devils sometimes sweep dirt off the equipment.'),
    effect: L('Os painéis solares ficam mais limpos e geram mais energia.', 'The solar panels get cleaner and make more power.'),
    real: L('Redemoinhos de poeira limparam os painéis dos rovers Spirit e Opportunity várias vezes, devolvendo energia e alongando as missões.', 'Dust devils cleaned the panels of the Spirit and Opportunity rovers several times, restoring power and making the missions last longer.'),
    link: { label: 'Rover Spirit (NASA)', url: 'https://science.nasa.gov/mission/mer-spirit/' },
  },
};

/**
 * Card de catástrofe/fenômeno: aparece uma vez quando um evento da base começa (tempestade,
 * micrometeoritos…), com o que ele é, o que acontece com a base e um caso real da NASA.
 */
export function IncidentCard({ hidden = false }: { hidden?: boolean }) {
  const event = useBaseOps((s) => s.integrity?.event);
  const [open, setOpen] = useState<BaseEventId | null>(null);
  /** último evento já tratado; `undefined` = ainda não vimos o estado da sala */
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    const seq = event?.seq ?? 0;
    if (handled.current === undefined) {
      // entrou na sala com um evento já em andamento e aplicado: não reabre ao recarregar
      handled.current = event?.applied ? seq : seq - 1;
    }
    if (event && seq > handled.current) {
      handled.current = seq;
      setOpen(event.id);
    }
  }, [event]);

  // escondido (minigame/evento na frente): o card espera a base ficar livre
  if (!open || hidden) return null;
  const info = INCIDENTS[open];
  const danger = open === 'micrometeorite' || open === 'dust_storm' || open === 'thermal_crack';
  return (
    <div className="event-tablet__backdrop" role="presentation">
      <section
        className={`event-tablet lore-card ${danger ? 'event-tablet--major' : 'event-tablet--lore'}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="incident-title"
      >
        <header className="event-tablet__head">
          <span className="event-tablet__alert" aria-hidden="true">
            {danger ? <AlertTriangle size={24} /> : <Info size={24} />}
          </span>
          <h2 id="incident-title">
            <small>{danger ? L('ALERTA NA BASE: ', 'BASE ALERT: ') : L('AVISO DA BASE: ', 'BASE NOTICE: ')}</small>
            {info.icon} {info.title.toUpperCase()}
          </h2>
        </header>
        <div className="event-tablet__screen lore-card__screen">
          <figure className="event-tablet__photo lore-card__photo">
            <img src={info.image} alt={info.title} loading="eager" />
          </figure>
          <div className="lore-card__text">
            <p className="event-tablet__body">
              <b>{L('O que é:', 'What it is:')} </b>
              {info.what}
            </p>
            <p className="event-tablet__body">
              <b>{L('Na base:', 'At the base:')} </b>
              {info.effect}
            </p>
            <aside className="event-tablet__fact">
              <span className="event-tablet__fact-tag">
                <Info size={12} aria-hidden="true" /> {L('ACONTECEU DE VERDADE', 'THIS REALLY HAPPENED')}
              </span>
              <p>{info.real}</p>
            </aside>
            <ul className="event-tablet__links">
              <li>
                <a href={info.link.url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink size={13} aria-hidden="true" /> {info.link.label}
                </a>
              </li>
            </ul>
          </div>
          <button
            type="button"
            className="event-tablet__ok lore-card__ok"
            onClick={() => setOpen(null)}
            autoFocus
          >
            {L('Entendido', 'Got it')}
          </button>
        </div>
      </section>
    </div>
  );
}
