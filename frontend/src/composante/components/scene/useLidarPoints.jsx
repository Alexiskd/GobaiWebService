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
 * Dalles LiDAR en vrais points 3D (GET /lidar) : envoyées au moteur dès le démarrage, affichées par défaut.
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

  // Effet qui charge les dalles.
  useEffect(() => {
    // Sans moteur, ou si le moteur ne gère pas les dalles de points, rien à faire.
    if (!engine?.setLidarPointTiles) return undefined;
    // Crée un contrôleur d'annulation.
    const controller = new AbortController();
    // Charge la liste des dalles, avec le signal d'annulation.
    fetchLidarTiles(controller.signal)
      // Réponse reçue : extrait les dalles (début).
      .then(({ items }) => {
        // Liste des dalles (vide si ce n'est pas un tableau), avec l'adresse complète de chaque nœud.
        const list = (Array.isArray(items) ? items : []).map((m) => ({ ...m, nodeUrl: resolveApiUrl(m.nodeUrl) }));
        // Envoie les dalles au moteur.
        engine.setLidarPointTiles(list);
        // Garde, pour chaque dalle, son identifiant, son nom, la position de son point d'ancrage et son nombre de points.
        setPlaces(list.map((m) => ({ id: m.id, name: m.name, lat: m.anchor.lat, lon: m.anchor.lon, points: m.points })));
      // Fin du traitement de la réponse.
      })
      // Un échec est ignoré.
      .catch(() => {}); // pas de dalle : rien à afficher
    // Nettoyage : annule la requête en cours.
    return () => controller.abort();
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
