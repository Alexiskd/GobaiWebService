import { Button, Stack } from '@mui/material';

// Boutons du formulaire : prévisualiser le placement (nouvelle contribution) et publier.
export function FormActions({ correction, busy, analyzing, progress, preview, identity, hasPseudonym, onAnalyze, onPublish }) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {!correction && (
        <Button variant="outlined" onClick={onAnalyze} disabled={busy}>
          {analyzing ? `Analyse ${progress} %` : 'Prévisualiser le placement'}
        </Button>
      )}
      <Button variant="contained" onClick={onPublish} disabled={busy || !preview || !identity || !hasPseudonym}>
        {correction ? 'Publier la correction' : 'Publier'}
      </Button>
    </Stack>
  );
}
