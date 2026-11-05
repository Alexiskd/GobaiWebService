import { AnchorFieldset } from './AnchorFieldset';
import { CorrectionNotice } from './CorrectionNotice';
import { DimensionsFieldset } from './DimensionsFieldset';
import { FormActions } from './FormActions';
import { LazMeta } from './LazMeta';

// Formulaire d'une contribution : métadonnées du fichier, nom, dimensions, ancrage et actions.
export function ContributionForm({ draft, busy, hasPseudonym, identity, analyzing, progress, onAnalyze, onPublish }) {
  const { metadata, correction, title, preview } = draft;
  return (
    <>
      {metadata && <LazMeta metadata={metadata} />}
      {correction && <CorrectionNotice correction={correction} busy={busy} onCancel={draft.cancelCorrection} />}
      <label className="contribution-field">
        Nom
        <input value={title} onChange={(event) => draft.setTitle(event.target.value)} maxLength={100} enterKeyHint="next" />
      </label>
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
      {!hasPseudonym && preview && <p className="contribution-note">Choisissez un pseudo pour publier.</p>}
    </>
  );
}
