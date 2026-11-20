// Onglet « Documentation » de la fenêtre Données : une fiche par astre présent dans l'application.
import { useMemo, useRef, useState } from 'react';
import { ALL_SATELLITES, MOON, PLANETS, SUN } from '../../../../Engine/SystemeEngine/data/astronomy/data/bodies.data';
import { DOCUMENTS } from './data/index.js';
import { bodyTree, buildBodyCatalog, filterCatalog } from './bodyCatalog.js';
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

/**
 * Un nœud de l'arborescence. Un appui sur la ligne déplie ou replie ses enfants (le Soleil montre les planètes et les
 * planètes naines, une planète montre ses satellites) ; une ligne sans enfant ouvre la fiche. Le bouton « Fiche »
 * ouvre la fiche de l'astre de la ligne. Les branches (Planètes, Planètes naines) n'ont pas de fiche.
 */
function TreeNode({ node, depth, expanded, onToggle, onOpen }) {
  const hasChildren = node.children.length > 0;
  const isOpen = hasChildren && expanded.has(node.id);
  const e = node.entry;
  const count = node.count ?? node.children.length;
  const what = e ? (e.kind === 'etoile' ? 'planètes' : 'satellites') : 'astres';
  return (
    <li className="doc-tree-item" role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-level={depth + 1}>
      <div className={`doc-tree-row ${e ? '' : 'is-branch'}`}>
        <button
          className="doc-tree-main"
          onClick={() => (hasChildren ? onToggle(node.id) : onOpen(e.id))}
          aria-label={hasChildren ? `${node.name} : ${isOpen ? 'replier' : 'afficher'} ${count} ${what}` : `${node.name} : ouvrir la fiche`}
        >
          <span className={`doc-tree-chevron ${isOpen ? 'is-open' : ''}`} aria-hidden="true">{hasChildren ? '›' : ''}</span>
          {e && <Orb color={e.color} size={depth === 0 ? 22 : depth >= 3 ? 12 : 16} />}
          <span className="doc-tree-name">{node.name}</span>
          {hasChildren && <span className="doc-group-count" aria-hidden="true">{count}</span>}
          {e && <span className="doc-tree-meta">{e.kindLabel}{e.inScene === false ? ' · hors scène' : ''}</span>}
        </button>
        {e && hasChildren && (
          <button className="doc-tree-sheet" onClick={() => onOpen(e.id)} aria-label={`Fiche de ${node.name}`}>Fiche</button>
        )}
      </div>
      {isOpen && (
        <ul className="doc-tree-children" role="group">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

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
 * Lune et chaque satellite naturel —, rangées en arborescence : le Soleil d'abord ; un appui dessus montre les
 * Planètes et les Planètes naines ; un appui sur une planète montre ses satellites. Une recherche (sans accents)
 * remplace l'arborescence par les fiches trouvées. Les fiches
 * tirées des PDF (petits satellites de Jupiter) sont rangées avec les autres satellites de Jupiter, par distance.
 * Une fiche ouverte montre les caractéristiques de l'astre et « Voir dans la scène » (`onGoTo`, qui vise l'astre et
 * ferme la fenêtre ; absent pour un satellite qui n'est pas dans la scène). Un avertissement sur les incertitudes
 * scientifiques ouvre la page.
 */
export function Documents({ onGoTo }) {
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  // Nœuds dépliés de l'arborescence : gardés quand on ouvre une fiche puis qu'on revient.
  const [expanded, setExpanded] = useState(() => new Set());
  const topRef = useRef(null);
  const all = catalog();

  const tree = useMemo(() => bodyTree(all), [all]);
  const searching = query.trim().length > 0;
  const shown = useMemo(() => (searching ? filterCatalog(all, { query }) : []), [all, query, searching]);
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
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

              {/* Recherche : sans texte, l'arborescence ; avec un texte, les fiches trouvées. */}
              <div className="doc-tools">
                <label className="doc-search">
                  <SearchIcon fontSize="small" aria-hidden="true" />
                  <input
                    type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Chercher un astre (Titan, Cérès, Jupiter…)" aria-label="Chercher un astre"
                    autoComplete="off" spellCheck={false}
                  />
                </label>
              </div>

              {!searching && (
                <nav aria-label="Arborescence des astres">
                  <ul className="doc-tree" role="tree">
                    <TreeNode node={tree.root} depth={0} expanded={expanded} onToggle={toggle} onOpen={open} />
                  </ul>
                </nav>
              )}

              {searching && <p className="doc-count" role="status">{count} {count > 1 ? 'fiches' : 'fiche'}</p>}

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


              {searching && count === 0 && <p className="doc-empty">Aucun astre ne correspond à « {query} ».</p>}

              <p className="doc-foot">
                Caractéristiques tirées des données de la scène 3D et de la fenêtre Informations. Fiches PDF : textes issus de
                Wikipédia francophone (licence CC BY-SA), PDF servis depuis <code>/data/documents/</code>.
              </p>
            </div>
          )}
    </div>
  );
}
