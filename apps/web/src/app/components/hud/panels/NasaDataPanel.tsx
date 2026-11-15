/**
 * Dados da NASA usados no jogo: tudo o que é real, de onde veio e de quando é.
 * Nada aqui é "ao vivo": é um arquivo curado de registros e medições publicados.
 */
import {
  DONKI_SOURCE,
  MARS_SITES,
  MARS_TREK_URL,
  RADIATION,
  RADIATION_SOURCES,
  SOLAR_FLARES,
} from '@mars/shared';
import { GAME_EVENTS } from '@mars/sim';
import { Database, ExternalLink, MapPin } from 'lucide-react';
import { LORE } from '../../../../game/lore/lore';
import { useHudContext } from '../HudContext';
import { L } from '../../../../lib/i18n';

const fmt = (iso: string) =>
  new Date(iso.replace('Z', ':00Z')).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

/** Fotos e fatos com fonte (curiosidades + eventos), sem repetir links. */
function photoSources() {
  const out = new Map<string, { title: string; credit: string; url: string }>();
  for (const l of Object.values(LORE))
    out.set(l.links[0]?.url ?? l.image, { title: l.title, credit: l.credit, url: l.links[0]?.url ?? '' });
  for (const e of GAME_EVENTS)
    if (e.credit && e.sourceUrl) out.set(e.sourceUrl, { title: e.title, credit: e.credit, url: e.sourceUrl });
  return [...out.values()];
}

export function NasaDataPanel() {
  const { info } = useHudContext();
  const site = info ? MARS_SITES[info.id] : undefined;
  return (
    <div className="hud-panel-content hud-panel-nasa">
      <div className="hud-panel-intro">
        <Database size={18} className="hud-panel-intro-icon" />
        <p>
          <strong>{L('Ciência de verdade.', 'Real science.')}</strong> {L('Estes números e imagens vêm de missões e bancos de dados da NASA. É um', 'These numbers and images come from NASA missions and databases. It is an')} <b>{L('arquivo', 'archive')}</b> {L('guardado no jogo, não dados ao vivo: cada item mostra a data e a fonte.', 'stored in the game, not live data: each item shows its date and source.')}
        </p>
      </div>

      {site && (
        <section className="hud-nasa-section">
          <h4 className="hud-tasks__heading">
            <MapPin size={14} aria-hidden="true" /> {L('Onde fica a sua base', 'Where your base is')}
          </h4>
          <p>
            <b>{site.name}</b> — latitude {site.lat.toFixed(1)}°, longitude {site.lon.toFixed(1)}°.{' '}
            {site.why}
          </p>
          <a href={MARS_TREK_URL} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={12} aria-hidden="true" /> {L('Ver o lugar de verdade no Mars Trek (NASA)', 'See the real place on Mars Trek (NASA)')}
          </a>
        </section>
      )}

      <section className="hud-nasa-section">
        <h4 className="hud-tasks__heading">{L('☀️ Explosões solares (DONKI)', '☀️ Solar flares (DONKI)')}</h4>
        <p>
          {L('As tempestades de radiação do jogo usam explosões solares que aconteceram de verdade. Classe C é fraca, M é média e X é forte.', 'The game\'s radiation storms use solar flares that really happened. Class C is weak, M is medium and X is strong.')}
        </p>
        <ul className="hud-nasa-list">
          {SOLAR_FLARES.map((f) => (
            <li key={f.peak}>
              <b>{f.classType}</b> · {fmt(f.peak)} · região {f.region} — {f.note}
            </li>
          ))}
        </ul>
        <a href={DONKI_SOURCE.url} target="_blank" rel="noreferrer noopener">
          <ExternalLink size={12} aria-hidden="true" /> {DONKI_SOURCE.name}
        </a>
      </section>

      <section className="hud-nasa-section">
        <h4 className="hud-tasks__heading">{L('☢ Radiação medida', '☢ Measured radiation')}</h4>
        <ul className="hud-nasa-list">
          <li>Superfície de Marte: {RADIATION.marsSurfacePerDay} mSv por dia (RAD/Curiosity).</li>
          <li>Viagem da Terra a Marte: {RADIATION.cruisePerDay} mSv por dia (RAD dentro da nave).</li>
          <li>Na Terra: {RADIATION.earthPerYear} mSv por ANO de radiação natural.</li>
          <li>Uma tomografia de tórax: cerca de {RADIATION.chestCt} mSv.</li>
          <li>Limite de toda a carreira de um astronauta da NASA: {RADIATION.careerLimit} mSv.</li>
        </ul>
        {RADIATION_SOURCES.map((s) => (
          <a key={s.label} href={s.url} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={12} aria-hidden="true" /> {s.label}
          </a>
        ))}
      </section>

      <section className="hud-nasa-section">
        <h4 className="hud-tasks__heading">{L('📷 Fotos e fatos das missões', '📷 Mission photos and facts')}</h4>
        <ul className="hud-nasa-list">
          {photoSources().map((p) => (
            <li key={p.url || p.title}>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer noopener">
                  {p.title}
                </a>
              ) : (
                p.title
              )}{' '}
              · <small>{p.credit}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="hud-nasa-section">
        <h4 className="hud-tasks__heading">{L('🧪 Outras fontes', '🧪 Other sources')}</h4>
        <ul className="hud-nasa-list">
          <li>{L('MOXIE (oxigênio do CO₂ de Marte) — rover Perseverance.', 'MOXIE (oxygen from Mars CO₂) — Perseverance rover.')}</li>
          <li>{L('Gelo no subsolo — sonda Mars Reconnaissance Orbiter (HiRISE).', 'Underground ice — Mars Reconnaissance Orbiter (HiRISE).')}</li>
          <li>{L('Horta no espaço — Veggie (NASA) e material da Agência Espacial Canadense (CSA).', 'Space garden — Veggie (NASA) and the Canadian Space Agency (CSA) toolkit.')}</li>
          <li>{L('Comunicação com a Terra — Deep Space Network (NASA).', 'Talking to Earth — Deep Space Network (NASA).')}</li>
        </ul>
      </section>
    </div>
  );
}
