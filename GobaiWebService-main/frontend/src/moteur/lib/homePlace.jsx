// Position de l'utilisateur et lieu « Maison ». La position lue par l'appareil
// n'est jamais envoyée au serveur : elle sert à déplacer la caméra, et la Maison est gardée dans le navigateur
// seulement (localStorage). Aucune dépendance : testable sans navigateur.

// Clé de la Maison dans le navigateur.
const KEY = 'gobai:maison';
// Nom affiché de la Maison.
export const HOME_NAME = 'Maison';
// Nom affiché de la position.
export const MY_POSITION_NAME = 'Ma position';

// Altitude du survol : assez près pour reconnaître son quartier, jamais plus près que la précision de la mesure.
// Altitude minimale du survol : 600 m.
export const FLY_ALTITUDE_MIN_M = 600;
// Altitude maximale du survol : 50 km.
export const FLY_ALTITUDE_MAX_M = 50_000;

/** Lieu valide { lat, lon } (longitude ramenée dans −180 … 180), ou null. */
// Fonction normalizePlace.
export function normalizePlace(place) {
  // Latitude et longitude, en nombres.
  const lat = Number(place?.lat), lon = Number(place?.lon);
  // Valeur absente, non finie, ou latitude au-delà de 90° : null.
  if (place?.lat == null || place?.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return null;
  // Longitude déjà dans la plage : gardée telle quelle (le repli par modulo abîmerait ses dernières décimales).
  // Longitude déjà entre −180° et 180° : rendue telle quelle.
  if (Math.abs(lon) <= 180) return { lat, lon };
  // Sinon ramenée dans cette plage.
  return { lat, lon: ((((lon + 180) % 360) + 360) % 360) - 180 };
// Fin de normalizePlace.
}

/** Altitude de survol (m) d'une position connue à `accuracyM` près : la zone d'incertitude tient dans l'écran. */
// Fonction flyAltitude.
export function flyAltitude(accuracyM) {
  // Précision, en nombre.
  const a = Number(accuracyM);
  // Inconnue ou nulle : l'altitude minimale.
  if (!Number.isFinite(a) || a <= 0) return FLY_ALTITUDE_MIN_M;
  // Quatre fois la précision, entre le minimum et le maximum.
  return Math.min(FLY_ALTITUDE_MAX_M, Math.max(FLY_ALTITUDE_MIN_M, a * 4));
// Fin de flyAltitude.
}

/** Lieu à survoler (format de `engine.goTo`) à partir d'une position de l'appareil. */
// Fonction placeFromPosition ; le nom « Ma position » par défaut.
export function placeFromPosition(position, name = MY_POSITION_NAME) {
  // Lieu lu dans la position de l'appareil.
  const place = normalizePlace({ lat: position?.coords?.latitude, lon: position?.coords?.longitude });
  // Invalide : null.
  if (!place) return null;
  // Renvoie le nom, le lieu et l'altitude de survol.
  return { name, ...place, altitudeM: flyAltitude(position.coords.accuracy) };
// Fin de placeFromPosition.
}

/** Message lisible d'un refus ou d'un échec de localisation (codes de GeolocationPositionError). */
// Fonction geolocationMessage.
export function geolocationMessage(error) {
  // Code 1 : localisation refusée.
  if (error?.code === 1) return 'Localisation refusée : autorisez-la dans les réglages du navigateur.';
  // Code 3 : délai dépassé.
  if (error?.code === 3) return 'La localisation met trop de temps : réessayez à ciel dégagé.';
  // Code 2 : position introuvable.
  if (error?.code === 2) return 'Position introuvable pour le moment.';
  // Sinon : localisation indisponible.
  return 'La localisation n’est pas disponible sur cet appareil.';
// Fin de geolocationMessage.
}

/** Lit la Maison enregistrée (texte JSON du stockage), ou null si elle est absente ou abîmée. */
// Fonction parseHome.
export function parseHome(raw) {
  // Rien : null.
  if (!raw) return null;
  // Lit le JSON et valide le lieu ; un échec donne null.
  try { return normalizePlace(JSON.parse(raw)); } catch { return null; }
// Fin de parseHome.
}

/**
 * Demande la position à l'appareil (une seule mesure). Doit être appelée depuis un appui de l'utilisateur :
 * Safari sur iPhone n'affiche la demande d'autorisation qu'à cette condition.
 * @returns {Promise<GeolocationPosition>}
 */
// Fonction locate ; la localisation du navigateur par défaut.
export function locate(geolocation = globalThis.navigator?.geolocation) {
  // Crée la promesse :
  return new Promise((resolve, reject) => {
    // appareil sans localisation : rejet.
    if (!geolocation?.getCurrentPosition) { reject(new Error('indisponible')); return; }
    // Une mesure de moins d'une minute suffit : pas de GPS rallumé pour rien (batterie et chauffe du téléphone).
    // Demande une mesure précise, attendue 12 s au plus, vieille d'une minute au plus.
    geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 });
  // Fin de la promesse.
  });
// Fin de locate.
}

/**
 * Cap de l'appareil, lu une seule fois (pour le cône du point bleu) puis les capteurs sont relâchés : pas de
 * boussole allumée en continu (batterie et chauffe). À appeler pendant un appui : l'iPhone ne demande
 * l'autorisation « Mouvement et orientation » qu'à cette condition. Résout à null sans boussole (ordinateur, refus).
 * @param read (event) => cap en degrés ou null (voir compassHeading)
 */
// Fonction readCompassOnce ; par défaut : la fenêtre du navigateur et 1,5 s d'attente.
export function readCompassOnce(read, { target = globalThis.window, timeoutMs = 1500 } = {}) {
  // Événement d'orientation de l'appareil.
  const Orientation = target?.DeviceOrientationEvent;
  // Sans cet événement, sans écoute possible ou sans écran tactile : null.
  if (!Orientation || !target.addEventListener || !(target.navigator?.maxTouchPoints > 0)) return Promise.resolve(null);
  // Autorisation.
  let permission;
  // Essaie
  try {
    // de la demander si le navigateur l'exige (iPhone) ; sinon elle est acquise.
    permission = typeof Orientation.requestPermission === 'function' ? Orientation.requestPermission() : Promise.resolve('granted');
  // En cas d'échec : null.
  } catch { return Promise.resolve(null); }
  // Une fois la réponse connue :
  return Promise.resolve(permission).then((state) => {
    // refusée : null.
    if (state !== 'granted') return null;
    // Crée la promesse du cap :
    return new Promise((resolve) => {
      // les deux événements écoutés ;
      const events = ['deviceorientationabsolute', 'deviceorientation'];
      // minuterie ;
      let timer = 0;
      // fonction finish : termine
      const finish = (value) => {
        // en arrêtant la minuterie,
        clearTimeout(timer);
        // en cessant d'écouter,
        events.forEach((name) => target.removeEventListener(name, onEvent));
        // et en rendant la valeur.
        resolve(value);
      // Fin de finish.
      };
      // Fonction onEvent : à chaque événement,
      function onEvent(event) {
        // lit le cap ;
        const heading = read(event);
        // s'il y en a un, termine avec lui.
        if (heading !== null) finish(heading);
      // Fin de onEvent.
      }
      // Écoute les deux événements.
      events.forEach((name) => target.addEventListener(name, onEvent));
      // Sans réponse au bout du délai : null.
      timer = setTimeout(() => finish(null), timeoutMs);
    // Fin de la promesse.
    });
  // Toute erreur donne null.
  }).catch(() => null);
// Fin de readCompassOnce.
}

// ------------------------------------------------------------------ Maison gardée dans le navigateur

// Maison gardée : aucune au départ.
let home = null;
// Lit celle du navigateur ; un échec est ignoré.
try { home = parseHome(globalThis.localStorage?.getItem(KEY)); } catch { /* stockage refusé : pas de Maison */ }
// Fonctions à prévenir d'un changement.
const listeners = new Set();

// Fonction getHome : la Maison.
export const getHome = () => home;

/** Enregistre la Maison (ou l'oublie avec null). Renvoie le lieu gardé. */
// Fonction setHome.
export function setHome(place) {
  // Garde le lieu validé, ou null.
  home = normalizePlace(place);
  // Essaie :
  try {
    // s'il y a une Maison, l'écrit dans le navigateur ;
    if (home) globalThis.localStorage?.setItem(KEY, JSON.stringify(home));
    // sinon l'efface.
    else globalThis.localStorage?.removeItem(KEY);
  // Un échec est ignoré.
  } catch { /* stockage refusé : valable pour la session */ }
  // Prévient les abonnés.
  listeners.forEach((fn) => fn());
  // Renvoie la Maison.
  return home;
// Fin de setHome.
}

// Fonction subscribeHome.
export function subscribeHome(fn) {
  // Ajoute l'abonné.
  listeners.add(fn);
  // Renvoie la fonction qui le retire.
  return () => listeners.delete(fn);
// Fin de subscribeHome.
}
