// Importe Box, la boîte de mise en page de MUI.
import { Box } from '@mui/material';

/**
 * Icône du bouton « E = mc² » : la formule composée comme en typographie mathématique (lettres en italique à
 * empattements, signe égal droit, exposant relevé), sur une seule ligne.
 *
 * C'est un composant, comme les icônes MUI : iconNode l'instancie avec `sx.fontSize` (la taille d'icône demandée),
 * et la formule se cale dessus. Cinq signes ne tiennent pas dans le carré d'une icône : la formule est donc
 * composée à 0,62 × la taille demandée, ce qui la fait tenir dans la tuile de 48 px du téléphone, et le bouton de
 * l'ordinateur lui donne une pastille plus large (voir `wide` dans ToolbarButton).
 */
export function EmcIcon({ sx }) {
  // La taille d'icône demandée (18 px par défaut, comme iconNode).
  const size = Number(sx?.fontSize) || 18;
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap', lineHeight: 1,
        fontFamily: '"Cambria Math", "STIX Two Text", "Times New Roman", Georgia, serif',
        fontSize: Math.round(size * 0.62 * 10) / 10, fontWeight: 600, letterSpacing: '0.01em',
      }}
    >
      {/* L'énergie, en italique. */}
      <Box component="i">E</Box>
      {/* Le signe égal, droit, avec une fine espace de chaque côté. */}
      <Box component="span" sx={{ mx: '0.18em', fontStyle: 'normal' }}>=</Box>
      {/* La masse et la vitesse de la lumière, en italique. */}
      <Box component="i">mc</Box>
      {/* Le carré, en exposant relevé sans agrandir la hauteur de ligne. */}
      <Box component="sup" sx={{ fontSize: '0.68em', lineHeight: 0, ml: '0.04em', position: 'relative', top: '-0.1em', fontStyle: 'normal' }}>2</Box>
    </Box>
  );
}
