// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe keyframes d'Emotion, pour définir une animation CSS.
import { keyframes } from '@emotion/react';
// Importe de MUI Box (conteneur), LinearProgress (barre de progression), Paper et Typography.
import { Box, LinearProgress, Paper, Typography } from '@mui/material';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe la table des astres cartographiés, qui donne la clé du HUD de chaque astre.
import { TILED_BODY_BY_ID } from '@/moteur/engine/tiledBodies';
// Importe l'état de repos, le calcul de l'avancement et les deux délais d'affichage.
import { HIDE_DELAY_MS, IDLE, SHOW_DELAY_MS, tileLoadStep } from '@/moteur/lib/tileLoading';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe MQ (requêtes média prêtes à l'emploi) et safe (marge de sécurité de l'écran).
import { MQ, safe } from '@/composante/theme/mediaQueries';

// Définit l'animation des trois points, sur le modèle « flow » de SpinKit, en CSS pur (début).
const flow = keyframes({
  // Au début, à 80 % et à la fin : point réduit et estompé.
  '0%, 80%, 100%': { transform: 'scale(0.35)', opacity: 0.45 },
  // À 40 % : point à sa taille, opaque.
  '40%': { transform: 'scale(1)', opacity: 1 },
// Fin de l'animation.
});
// Définit l'animation d'apparition de la pastille (début).
const appear = keyframes({
  // Au départ : transparente, légèrement remontée.
  from: { opacity: 0, transform: 'translateY(-4px)' },
  // À la fin : opaque, à sa place.
  to: { opacity: 1, transform: 'translateY(0)' },
// Fin de l'animation.
});

/**
 * Petit indicateur du chargement des tuiles de l'astre visé (Terre, Lune, Mars, satellites…) : trois points animés,
 * le nom de l'astre, le pourcentage et une fine barre. Il n'apparaît que si le chargement dure plus d'un quart de
 * seconde (pas de clignotement lors d'un simple déplacement) et s'efface juste après la dernière tuile. Sans
 * dépendance ajoutée : animation en CSS pur (transform et opacity seulement, peu coûteuses sur téléphone), coupée
 * si l'appareil demande moins d'animations. Il ne capte aucun clic.
 */
// Déclare et exporte le composant TuilesLoader : magasin du HUD, identifiant et nom de l'astre visé.
export function TuilesLoader({ hud, bodyId, bodyName }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Clé du HUD de l'astre visé, null s'il n'a pas de tuiles (Soleil, astre sans carte).
  const hudKey = (bodyId && TILED_BODY_BY_ID[bodyId]?.hudKey) || null;
  // Lit l'état des tuiles de cet astre ; l'objet ne change que si ce qui est affiché a changé.
  const snap = useHud(hud, (s) => (hudKey ? s[hudKey] : null));
  // Mémoire entre deux rendus : l'astre suivi et l'avancement de son chargement.
  const memo = useRef({ key: null, step: IDLE });
  // Changement d'astre : repart du repos.
  if (memo.current.key !== hudKey) memo.current = { key: hudKey, step: IDLE };
  // Fait avancer l'état d'après le dernier état publié par le moteur.
  memo.current.step = tileLoadStep(memo.current.step, snap);
  // L'état courant : chargement en cours ou non, et pourcentage.
  const { busy, percent } = memo.current.step;
  // État : indicateur affiché ou non.
  const [shown, setShown] = useState(false);

  // Effet qui affiche l'indicateur après un court délai, puis l'efface après la fin.
  useEffect(() => {
    // Délai : celui d'apparition pendant un chargement, celui de maintien après la fin.
    const timer = setTimeout(() => setShown(busy), busy ? SHOW_DELAY_MS : HIDE_DELAY_MS);
    // Nettoyage : annule ce délai.
    return () => clearTimeout(timer);
  // Fin de l'effet ; dépendances : le chargement et l'astre.
  }, [busy, hudKey]);

  // Rien à afficher si l'indicateur est caché ou si l'astre n'a pas de tuiles.
  if (!shown || !hudKey) return null;
  // Valeur affichée : 100 une fois le chargement fini, pendant le court maintien.
  const value = busy ? percent : 100;
  // Début du rendu.
  return (
    // Pastille de l'indicateur (début de la balise).
    <Paper
      // Ombre légère.
      elevation={2}
      // Rôle d'état.
      role="status"
      // Nom pour les lecteurs d'écran, avec l'astre et le pourcentage.
      aria-label={`Chargement des tuiles${bodyName ? ` de ${bodyName}` : ''} : ${value} %`}
      // Début du style.
      sx={{
        // Fixée, sans capter les clics.
        position: 'fixed', zIndex: 26, pointerEvents: 'none',
        // Sous le bandeau du haut, à gauche : sous le compteur d'images sur ordinateur, à sa place sur téléphone.
        top: `calc(var(--gps-top, 0px) + ${safe('top')} + ${compact ? 46 : 60}px)`, left: `calc(${safe('left')} + 5px)`,
        // Largeur selon l'écran, petites marges, coins arrondis, apparition en fondu.
        width: compact ? 150 : 180, px: 1, py: 0.6, borderRadius: 1, animation: `${appear} 180ms ease-out`,
        // Si l'appareil demande moins d'animations : pas de fondu.
        [MQ.reducedMotion]: { animation: 'none' },
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Ligne du haut : les points, le libellé et le pourcentage, centrés verticalement. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {/* Les trois points animés, cachés aux lecteurs d'écran, qui ne se déforment pas. */}
        <Box aria-hidden="true" sx={{ display: 'flex', gap: '3px', flex: 'none' }}>
          {/* Crée les trois points (i : numéro du point). */}
          {[0, 1, 2].map((i) => (
            // Un point (début de la balise).
            <Box
              // Clé React du point.
              key={i}
              // Début du style.
              sx={{
                // Rond de 5 px, de la couleur principale du thème.
                width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main',
                // Pulsation en boucle, décalée de 0,16 s d'un point au suivant.
                animation: `${flow} 1.3s ${i * 0.16}s infinite ease-in-out both`,
                // Si l'appareil demande moins d'animations : points fixes.
                [MQ.reducedMotion]: { animation: 'none' },
              // Fin du style.
              }}
            // Fin du point.
            />
          // Fin de la création des points.
          ))}
        {/* Fin des trois points. */}
        </Box>
        {/* Le libellé : prend la largeur restante, sur une seule ligne, coupé par des points de suspension. */}
        <Typography variant="caption" sx={{ flex: 1, minWidth: 0, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {/* « Tuiles », suivi du nom de l'astre s'il est connu. */}
          Tuiles{bodyName ? ` · ${bodyName}` : ''}
        {/* Fin du libellé. */}
        </Typography>
        {/* Le pourcentage, en chiffres de largeur fixe, jamais traduit. */}
        <Typography variant="caption" translate="no" sx={{ flex: 'none', fontWeight: 600, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
          {/* La valeur et son unité. */}
          {value} %
        {/* Fin du pourcentage. */}
        </Typography>
      {/* Fin de la ligne du haut. */}
      </Box>
      {/* La barre de progression, très fine et arrondie. */}
      <LinearProgress variant="determinate" value={value} sx={{ mt: 0.5, height: 3, borderRadius: 2 }} />
    {/* Fin de la pastille. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de TuilesLoader.
}
