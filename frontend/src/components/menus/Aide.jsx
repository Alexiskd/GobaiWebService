import { Box, Dialog, DialogContent, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import { useViewport } from '@/hooks/useViewport';
import { PanelHeader } from '../ui/PanelHeader';

const KEYS = [
  ['Ctrl K  ou  /', 'Rechercher une ville ou un astre'],
  ['+  /  −', 'Zoomer, dézoomer'],
  ['← → ↑ ↓', 'Faire tourner la caméra autour de l’astre'],
  ['0 (pavé numérique)', 'Vue d’ensemble'],
  ['L', 'Ouvrir ou fermer les informations'],
  ['G', 'Afficher ou masquer les coordonnées GPS'],
  ['?', 'Afficher cette aide'],
  ['Échap', 'Fermer le panneau ouvert'],
];

const GESTURES = [
  ['Un doigt', 'Glisser pour tourner autour de l’astre'],
  ['Deux doigts', 'Pincer pour zoomer'],
  ['Toucher un astre', 'Le centrer'],
  ['Boutons + / −', 'Maintenir pour zoomer en continu'],
  ['Boussole', 'Recaler la caméra sur le nord'],
];

export function Aide({ open, onClose }) {
  const { coarse, compact } = useViewport();
  const rows = coarse ? GESTURES : KEYS;
  const title = coarse ? 'Gestes tactiles' : 'Raccourcis clavier';
  return (
    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="xs" fullWidth aria-label={title}>
      <PanelHeader title={title} onClose={onClose} />
      <DialogContent sx={{ pt: 1 }}>
        <Table size="small">
          <TableBody>
            {rows.map(([k, d]) => (
              <TableRow key={k}>
                <TableCell sx={{ whiteSpace: 'nowrap', pl: 0 }}>
                  <Box component="kbd" sx={{ font: 'inherit', fontSize: '0.85em', px: 0.75, py: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>{k}</Box>
                </TableCell>
                <TableCell sx={{ pr: 0 }}>{d}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!coarse && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Souris : glisser pour tourner, molette ou pincement pour zoomer, clic sur un astre pour le centrer.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
