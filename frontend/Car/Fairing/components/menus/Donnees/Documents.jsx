// Importe les crochets useState et useMemo.
import { useMemo, useState } from 'react';
// Importe les groupes et la liste des fiches, et les fiches d'un groupe.
import { DOCUMENTS, GROUPS, documentsOf } from './data/index.js';
// Icônes de téléchargement et de lien externe.
import { DownloadIcon, OpenInNewIcon } from '../../ui/icons.jsx';
// Feuille de style de la documentation.
import './documents.css';

/**
 * Documents : onglet « Documentation » de la fenêtre Données. Affiche les fiches construites à partir
 * des PDF de public/data/documents (un module JS par PDF dans data/), groupées par famille dynamique.
 * Une fiche ouverte montre les données extraites du document et renvoie vers sa page Wikipédia.
 * Les styles sont limités au conteneur .gobai-docs.
 */
// Déclare et exporte le composant Documents.
export function Documents() {
  // État : la fiche ouverte, null si aucune.
  const [openId, setOpenId] = useState(null);
  // La fiche ouverte (calcul mémorisé).
  const doc = useMemo(() => DOCUMENTS.find((d) => d.id === openId), [openId]);

  // Si une fiche est ouverte, affiche sa fiche détaillée.
  if (doc) {
    // Début du rendu de la fiche.
    return (
      // Conteneur qui porte les styles de la documentation.
      <div className="gobai-docs">
        <div className="docs-wrap">
          {/* Le retour à la liste. */}
          <button className="doc-back" onClick={() => setOpenId(null)}>
            ← Toutes les fiches
          </button>
          {/* L'en-tête de la fiche : nom, désignation et pastilles. */}
          <header className="doc-head">
            <h1 className="doc-title">{doc.name}</h1>
            <span className="doc-designation">{doc.designation}</span>
            <div className="doc-chips">
              <span className="doc-chip">{doc.group}</span>
              <span className="doc-chip">Orbite {doc.motion === 'rétrograde' ? 'rétrograde' : 'prograde'}</span>
              <span className="doc-chip">{doc.physical.size}</span>
            </div>
          </header>
          {/* Les actions sur le document. */}
          <div className="doc-actions">
            <a className="doc-btn" href={doc.source} target="_blank" rel="noreferrer">
              <OpenInNewIcon fontSize="small" /> Page Wikipédia
            </a>
            <a className="doc-btn" href={doc.file} target="_blank" rel="noreferrer">
              <OpenInNewIcon fontSize="small" /> Ouvrir dans un onglet
            </a>
            <a className="doc-btn" href={doc.file} download>
              <DownloadIcon fontSize="small" /> Télécharger
            </a>
            <a className="doc-src" href={doc.source} target="_blank" rel="noreferrer">Source : Wikipédia</a>
          </div>
          {/* Les données de la fiche. */}
          <section className="doc-grid">
            {/* La découverte (début du bloc). */}
            <div className="doc-card">
              <h2>Découverte</h2>
              <dl>
                <dt>Découvreur</dt><dd>{doc.discovery.who}</dd>
                {doc.discovery.where ? <><dt>Lieu</dt><dd>{doc.discovery.where}</dd></> : null}
                <dt>Date</dt><dd>{doc.discovery.date}</dd>
                <dt>Désignation d'origine</dt><dd>{doc.discovery.provisional}</dd>
              </dl>
            </div>
            {/* Fin du bloc découverte. */}
            {/* L'orbite (début du bloc). */}
            <div className="doc-card">
              <h2>Orbite</h2>
              <dl>
                <dt>Demi-grand axe</dt><dd>{doc.orbit.semiMajorAxis}</dd>
                <dt>Période de révolution</dt><dd>{doc.orbit.period}</dd>
                <dt>Excentricité</dt><dd>{doc.orbit.eccentricity}</dd>
                <dt>Inclinaison</dt><dd>{doc.orbit.inclination}</dd>
              </dl>
            </div>
            {/* Fin du bloc orbite. */}
            {/* Les caractéristiques physiques (début du bloc). */}
            <div className="doc-card">
              <h2>Caractéristiques physiques</h2>
              <dl>
                <dt>Dimensions</dt><dd>{doc.physical.size}</dd>
                <dt>Masse</dt><dd>{doc.physical.mass}</dd>
                <dt>Masse volumique</dt><dd>{doc.physical.density}</dd>
                <dt>Albédo moyen</dt><dd>{doc.physical.albedo}</dd>
              </dl>
            </div>
            {/* Fin du bloc physique. */}
          </section>
          {/* Le texte du document (début du bloc). */}
          <section className="doc-text">
            <h2>Résumé</h2>
            <p>{doc.summary}</p>
            <h2>Origine du nom</h2>
            <p>{doc.mythology}</p>
          </section>
          {/* Fin du bloc texte. */}
        {/* Fin du conteneur central. */}
        </div>
      {/* Fin du conteneur. */}
      </div>
    // Fin du rendu de la fiche.
    );
  // Fin du cas fiche ouverte.
  }

  // Liste des fiches, groupées (début du calcul).
  const groups = GROUPS.map((g) => ({ ...g, docs: documentsOf(g.id) }));

  // Début du rendu de la liste.
  return (
    // Conteneur qui porte les styles de la documentation.
    <div className="gobai-docs">
      <div className="docs-wrap">
        {/* L'en-tête de la liste. */}
        <header className="doc-head">
          <h1 className="doc-title">Documentation</h1>
          <p className="doc-sub">{DOCUMENTS.length} fiches établies à partir des PDF de Jupiter, une par document du dossier data.</p>
        </header>
        {/* Un groupe par famille dynamique (début). */}
        {groups.map((g) => (
          // La section du groupe (début de la balise).
          <section key={g.id} className="doc-group">
            {/* Le titre du groupe. */}
            <h2 className="doc-group-title">
              {g.name} <span className="doc-group-count">{g.docs.length}</span>
            </h2>
            {/* Une carte par fiche (début). */}
            <div className="doc-cards">
              {g.docs.map((d) => (
                // La carte, cliquable, qui ouvre la fiche (début de la balise).
                <button key={d.id} className="doc-card-btn"
                  onClick={() => setOpenId(d.id)}>
                  {/* Le nom et la désignation. */}
                  <span className="doc-card-name">{d.name}</span>
                  <span className="doc-card-designation">{d.designation}</span>
                  {/* Le résumé. */}
                  <span className="doc-card-sum">{d.summary}</span>
                  {/* Les métadonnées rapides. */}
                  <span className="doc-card-meta">{d.physical.size} · {d.orbit.period}</span>
                {/* Fin de la carte. */}
                </button>
              // Fin des cartes.
              ))}
            {/* Fin des cartes. */}
            </div>
          {/* Fin de la section. */}
          </section>
        // Fin des groupes.
        ))}
        {/* L'origine des documents. */}
        <p className="doc-foot">Textes issus des articles Wikipédia francophone correspondants (licence CC BY-SA) ; les PDF originaux sont servis depuis <code>/data/documents/</code>.</p>
      {/* Fin du conteneur central. */}
      </div>
    {/* Fin du conteneur des styles. */}
    </div>
  // Fin du rendu.
  );
// Fin de Documents.
}
