// Importe de MUI Box, ToggleButton (bouton à bascule) et Typography.
import { Box, ToggleButton, Typography } from '@mui/material';
// Importe la liste des familles d'astres.
import { BODY_KINDS } from '@/moteur/engine/bodyKinds';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';

/**
 * Familles d'astres : un bouton par famille, enfoncé quand elle est affichée. Un appui l'enlève de la scène (astres,
 * anneaux, cartes, orbites, repères et listes de navigation), un second la remet. Les satellites suivent leur planète.
 */
// Déclare et exporte le composant AstresAffiches : les familles affichées et le rappel.
export function AstresAffiches({ kinds = {}, onKind }) {
  // Début du rendu.
  return (
    // Conteneur au rôle de groupe.
    <Box role="group" aria-label="Astres affichés" sx={{ mb: 2 }}>
      {/* Le titre. */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>Astres affichés</Typography>
      {/* Grille des boutons : une colonne sur très petit écran, deux sinon. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
        {/* Un bouton par famille (début). */}
        {BODY_KINDS.map(({ id, label, hint }) => {
          // Famille affichée, sauf si elle est explicitement à faux.
          const shown = kinds[id] !== false;
          // Début du rendu du bouton.
          return (
            // Le bouton à bascule (début de la balise).
            <ToggleButton
              // Clé unique.
              key={id}
              // Sa valeur : l'identifiant de la famille.
              value={id}
              // Enfoncé si la famille est affichée.
              selected={shown}
              // Au changement : demande l'état inverse.
              onChange={() => onKind?.(id, !shown)}
              // Nom pour les lecteurs d'écran, avec l'état et l'effet d'un appui.
              aria-label={`${label} : ${shown ? 'affichés, appuyer pour les enlever' : 'enlevés, appuyer pour les remettre'}`}
              // Début du style.
              sx={{
                // Contenu en colonne, aligné à gauche.
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25,
                // Marges, texte à gauche ; estompé si la famille est enlevée.
                px: 1.5, py: 1, textAlign: 'left', lineHeight: 1.25, opacity: shown ? 1 : 0.72,
              // Fin du style.
              }}
            // Fin de la balise ouvrante.
            >
              {/* Première ligne : nom et état aux deux extrémités. */}
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, width: '100%' }}>
                {/* Le nom, barré si la famille est enlevée. */}
                <Box component="span" sx={{ textDecoration: shown ? 'none' : 'line-through' }}>{label}</Box>
                {/* L'état : « Affichés » ou « Enlevés ». */}
                <Box component="span" aria-hidden="true" sx={{ fontSize: '0.75rem', opacity: 0.85 }}>{shown ? 'Affichés' : 'Enlevés'}</Box>
              {/* Fin de la première ligne. */}
              </Box>
              {/* Le texte d'aide de la famille, en petit. */}
              <Box component="span" sx={{ fontSize: '0.72rem', fontFamily: 'system-ui, sans-serif', letterSpacing: 0, opacity: 0.8 }}>{hint}</Box>
            {/* Fin du bouton. */}
            </ToggleButton>
          // Fin du rendu du bouton.
          );
        // Fin des boutons.
        })}
      {/* Fin de la grille. */}
      </Box>
      {/* Note d'aide. */}
      <Hint>Appuyez sur une famille pour l’enlever de la scène ou la remettre. Les satellites disparaissent avec leur planète.</Hint>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de AstresAffiches.
}
