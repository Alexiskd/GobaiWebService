// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group.jsx';
// Importe Switch, l'interrupteur.
import { Switch } from '../../ui/Switch.jsx';

/**
 * Catégorie « Atmosphère » : les nuages et l'atmosphère de la Terre (calque séparé de sa couche unique, activé par
 * défaut), puis l'atmosphère de Vénus et de Mars. Les nuages sont simulés : aucune source météo n'est interrogée.
 */
// Déclare et exporte le composant Atmosphere (début de la liste des propriétés).
export function Atmosphere({
  showEarthAtmosphere = true, showBodyAtmospheres = true,
  // Les nuages et l'atmosphère de la Terre, leur rappel et leur texte d'aide.
  earthAtmosphere = true, onEarthAtmosphere, earthAtmosphereHint,
  // L'atmosphère de Vénus et de Mars, son rappel et son texte d'aide.
  atmospheres, onAtmospheres, atmospheresHint,
// Fin de la liste des propriétés.
}) {
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Atmosphère">
      {/* Si le réglage de la Terre est fourni : interrupteur de ses nuages et de son atmosphère. */}
      {showEarthAtmosphere && onEarthAtmosphere && <Switch checked={earthAtmosphere} onChange={onEarthAtmosphere} label="Nuages et atmosphère de la Terre" hint={earthAtmosphereHint || 'Nuages simulés et halo bleu ; décoché : globe nu'} />}
      {/* Interrupteur de l'atmosphère de Vénus et de Mars. */}
      {showBodyAtmospheres && <Switch checked={atmospheres} onChange={onAtmospheres} label="Atmosphère de Vénus et de Mars" hint={atmospheresHint || 'Décoché : globes nus'} />}
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de Atmosphere.
}
