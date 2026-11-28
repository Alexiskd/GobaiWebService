// Importe le bouton de téléchargement d'une couche.
import { DownloadButton } from '../../ui/Radio.jsx';
// Importe layerSource, qui donne la source d'une couche.
import { layerSource } from '../Informations/couches/layerSource.jsx';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group.jsx';

/**
 * Entrée unique « Terre » : la seule couche d'imagerie de la Terre, qui fusionne toutes ses sources, avec son nom, ses
 * sources et son unique bouton de téléchargement. Il n'y a rien à choisir : pas d'interrupteur.
 */
// Déclare et exporte le composant EntreeTerre : la description de la couche unique (null tant qu'elle n'est pas chargée).
export function EntreeTerre({ layer }) {
  // Tant que la couche n'est pas là : rien.
  if (!layer) return null;
  // Début du rendu.
  return (
    // Ligne : textes à gauche, bouton de téléchargement à droite.
    <div className="flex items-start px-2 py-1">
      {/* Les textes. */}
      <div className="py-1.5 flex-1 min-w-0">
        {/* Le nom, en demi-gras. */}
        <p className="t-body2 font-semibold">Terre</p>
        {/* La description de la couche, en petit, couleur secondaire. */}
        {layer.description && <span className="t-caption text-soft block">{layer.description}</span>}
        {/* Ses sources, en italique, précédées de « Sources : ». */}
        {layerSource(layer) && <span className="t-caption text-soft block italic">Sources : {layerSource(layer)}</span>}
      {/* Fin des textes. */}
      </div>
      {/* Le seul bouton de téléchargement de la couche fusionnée. */}
      <DownloadButton layerId={layer.id} body="Terre" label="couche fusionnée" />
    {/* Fin de la ligne. */}
    </div>
  // Fin du rendu.
  );
// Fin de EntreeTerre.
}

/**
 * Cartographie de la Terre : sa couche unique (entrée « Terre ») et son téléchargement. Les noms, frontières,
 * littoraux, rues et lumières de la nuit sont toujours affichés, selon le zoom (refonte, étape 2) : plus d'interrupteurs.
 */
// Déclare et exporte le composant Cartographie : la couche unique de la Terre.
export function Cartographie({ earthLayer = null }) {
  // Tant que la couche n'est pas là : rien.
  if (!earthLayer) return null;
  // Groupe titré avec l'entrée unique de la Terre.
  return (
    <Group title="Cartographie">
      <EntreeTerre layer={earthLayer} />
    </Group>
  );
}
