// Importe de MUI Box, Checkbox (case à cocher), les éléments de liste, Paper et Typography.
import { Box, Checkbox, List, ListItem, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';

/** Pastille à la couleur de l'astre. */
// Déclare le composant Dot : la couleur et l'indicateur « estompé ».
const Dot = ({ color, dim }) => (
  // Rond de 10 px à la couleur de l'astre (gris à défaut), estompé si demandé.
  <Box aria-hidden="true" sx={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', bgcolor: color || 'text.disabled', opacity: dim ? 0.35 : 1 }} />
// Fin de Dot.
);

/**
 * Liste de tous les astres, avec leur numéro (la Lune en « 04 bis ») et les satellites en retrait sous leur planète.
 *  - la case enlève l'astre de la scène ou le remet (le Soleil n'en a pas) ; enlever une planète enlève ses satellites ;
 *  - un appui sur le nom s'y téléporte et ferme la fenêtre.
 * `shown` = case cochée ; `locked` = enlevé par sa famille (boutons du haut) ou par sa planète : case grisée.
 */
// Déclare et exporte le composant AllerAUnAstre : astres, astre visé, rappel de choix et rappel d'affichage.
export function AllerAUnAstre({ bodies = [], focus, onPick, onShown }) {
  // Début du rendu.
  return (
    // Conteneur au rôle de groupe.
    <Box role="group" aria-label="Astres">
      {/* Le titre. */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>Astres</Typography>
      {/* Carte à contour, transparente. */}
      <Paper variant="outlined" sx={{ bgcolor: 'transparent', backdropFilter: 'none', overflow: 'hidden' }}>
        {/* Liste dense, sans marge. */}
        <List dense disablePadding>
          {/* Un élément par astre (début). */}
          {bodies.map((body) => {
            // Est-ce le Soleil ?
            const isSun = body.index === 0;
            // Astre affiché, sauf si shown est explicitement à faux.
            const shown = body.shown !== false;
            // Astre visé ?
            const current = focus === body.index;
            // Début du rendu de l'élément.
            return (
              // L'élément de liste (début de la balise).
              <ListItem
                // Clé unique : le nom de l'astre.
                key={body.name}
                // Sans marge intérieure.
                disablePadding
                // En retrait pour un satellite.
                sx={{ pl: body.satellite ? 2.5 : 0 }}
              // Fin de la balise ouvrante.
              >
                {/* Pour le Soleil (début). */}
                {isSun ? (
                  // Un espace vide à la place de la case.
                  <Box aria-hidden="true" sx={{ width: 38, flex: 'none' }} />
                // Sinon (début).
                ) : (
                  // La case à cocher (début de la balise).
                  <Checkbox
                    // Petite taille.
                    size="small"
                    // Cochée si l'astre est affiché.
                    checked={shown}
                    // Grisée si l'astre est verrouillé.
                    disabled={Boolean(body.locked)}
                    // Au changement : affiche ou enlève l'astre.
                    onChange={(e) => onShown?.(body.index, e.target.checked)}
                    // Nom pour les lecteurs d'écran : « Enlever » ou « Remettre », suivi du nom.
                    slotProps={{ input: { 'aria-label': `${shown ? 'Enlever' : 'Remettre'} ${body.name}` } }}
                    // Taille fixe et marges.
                    sx={{ flex: 'none', ml: 0.5, p: 0.75 }}
                  // Fin de la case.
                  />
                // Fin du choix.
                )}
                {/* Le bouton de l'astre (début de la balise). */}
                <ListItemButton
                  // Dense.
                  dense
                  // Sélectionné si l'astre est visé.
                  selected={current}
                  // Désactivé si l'astre est enlevé.
                  disabled={!shown}
                  // Marque l'élément courant pour les lecteurs d'écran.
                  aria-current={current ? 'true' : undefined}
                  // Au clic : va à l'astre.
                  onClick={() => onPick(body.index)}
                  // Espacement et marges.
                  sx={{ gap: 1.25, pl: 0.75, pr: 1.5 }}
                // Fin de la balise ouvrante.
                >
                  {/* La pastille, estompée si l'astre est enlevé. */}
                  <Dot color={body.color} dim={!shown} />
                  {/* Le nom (début de la balise). */}
                  <ListItemText
                    // Son texte.
                    primary={body.name}
                    // Style du texte (début).
                    slotProps={{ primary: { variant: 'body2', sx: {
                      // Demi-gras si l'astre est visé.
                      fontWeight: current ? 600 : 400,
                      // Couleur secondaire pour un satellite.
                      color: body.satellite ? 'text.secondary' : 'text.primary',
                      // Barré si l'astre est enlevé.
                      textDecoration: shown ? 'none' : 'line-through',
                    // Fin du style.
                    } } }}
                  // Fin du nom.
                  />
                  {/* Le numéro de l'astre, en police à chasse fixe. */}
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{body.number}</Typography>
                {/* Fin du bouton. */}
                </ListItemButton>
              {/* Fin de l'élément. */}
              </ListItem>
            // Fin du rendu de l'élément.
            );
          // Fin des éléments.
          })}
        {/* Fin de la liste. */}
        </List>
      {/* Fin de la carte. */}
      </Paper>
      {/* Note d'aide. */}
      <Hint>Décochez un astre pour l’enlever de la scène, recochez-le pour le remettre. Appuyez sur son nom pour y aller.</Hint>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de AllerAUnAstre.
}
