// Recherche dans le flux : nom, pseudo ou CID.
export function FeedSearch({ value, onChange }) {
  return (
    <label className="contribution-search">
      Rechercher dans le flux
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nom, pseudo ou CID…"
        autoCapitalize="none"
        autoCorrect="off"
      />
    </label>
  );
}
