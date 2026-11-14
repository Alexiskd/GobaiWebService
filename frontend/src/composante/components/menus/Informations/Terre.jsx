// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';
// Importe le squelette de chargement.
import { LayerSkeleton } from '../../ui/LayerSkeleton';
// Importe Radio, l'option d'un fond de carte.
import { Radio } from '../../ui/Radio';
// Importe la ligne d'état de la Terre.
import { EarthStatus } from './EarthStatus';
// Importe layerSource, qui donne la source d'un calque.
import { layerSource } from './layerSource';

/** Menu « Terre » : fond de carte et état du chargement (les calques sont dans les Paramètres). */
// Déclare et exporte le composant Terre (début de la liste des propriétés).
export function Terre({
  // HUD, calques, fond choisi, rappel de choix, statut et erreur de la liste.
  hud, layers, baseId, onBase, listStatus, listError,
// Fin de la liste des propriétés.
}) {
  // Les fonds : les calques qui ne sont pas des calques superposés.
  const bases = layers.filter((l) => l.kind !== 'overlay');

  // Début du rendu.
  return (
    // Fragment : regroupe le groupe et la ligne d'état.
    <>
      {/* Groupe titré. */}
      <Group title="Fond de carte · Terre">
        {/* Une option par fond (début). */}
        {bases.map((l) => (
          // L'option (début de la balise).
          <Radio
            // Clé unique : l'identifiant du fond.
            key={l.id}
            // Nom du groupe radio.
            name="earth-base"
            // Cochée si c'est le fond choisi.
            checked={baseId === l.id}
            // Au changement : choisit ce fond.
            onChange={() => onBase?.(l.id)}
            // Son nom, sa source et son téléchargement.
            label={l.label} source={layerSource(l)} download={{ layerId: l.id, body: 'Terre' }}
            // Sa description, suivie de « (expérimental) » s'il y a lieu.
            description={`${l.description || ''}${l.experimental ? ' (expérimental)' : ''}`}
          // Fin de l'option.
          />
        // Fin des options.
        ))}
        {/* Aucun fond : le squelette pendant le chargement, une note sinon. */}
        {bases.length === 0 && (listStatus === 'loading' ? <LayerSkeleton /> : <Hint>Aucun fond proposé par le fournisseur.</Hint>)}
      {/* Fin du groupe. */}
      </Group>

      {/* La ligne d'état de la Terre. */}
      <EarthStatus hud={hud} listStatus={listStatus} listError={listError} />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Terre.
}
