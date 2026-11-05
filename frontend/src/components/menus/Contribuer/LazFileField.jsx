// Champ de choix du fichier LAZ, seul format accepté.
export function LazFileField({ inputRef, busy, onChange }) {
  return (
    <label className="contribution-field">
      Fichier LAZ uniquement (maximum 256 Mio)
      <input ref={inputRef} type="file" accept=".laz" onChange={onChange} disabled={busy} />
    </label>
  );
}
