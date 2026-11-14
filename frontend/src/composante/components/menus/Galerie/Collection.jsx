// Importe de React les crochets useEffect, useMemo et useState.
import { useEffect, useMemo, useState } from 'react';
// Importe resolveApiUrl, qui complète une adresse de l'API.
import { resolveApiUrl } from '@/moteur/api/client';
// Icônes de lecture, de téléchargement et de fermeture.
import { CloseIcon, DownloadIcon, PlayArrowIcon } from '../../ui/icons';

// fmtSize : taille d'un fichier, en mégaoctets à partir d'un mégaoctet, en kilooctets sinon.
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.round(b / 1024)} Ko`);
// fmtDuration : durée en minutes et secondes.
const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
// ext : extension du fichier d'après son type MIME (« jpg » par défaut, « jpeg » ramené à « jpg »).
const ext = (item) => (item.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');

/**
 * « Ma collection » : photos et vidéos personnelles servies par l'API (GET /api/v1/galerie), stockées dans la base
 * PostgreSQL du service. Filtrées par catégorie (`category`), puis par dossier. `data` = réponse de l'API, chargée par GalerieApp.
 * `onLightboxChange(ouverte)` prévient la fenêtre quand la visionneuse s'ouvre.
 */
// Déclare et exporte le composant Collection : la catégorie, les données et le rappel de la visionneuse.
export function Collection({ category, data, onLightboxChange }) {
  // État : le dossier affiché, tous au départ.
  const [folderId, setFolderId] = useState('all');
  // État : le média ouvert dans la visionneuse, null s'il n'y en a pas.
  const [open, setOpen] = useState(null); // index dans `items`

  // Prévient le parent quand la visionneuse s'ouvre ou se ferme.
  useEffect(() => { onLightboxChange?.(open != null); }, [open, onLightboxChange]);

  // Dossiers de la catégorie affichée (planètes, planètes géantes, planètes naines ou satellites).
  // Dossiers de la catégorie affichée, liste vide sans données.
  const folders = useMemo(() => (data?.folders ?? []).filter((f) => f.category === category.id), [data, category]);
  // Nombre total de médias de ces dossiers.
  const count = folders.reduce((n, f) => n + f.items.length, 0);
  // Médias affichés (début du calcul mémorisé).
  const items = useMemo(
    // Part des dossiers…
    () => folders
      // … garde le dossier choisi, ou tous…
      .filter((f) => folderId === 'all' || f.id === folderId)
      // … et réunit leurs médias, avec le nom du dossier et les adresses complètes.
      .flatMap((f) => f.items.map((i) => ({ ...i, folderName: f.name, url: resolveApiUrl(i.url), thumbUrl: resolveApiUrl(i.thumbUrl) }))),
    // Dépendances : les dossiers et le dossier choisi.
    [folders, folderId]
  // Fin du calcul.
  );

  // Début du rendu.
  return (
    // Conteneur qui porte les styles de la galerie.
    <div className="gobai-gallery">
      {/* Conteneur de l'application, avec la couleur de la catégorie en variable CSS. */}
      <div className="app" style={{ '--planet': category.color }}>
        {/* L'en-tête. */}
        <header className="masthead">
          {/* Bloc du titre. */}
          <div className="brand">
            {/* Le surtitre : « Ma collection » et le nom de la catégorie. */}
            <span className="eyebrow">Ma collection · {category.name}</span>
            {/* Le titre. */}
            <h1>Photos et vidéos</h1>
          {/* Fin du bloc du titre. */}
          </div>
        {/* Fin de l'en-tête. */}
        </header>

        {/* La barre de filtres. */}
        <section className="toolbar">
          {/* Le groupe des dossiers. */}
          <div className="missions" role="group" aria-label="Dossiers">
            {/* Bouton « Tout », actif si tous les dossiers sont affichés ; un clic ferme aussi la visionneuse. */}
            <button className={`chip ${folderId === 'all' ? 'is-active' : ''}`} onClick={() => { setFolderId('all'); setOpen(null); }}>
              {/* Son libellé. */}
              Tout
              {/* Le nombre total de médias, quand les dossiers sont connus. */}
              {data?.folders && <span className="chip-count">{count}</span>}
            {/* Fin du bouton. */}
            </button>
            {/* Un bouton par dossier (début). */}
            {folders.map((f) => (
              // Le bouton, actif si c'est le dossier affiché ; un clic ferme aussi la visionneuse.
              <button key={f.id} className={`chip ${folderId === f.id ? 'is-active' : ''}`} onClick={() => { setFolderId(f.id); setOpen(null); }}>
                {/* Le nom du dossier. */}
                {f.name}
                {/* Son nombre de médias. */}
                <span className="chip-count">{f.items.length}</span>
              {/* Fin du bouton. */}
              </button>
            // Fin des boutons.
            ))}
          {/* Fin du groupe. */}
          </div>
        {/* Fin de la barre de filtres. */}
        </section>

        {/* En cas d'erreur : un message avec sa cause. */}
        {data?.error && <p className="notice">Impossible de charger la collection : {data.error}</p>}

        {/* La grille des médias. */}
        <main className="grid">
          {/* Une vignette par média (début). */}
          {items.map((item, i) => (
            // La vignette ; un clic l'ouvre dans la visionneuse.
            <figure key={item.id} className="tile" onClick={() => setOpen(i)}>
              {/* L'image réduite, chargée à l'approche. */}
              <img src={item.thumbUrl} alt={item.title} loading="lazy" />
              {/* Pour une vidéo : l'icône de lecture. */}
              {item.kind === 'video' && <span className="tile-play" aria-hidden="true"><PlayArrowIcon fontSize="inherit" /></span>}
              {/* Le lien de téléchargement du fichier d'origine (début) ; son clic n'ouvre pas la visionneuse. */}
              <a className="tile-dl" href={item.url} download={`${item.id}.${ext(item)}`} onClick={(e) => e.stopPropagation()}
                // Son nom pour les lecteurs d'écran, son infobulle et son symbole.
                aria-label={`Télécharger ${item.title}`} title="Télécharger le fichier d'origine"><DownloadIcon fontSize="inherit" /></a>
              {/* La légende. */}
              <figcaption>
                {/* Le nom du dossier, suivi de « vidéo » s'il y a lieu. */}
                <span className="tile-mission">{item.folderName}{item.kind === 'video' ? ' · vidéo' : ''}</span>
                {/* Le titre, jamais traduit. */}
                <span className="tile-title" translate="no">{item.title}</span>
                {/* Ligne des dimensions (début de la balise). */}
                <span className="tile-date">
                  {/* La durée pour une vidéo, puis la largeur et la hauteur. */}
                  {item.kind === 'video' && item.duration ? `${fmtDuration(item.duration)} · ` : ''}{item.width} × {item.height}
                {/* Fin de la ligne. */}
                </span>
              {/* Fin de la légende. */}
              </figcaption>
            {/* Fin de la vignette. */}
            </figure>
          // Fin des vignettes.
          ))}
          {/* Sans données : douze vignettes vides, en attendant. */}
          {!data && Array.from({ length: 12 }).map((_, i) => <div key={`sk${i}`} className="tile skeleton" />)}
        {/* Fin de la grille. */}
        </main>

        {/* Données reçues, sans erreur et sans média : un message qui le dit. */}
        {data && !data.error && items.length === 0 && <p className="empty">Aucune photo ni vidéo dans « {category.name} » pour l'instant.</p>}

        {/* Le pied de page. */}
        <footer className="foot">
          {/* Le décompte (début de la balise). */}
          <span className="count">
            {/* Le nombre de médias et, s'il est connu, leur lieu de stockage. */}
            {items.length} médias{data?.storage ? ` · ${data.storage === 'postgres' ? 'servis depuis PostgreSQL' : 'servis depuis les fichiers du dépôt'}` : ''}
          {/* Fin du décompte. */}
          </span>
        {/* Fin du pied de page. */}
        </footer>

        {/* Si un média est ouvert et existe (début). */}
        {open != null && items[open] && (
          // La visionneuse (début de la balise).
          <Viewer
            // Le média.
            item={items[open]}
            // Son rang.
            index={open}
            // Le nombre de médias.
            total={items.length}
            // Fermeture.
            onClose={() => setOpen(null)}
            // Navigation : avance ou recule en boucle.
            onNav={(d) => setOpen((i) => (i + d + items.length) % items.length)}
          // Fin de la visionneuse.
          />
        // Fin du cas.
        )}
      {/* Fin du conteneur de l'application. */}
      </div>
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de Collection.
}

// Déclare le composant Viewer : le média, son rang, le total, la fermeture et la navigation.
function Viewer({ item, index, total, onClose, onNav }) {
  // Effet des raccourcis clavier.
  useEffect(() => {
    // Déclare onKey, appelé à chaque touche enfoncée.
    const onKey = (e) => {
      // Échap : ferme.
      if (e.key === 'Escape') onClose();
      // Flèche droite : média suivant.
      if (e.key === 'ArrowRight') onNav(1);
      // Flèche gauche : média précédent.
      if (e.key === 'ArrowLeft') onNav(-1);
    // Fin de onKey.
    };
    // Écoute les touches sur toute la fenêtre.
    window.addEventListener('keydown', onKey);
    // Nettoyage : retire l'écouteur.
    return () => window.removeEventListener('keydown', onKey);
  // Fin de l'effet ; dépendances : les deux rappels.
  }, [onClose, onNav]);

  // Début du rendu.
  return (
    // Le fond de la visionneuse, au rôle de dialogue modal ; un clic dessus ferme.
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.title} onClick={onClose}>
      {/* Le corps ; un clic dedans ne ferme pas. */}
      <div className="lb-body" onClick={(e) => e.stopPropagation()}>
        {/* La scène. */}
        <div className="lb-stage">
          {/* Pour une vidéo… */}
          {item.kind === 'video'
            // … le lecteur vidéo, avec son image d'attente, en lecture automatique…
            ? <video key={item.id} src={item.url} poster={item.thumbUrl} controls autoPlay playsInline />
            // … sinon l'image.
            : <img key={item.id} src={item.url} alt={item.title} />}
          {/* Bouton « précédent ». */}
          <button className="lb-nav prev" onClick={() => onNav(-1)} aria-label="Média précédent">‹</button>
          {/* Bouton « suivant ». */}
          <button className="lb-nav next" onClick={() => onNav(1)} aria-label="Média suivant">›</button>
        {/* Fin de la scène. */}
        </div>
        {/* Le volet d'informations. */}
        <aside className="lb-info">
          {/* Sa ligne du haut. */}
          <div className="lb-top">
            {/* Le nom du dossier. */}
            <span className="tile-mission">{item.folderName}</span>
            {/* Le bouton de fermeture. */}
            <button className="lb-close" onClick={onClose} aria-label="Fermer"><CloseIcon fontSize="inherit" /></button>
          {/* Fin de la ligne du haut. */}
          </div>
          {/* Le titre, jamais traduit. */}
          <h2 translate="no">{item.title}</h2>
          {/* La liste des caractéristiques. */}
          <dl>
            {/* Le type : vidéo ou photo. */}
            <div><dt>Type</dt><dd>{item.kind === 'video' ? 'Vidéo' : 'Photo'}</dd></div>
            {/* Les dimensions. */}
            <div><dt>Dimensions</dt><dd>{item.width} × {item.height}</dd></div>
            {/* La durée, si elle est connue. */}
            {item.duration && <div><dt>Durée</dt><dd>{fmtDuration(item.duration)}</dd></div>}
            {/* La taille du fichier. */}
            <div><dt>Taille</dt><dd>{fmtSize(item.bytes)}</dd></div>
            {/* La position dans la série. */}
            <div><dt>Position</dt><dd>{index + 1} / {total}</dd></div>
          {/* Fin de la liste. */}
          </dl>
          {/* Les actions. */}
          <div className="lb-actions">
            {/* Le lien de téléchargement du fichier. */}
            <a className="lb-dl" href={item.url} download={`${item.id}.${ext(item)}`}>⤓ Télécharger le fichier</a>
          {/* Fin des actions. */}
          </div>
        {/* Fin du volet d'informations. */}
        </aside>
      {/* Fin du corps. */}
      </div>
    {/* Fin du fond de la visionneuse. */}
    </div>
  // Fin du rendu.
  );
// Fin de Viewer.
}
