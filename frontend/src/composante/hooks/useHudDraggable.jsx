// Importe le crochet useDraggable, qui rend un panneau déplaçable.
import { useDraggable } from './useDraggable';

/** Glisser-déposer des panneaux, désactivé en mode compact (les panneaux y ont une place fixe). */
// Déclare et exporte le crochet useHudDraggable : reçoit l'identifiant du panneau et un booléen qui autorise le déplacement.
export function useHudDraggable(id, enabled) {
  // Appelle toujours useDraggable (les crochets React ne s'appellent jamais sous condition) et garde son résultat.
  const drag = useDraggable(id);
  // Si le déplacement est autorisé, renvoie le résultat tel quel ; sinon ne garde que la référence, sans style ni propriétés de poignée.
  return enabled ? drag : { ref: drag.ref, style: undefined, handleProps: {} };
// Fin de useHudDraggable.
}
