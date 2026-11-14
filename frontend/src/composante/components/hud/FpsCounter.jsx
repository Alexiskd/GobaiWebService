// Importe Paper, la carte de MUI.
import { Paper } from '@mui/material';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';

/** Couleur selon la fluidité : vert à partir de 50 images par seconde, orange à partir de 25, rouge en dessous. */
// fpsColor : vert à partir de 50, orange à partir de 25, rouge en dessous.
export const fpsColor = (fps) => (fps >= 50 ? 'success.main' : fps >= 25 ? 'warning.main' : 'error.main');

/**
 * Compteur d'images par seconde : nombre d'images réellement dessinées par le moteur 3D, mis à jour deux fois par
 * seconde (voir Engine.countFps). Petite pastille en haut à gauche, sous le bandeau du titre ; elle ne capte aucun
 * clic. Sur téléphone le moteur vise 30 images par seconde (20 au repos) : la valeur le reflète.
 */
// Déclare et exporte le composant FpsCounter : reçoit le magasin du HUD.
export function FpsCounter({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit le nombre d'images par seconde, 0 à défaut.
  const fps = useHud(hud, (s) => s.fps ?? 0);
  // Sans mesure, rien n'est affiché.
  if (compact || !fps) return null;
  // Début du rendu.
  return (
    // Pastille (début de la balise).
    <Paper
      // Ombre légère.
      elevation={2}
      // Rôle d'état.
      role="status"
      // Nom complet pour les lecteurs d'écran.
      aria-label={`${fps} images par seconde`}
      // Jamais traduit.
      translate="no"
      // Début du style.
      sx={{
        // Fixée, sans capter les clics, contenu aligné sur la ligne de base.
        position: 'fixed', zIndex: 26, pointerEvents: 'none', display: 'flex', alignItems: 'baseline', gap: '4px',
        // Sous le bandeau du haut (plus bas en mode compact), à 5 px du bord gauche.
        top: `calc(var(--gps-top, 0px) + ${safe('top')} + ${compact ? 46 : 34}px)`, left: `calc(${safe('left')} + 5px)`,
        // Petites marges, coins arrondis, une seule ligne, chiffres de largeur fixe.
        px: 0.75, py: 0.25, borderRadius: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        // Police à chasse fixe, petite taille.
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 11.5, lineHeight: 1.35,
        // Le nombre : gras, coloré selon la fluidité, large de deux chiffres, aligné à droite.
        '& b': { fontWeight: 700, color: fpsColor(fps), minWidth: '2ch', textAlign: 'right' },
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Le nombre d'images par seconde. */}
      <b>{fps}</b>
      {/* L'unité. */}
      <span>FPS</span>
    {/* Fin de la pastille. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de FpsCounter.
}
