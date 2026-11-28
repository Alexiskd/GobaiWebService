// Importe le bouton de téléchargement d'une couche.
import { DownloadButton } from '../../ui/Radio.jsx';
// Importe layerSource, qui donne la source d'une couche.
import { layerSource } from '../Informations/couches/layerSource.jsx';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group.jsx';
// Importe Switch, l'interrupteur.
import { Switch } from '../../ui/Switch.jsx';

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
 * Cartographie de la Terre, à plat : sa couche unique (entrée « Terre »), puis ce qui se lit sur la carte (noms des
 * villes et des pays, frontières et littoraux, rues et routes d'OpenStreetMap, lumières
 * de la nuit). Le relief a son propre groupe, CartographieRelief ci-dessous.
 */
// Déclare et exporte le composant Cartographie (début de la liste des propriétés).
export function Cartographie({
  // La couche unique de la Terre.
  earthLayer = null,
  // Les noms des villes, les noms des pays et les contours, avec leurs rappels et leurs textes d'aide.
  cityNames, onCityNames, cityNamesHint, countryNames, onCountryNames, outlines, onOutlines, outlinesHint,
  // Les rues (éteintes par défaut) et leur rappel.
  streets = false, onStreets,
  // Les lumières de la nuit (allumées par défaut) et leur rappel ; la vue de la pollution lumineuse (coupée) et son rappel.
  nightLights = true, onNightLights, lightView = false, onLightView,
// Fin de la liste des propriétés.
}) {
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Cartographie">
      {/* L'entrée unique de la Terre et son téléchargement. */}
      <EntreeTerre layer={earthLayer} />
      {/* Interrupteur des noms des villes. */}
      <Switch checked={cityNames} onChange={onCityNames} label="Noms des villes" hint={cityNamesHint} />
      {/* Interrupteur des noms des pays. */}
      <Switch checked={countryNames} onChange={onCountryNames} label="Noms des pays" hint="Dans leur alphabet local, en zoomant" />
      {/* Interrupteur des frontières et des littoraux. */}
      <Switch checked={outlines} onChange={onOutlines} label="Frontières et littoraux" hint={outlinesHint} />
      {/* Si le réglage des rues est fourni (début). */}
      {onStreets && (
        // Interrupteur des rues et des routes.
        <Switch checked={streets} onChange={onStreets} label="Rues et routes" hint="Grands axes de loin, rues et noms en zoomant" />
      // Fin du cas.
      )}
      {/* Si le réglage des lumières de la nuit est fourni (début). */}
      {onNightLights && (
        // Interrupteur des lumières de la nuit.
        <Switch checked={nightLights} onChange={onNightLights} label="Lumières de la nuit" hint="Pollution lumineuse 2025 vue de l’espace, en couleurs naturelles, allumée côté nuit au rythme du Soleil · Light Pollution Atlas (D. Lorenz)" />
      // Fin du cas.
      )}
      {/* Si le réglage de la vue de nuit est fourni (début). */}
      {onLightView && (
        // Interrupteur de la vue de la pollution lumineuse.
        <Switch checked={lightView} onChange={onLightView} label="Pollution lumineuse de toute la Terre" hint="Toute la Terre de nuit, vue de l’espace : la pollution lumineuse 2025 du monde entier chargée d’un coup · Light Pollution Atlas (D. Lorenz)" />
      // Fin du cas.
      )}
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
}
// Fin de Cartographie.

/**
 * Cartographie en relief de la Terre : tout ce qui donne du volume à la carte. Relief 3D du globe (montagnes, fonds
 * marins).
 */
// Déclare et exporte le composant CartographieRelief (début de la liste des propriétés).
export function CartographieRelief({
  // Le relief et son rappel.
  relief, onRelief,
// Fin de la liste des propriétés.
}) {
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Cartographie en relief">
      {/* Interrupteur du relief 3D. */}
      <Switch checked={relief} onChange={onRelief} label="Relief 3D" hint="Montagnes et fonds marins en volume ; décoché : carte à plat, plus rapide" />
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de CartographieRelief.
}
