// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/Engine/AstreSolideEngine/hudStore';
// Importe de React le crochet useState.
import { useState } from 'react';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';

/**
 * Lecture du zoom, du niveau d'échelle (« Rue », « Ville », « Planète »…) et du niveau de carte de la Terre,
 * intégrée à la barre d'outils.
 * Chiffres à chasse fixe : la valeur défile sans faire bouger le texte autour.
 */
// Déclare et exporte le composant Readout : reçoit le magasin du HUD.
export function Readout({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit le texte du zoom.
  const zoomText = useHud(hud, (s) => s.zoomText);
  // Lit le texte du niveau d'échelle.
  const scaleText = useHud(hud, (s) => s.scaleText);
  // Lit le niveau de zoom de la carte, seulement si une couche de tuiles est affichée.
  const tileZoom = useHud(hud, (s) => (s.tiles && s.tiles.layerId ? s.tiles.zoom : null));
  // Lit le lien de la vue du globe de près (vide hors du globe de près).
  const viewLink = useHud(hud, (s) => s.viewLink);
  // État : vrai juste après la copie du lien.
  const [copied, setCopied] = useState(false);
  // shareLink : partage (téléphone) ou copie le lien de la vue (début).
  const shareLink = async () => {
    // Début du bloc protégé : le partage peut être annulé, le presse-papiers refusé.
    try {
      // Téléphone avec partage natif : menu de partage.
      if (compact && navigator.share) { await navigator.share({ title: document.title, url: viewLink }); return; }
      // Sinon : copie dans le presse-papiers.
      await navigator.clipboard.writeText(viewLink);
      // « Lien copié » pendant 1,5 s.
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    // Annulation ou refus : rien.
    } catch { /* partage annulé ou presse-papiers indisponible */ }
  // Fin de shareLink.
  };
  // Début du rendu.
  return (
    // Ligne horizontale, non annoncée par les lecteurs d'écran, sur une seule ligne.
    <div aria-live="off" className="flex flex-row gap-3 px-2 items-center whitespace-nowrap min-w-0">
      {/* Le texte du zoom, coupé par des points de suspension s'il déborde, en chiffres de largeur fixe. */}
      <span className="t-caption overflow-hidden text-ellipsis tabular-nums">{zoomText}</span>
      {/* Le niveau d'échelle, s'il existe, avec une infobulle. */}
      {scaleText && <span title="Niveau d’échelle de la vue" className="t-caption text-soft flex-none">{scaleText}</span>}
      {/* Le niveau de la carte, s'il est connu, hors mode compact. */}
      {tileZoom !== null && !compact && <span className="t-caption text-soft">carte niveau {tileZoom}</span>}
      {/* Globe de près : bouton qui copie (ou partage) le lien de la vue. */}
      {viewLink && <button type="button" onClick={shareLink} title="Copier le lien de cette vue" className="t-caption text-soft flex-none hover:underline">{copied ? 'Lien copié' : 'Copier le lien'}</button>}
    {/* Fin de la ligne. */}
    </div>
  // Fin du rendu.
  );
// Fin de Readout.
}
