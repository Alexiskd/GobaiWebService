// Importe useState de React.
import { useState } from 'react';
// Importe de MUI Box, CircularProgress (roue de chargement), FormControlLabel, IconButton, Radio (renommé MuiRadio), Tooltip et Typography.
import { Box, CircularProgress, FormControlLabel, IconButton, Radio as MuiRadio, Tooltip, Typography } from '@mui/material';
// Importe le téléchargement d'une couche et le calcul du nom du fichier.
import { downloadLayer, layerFileName } from '@/moteur/engine/layerDownload';
// Importe l'icône de téléchargement.
import { DownloadIcon } from './icons';

/** Bouton « Télécharger » d'une couche : carte globale en PNG (voir moteur/engine/layerDownload.jsx). */
// Déclare le composant DownloadButton : identifiant de la couche, astre et libellé.
function DownloadButton({ layerId, body, label }) {
  // État du téléchargement, au repos au départ.
  const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'error'
  // Infobulle selon l'état : téléchargement en cours…
  const title = state === 'loading' ? 'Téléchargement en cours…'
    // … ou échec avec invitation à réessayer, ou invitation à télécharger.
    : state === 'error' ? `Téléchargement impossible : réessayer « ${label} »` : `Télécharger « ${label} »`;
  // Déclare run, qui lance le téléchargement.
  const run = () => {
    // Passe à l'état « en cours ».
    setState('loading');
    // Télécharge la couche sous un nom de fichier construit avec l'astre et le libellé.
    downloadLayer({ layerId, fileName: layerFileName(body, label) })
      // Réussite : retour au repos ; échec : état d'erreur.
      .then(() => setState('idle'), () => setState('error'));
  // Fin de run.
  };
  // Début du rendu.
  return (
    // Infobulle du bouton.
    <Tooltip title={title}>
      {/* Balise span : l'infobulle fonctionne même quand le bouton est désactivé. */}
      <span>
        {/* Petit bouton, désactivé pendant le téléchargement, rouge en cas d'erreur. */}
        <IconButton size="small" aria-label={title} disabled={state === 'loading'} onClick={run} color={state === 'error' ? 'error' : 'default'} sx={{ mt: 0.75, mr: 0.5 }}>
          {/* Roue de chargement pendant le téléchargement, icône sinon. */}
          {state === 'loading' ? <CircularProgress size={18} /> : <DownloadIcon fontSize="small" />}
        {/* Fin du bouton. */}
        </IconButton>
      {/* Fin de la balise span. */}
      </span>
    {/* Fin de l'infobulle. */}
    </Tooltip>
  // Fin du rendu.
  );
// Fin de DownloadButton.
}

/**
 * Option d'un fond de carte. `download` ({ layerId, body }) ajoute à droite le bouton de téléchargement de la couche.
 */
// Déclare et exporte le composant Radio : nom du groupe, état, rappel, libellé, description, source et téléchargement.
export function Radio({ name, checked, onChange, label, description, source, download }) {
  // Début du rendu.
  return (
    // Ligne : option et bouton côte à côte, alignés en haut, avec fond de survol.
    <Box sx={{ display: 'flex', alignItems: 'flex-start', '&:hover': { bgcolor: 'action.hover' } }}>
      {/* Libellé cliquable qui englobe le bouton radio (début de la balise). */}
      <FormControlLabel
        // Le libellé gère lui-même sa typographie.
        disableTypography
        // Style : aucune marge, prend la largeur restante, aligné en haut.
        sx={{ m: 0, px: 1, py: 0.5, flex: 1, minWidth: 0, alignItems: 'flex-start' }}
        // La commande : petit bouton radio MUI, état converti en booléen.
        control={<MuiRadio size="small" name={name} checked={Boolean(checked)} onChange={onChange} sx={{ mt: 0.25 }} />}
        // Le libellé (début).
        label={(
          // Conteneur des textes.
          <Box sx={{ py: 0.75, minWidth: 0 }}>
            {/* Le nom, en demi-gras si l'option est choisie. */}
            <Typography variant="body2" sx={{ fontWeight: checked ? 600 : 400 }}>{label}</Typography>
            {/* Si une description est donnée : en petit, couleur secondaire. */}
            {description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{description}</Typography>}
            {/* Si une source est donnée : en petit, en italique, précédée de « Source : ». */}
            {source && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>Source : {source}</Typography>}
          {/* Fin du conteneur des textes. */}
          </Box>
        // Fin du libellé.
        )}
      // Fin de la balise FormControlLabel.
      />
      {/* Si un téléchargement est prévu pour une couche : le bouton de téléchargement. */}
      {download?.layerId && <DownloadButton layerId={download.layerId} body={download.body} label={label} />}
    {/* Fin de la ligne. */}
    </Box>
  // Fin du rendu.
  );
// Fin de Radio.
}
