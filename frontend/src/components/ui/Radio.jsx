export function Radio({ name, checked, onChange, label, description }) {
  return (
    <label className={checked ? 'ac-option is-checked' : 'ac-option'}>
      <input type="radio" className="ac-radio" name={name} checked={checked} onChange={onChange} />
      <span className="ac-option-text">
        <span className="ac-option-label">{label}</span>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}
