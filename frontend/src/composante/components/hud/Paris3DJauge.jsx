// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe de MUI LinearProgress (barre de progression), Paper et Typography.
import { LinearProgress, Paper, Typography } from '@mui/material';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';

/** Durée d'affichage de la jauge une fois tout chargé, avant qu'elle ne s'efface (ms). */
// La jauge reste affichée 3 secondes.
const DONE_MS = 3000;

/**
 * Petite jauge de Paris en 3D : cellules hexagonales affichées, en cours de chargement, nombre de bâtiments, et la
 * dernière erreur s'il y en a une (téléchargement IGN refusé, construction 3D impossible). Elle apparaît sous 4 km
 * d'altitude au-dessus de Paris, pendant un chargement ou en cas d'erreur, sous la jauge LiDAR, et s'efface trois
 * secondes après la fin d'un chargement réussi.
 */
// Déclare et exporte le composant Paris3DJauge : reçoit le magasin du HUD.
export function Paris3DJauge({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit l'état de Paris en 3D publié par le moteur.
  const on = useHud(hud, (s) => Boolean(s.paris3d?.on));
  // Cellules affichées.
  const shown = useHud(hud, (s) => s.paris3d?.shown ?? 0);
  // Cellules en cours de chargement.
  const loading = useHud(hud, (s) => s.paris3d?.loading ?? 0);
  // Bâtiments affichés.
  const buildings = useHud(hud, (s) => s.paris3d?.buildings ?? 0);
  // Cellules en échec.
  const failed = useHud(hud, (s) => s.paris3d?.failed ?? 0);
  // Dernière erreur, ou null.
  const error = useHud(hud, (s) => s.paris3d?.error ?? null);
  // Quelque chose à signaler : un chargement, un échec, ou rien d'affiché alors que Paris 3D est actif.
  const busy = on && (loading > 0 || failed > 0 || shown === 0);
  // État : jauge visible ou non.
  const [visible, setVisible] = useState(false);

  // Effet qui affiche puis efface la jauge.
  useEffect(() => {
    // Quelque chose à signaler : visible.
    if (busy) { setVisible(true); return undefined; }
    // Sinon : l'efface après 3 secondes, tout de suite si Paris 3D n'est plus actif.
    const timer = setTimeout(() => setVisible(false), on ? DONE_MS : 0);
    // Nettoyage : annule ce délai.
    return () => clearTimeout(timer);
  // Fin de l'effet ; dépendances : l'activité et l'état.
  }, [busy, on]);

  // Rien à afficher si la jauge est cachée.
  if (!visible) return null;
  // Part des cellules prêtes parmi celles en cours ou prêtes, en pourcentage.
  const percent = shown + loading > 0 ? Math.round((shown / (shown + loading)) * 100) : 0;
  // Début du rendu.
  return (
    // Carte de la jauge (début de la balise).
    <Paper
      // Ombre légère.
      elevation={2}
      // Rôle d'état.
      role="status"
      // Nom pour les lecteurs d'écran.
      aria-label={`Paris en 3D : ${shown} cellules, ${buildings} bâtiments${error ? `, erreur : ${error}` : ''}`}
      // Début du style.
      sx={{
        // Fixée, sans capter les clics.
        position: 'fixed', zIndex: 26, pointerEvents: 'none',
        // Sous la jauge LiDAR, à 5 px du bord droit.
        top: `calc(var(--gps-top, 0px) + ${safe('top')} + ${compact ? 128 : 116}px)`, right: `calc(${safe('right')} + 5px)`,
        // Largeur selon l'écran, petites marges, coins arrondis.
        width: compact ? 164 : 210, px: 1, py: 0.75, borderRadius: 1,
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Première ligne : titre et pourcentage, en demi-gras. */}
      <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontWeight: 600, lineHeight: 1.3 }}>
        {/* Le titre. */}
        <span>Paris 3D</span>
        {/* Le pourcentage, en chiffres de largeur fixe. */}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{percent} %</span>
      {/* Fin de la première ligne. */}
      </Typography>
      {/* La barre : indéterminée tant que rien n'est prêt, sinon la part prête. */}
      <LinearProgress variant={shown ? 'determinate' : 'indeterminate'} value={percent} sx={{ my: 0.5, height: 4, borderRadius: 2 }} />
      {/* Ligne du décompte, en chiffres de largeur fixe. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
        {/* Cellules et bâtiments. */}
        {shown} cellules · {buildings.toLocaleString('fr-FR')} bâtiments{loading ? ` · ${loading} en cours` : ''}
      {/* Fin de la ligne du décompte. */}
      </Typography>
      {/* En cas d'échec : la dernière erreur, en couleur d'erreur, sur deux lignes au plus (début). */}
      {failed > 0 && (
        // La ligne de l'erreur.
        <Typography variant="caption" color="error" sx={{ display: 'block', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
          {/* Le nombre de cellules en échec et la raison. */}
          {failed} en échec{error ? ` · ${error}` : ''}
        {/* Fin de la ligne de l'erreur. */}
        </Typography>
      // Fin du cas.
      )}
    {/* Fin de la carte. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de Paris3DJauge.
}
