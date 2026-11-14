// Importe de React les crochets useCallback, useEffect et useState.
import { useCallback, useEffect, useState } from 'react';
// Importe l'identifiant du calque des rues.
import { ROADS_LAYER_ID } from '@/moteur/engine/tiles/roadSource';
// Importe le chargement des volcans en éruption.
import { fetchVolcanoes } from '@/moteur/api/scene';
// Importe l'API des tuiles, pour la liste des villes du LiDAR HD.
import { tilesApi } from '@/moteur/api/tiles';

// Clé du stockage local : calque LiDAR HD choisi.
const LIDAR_KEY = 'gobai:lidar-hd'; // calque LiDAR HD choisi (identifiant de couche), gardé dans le navigateur
// Déclare storedLidar, qui lit le calque LiDAR HD enregistré.
function storedLidar() {
  // La valeur enregistrée, null si elle manque ou si le stockage est inaccessible.
  try { return globalThis.localStorage?.getItem(LIDAR_KEY) || null; } catch { return null; }
// Fin de storedLidar.
}
/** Garde un réglage dans le navigateur (null : l'efface). Stockage refusé : le réglage vaut pour la session. */
// Déclare remember : reçoit la clé et la valeur.
function remember(key, value) {
  // Début du bloc protégé.
  try {
    // S'il y a une valeur, l'enregistre.
    if (value) globalThis.localStorage?.setItem(key, value);
    // Sinon, efface l'entrée.
    else globalThis.localStorage?.removeItem(key);
  // Une erreur de stockage est ignorée.
  } catch { /* stockage refusé */ }
// Fin de remember.
}
// Clé du stockage local : calque des rues.
const STREETS_KEY = 'gobai:rues'; // calque des rues (OpenStreetMap) : « 1 » quand il est affiché
// Déclare storedStreets, qui lit l'affichage enregistré des rues.
function storedStreets() {
  // Vrai si la valeur enregistrée vaut « 1 » ; faux si le stockage est inaccessible.
  try { return globalThis.localStorage?.getItem(STREETS_KEY) === '1'; } catch { return false; }
// Fin de storedStreets.
}
// Clé du stockage local : volcans en éruption.
const VOLCANOES_KEY = 'gobai:volcans'; // volcans en éruption : « 1 » quand ils sont affichés (masqués par défaut)
// Déclare storedVolcanoes, qui lit l'affichage enregistré des volcans.
function storedVolcanoes() {
  // Vrai si la valeur enregistrée vaut « 1 » ; faux si le stockage est inaccessible.
  try { return globalThis.localStorage?.getItem(VOLCANOES_KEY) === '1'; } catch { return false; }
// Fin de storedVolcanoes.
}
// Délai entre deux lectures de la liste des volcans : 30 minutes.
const VOLCANOES_REFRESH_MS = 30 * 60 * 1000;
/** Altitude d'arrivée au-dessus d'une ville (m) si le serveur n'a pas répondu : la même que la sienne. */
// Altitude d'arrivée de secours : 2 000 mètres.
const CITY_ALTITUDE_FALLBACK_M = 2000;

/** Affichage de la Terre (ombrage, frontières, littoraux, noms, routes, LiDAR HD) et son envoi au moteur. */
// Déclare et exporte le crochet useEarthDisplay : moteur, fond de carte, calque superposé, calques LiDAR et fonction de messages.
export function useEarthDisplay({ engine, baseLayer, overlayLayer, lidarLayers = [], push }) {
  // État : routes, affichées au départ.
  const [roads, setRoads] = useState(true);
  // État : ombrage, actif au départ.
  const [shade, setShade] = useState(true);
  // État : frontières, affichées au départ.
  const [borders, setBorders] = useState(true);
  // État : littoraux, affichés au départ.
  const [coasts, setCoasts] = useState(true);
  // État : noms des pays, masqués au départ.
  const [countryNames, setCountryNames] = useState(false);
  // État : noms des villes, masqués au départ.
  const [cityNames, setCityNames] = useState(false);
  // État : coordonnées GPS, affichées au départ.
  const [gps, setGps] = useState(true); // coordonnées GPS des coins de l'écran
  // LiDAR HD de l'IGN sur la France : identifiant du calque affiché, ou null. Un seul calque à la fois sur le fond.
  // État : calque LiDAR HD choisi, lu dans le stockage.
  const [lidarId, setLidarId] = useState(storedLidar);
  // Rues et routes du monde (OpenStreetMap, tuiles vectorielles OpenFreeMap) : éteint par défaut.
  // État : rues affichées ou non, lu dans le stockage.
  const [streets, setStreetsOn] = useState(storedStreets);
  // Un seul calque par tuile : allumer les rues éteint le LiDAR HD, et inversement.
  // setLidar : choisit un calque LiDAR HD, ou aucun ; début de la fonction mémorisée.
  const setLidar = useCallback((id) => {
    // Met l'état à jour (null si aucun).
    setLidarId(id || null);
    // Enregistre le choix.
    remember(LIDAR_KEY, id || null);
    // Si un calque est choisi, éteint les rues et efface leur réglage.
    if (id) { setStreetsOn(false); remember(STREETS_KEY, null); }
  // Fin de setLidar ; fonction stable.
  }, []);
  // setStreets : affiche ou masque les rues ; début de la fonction mémorisée.
  const setStreets = useCallback((on) => {
    // Met l'état à jour, converti en booléen.
    setStreetsOn(Boolean(on));
    // Enregistre « 1 », ou efface l'entrée.
    remember(STREETS_KEY, on ? '1' : null);
    // Si les rues sont affichées, éteint le LiDAR HD et efface son réglage.
    if (on) { setLidarId(null); remember(LIDAR_KEY, null); }
  // Fin de setStreets ; fonction stable.
  }, []);
  // Le calque LiDAR HD choisi, parmi ceux qui sont proposés ; null s'il n'existe pas.
  const lidarLayer = lidarLayers.find((l) => l.id === lidarId) || null;

  // Le fond « hybride » inclut déjà les routes et les noms : on ne les superpose pas.
  // Routes déjà incluses : il y a un fond et ce n'est pas une simple imagerie.
  const roadsIncluded = Boolean(baseLayer && baseLayer.kind !== 'imagery');
  // Routes indisponibles : fond d'imagerie sans calque superposé.
  const roadsUnavailable = baseLayer?.kind === 'imagery' && !overlayLayer;
  // Texte d'aide des routes, selon le cas ; aucun si elles sont disponibles.
  const roadsHint = roadsIncluded ? 'Déjà inclus dans ce fond' : roadsUnavailable ? 'Non proposé par ce fournisseur' : undefined;
  // Noms déjà inclus : même condition que pour les routes.
  const namesIncluded = Boolean(baseLayer && baseLayer.kind !== 'imagery');
  // Noms des villes à afficher : demandés et pas déjà inclus dans le fond.
  const showCityNames = cityNames && !namesIncluded;

  // Transmet l'ombrage au moteur.
  useEffect(() => { engine?.setTileShade(shade); }, [engine, shade]);
  // Transmet l'affichage des frontières au moteur.
  useEffect(() => { engine?.setBordersVisible(borders); }, [engine, borders]);
  // Transmet l'affichage des littoraux au moteur.
  useEffect(() => { engine?.setCoastsVisible(coasts); }, [engine, coasts]);

  // Villes de France où le LiDAR HD est proposé (métropole, Corse et outre-mer) : lues une fois au démarrage, elles
  // ne changent pas. Paramètres en fait une liste : choisir une ville allume le calque et s'y rend.
  // État : les villes proposées, vide tant que la liste n'est pas arrivée.
  const [lidarCities, setLidarCities] = useState([]);
  // État : l'altitude d'arrivée au-dessus d'une ville, celle de secours au départ.
  const [lidarCityAltitudeM, setLidarCityAltitudeM] = useState(CITY_ALTITUDE_FALLBACK_M);
  // Lit la liste des villes une fois, si des calques LiDAR HD sont proposés (début de l'effet).
  useEffect(() => {
    // Aucun calque LiDAR HD : pas de liste à lire.
    if (!lidarLayers.length) return undefined;
    // Contrôleur d'abandon de la lecture.
    const controller = new AbortController();
    // Demande la liste au serveur.
    tilesApi.lidarCities(controller.signal)
      // Reçue (début).
      .then((data) => {
        // Garde les villes, une liste vide si la réponse n'en porte pas.
        setLidarCities(Array.isArray(data?.items) ? data.items : []);
        // Garde l'altitude d'arrivée si elle est donnée et vaut plus que zéro.
        if (data?.altitudeM > 0) setLidarCityAltitudeM(data.altitudeM);
      // Fin de la réception.
      })
      // Échec : la liste reste vide, le calque s'allume quand même à la main.
      .catch(() => {});
    // Nettoyage : abandonne la lecture en cours.
    return () => controller.abort();
  // Fin de l'effet ; dépendance : le nombre de calques proposés.
  }, [lidarLayers.length]);

  // Volcans en éruption, en direct (NASA EONET) : masqués par défaut.
  // État : volcans affichés ou non, lu dans le stockage.
  const [volcanoes, setVolcanoesOn] = useState(storedVolcanoes);
  // État : nombre de volcans en éruption, null tant que la liste n'est pas arrivée.
  const [volcanoCount, setVolcanoCount] = useState(null);
  // setVolcanoes : affiche ou masque les volcans ; début de la fonction mémorisée.
  const setVolcanoes = useCallback((on) => {
    // Change l'état.
    setVolcanoesOn(Boolean(on));
    // Garde le choix : « 1 » s'ils sont affichés, rien sinon.
    remember(VOLCANOES_KEY, on ? '1' : null);
  // Fin de setVolcanoes ; fonction stable.
  }, []);
  // Transmet l'affichage des volcans au moteur.
  useEffect(() => { engine?.setVolcanoesVisible(volcanoes); }, [engine, volcanoes]);
  // Charge la liste des volcans quand ils sont affichés, puis toutes les 30 minutes (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou volcans masqués : rien.
    if (!engine || !volcanoes) return undefined;
    // Contrôleur d'abandon de la lecture en cours.
    const controller = new AbortController();
    // load : lit la liste et la pose dans le moteur ; un échec est ignoré, le calque est automatique.
    const load = () => fetchVolcanoes(controller.signal)
      // Liste reçue : la pose et note le nombre de volcans.
      .then((data) => { const list = data?.volcanoes || []; engine.setVolcanoes(list); setVolcanoCount(list.length); })
      // Échec : rien.
      .catch(() => {});
    // Première lecture.
    load();
    // Lectures suivantes.
    const timer = setInterval(load, VOLCANOES_REFRESH_MS);
    // Nettoyage : arrête les lectures.
    return () => { controller.abort(); clearInterval(timer); };
  // Fin de l'effet.
  }, [engine, volcanoes]);
  // Transmet l'affichage des noms de pays au moteur.
  useEffect(() => { engine?.setCountryLabelsVisible(countryNames); }, [engine, countryNames]);
  // Transmet l'affichage des noms de villes au moteur.
  useEffect(() => { engine?.setCityLabelsVisible(showCityNames); }, [engine, showCityNames]);
  // Transmet l'affichage des coordonnées GPS au moteur, s'il gère cette commande.
  useEffect(() => { engine?.setGpsVisible?.(gps); }, [engine, gps]);

  // Touche G : afficher ou masquer les coordonnées GPS (hors saisie de texte).
  // Effet exécuté une seule fois : le raccourci clavier.
  useEffect(() => {
    // Déclare onKey, appelé à chaque touche enfoncée.
    const onKey = (e) => {
      // La cible de la frappe.
      const t = e.target;
      // Pendant la saisie dans un champ, rien à faire.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Avec Ctrl, Cmd ou Alt, ou pour une autre touche que G, rien à faire.
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'g') return;
      // Inverse l'affichage des coordonnées GPS.
      setGps((v) => !v);
    // Fin de onKey.
    };
    // Écoute les touches sur toute la fenêtre.
    window.addEventListener('keydown', onKey);
    // Nettoyage : retire l'écouteur.
    return () => window.removeEventListener('keydown', onKey);
  // Fin de l'effet ; aucune dépendance.
  }, []);

  // Effet qui choisit le calque superposé de la Terre.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return;
    // Le LiDAR HD, quand il est choisi, prend la place du calque des routes (un seul calque par tuile).
    // Calque voulu : le LiDAR HD s'il est choisi…
    const wanted = lidarLayer ? lidarLayer.id
      // … sinon les rues si elles sont affichées…
      : streets ? ROADS_LAYER_ID
        // … sinon le calque des routes, s'il est demandé, proposé et que le fond est une imagerie ; sinon aucun.
        : roads && baseLayer?.kind === 'imagery' && overlayLayer ? overlayLayer.id : null;
    // Littoraux : ceux des tuiles remplacent ceux du globe quand le calque des rues est affiché.
    engine.setCoastsFromTiles(wanted === ROADS_LAYER_ID);
    // Demande ce calque au moteur ; en cas d'échec (début).
    engine.setBodyTileOverlay('earth', wanted).catch((e) => {
      // Les rues sont un choix de l'utilisateur : il est prévenu si elles ne répondent pas. Les autres calques sont automatiques.
      // Si c'étaient les rues, affiche l'erreur pendant 7 secondes.
      if (wanted === ROADS_LAYER_ID) push?.(e?.message || 'Rues indisponibles pour le moment', 'error', 7000);
    // Fin du traitement de l'échec.
    });
  // Fin de l'effet ; dépendances : le moteur, les réglages, les calques et push.
  }, [engine, roads, streets, baseLayer, overlayLayer, lidarLayer, push]);

  // Début de l'objet renvoyé.
  return {
    // Les routes : état, fonction, inclusion, indisponibilité et texte d'aide.
    roads, setRoads, roadsIncluded, roadsUnavailable, roadsHint,
    // L'ombrage, les frontières et les littoraux, avec leurs fonctions.
    shade, setShade, borders, setBorders, coasts, setCoasts,
    // Les noms de pays et de villes, l'inclusion des noms, l'affichage effectif des villes et le GPS.
    countryNames, setCountryNames, cityNames, setCityNames, namesIncluded, showCityNames, gps, setGps,
    // Le calque LiDAR HD effectif (null s'il n'existe pas), sa fonction et la liste des calques.
    lidarId: lidarLayer?.id ?? null, setLidar, lidarLayers,
    // Les villes de France où le LiDAR HD est proposé, et l'altitude d'arrivée au-dessus d'une ville.
    lidarCities, lidarCityAltitudeM,
    // Les rues, vraies seulement sans LiDAR HD, et leur fonction.
    streets: streets && !lidarLayer, setStreets,
    // Les volcans en éruption, leur fonction et leur nombre.
    volcanoes, setVolcanoes, volcanoCount,
  // Fin de l'objet renvoyé.
  };
// Fin de useEarthDisplay.
}
