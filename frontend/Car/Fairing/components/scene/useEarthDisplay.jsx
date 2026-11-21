// Importe de React les crochets useCallback, useEffect et useState.
import { useCallback, useEffect, useState } from 'react';
// Importe l'identifiant du calque des rues.
import { ROADS_LAYER_ID } from '@/Engine/AstreSolideEngine/MapEngine/earth/roadSource';
// Importe le chargement des volcans en éruption.
import { fetchVolcanoes } from '@/Computing/api/scene';

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

/** Affichage de la Terre (ombrage, frontières, littoraux, noms, rues) et son envoi au moteur. */
// Déclare et exporte le crochet useEarthDisplay : moteur et fonction de messages.
export function useEarthDisplay({ engine, push }) {
  // État : ombrage, actif au départ.
  const [shade, setShade] = useState(true);
  // État : frontières, masquées au départ.
  const [borders, setBorders] = useState(false);
  // État : littoraux, masqués au départ.
  const [coasts, setCoasts] = useState(false);
  // État : noms des pays, masqués au départ.
  const [countryNames, setCountryNames] = useState(false);
  // État : noms des villes, masqués au départ.
  const [cityNames, setCityNames] = useState(false);
  // État : coordonnées GPS, affichées au départ.
  const [gps, setGps] = useState(true); // coordonnées GPS des coins de l'écran
  // Rues et routes du monde (OpenStreetMap, tuiles vectorielles OpenFreeMap) : éteint par défaut.
  // État : rues affichées ou non, lu dans le stockage.
  const [streets, setStreetsOn] = useState(storedStreets);
  // setStreets : affiche ou masque les rues ; début de la fonction mémorisée.
  const setStreets = useCallback((on) => {
    // Met l'état à jour, converti en booléen.
    setStreetsOn(Boolean(on));
    // Enregistre « 1 », ou efface l'entrée.
    remember(STREETS_KEY, on ? '1' : null);
  // Fin de setStreets ; fonction stable.
  }, []);
  // La couche unique de la Terre est une imagerie, sans noms ni routes : les noms des villes s'affichent dès qu'ils sont demandés.
  const showCityNames = cityNames;

  // Transmet l'ombrage au moteur.
  useEffect(() => { engine?.setTileShade(shade); }, [engine, shade]);
  // Transmet l'affichage des frontières au moteur.
  useEffect(() => { engine?.setBordersVisible(borders); }, [engine, borders]);
  // Transmet l'affichage des littoraux au moteur.
  useEffect(() => { engine?.setCoastsVisible(coasts); }, [engine, coasts]);

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
    // Calque voulu : les rues si elles sont affichées, sinon aucun.
    const wanted = streets ? ROADS_LAYER_ID : null;
    // Littoraux : ceux des tuiles remplacent ceux du globe quand le calque des rues est affiché.
    engine.setCoastsFromTiles(wanted === ROADS_LAYER_ID);
    // Demande ce calque au moteur ; en cas d'échec (début).
    engine.setBodyTileOverlay('earth', wanted).catch((e) => {
      // Les rues sont un choix de l'utilisateur : il est prévenu si elles ne répondent pas. Les autres calques sont automatiques.
      // Si c'étaient les rues, affiche l'erreur pendant 7 secondes.
      if (wanted === ROADS_LAYER_ID) push?.(e?.message || 'Rues indisponibles pour le moment', 'error', 7000);
    // Fin du traitement de l'échec.
    });
  // Fin de l'effet ; dépendances : le moteur, les rues et push.
  }, [engine, streets, push]);

  // Début de l'objet renvoyé.
  return {
    // L'ombrage, les frontières et les littoraux, avec leurs fonctions.
    shade, setShade, borders, setBorders, coasts, setCoasts,
    // Les noms de pays et de villes, l'affichage effectif des villes et le GPS.
    countryNames, setCountryNames, cityNames, setCityNames, showCityNames, gps, setGps,
    // Les rues, et leur fonction.
    streets, setStreets,
    // Les volcans en éruption, leur fonction et leur nombre.
    volcanoes, setVolcanoes, volcanoCount,
  // Fin de l'objet renvoyé.
  };
// Fin de useEarthDisplay.
}
