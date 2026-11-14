// Importe de React les crochets useCallback, useEffect et useState.
import { useCallback, useEffect, useState } from 'react';
// Importe le chargement des dalles LiDAR et resolveApiUrl, qui complète une adresse de l'API.
import { fetchLidarTiles, resolveApiUrl } from '@/moteur/api';

// Clé du stockage local : affichage du nuage de points.
const KEY = 'gobai:lidar-3d'; // « 0 » : nuage de points masqué ; sinon affiché
// Clé du stockage local : mode de couleur du nuage.
const COLOR_KEY = 'gobai:lidar-3d-couleur'; // « classes » : couleur par type de point ; sinon photo aérienne drapée
// Déclare storedColor, qui lit le mode de couleur enregistré.
function storedColor() {
  // « classes » si c'est la valeur enregistrée, « photo » sinon ; « photo » si le stockage est inaccessible.
  try { return globalThis.localStorage?.getItem(COLOR_KEY) === 'classes' ? 'classes' : 'photo'; } catch { return 'photo'; }
// Fin de storedColor.
}
// Déclare storedOn, qui lit l'affichage enregistré.
function storedOn() {
  // Affiché sauf si la valeur enregistrée vaut « 0 » ; affiché si le stockage est inaccessible.
  try { return globalThis.localStorage?.getItem(KEY) !== '0'; } catch { return true; }
// Fin de storedOn.
}

/**
 * Nuages LiDAR HD de l'IGN en vrais points 3D (GET /lidar?lon&lat) : cherchés par le moteur sous la caméra, partout
 * en France, affichés par défut.
 * Renvoie { on, setOn, color, setColor, places } ; `color` : « photo » (orthophoto drapée sur les points) ou « classes » ; `places` : lieux des dalles ([{ id, name, lat, lon, points }]) pour s'y rendre.
 */
// Déclare et exporte le crochet useLidarPoints : reçoit le moteur.
export function useLidarPoints(engine) {
  // État : nuage affiché ou non, lu dans le stockage.
  const [on, setOnState] = useState(storedOn);
  // État : les lieux des dalles, vide au départ.
  const [places, setPlaces] = useState([]);
  // État : le mode de couleur, lu dans le stockage.
  const [color, setColorState] = useState(storedColor);

  // Effet qui branche la recherche des nuages LiDAR HD de l'IGN : le moteur demande les dalles sous la caméra quand
  // elle descend sous 3 km, partout en France ; le serveur les lit en direct sur la Géoplateforme.
  useEffect(() => {
    // Sans moteur, ou si le moteur ne gère pas la recherche, rien à faire.
    if (!engine?.setLidarDiscovery) return undefined;
    // Contrôleur d'annulation des requêtes en cours.
    const controller = new AbortController();
    // Branche la recherche (début) :
    engine.setLidarDiscovery(
      // les dalles autour du point, avec l'adresse complète de chaque nœud ;
      (lon, lat) => fetchLidarTiles(controller.signal, { lon, lat }).then(({ items }) => (Array.isArray(items) ? items : []).map((m) => ({ ...m, nodeUrl: resolveApiUrl(m.nodeUrl) }))),
      // à chaque nouvelle liste : les lieux des dalles (identifiant, nom, position, nombre de points).
      (list) => setPlaces(list),
    // Fin du branchement.
    );
    // Nettoyage : annule les requêtes et débranche la recherche.
    return () => { controller.abort(); engine.setLidarDiscovery(null, null); };
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // Transmet l'affichage au moteur, s'il gère cette commande.
  useEffect(() => { engine?.setLidarPointsVisible?.(on); }, [engine, on]);
  // Transmet le mode de couleur au moteur, s'il gère cette commande.
  useEffect(() => { engine?.setLidarPointsColor?.(color); }, [engine, color]);

  // setOn : affiche ou masque le nuage ; début de la fonction mémorisée.
  const setOn = useCallback((value) => {
    // Met l'état à jour, converti en booléen.
    setOnState(Boolean(value));
    // Enregistre « 1 » ou « 0 » ; une erreur de stockage est ignorée.
    try { globalThis.localStorage?.setItem(KEY, value ? '1' : '0'); } catch { /* stockage refusé : valable pour la session */ }
  // Fin de setOn ; fonction stable.
  }, []);

  // setColor : change le mode de couleur ; début de la fonction mémorisée.
  const setColor = useCallback((value) => {
    // Seules deux valeurs sont admises : « classes », sinon « photo ».
    const next = value === 'classes' ? 'classes' : 'photo';
    // Met l'état à jour.
    setColorState(next);
    // Enregistre le mode ; une erreur de stockage est ignorée.
    try { globalThis.localStorage?.setItem(COLOR_KEY, next); } catch { /* stockage refusé : valable pour la session */ }
  // Fin de setColor ; fonction stable.
  }, []);

  // Renvoie l'affichage, le mode de couleur, leurs deux fonctions et les lieux.
  return { on, setOn, color, setColor, places };
// Fin de useLidarPoints.
}
