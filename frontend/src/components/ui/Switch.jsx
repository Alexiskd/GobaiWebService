/** Interrupteur : toute la ligne est cliquable, le bouton est toujours aligné à droite. */
export function Switch({ checked, disabled, onChange, label, hint }) {
  return (
    <label className={disabled ? 'ac-switch is-disabled' : 'ac-switch'}>
      <span className="ac-switch-text">
        <span className="ac-switch-label">{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="ac-toggle"
        checked={Boolean(checked)}
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </label>
  );
}
