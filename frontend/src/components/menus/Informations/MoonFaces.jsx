import { Button, ButtonGroup } from '@mui/material';
import { Section } from '../../ui/Section';

export function MoonFaces({ onSide }) {
  return (
    <Section title="Faces de la Lune">
      <ButtonGroup variant="outlined" fullWidth aria-label="Face de la Lune">
        <Button onClick={() => onSide?.('near')}>Face visible</Button>
        <Button onClick={() => onSide?.('far')}>Face cachée</Button>
      </ButtonGroup>
    </Section>
  );
}
