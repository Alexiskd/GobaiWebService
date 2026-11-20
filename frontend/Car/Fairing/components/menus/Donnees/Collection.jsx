// Visionneuse des photos et vidéos de Ma collection, ouverte depuis la fiche d'un astre de la Documentation.
import { useEffect } from 'react';
import { CloseIcon } from '../../ui/icons.jsx';
import './galerie.css';

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.round(b / 1024)} Ko`);
const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const ext = (item) => (item.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');

/**
 * Visionneuse plein écran d'un média de Ma collection (photo ou vidéo) : média en grand, flèches et clavier
 * (← →, Échap), informations et téléchargement du fichier d'origine. Les styles viennent de galerie.css
 * (conteneur .gobai-gallery, posé par l'appelant).
 */
export function CollectionViewer({ item, index, total, onClose, onNav }) {
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
