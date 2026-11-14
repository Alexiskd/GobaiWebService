// Importe de React les crochets useCallback (fonction stable), useRef (valeur persistante) et useState (état).
import { useCallback, useRef, useState } from 'react';

/** Messages brefs et temporaires. tone : 'info' | 'warn' | 'error'. */
// Déclare et exporte le crochet useToasts, qui gère la liste des messages temporaires.
export function useToasts() {
  // État : la liste des messages affichés (vide au départ) et sa fonction de mise à jour.
  const [toasts, setToasts] = useState([]);
  // Référence persistante : le prochain identifiant de message, à partir de 1.
  const nextId = useRef(1);

  // dismiss : retire de la liste le message dont l'identifiant est donné ; fonction stable (aucune dépendance).
  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  // push : ajoute un message (texte, ton « info » par défaut, durée de 6 000 ms par défaut) ; début de la fonction mémorisée.
  const push = useCallback((text, tone = 'info', ms = 6000) => {
    // Prend l'identifiant courant, puis incrémente le compteur pour le message suivant.
    const id = nextId.current++;
    // Ne garde que les deux derniers messages et ajoute le nouveau : trois messages au plus à l'écran.
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    // Si une durée est donnée (non nulle), programme le retrait du message après ce délai.
    if (ms) setTimeout(() => dismiss(id), ms);
    // Renvoie l'identifiant du message créé.
    return id;
  // Fin de push ; recréée seulement si dismiss change.
  }, [dismiss]);

  // Renvoie la liste des messages et les deux fonctions (ajouter, retirer).
  return { toasts, push, dismiss };
// Fin de useToasts.
}
