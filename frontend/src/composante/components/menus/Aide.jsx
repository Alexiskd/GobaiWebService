// Importe de MUI Box, la boîte de dialogue, les éléments de tableau et Typography.
import { Box, Dialog, DialogContent, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../ui/PanelHeader';

// Raccourcis clavier : touche, puis effet (début du tableau).
const KEYS = [
  // Ctrl K ou barre oblique : la recherche.
  ['Ctrl K  ou  /', 'Rechercher une ville ou un astre'],
  // Plus et moins : le zoom.
  ['+  /  −', 'Zoomer, dézoomer'],
  // Flèches : la rotation de la caméra.
  ['← → ↑ ↓', 'Faire tourner la caméra autour de l’astre'],
  // 0 du pavé numérique : la vue d'ensemble.
  ['0 (pavé numérique)', 'Vue d’ensemble'],
  // L : les informations.
  ['L', 'Ouvrir ou fermer les informations (le Soleil en vue d’ensemble)'],
  // G : les coordonnées GPS.
  ['G', 'Afficher ou masquer les coordonnées GPS'],
  // S : la fenêtre des sources.
  ['S', 'Anthropic Node Open Source (NASA EOSDIS GIBS, Trek, JPL…)'],
  // P : la galerie.
  ['P', 'Galerie (images NASA et collection)'],
  // T : le plateau tournant.
  ['T', 'Plateau tournant (fond de carte actif)'],
  // Point d'interrogation : cette aide.
  ['?', 'Afficher cette aide'],
  // Échap : la fermeture du panneau ouvert.
  ['Échap', 'Fermer le panneau ouvert'],
// Fin du tableau.
];

// Gestes tactiles : geste, puis effet (début du tableau).
const GESTURES = [
  // Un doigt : tourner.
  ['Un doigt', 'Glisser pour tourner autour de l’astre'],
  // Deux doigts : zoomer.
  ['Deux doigts', 'Pincer pour zoomer'],
  // Toucher un astre : le centrer.
  ['Toucher un astre', 'Le centrer'],
  // Boutons plus et moins : zoom continu.
  ['Boutons + / −', 'Maintenir pour zoomer en continu'],
  // Boussole : recaler sur le nord.
  ['Boussole', 'Recaler la caméra sur le nord'],
// Fin du tableau.
];

// Déclare et exporte le composant Aide : ouverture et fermeture.
export function Aide({ open, onClose }) {
  // Lit le type de pointeur et le mode compact.
  const { coarse, compact } = useViewport();
  // Les lignes affichées : gestes au doigt, raccourcis sinon.
  const rows = coarse ? GESTURES : KEYS;
  // Le titre correspondant.
  const title = coarse ? 'Gestes tactiles' : 'Raccourcis clavier';
  // Début du rendu.
  return (
    // Boîte de dialogue : plein écran en mode compact, très petite largeur sinon.
    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="xs" fullWidth aria-label={title}>
      {/* L'en-tête, avec le titre et la fermeture. */}
      <PanelHeader title={title} onClose={onClose} />
      {/* Contenu de la boîte de dialogue. */}
      <DialogContent sx={{ pt: 1 }}>
        {/* Petit tableau. */}
        <Table size="small">
          {/* Corps du tableau. */}
          <TableBody>
            {/* Une ligne par raccourci ou par geste (début). */}
            {rows.map(([k, d]) => (
              // La ligne.
              <TableRow key={k}>
                {/* Cellule de la touche, sur une seule ligne. */}
                <TableCell sx={{ whiteSpace: 'nowrap', pl: 0 }}>
                  {/* La touche, dans une balise kbd à bordure fine et fond léger. */}
                  <Box component="kbd" sx={{ font: 'inherit', fontSize: '0.85em', px: 0.75, py: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>{k}</Box>
                {/* Fin de la cellule. */}
                </TableCell>
                {/* Cellule de l'effet. */}
                <TableCell sx={{ pr: 0 }}>{d}</TableCell>
              {/* Fin de la ligne. */}
              </TableRow>
            // Fin des lignes.
            ))}
          {/* Fin du corps du tableau. */}
          </TableBody>
        {/* Fin du tableau. */}
        </Table>
        {/* Hors écran tactile (début). */}
        {!coarse && (
          // Note sous le tableau.
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {/* Les gestes de la souris. */}
            Souris : glisser pour tourner, molette ou pincement pour zoomer, clic sur un astre pour le centrer.
          {/* Fin de la note. */}
          </Typography>
        // Fin du cas.
        )}
      {/* Fin du contenu. */}
      </DialogContent>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Aide.
}
