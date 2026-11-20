// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe resolveApiUrl, qui complète une adresse de l'API.

/** Calques propres à la Lune : lieux (interrupteur des Paramètres) et couleurs naturelles. */
// Déclare et exporte le crochet useMoonLayers : reçoit le moteur.
export function useMoonLayers({ engine }) {
  // État : lieux lunaires affichés ou non (non au départ).
  const [moonFeatures, setMoonFeatures] = useState(false);
  // État : couleurs naturelles chargées (true), en échec (false) ou pas encore connues (null).
  const [moonColorOk, setMoonColorOk] = useState(null);

  // Donne au moteur les types de lieux à afficher : les quatre types si l'interrupteur est actif, aucun sinon.
  useEffect(() => { engine?.setMoonFeatureTypes(moonFeatures ? ['landing', 'mare', 'crater', 'region'] : []); }, [engine, moonFeatures]);

  // Mode statique : aucune texture distante n'est demandée. Le moteur conserve son matériau lunaire local.
  useEffect(() => { setMoonColorOk(false); }, [engine]);

  // Renvoie l'état des lieux, sa fonction de mise à jour et l'état des couleurs.
  return { moonFeatures, setMoonFeatures, moonColorOk };
// Fin de useMoonLayers.
}
