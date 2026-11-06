import { TextField } from '@mui/material';
import { Fieldset } from './Fieldset';

// Dimensions de la modélisation en mètres, une par axe.
export function DimensionsFieldset({ dimensions, onChange }) {
  return (
    <Fieldset legend="Dimensions de la modélisation (m)">
      {['X', 'Y', 'Z'].map((axis, index) => (
        <TextField
          key={axis}
          label={axis}
          type="number"
          size="small"
          value={dimensions[index]}
          onChange={(event) => onChange(index, event.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal', enterKeyHint: 'next', min: '0.001', step: 'any' } }}
        />
      ))}
    </Fieldset>
  );
}
