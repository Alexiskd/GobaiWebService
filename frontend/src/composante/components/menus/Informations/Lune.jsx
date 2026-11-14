// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';
// Importe le squelette de chargement.
import { LayerSkeleton } from '../../ui/LayerSkeleton';
// Importe Radio, l'option d'un fond de carte.
import { Radio } from '../../ui/Radio';
// Importe la ligne d'état des tuiles.
import { TileStatus } from './TileStatus';
// Importe layerSource, qui donne la source d'un calque.
import { layerSource } from './layerSource';

/** Menu « Lune » : fond de carte (réel ou NASA), calques lunaires et affichage. */
// Déclare et exporte le composant Lune (début de la liste des propriétés).
export function Lune({
  // HUD, calques, fond choisi, rappel de choix, disponibilité de la Lune réelle, état des couleurs et statut de la liste.
  hud, moonLayers, moonBaseId, onMoonBase, moonRealAvailable, moonColorOk, listStatus,
  // L'ombrage et son rappel.
  shade, onShade,
// Fin de la liste des propriétés.
}) {
  // Les fonds : les calques qui ne sont pas des calques superposés.
  const moonBases = moonLayers.filter((l) => l.kind !== 'overlay');
  // « Lune réelle » est un composite : son téléchargement donne sa carte de détail (Kaguya, sinon relief LOLA).
  // Le calque téléchargé pour la « Lune réelle » : Kaguya, sinon l'ombrage LOLA.
  const realLayer = moonLayers.find((l) => l.id.includes('kaguya')) || moonLayers.find((l) => l.id.includes('lola-shade'));

  // Début du rendu.
  return (
    // Fragment : regroupe le groupe et la ligne d'état.
    <>
      {/* Groupe titré. */}
      <Group title="Fond de carte · Lune">
        {/* Pendant le chargement (début). */}
        {listStatus === 'loading' ? (
          // Le squelette.
          <LayerSkeleton />
        // Sinon, si la Lune réelle est disponible (début).
        ) : moonRealAvailable ? (
          // Note d'explication (début de la balise).
          <Hint>
            {/* Ce qu'est la « Lune réelle ». */}
            <strong>Lune réelle</strong> : couleurs naturelles (NASA SVS) et détail de plus en plus fin en zoomant (Kaguya, jusqu’à ≈ 20 m).
            {/* Un avertissement si les couleurs sont indisponibles. */}
            {moonColorOk === false ? ' Couleurs indisponibles : gris neutre.' : ''}
          {/* Fin de la note. */}
          </Hint>
        // Sinon (début).
        ) : (
          // Une note : relief indisponible.
          <Hint>Relief de la Lune indisponible : sphère aux couleurs naturelles seule.</Hint>
        // Fin du choix.
        )}
        {/* Si la Lune réelle est disponible (début). */}
        {moonRealAvailable && (
          // Son option (début de la balise).
          <Radio
            // Nom du groupe radio.
            name="moon-base"
            // Cochée si c'est le fond choisi.
            checked={moonBaseId === 'real'}
            // Au changement : choisit la Lune réelle.
            onChange={() => onMoonBase?.('real')}
            // Son nom.
            label="Lune réelle"
            // Sa source.
            source={layerSource({ id: 'real' })}
            // Son téléchargement : celui de son calque de détail.
            download={{ layerId: realLayer?.id, body: 'Lune' }}
            // Sa description.
            description="Couleurs naturelles NASA SVS · détail Kaguya en zoomant"
          // Fin de l'option.
          />
        // Fin du cas.
        )}
        {/* Une option par fond simple (début). */}
        {moonBases.map((l) => (
          // L'option : cochée si c'est le fond choisi, avec sa source, son téléchargement et sa description.
          <Radio key={l.id} name="moon-base" checked={moonBaseId === l.id} onChange={() => onMoonBase?.(l.id)} label={l.label} source={layerSource(l)} download={{ layerId: l.id, body: 'Lune' }} description={l.description} />
        // Fin des options.
        ))}
      {/* Fin du groupe. */}
      </Group>

      {/* La ligne d'état des tuiles de la Lune, avec le suivi de la mise en cache. */}
      <TileStatus hud={hud} source="moonTiles" label="Lune" warmup />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Lune.
}
