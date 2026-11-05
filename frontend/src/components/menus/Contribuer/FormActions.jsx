// Boutons du formulaire : prévisualiser le placement (nouvelle contribution) et publier.
export function FormActions({ correction, busy, analyzing, progress, preview, identity, hasPseudonym, onAnalyze, onPublish }) {
  return (
    <div className="contribution-actions">
      {!correction && (
        <button type="button" onClick={onAnalyze} disabled={busy}>
          {analyzing ? `Analyse ${progress} %` : 'Prévisualiser le placement'}
        </button>
      )}
      <button type="button" onClick={onPublish} disabled={busy || !preview || !identity || !hasPseudonym}>
        {correction ? 'Publier la correction' : 'Publier'}
      </button>
    </div>
  );
}
