// Importe useState de React.
import { useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { CircularProgress, FormControlLabel, IconButton, Radio as RadioInput, Tooltip } from '@/Fairing/kit';
// Importe le téléchargement d'une couche et le calcul du nom du fichier.
import { downloadLayer, layerFileName } from '@/Engine/AstreSolideEngine/layerDownload';
// Importe l'icône de téléchargement.
import { DownloadIcon } from './icons.jsx';

/** Bouton « Télécharger » d'une couche : carte globale en PNG (voir moteur/engine/layerDownload.jsx). */
// Déclare et exporte le composant DownloadButton (servi aussi à l'entrée « Terre » de Paramètres) : identifiant de la couche, astre et libellé.
export function DownloadButton({ layerId, body, label }) {
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
        <IconButton size="small" aria-label={title} disabled={state === 'loading'} onClick={run} color={state === 'error' ? 'error' : 'default'} className="mt-1.5 mr-1">
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
 * Option d'un fond de carte. `download` ({ layerId, body }) ajoute à droite le bouton de téléchargement de la couche ;
 * `action` : tout autre bouton à placer à droite.
 */
// Déclare et exporte le composant Radio : nom du groupe, état, rappel, libellé, description, source et téléchargement.
export function Radio({ name, checked, onChange, label, description, source, download, action }) {
  // Début du rendu.
  return (
    // Ligne : option et bouton côte à côte, alignés en haut, avec fond de survol.
    <div className="flex items-start hover:bg-hover">
      {/* Libellé cliquable qui englobe le bouton radio (début de la balise). */}
      <FormControlLabel
        // Le libellé gère lui-même sa typographie.
        disableTypography
        // Style : aucune marge, prend la largeur restante, aligné en haut.
        className="m-0 px-2 py-1 flex-1 min-w-0 items-start"
        // La commande : bouton radio natif du kit, état converti en booléen.
        control={<RadioInput size="small" name={name} checked={Boolean(checked)} onChange={onChange} className="mt-0.5" />}
        // Le libellé (début).
        label={(
          // Conteneur des textes.
          <div className="py-1.5 min-w-0">
            {/* Le nom, en demi-gras si l'option est choisie. */}
            <p className={`t-body2 ${checked ? 'font-semibold' : 'font-normal'}`}>{label}</p>
            {/* Si une description est donnée : en petit, couleur secondaire. */}
            {description && <span className="t-caption text-soft block">{description}</span>}
            {/* Si une source est donnée : en petit, en italique, précédée de « Source : ». */}
            {source && <span className="t-caption text-soft block italic">Source : {source}</span>}
          {/* Fin du conteneur des textes. */}
          </div>
        // Fin du libellé.
        )}
      // Fin de la balise FormControlLabel.
      />
      {/* Si un téléchargement est prévu pour une couche : le bouton de téléchargement. */}
      {download?.layerId && <DownloadButton layerId={download.layerId} body={download.body} label={label} />}
      {/* Action libre à droite (bouton propre à l'option), si elle est donnée. */}
      {action}
    {/* Fin de la ligne. */}
    </div>
  // Fin du rendu.
  );
// Fin de Radio.
}
