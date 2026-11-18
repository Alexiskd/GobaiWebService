// Importe de MUI Button et ButtonGroup (groupe de boutons).
import { Button, ButtonGroup } from '@mui/material';
// Importe Section, la section d'un panneau.
import { Section } from '../../ui/Section';

// Déclare et exporte le composant MoonFaces : reçoit le rappel de changement de face.
export function MoonFaces({ onSide }) {
  // Début du rendu.
  return (
    // Section titrée.
    <Section title="Faces de la Lune">
      {/* Groupe de deux boutons à contour, sur toute la largeur. */}
      <ButtonGroup variant="outlined" fullWidth aria-label="Face de la Lune">
        {/* Bouton « Face visible » : demande la face « near ». */}
        <Button onClick={() => onSide?.('near')}>Face visible</Button>
        {/* Bouton « Face cachée » : demande la face « far ». */}
        <Button onClick={() => onSide?.('far')}>Face cachée</Button>
      {/* Fin du groupe. */}
      </ButtonGroup>
    {/* Fin de la section. */}
    </Section>
  // Fin du rendu.
  );
// Fin de MoonFaces.
}
