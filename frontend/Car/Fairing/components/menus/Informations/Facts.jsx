// Importe les composants MUI utilisés ici.
import { Box, Typography } from '@mui/material';
// Importe le calcul des largeurs des tuiles (module sans JSX, testé à part).
import { largeurs } from './factsLayout.js';

/**
 * Caractéristiques d'un astre, en tuiles : le terme en petites capitales au-dessus, la valeur en gras et en
 * chiffres alignés, la note éventuelle en dessous. Deux tuiles par ligne quand la largeur le permet ; une
 * caractéristique longue (phase de la Lune, libration…) prend la ligne entière, et une tuile qui resterait seule
 * sur sa ligne s'étire pour ne pas laisser de trou.
 * Liste de définitions (dl / dt / dd) pour les lecteurs d'écran, comme l'ancienne présentation en lignes.
 */
export function Facts({ items }) {
  // Sans caractéristique : rien à afficher.
  if (!items?.length) return null;
  // La largeur de chaque tuile, calculée une fois pour la liste.
  const large = largeurs(items);
  return (
    <Box
      component="dl"
      sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}
    >
      {items.map((item, i) => (
        <Box
          key={item.term}
          sx={{
            minWidth: 0, px: 1.25, py: 1, borderRadius: 2,
            border: 1, borderColor: 'divider', bgcolor: 'action.hover',
            // Une caractéristique longue prend les deux colonnes ; une tuile seule sur sa ligne aussi.
            gridColumn: large[i] ? '1 / -1' : undefined,
          }}
        >
          {/* Le terme : petites capitales, couleur atténuée. */}
          <Typography component="dt" sx={{ fontSize: 10.5, lineHeight: 1.3, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {item.term}
          </Typography>
          <Box component="dd" sx={{ m: 0, mt: 0.4 }}>
            {/* La valeur : en gras, chiffres de même largeur pour que les valeurs en direct ne tremblent pas. */}
            <Typography sx={{ fontSize: 14.5, lineHeight: 1.3, fontWeight: 600, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
              {item.value}
            </Typography>
            {/* La note éventuelle, sous la valeur. */}
            {item.note && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                {item.note}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
