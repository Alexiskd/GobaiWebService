// Onglet « Documentation » de la fenêtre Données : une fiche par astre présent dans l'application.
import { useMemo, useRef, useState } from 'react';
import { ALL_SATELLITES, MOON, PLANETS, SUN } from '../../../../Engine/SystemeEngine/data/astronomy/data/bodies.data';
import { DOCUMENTS } from './data/index.js';
import { buildBodyCatalog, filterCatalog } from './bodyCatalog.js';
import { DownloadIcon, OpenInNewIcon, PlaceIcon, SearchIcon } from '../../ui/icons.jsx';
import './documents.css';

/** Le catalogue est construit une fois : les données de la scène sont embarquées et fixes. */
let CATALOG = null;
const catalog = () => (CATALOG ||= buildBodyCatalog({ sun: SUN, moon: MOON, planets: PLANETS, satellites: ALL_SATELLITES }));

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
      {onGoTo && (
        <div className="doc-actions">
          <button className="doc-btn doc-btn-primary" onClick={() => onGoTo(entry.name)}>
            <PlaceIcon fontSize="small" /> Voir dans la scène
          </button>
        </div>
      )}
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
    </div>
  );
}

/** Fiche d'un document PDF (petits satellites de Jupiter, hors de la scène 3D). */
function PdfSheet({ doc, onBack }) {
  return (
    <div className="docs-wrap">
      <button className="doc-back" onClick={onBack}>← Tous les astres</button>
      <header className="doc-head">
        <h1 className="doc-title">{doc.name}</h1>
        <span className="doc-designation">{doc.designation}</span>
        <div className="doc-chips">
          <span className="doc-chip">{doc.group}</span>
          <span className="doc-chip">Orbite {doc.motion === 'rétrograde' ? 'rétrograde' : 'prograde'}</span>
          <span className="doc-chip">{doc.physical.size}</span>
        </div>
      </header>
      <div className="doc-actions">
        <a className="doc-btn" href={doc.source} target="_blank" rel="noreferrer"><OpenInNewIcon fontSize="small" /> Page Wikipédia</a>
        <a className="doc-btn" href={doc.file} target="_blank" rel="noreferrer"><OpenInNewIcon fontSize="small" /> Ouvrir le PDF</a>
        <a className="doc-btn" href={doc.file} download><DownloadIcon fontSize="small" /> Télécharger</a>
      </div>
      <section className="doc-grid">
        <div className="doc-card">
          <h2>Découverte</h2>
          <dl>
            <dt>Découvreur</dt><dd>{doc.discovery.who}</dd>
            {doc.discovery.where ? <><dt>Lieu</dt><dd>{doc.discovery.where}</dd></> : null}
            <dt>Date</dt><dd>{doc.discovery.date}</dd>
            <dt>Désignation d'origine</dt><dd>{doc.discovery.provisional}</dd>
          </dl>
        </div>
        <div className="doc-card">
          <h2>Orbite</h2>
          <dl>
            <dt>Demi-grand axe</dt><dd>{doc.orbit.semiMajorAxis}</dd>
            <dt>Période de révolution</dt><dd>{doc.orbit.period}</dd>
            <dt>Excentricité</dt><dd>{doc.orbit.eccentricity}</dd>
            <dt>Inclinaison</dt><dd>{doc.orbit.inclination}</dd>
          </dl>
        </div>
        <div className="doc-card">
          <h2>Caractéristiques physiques</h2>
          <dl>
            <dt>Dimensions</dt><dd>{doc.physical.size}</dd>
            <dt>Masse</dt><dd>{doc.physical.mass}</dd>
            <dt>Masse volumique</dt><dd>{doc.physical.density}</dd>
            <dt>Albédo moyen</dt><dd>{doc.physical.albedo}</dd>
          </dl>
        </div>
      </section>
      <section className="doc-text">
        <h2>Résumé</h2>
        <p>{doc.summary}</p>
        <h2>Origine du nom</h2>
        <p>{doc.mythology}</p>
      </section>
    </div>
  );
}

/**
 * Documentation : une fiche par astre présent dans l'application — le Soleil, les planètes, les planètes naines, la
 * Lune et chaque satellite naturel de la scène —, groupées, avec une recherche (sans accents) et un filtre par groupe.
 * Une fiche ouverte montre les caractéristiques de l'astre et « Voir dans la scène » (`onGoTo`, qui vise l'astre et
 * ferme la fenêtre). Les fiches tirées des PDF (petits satellites de Jupiter, absents de la scène) suivent à la fin.
 */
export function Documents({ onGoTo }) {
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('tous');
  const topRef = useRef(null);
  const all = catalog();

  const shown = useMemo(() => filterCatalog(all, { query, group }), [all, query, group]);
  const pdfShown = useMemo(() => {
    if (group !== 'tous' && group !== 'pdf') return [];
    const q = query.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return DOCUMENTS.filter((d) => !q || `${d.name} ${d.designation} ${d.group}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q));
  }, [query, group]);
  const count = shown.reduce((n, g) => n + g.entries.length, 0) + pdfShown.length;

  const open = (id) => { setOpenId(id); topRef.current?.scrollIntoView?.({ block: 'start' }); };
  const back = () => setOpenId(null);

  const entry = openId && all.entries.find((e) => `astre:${e.id}` === openId);
  const pdf = openId && DOCUMENTS.find((d) => `pdf:${d.id}` === openId);

  return (
    <div className="gobai-docs" ref={topRef}>
      {entry ? <BodySheet entry={entry} onBack={back} onGoTo={onGoTo} />
        : pdf ? <PdfSheet doc={pdf} onBack={back} />
          : (
            <div className="docs-wrap">
              <header className="doc-head">
                <h1 className="doc-title">Documentation</h1>
                <p className="doc-sub">
                  {all.entries.length} astres présents dans l’application : le Soleil, {all.groups.find((g) => g.id === 'planetes')?.entries.length ?? 0} planètes,
                  {' '}{all.groups.find((g) => g.id === 'naines')?.entries.length ?? 0} planètes naines, la Lune et les satellites naturels de la scène.
                </p>
              </header>

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
                  {[{ id: 'tous', name: 'Tous' }, ...all.groups, { id: 'pdf', name: 'Documents PDF' }].map((g) => (
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
                      <button key={e.id} className="doc-card-btn" onClick={() => open(`astre:${e.id}`)}>
                        <span className="doc-card-head"><Orb color={e.color} /><span className="doc-card-name">{e.name}</span></span>
                        <span className="doc-card-meta">{e.summary}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}

              {pdfShown.length > 0 && (
                <section className="doc-group">
                  <h2 className="doc-group-title">Documents PDF · petits satellites de Jupiter <span className="doc-group-count">{pdfShown.length}</span></h2>
                  <p className="doc-sub">Fiches établies à partir des PDF du dossier data ; ces satellites ne sont pas dans la scène 3D.</p>
                  <div className="doc-cards">
                    {pdfShown.map((d) => (
                      <button key={d.id} className="doc-card-btn" onClick={() => open(`pdf:${d.id}`)}>
                        <span className="doc-card-name">{d.name}</span>
                        <span className="doc-card-designation">{d.designation}</span>
                        <span className="doc-card-sum">{d.summary}</span>
                        <span className="doc-card-meta">{d.physical.size} · {d.orbit.period}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

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
