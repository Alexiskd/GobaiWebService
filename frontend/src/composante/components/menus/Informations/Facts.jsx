// Importe de MUI Box, Paper, Stack et Typography.
import { Box, Paper, Stack, Typography } from '@mui/material';

/** Caractéristiques de l'astre : libellé à gauche, valeur (et note) alignée à droite. */
// Déclare et exporte le composant Facts : reçoit les caractéristiques.
export function Facts({ items }) {
  // Sans caractéristique, rien n'est affiché.
  if (!items?.length) return null;
  // Début du rendu.
  return (
    // Carte à contour rendue en liste de définitions (dl), transparente.
    <Paper variant="outlined" component="dl" sx={{ m: 0, bgcolor: 'transparent', backdropFilter: 'none' }}>
      {/* Une ligne par caractéristique (début). */}
      {items.map(({ term, value, note }, i) => (
        // La ligne (début de la balise).
        <Stack
          // Clé unique : le libellé.
          key={term}
          // Disposition horizontale.
          direction="row"
          // Libellé et valeur aux deux extrémités.
          justifyContent="space-between"
          // Alignés sur la ligne de base.
          alignItems="baseline"
          // Espacement.
          spacing={2}
          // Marges, et un filet en haut de chaque ligne sauf la première.
          sx={{ px: 1.5, py: 1, borderTop: i ? 1 : 0, borderColor: 'divider' }}
        // Fin de la balise ouvrante.
        >
          {/* Le libellé (dt), en couleur secondaire. */}
          <Typography component="dt" variant="body2" color="text.secondary">{term}</Typography>
          {/* La valeur (dd), alignée à droite. */}
          <Box component="dd" sx={{ m: 0, textAlign: 'right' }}>
            {/* Le texte de la valeur. */}
            <Typography variant="body2">{value}</Typography>
            {/* La note, si elle existe, en petit. */}
            {note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{note}</Typography>}
          {/* Fin de la valeur. */}
          </Box>
        {/* Fin de la ligne. */}
        </Stack>
      // Fin des lignes.
      ))}
    {/* Fin de la carte. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de Facts.
}
