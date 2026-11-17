// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe resolveApiUrl, qui complète une adresse de l'API.
import { resolveApiUrl } from '@/moteur/api';

/** Calques propres à la Lune : lieux (interrupteur des Paramètres) et couleurs naturelles. */
// Déclare et exporte le crochet useMoonLayers : reçoit le moteur.
export function useMoonLayers({ engine }) {
  // État : lieux lunaires affichés ou non (non au départ).
  const [moonFeatures, setMoonFeatures] = useState(false);
  // État : couleurs naturelles chargées (true), en échec (false) ou pas encore connues (null).
  const [moonColorOk, setMoonColorOk] = useState(null);

  // Donne au moteur les types de lieux à afficher : les quatre types si l'interrupteur est actif, aucun sinon.
  useEffect(() => { engine?.setMoonFeatureTypes(moonFeatures ? ['landing', 'mare', 'crater', 'region'] : []); }, [engine, moonFeatures]);

  // Effet qui charge les couleurs naturelles de la Lune.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Drapeau : faux une fois l'effet nettoyé.
    let alive = true;
    // Demande au moteur de charger l'image des couleurs depuis l'API.
    engine.loadMoonColor(resolveApiUrl('/api/v1/tiles/moon-color.jpg'))
      // Réussite : on le note, si l'effet est toujours actif.
      .then(() => { if (alive) setMoonColorOk(true); })
      // Échec : on le note, si l'effet est toujours actif.
      .catch(() => { if (alive) setMoonColorOk(false); });
    // Nettoyage : les réponses tardives seront ignorées.
    return () => { alive = false; };
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // Renvoie l'état des lieux, sa fonction de mise à jour et l'état des couleurs.
  return { moonFeatures, setMoonFeatures, moonColorOk };
// Fin de useMoonLayers.
}
