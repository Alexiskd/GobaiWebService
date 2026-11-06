import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material';
import { ExpandMoreIcon } from '../../ui/icons';
import { Note } from './Note';

// Notes d'information : repliées sur mobile pour laisser la place au formulaire.
export function ContributionNotes({ compact }) {
  const notes = (
    <Stack spacing={1}>
      <Note>Import LAZ uniquement. Les contributions et commentaires apparaissent sous votre pseudo ; les fichiers restent dans le stockage pair-à-pair.</Note>
      <Note>Le compte par jeton de connexion sera ajouté ultérieurement.</Note>
      <Note>Tiering : pseudo et index dans localStorage, gros blocs dans le Cache du navigateur, petits blocs dans IndexedDB. Aucun cookie.</Note>
    </Stack>
  );

  return compact ? (
    <Accordion disableGutters variant="outlined" sx={{ bgcolor: 'transparent', backdropFilter: 'none' }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2">Comment ça marche</Typography></AccordionSummary>
      <AccordionDetails>{notes}</AccordionDetails>
    </Accordion>
  ) : notes;
}
