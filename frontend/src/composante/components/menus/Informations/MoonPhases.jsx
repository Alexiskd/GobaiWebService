// Importe de MUI les éléments de liste et Typography.
import { List, ListItem, ListItemText, Typography } from '@mui/material';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';
// Importe Section, la section d'un panneau.
import { Section } from '../../ui/Section';

// Déclare dateLabel, qui écrit une date en français.
const dateLabel = (utc) => {
  // Convertit le texte en date.
  const date = new Date(utc);
  // Date illisible : un tiret.
  if (Number.isNaN(date.getTime())) return '—';
  // Jour de la semaine abrégé, jour, mois abrégé, heure et minutes.
  return date.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
// Fin de dateLabel.
};

// Déclare et exporte le composant MoonPhases : reçoit les phases.
export function MoonPhases({ phases }) {
  // Sans phase, rien n'est affiché.
  if (!phases?.items?.length) return null;
  // Début du rendu.
  return (
    // Section titrée.
    <Section title="Prochaines phases">
      {/* Liste dense, ordonnée (ol), sans marge. */}
      <List dense disablePadding component="ol">
        {/* Un élément par phase (début). */}
        {phases.items.map((p) => (
          // L'élément, de clé unique, avec une action secondaire à droite (début).
          <ListItem key={p.utc} disableGutters secondaryAction={(
            // La date de la phase, dans une balise time.
            <Typography component="time" variant="body2" color="text.secondary" dateTime={p.utc}>{dateLabel(p.utc)}</Typography>
          // Fin de l'action secondaire et de la balise ouvrante.
          )}>
            {/* Le nom de la phase. */}
            <ListItemText primary={p.phase} />
          {/* Fin de l'élément. */}
          </ListItem>
        // Fin des éléments.
        ))}
      {/* Fin de la liste. */}
      </List>
      {/* La source, si elle est connue. */}
      {phases.source && <Hint>Source : {phases.source}</Hint>}
    {/* Fin de la section. */}
    </Section>
  // Fin du rendu.
  );
// Fin de MoonPhases.
}
