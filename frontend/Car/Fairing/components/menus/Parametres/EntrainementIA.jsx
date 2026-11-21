// Importe de MUI Box, Button, Paper et Typography.
import { Box, Button, Paper, Typography } from '@mui/material';
// Importe les icônes du bouton (cerveau, lien externe).
import { OpenInNewIcon, PsychologyIcon } from '../../ui/icons.jsx';

/** Adresse du site d'entraînement de l'IA. */
export const ENTRAINEMENT_IA_URL = 'https://gobaispace.info';

/**
 * Bloc « Entraînement IA » : un bouton qui ouvre gobaispace.info. Le site s'ouvre dans un nouvel onglet : la scène 3D
 * et la fenêtre des paramètres restent telles quelles dans l'onglet d'origine.
 */
export function EntrainementIA() {
  return (
    <Box role="group" aria-label="Entraînement IA">
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>Entraînement IA</Typography>
      <Paper variant="outlined" sx={{ bgcolor: 'transparent', backdropFilter: 'none', p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 220px' }}>Entraîner l’IA sur le site gobaispace.info.</Typography>
        <Button
          component="a" href={ENTRAINEMENT_IA_URL} target="_blank" rel="noopener noreferrer"
          variant="contained" startIcon={<PsychologyIcon />} endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{ minHeight: 44, textTransform: 'none' }}
        >
          Entraînement IA
        </Button>
      </Paper>
    </Box>
  );
}
