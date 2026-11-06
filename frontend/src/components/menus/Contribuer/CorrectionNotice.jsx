import { Alert, Button } from '@mui/material';

// Rappel de la correction en cours : l'ancienne version reste disponible, on peut annuler.
export function CorrectionNotice({ correction, busy, onCancel }) {
  return (
    <Alert
      severity="info"
      action={<Button color="inherit" size="small" onClick={onCancel} disabled={busy}>Annuler la correction</Button>}
    >
      Correction immuable de {correction.manifest.title} — l’ancienne version reste disponible.
    </Alert>
  );
}
