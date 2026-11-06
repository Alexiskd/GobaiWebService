import { TextField } from '@mui/material';
import { ANCHOR_FIELDS } from './anchor';
import { Fieldset } from './Fieldset';

// Ancrage GPS (WGS84) : latitude, longitude et altitude saisies sous forme de texte.
export function AnchorFieldset({ anchorInput, onChange }) {
  return (
    <Fieldset legend="Ancrage GPS (WGS84)">
      {ANCHOR_FIELDS.map(([key, label]) => (
        <TextField
          key={key}
          label={label}
          size="small"
          value={anchorInput[key]}
          onChange={(event) => onChange(key, event.target.value.replace(',', '.'))}
          slotProps={{
            // Clavier numérique avec le signe « - » sur mobile.
            htmlInput: { inputMode: 'decimal', enterKeyHint: 'next', pattern: '-?[0-9]*[.,]?[0-9]*' },
          }}
        />
      ))}
    </Fieldset>
  );
}
