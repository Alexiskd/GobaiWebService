import { MAX_PSEUDONYM_LENGTH } from '@/contributions/store';

// Pseudo affiché dans le flux communautaire ; chaque frappe est enregistrée localement.
export function PseudonymField({ value, busy, onChange }) {
  return (
    <label className="contribution-field">
      Pseudo (visible dans le flux communautaire)
      <input
        type="text"
        value={value}
        maxLength={MAX_PSEUDONYM_LENGTH}
        autoComplete="nickname"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="done"
        placeholder="Choisissez un pseudo"
        onChange={(event) => onChange(event.target.value)}
        disabled={busy}
        required
      />
    </label>
  );
}
