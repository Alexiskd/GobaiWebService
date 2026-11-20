// Importe Box de MUI.
import { Box } from '@mui/material';

/**
 * Icône du bouton « E = mc² », écrite en Google Sans (la police de l'interface, chargée par index.html) : lettres
 * droites en demi-gras, signe égal entouré de fines espaces, exposant relevé sans agrandir la ligne. Chiffres et
 * lettres à chasse régulière : la formule ne bouge pas quand le bouton change d'état.
 *
 * C'est un composant, comme les icônes MUI : iconNode l'instancie avec `sx.fontSize` (la taille d'icône demandée),
 * et la formule se cale dessus. Cinq signes ne tiennent pas dans le carré d'une icône : la formule est composée à
 * 0,64 × la taille demandée, ce qui la fait tenir dans la tuile de 48 px du téléphone ; le bouton de l'ordinateur
 * lui donne une pastille plus large (voir `wide` dans ToolbarButton).
 */
export function EmcIcon({ sx }) {
  const size = Number(sx?.fontSize) || 18;
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap', lineHeight: 1,
        fontFamily: '"Google Sans", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: Math.round(size * 0.64 * 10) / 10, fontWeight: 600, letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums', fontStyle: 'normal',
      }}
    >
      <span>E</span>
      {/* Le signe égal, plus léger, avec une fine espace de chaque côté. */}
      <Box component="span" sx={{ mx: '0.16em', fontWeight: 500, opacity: 0.85 }}>=</Box>
      <span>mc</span>
      {/* Le carré, en exposant relevé sans agrandir la hauteur de ligne. */}
      <Box component="sup" sx={{ fontSize: '0.62em', fontWeight: 700, lineHeight: 0, ml: '0.06em', position: 'relative', top: '-0.12em' }}>2</Box>
    </Box>
  );
}
