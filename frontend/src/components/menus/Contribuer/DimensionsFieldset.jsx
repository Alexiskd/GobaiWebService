// Dimensions de la modélisation en mètres, une par axe.
export function DimensionsFieldset({ dimensions, onChange }) {
  return (
    <fieldset>
      <legend>Dimensions de la modélisation (m)</legend>
      <div className="contribution-grid">
        {['X', 'Y', 'Z'].map((axis, index) => (
          <label key={axis}>
            {axis}
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              min="0.001"
              step="any"
              value={dimensions[index]}
              onChange={(event) => onChange(index, event.target.value)}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
