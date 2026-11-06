import { TextField } from '@mui/material';
import { MAX_PSEUDONYM_LENGTH } from '@/contributions/store';

// Pseudo affiché dans le flux communautaire ; chaque frappe est enregistrée localement.
export function PseudonymField({ value, busy, onChange }) {
  return (
    <TextField
      label="Pseudo (visible dans le flux communautaire)"
      size="small"
      fullWidth
      required
      value={value}
      placeholder="Choisissez un pseudo"
      onChange={(event) => onChange(event.target.value)}
      disabled={busy}
      slotProps={{
        htmlInput: { maxLength: MAX_PSEUDONYM_LENGTH, autoComplete: 'nickname', autoCapitalize: 'none', autoCorrect: 'off', enterKeyHint: 'done' },
      }}
    />
  );
}
