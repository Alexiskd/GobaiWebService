import { Button, Stack, TextField } from '@mui/material';

export function CommentForm({ value, placeholder, label, busy, onChange, onSubmit }) {
  const submit = () => { if (!busy && value.trim()) onSubmit(); };
  return (
    <Stack direction="row" spacing={1}>
      <TextField
        size="small"
        fullWidth
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
        slotProps={{ htmlInput: { maxLength: 1000, 'aria-label': placeholder, enterKeyHint: 'send' } }}
      />
      <Button variant="outlined" disabled={busy || !value.trim()} onClick={submit} sx={{ flex: 'none' }}>{label}</Button>
    </Stack>
  );
}
