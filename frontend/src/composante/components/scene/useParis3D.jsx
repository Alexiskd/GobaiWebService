// Importe de React les crochets useCallback, useEffect et useState.
import { useCallback, useEffect, useState } from 'react';

// Clé du stockage local : affichage de Paris en 3D.
const KEY = 'gobai:paris-3d'; // « 0 » : bâtiments masqués ; sinon affichés
/** Lieu d'arrivée du bouton « Y aller » : le centre de Paris (Île de la Cité), à 900 m d'altitude. */
// Déclare et exporte le lieu d'arrivée au-dessus de Paris.
export const PARIS_PLACE = { name: 'Paris', lat: 48.8566, lon: 2.3483, altitudeM: 900 };

// Déclare storedOn, qui lit l'affichage enregistré.
function storedOn() {
  // Affiché sauf si la valeur enregistrée vaut « 0 » ; affiché si le stockage est inaccessible.
  try { return globalThis.localStorage?.getItem(KEY) !== '0'; } catch { return true; }
// Fin de storedOn.
}

/**
 * Paris en 3D (bâtiments de la BD TOPO de l'IGN, chargés par le moteur à l'approche) : affiché par défaut,
 * interrupteur dans Paramètres. Renvoie { on, setOn }.
 */
// Déclare et exporte le crochet useParis3D : reçoit le moteur.
export function useParis3D(engine) {
  // État : bâtiments affichés ou non, lu dans le stockage.
  const [on, setOnState] = useState(storedOn);

  // Transmet l'affichage au moteur, s'il gère cette commande.
  useEffect(() => { engine?.setParis3dVisible?.(on); }, [engine, on]);

  // setOn : affiche ou masque les bâtiments ; début de la fonction mémorisée.
  const setOn = useCallback((value) => {
    // Met l'état à jour, converti en booléen.
    setOnState(Boolean(value));
    // Enregistre « 1 » ou « 0 » ; une erreur de stockage est ignorée.
    try { globalThis.localStorage?.setItem(KEY, value ? '1' : '0'); } catch { /* stockage refusé : valable pour la session */ }
  // Fin de setOn ; fonction stable.
  }, []);

  // Renvoie l'état et son réglage.
  return { on, setOn };
// Fin de useParis3D.
}
