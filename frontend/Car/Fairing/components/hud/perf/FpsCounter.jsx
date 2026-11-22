// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/Engine/AstreSolideEngine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
// Importe tok, qui donne la variable CSS d'une couleur nommée.
import { tok } from '@/Fairing/kit/sx';
import { useViewport } from '@/Fairing/hooks/useViewport';

/**
 * Couleur selon la fluidité, par rapport au rythme visé par le moteur (50 par défaut) : vert à partir de 90 % du
 * rythme visé, orange à partir de la moitié, rouge en dessous. Un rythme plafonné tenu reste donc vert.
 */
// fpsColor : vert à 90 % du rythme visé, orange à 50 %, rouge en dessous.
export const fpsColor = (fps, target = 50) => (fps >= 0.9 * target ? 'success.main' : fps >= 0.5 * target ? 'warning.main' : 'error.main');

/**
 * Compteur d'images par seconde : moyenne des images réellement dessinées par le moteur 3D sur la dernière seconde
 * (voir Engine.countFps). L'infobulle donne le rythme de l'image la plus lente. Sur ordinateur, « · 60 FPS » à la suite de la date, dans le bandeau du titre
 * (HudTop) : il n'a plus de position propre et ne recouvre plus le logo. Rien sur téléphone.
 */
// Déclare et exporte le composant FpsCounter : reçoit le magasin du HUD.
export function FpsCounter({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit le nombre d'images par seconde, 0 à défaut.
  const fps = useHud(hud, (s) => s.fps ?? 0);
  // Lit le rythme de l'image la plus lente, 0 à défaut.
  const low = useHud(hud, (s) => s.fpsLow ?? 0);
  // Lit le rythme visé par le moteur, 50 à défaut.
  const target = useHud(hud, (s) => s.fpsTarget || 50);
  // Téléphone ou sans mesure : rien.
  if (compact || !fps) return null;
  // Début du rendu.
  return (
    // Texte en ligne, d'un seul tenant, rôle d'état, nom complet pour les lecteurs d'écran, jamais traduit.
    <span role="status" aria-label={`${fps} images par seconde`} title={low ? `Image la plus lente : ${low} FPS · rythme visé : ${target} FPS` : undefined} translate="no" className="whitespace-nowrap">
      {/* Séparateur, nombre (gras, coloré selon la fluidité) et unité. */}
      {' · '}<b className="font-bold" style={{ color: tok(fpsColor(fps, target)) }}>{fps}</b> FPS
    {/* Fin du texte. */}
    </span>
  // Fin du rendu.
  );
// Fin de FpsCounter.
}
