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

/** Durée d'affichage de la jauge pleine avant qu'elle ne s'efface (ms). */
// La jauge pleine reste affichée 2 secondes.
const DONE_MS = 2000;
// millions : convertit un nombre en millions, au format français, avec une décimale.
const millions = (n) => (n / 1e6).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Petite jauge du chargement du nuage de points LiDAR en 3D (dalle à l'écran) : points déjà dessinés sur points
 * voulus pour la vue, mis à jour en direct par le moteur. Elle n'apparaît que pendant un chargement, sous la
 * pastille GPS du coin haut droit, et s'efface deux secondes après la fin.
 */
// Déclare et exporte le composant LidarJauge : reçoit le magasin du HUD.
export function LidarJauge({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit le nom de la dalle en cours, null s'il n'y en a pas.
  const name = useHud(hud, (s) => s.lidarPoints?.name ?? null);
  // Lit le nombre de points déjà dessinés.
  const shown = useHud(hud, (s) => s.lidarPoints?.shown ?? 0);
  // Lit le nombre de points voulus.
  const wanted = useHud(hud, (s) => s.lidarPoints?.wanted ?? 0);
  // Chargement en cours : il y a une dalle et il manque des points.
  const loading = name !== null && shown < wanted;
  // État : jauge visible ou non.
  const [visible, setVisible] = useState(false);

  // Effet qui affiche puis efface la jauge.
  useEffect(() => {
    // Pendant le chargement : visible, et rien à nettoyer.
    if (loading) { setVisible(true); return undefined; }
    // Sinon : l'efface après 2 secondes, tout de suite s'il n'y a plus de dalle.
    const timer = setTimeout(() => setVisible(false), name === null ? 0 : DONE_MS);
    // Nettoyage : annule ce délai.
    return () => clearTimeout(timer);
  // Fin de l'effet ; dépendances : le chargement et le nom.
  }, [loading, name]);

  // Rien à afficher si la jauge est cachée ou sans dalle.
  if (!visible || name === null) return null;
  // Pourcentage entier, plafonné à 100 ; 100 si aucun point n'est voulu.
  const percent = wanted > 0 ? Math.min(100, Math.floor((shown / wanted) * 100)) : 100;
  // Début du rendu.
  return (
    // Carte de la jauge (début de la balise).
    <Paper
      // Ombre légère.
      elevation={2}
      // Rôle d'état.
      role="status"
      // Nom pour les lecteurs d'écran, avec le pourcentage.
      aria-label={`Chargement du nuage de points LiDAR : ${percent} %`}
      // Début du style.
      sx={{
        // Fixée, sans capter les clics.
        position: 'fixed', zIndex: 26, pointerEvents: 'none',
        // Sous le bandeau du haut (plus bas en mode compact), à 5 px du bord droit.
        top: `calc(var(--gps-top, 0px) + ${safe('top')} + ${compact ? 46 : 34}px)`, right: `calc(${safe('right')} + 5px)`,
        // Largeur selon l'écran, petites marges, coins arrondis.
        width: compact ? 164 : 210, px: 1, py: 0.75, borderRadius: 1,
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Première ligne : titre et pourcentage aux deux extrémités, en demi-gras. */}
      <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontWeight: 600, lineHeight: 1.3 }}>
        {/* Le titre. */}
        <span>LiDAR 3D</span>
        {/* Le pourcentage, en chiffres de largeur fixe. */}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{percent} %</span>
      {/* Fin de la première ligne. */}
      </Typography>
      {/* La barre de progression, fine et arrondie. */}
      <LinearProgress variant="determinate" value={percent} sx={{ my: 0.5, height: 4, borderRadius: 2 }} />
      {/* Ligne du nom, sur une seule ligne, coupée par des points de suspension. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {/* Le nom de la dalle. */}
        {name}
      {/* Fin de la ligne du nom. */}
      </Typography>
      {/* Ligne du décompte, en chiffres de largeur fixe. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
        {/* Points dessinés sur points voulus, en millions. */}
        {millions(shown)} / {millions(wanted)} millions de points
      {/* Fin de la ligne du décompte. */}
      </Typography>
    {/* Fin de la carte. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de LidarJauge.
}
