// Importe useSyncExternalStore de React.
import { useSyncExternalStore } from 'react';
// Importe le lecteur, le réglage et l'abonnement du mode économie d'énergie.
import { getPowerSaving, setPowerSaving, subscribePowerSaving } from '@/moteur/lib/powerSaving';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Importe Switch, l'interrupteur.
import { Switch } from '../../ui/Switch';

/** Mode économie d'énergie : rendu allégé (20 images par seconde, densité 1) pour moins chauffer et moins consommer. */
// Déclare et exporte le composant EconomieEnergie.
export function EconomieEnergie() {
  // Lit le mode économie d'énergie et s'y abonne.
  const saving = useSyncExternalStore(subscribePowerSaving, getPowerSaving, getPowerSaving);
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Énergie">
      {/* L'interrupteur (début de la balise). */}
      <Switch
        // Son état.
        checked={saving}
        // Au changement : enregistre le réglage.
        onChange={setPowerSaving}
        // Son libellé.
        label="Économie d’énergie"
        // Son texte d'aide.
        hint="Image moins fine et moins fluide : l’appareil chauffe moins et la batterie dure plus longtemps"
      // Fin de l'interrupteur.
      />
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de EconomieEnergie.
}
