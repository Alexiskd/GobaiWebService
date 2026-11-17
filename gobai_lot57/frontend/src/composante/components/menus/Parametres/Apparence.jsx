// Importe useSyncExternalStore de React.
import { useSyncExternalStore } from 'react';
// Importe le lecteur, le réglage et l'abonnement du noir OLED.
import { getOledBlack, setOledBlack, subscribeOledBlack } from '@/moteur/lib/oledBlack';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Importe Switch, l'interrupteur.
import { Switch } from '../../ui/Switch';

/** Apparence : thème « noir pur » pour les écrans OLED (s'applique quand l'ombre, donc le thème de nuit, est activée). */
// Déclare et exporte le composant Apparence.
export function Apparence() {
  // Lit le réglage noir OLED et s'y abonne.
  const oled = useSyncExternalStore(subscribeOledBlack, getOledBlack, getOledBlack);
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Apparence">
      {/* L'interrupteur (début de la balise). */}
      <Switch
        // Son état.
        checked={oled}
        // Au changement : enregistre le réglage.
        onChange={setOledBlack}
        // Son libellé.
        label="Noir pur"
        // Son texte d'aide.
        hint="Panneaux noirs à la place du bleu nuit : économise la batterie sur écran OLED (thème de nuit)"
      // Fin de l'interrupteur.
      />
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de Apparence.
}
