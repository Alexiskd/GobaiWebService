import { Stack, TextField } from '@mui/material';
import { AnchorFieldset } from './AnchorFieldset';
import { CorrectionNotice } from './CorrectionNotice';
import { DimensionsFieldset } from './DimensionsFieldset';
import { FormActions } from './FormActions';
import { LazMeta } from './LazMeta';
import { Note } from './Note';

// Formulaire d'une contribution : métadonnées du fichier, nom, dimensions, ancrage et actions.
export function ContributionForm({ draft, busy, hasPseudonym, identity, analyzing, progress, onAnalyze, onPublish }) {
  const { metadata, correction, title, preview } = draft;
  return (
    <Stack spacing={2}>
      {metadata && <LazMeta metadata={metadata} />}
      {correction && <CorrectionNotice correction={correction} busy={busy} onCancel={draft.cancelCorrection} />}
      <TextField
        label="Nom"
        size="small"
        fullWidth
        value={title}
        onChange={(event) => draft.setTitle(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 100, enterKeyHint: 'next' } }}
      />
      <DimensionsFieldset dimensions={draft.dimensions} onChange={draft.updateDimension} />
      <AnchorFieldset anchorInput={draft.anchorInput} onChange={draft.updateAnchor} />
      <FormActions
        correction={correction}
        busy={busy}
        analyzing={analyzing}
        progress={progress}
        preview={preview}
        identity={identity}
        hasPseudonym={hasPseudonym}
        onAnalyze={onAnalyze}
        onPublish={onPublish}
      />
      {!hasPseudonym && preview && <Note>Choisissez un pseudo pour publier.</Note>}
    </Stack>
  );
}
