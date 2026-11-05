import { ANCHOR_FIELDS } from './anchor';

// Ancrage GPS (WGS84) : latitude, longitude et altitude saisies sous forme de texte.
export function AnchorFieldset({ anchorInput, onChange }) {
  return (
    <fieldset>
      <legend>Ancrage GPS (WGS84)</legend>
      <div className="contribution-grid">
        {ANCHOR_FIELDS.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="text"
              inputMode="decimal"  // clavier numérique avec le signe « - » sur mobile
              enterKeyHint="next"
              pattern="-?[0-9]*[.,]?[0-9]*"
              value={anchorInput[key]}
              onChange={(event) => onChange(key, event.target.value.replace(',', '.'))}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
