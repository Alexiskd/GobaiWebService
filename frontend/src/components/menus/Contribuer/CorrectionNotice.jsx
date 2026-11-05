// Rappel de la correction en cours : l'ancienne version reste disponible, on peut annuler.
export function CorrectionNotice({ correction, busy, onCancel }) {
  return (
    <div className="contribution-identity">
      <p className="contribution-note">Correction immuable de {correction.manifest.title} — l’ancienne version reste disponible.</p>
      <button type="button" onClick={onCancel} disabled={busy}>Annuler la correction</button>
    </div>
  );
}
