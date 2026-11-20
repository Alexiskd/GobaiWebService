// Onglet « Documentation » de la fenêtre Données : une fiche par astre présent dans l'application.
import { useMemo, useRef, useState } from 'react';
import { ALL_SATELLITES, MOON, PLANETS, SUN } from '../../../../Engine/SystemeEngine/data/astronomy/data/bodies.data';
import { DOCUMENTS } from './data/index.js';
import { buildBodyCatalog, filterCatalog } from './bodyCatalog.js';
import { DownloadIcon, OpenInNewIcon, PlaceIcon, SearchIcon } from '../../ui/icons.jsx';
import './documents.css';

/** Le catalogue est construit une fois : les données de la scène sont embarquées et fixes. */
let CATALOG = null;
const catalog = () => (CATALOG ||= buildBodyCatalog({ sun: SUN, moon: MOON, planets: PLANETS, satellites: ALL_SATELLITES, documents: DOCUMENTS }));

/** Avertissement affiché en haut de la Documentation (liste et fiches). */
const UNCERTAINTY = 'Ces informations peuvent être faussées par les incertitudes scientifiques : mesures approchées, valeurs révisées au fil des observations et des missions, modèles simplifiés. Pour un usage précis, vérifiez les sources de référence.';

function Uncertainty() {
  return (
    <p className="doc-warning" role="note">
      <span aria-hidden="true" className="doc-warning-icon">!</span>
      <span>{UNCERTAINTY}</span>
    </p>
  );
}

/** Pastille de l'astre, à sa couleur (même rendu que le rail de navigation). */
const Orb = ({ color, size = 14 }) => (
  <span className="doc-orb" aria-hidden="true" style={{ '--orb': color, width: size, height: size }} />
);

/** Fiche d'un astre : ses caractéristiques, et « Voir dans la scène ». */
function BodySheet({ entry, onBack, onGoTo }) {
  return (
    <div className="docs-wrap">
      <button className="doc-back" onClick={onBack}>← Tous les astres</button>
      <header className="doc-head">
        <div className="doc-title-row">
          <Orb color={entry.color} size={28} />
          <h1 className="doc-title">{entry.name}</h1>
        </div>
        <div className="doc-chips">
          <span className="doc-chip">{entry.kindLabel}</span>
          {entry.parentName && <span className="doc-chip">Autour de {entry.parentName}</span>}
        </div>
      </header>
      <Uncertainty />
      <div className="doc-actions">
        {onGoTo && entry.inScene !== false && (
          <button className="doc-btn doc-btn-primary" onClick={() => onGoTo(entry.name)}>
            <PlaceIcon fontSize="small" /> Voir dans la scène
          </button>
        )}
        {entry.doc && (
          <>
            <a className="doc-btn" href={entry.doc.source} target="_blank" rel="noreferrer"><OpenInNewIcon fontSize="small" /> Page Wikipédia</a>
            <a className="doc-btn" href={entry.doc.file} target="_blank" rel="noreferrer"><OpenInNewIcon fontSize="small" /> Ouvrir le PDF</a>
            <a className="doc-btn" href={entry.doc.file} download><DownloadIcon fontSize="small" /> Télécharger</a>
          </>
        )}
        {entry.inScene === false && <span className="doc-src">Ce satellite n’est pas dans la scène 3D.</span>}
      </div>
      <section className="doc-card">
        <h2>Caractéristiques</h2>
        <dl className="doc-facts">
          {entry.facts.map((f) => (
            <div key={f.term} className="doc-fact">
              <dt>{f.term}</dt>
              <dd>
                {f.value}
                {f.note && <span className="doc-fact-note">{f.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {entry.doc && (
        <section className="doc-text doc-text-after">
          <h2>Résumé</h2>
          <p>{entry.doc.summary}</p>
          <h2>Origine du nom</h2>
          <p>{entry.doc.mythology}</p>
        </section>
      )}
    </div>
  );
}

/**
 * Documentation : une fiche par astre présent dans l'application — le Soleil, les planètes, les planètes naines, la
 * Lune et chaque satellite naturel —, groupées, avec une recherche (sans accents) et un filtre par groupe. Les fiches
 * tirées des PDF (petits satellites de Jupiter) sont rangées avec les autres satellites de Jupiter, par distance.
 * Une fiche ouverte montre les caractéristiques de l'astre et « Voir dans la scène » (`onGoTo`, qui vise l'astre et
 * ferme la fenêtre ; absent pour un satellite qui n'est pas dans la scène). Un avertissement sur les incertitudes
 * scientifiques ouvre la page.
 */
export function Documents({ onGoTo }) {
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('tous');
  const topRef = useRef(null);
  const all = catalog();

  const shown = useMemo(() => filterCatalog(all, { query, group }), [all, query, group]);
  const count = shown.reduce((n, g) => n + g.entries.length, 0);

  const open = (id) => { setOpenId(id); topRef.current?.scrollIntoView?.({ block: 'start' }); };
  const back = () => setOpenId(null);

  const entry = openId && all.entries.find((e) => e.id === openId);

  return (
    <div className="gobai-docs" ref={topRef}>
      {entry ? <BodySheet entry={entry} onBack={back} onGoTo={onGoTo} />
        : (
            <div className="docs-wrap">
              <header className="doc-head">
                <h1 className="doc-title">Documentation</h1>
                <p className="doc-sub">
                  {all.entries.length} astres : le Soleil, {all.groups.find((g) => g.id === 'planetes')?.entries.length ?? 0} planètes,
                  {' '}{all.groups.find((g) => g.id === 'naines')?.entries.length ?? 0} planètes naines, la Lune et
                  {' '}{all.entries.filter((e) => e.kind === 'satellite' && e.name !== 'Lune').length} autres satellites naturels,
                  {' '}dont {all.entries.filter((e) => e.doc).length} petits satellites de Jupiter documentés par des PDF (absents de la scène 3D).
                </p>
              </header>
              <Uncertainty />

              {/* Recherche et filtre par groupe : la barre passe à la ligne, les pastilles défilent sur téléphone. */}
              <div className="doc-tools">
                <label className="doc-search">
                  <SearchIcon fontSize="small" aria-hidden="true" />
                  <input
                    type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Chercher un astre (Titan, Cérès, Jupiter…)" aria-label="Chercher un astre"
                    autoComplete="off" spellCheck={false}
                  />
                </label>
                <div className="doc-filters" role="group" aria-label="Filtrer par groupe">
                  {[{ id: 'tous', name: 'Tous' }, ...all.groups].map((g) => (
                    <button key={g.id} className={`doc-filter ${group === g.id ? 'is-active' : ''}`} aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>

              <p className="doc-count" role="status">{count} {count > 1 ? 'fiches' : 'fiche'}</p>

              {shown.map((g) => (
                <section key={g.id} className="doc-group">
                  <h2 className="doc-group-title">{g.name} <span className="doc-group-count">{g.entries.length}</span></h2>
                  <div className="doc-cards">
                    {g.entries.map((e) => (
                      <button key={e.id} className="doc-card-btn" onClick={() => open(e.id)}>
                        <span className="doc-card-head"><Orb color={e.color} /><span className="doc-card-name">{e.name}</span></span>
                        <span className="doc-card-meta">{e.summary}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}


              {count === 0 && <p className="doc-empty">Aucun astre ne correspond à « {query} ».</p>}

              <p className="doc-foot">
                Caractéristiques tirées des données de la scène 3D et de la fenêtre Informations. Fiches PDF : textes issus de
                Wikipédia francophone (licence CC BY-SA), PDF servis depuis <code>/data/documents/</code>.
              </p>
            </div>
          )}
    </div>
  );
}
