// Position de l'utilisateur suivie en direct (GPS de l'appareil, `watchPosition`). Comme pour « Maison »
// (homePlace.jsx), la position n'est jamais envoyée au serveur : elle déplace le point bleu et la caméra.
// Le suivi démarre sur un appui (condition de Safari pour demander l'autorisation), se met en pause quand l'onglet
// est caché (pas de GPS allumé pour rien) et reprend au retour. Sans dépendance au moteur : testable sans navigateur.
// Validation d'un lieu.
import { normalizePlace } from './homePlace';

/** Une mesure d'au plus 5 s d'âge ; haute précision (GPS) ; 15 s pour obtenir la première. */
// Options du suivi : haute précision, 15 s d'attente, mesure de 5 s au plus.
export const LIVE_OPTIONS = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 };

// Rayon de la Terre, en mètres.
const EARTH_RADIUS_M = 6_371_000;
// Un degré en radians.
const RAD = Math.PI / 180;

// Fonction heading : un cap valide (nombre positif ou nul) ramené sous 360°, sinon null.
const heading = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value % 360 : null);

/** Mesure de l'appareil → point du moteur { lat, lon, accuracyM, headingDeg } ; `compass` : cap de secours à l'arrêt. */
// Fonction pointFromPosition.
export function pointFromPosition(position, compass = null) {
  // Lieu lu dans la position de l'appareil.
  const place = normalizePlace({ lat: position?.coords?.latitude, lon: position?.coords?.longitude });
  // Invalide : null.
  if (!place) return null;
  // Précision.
  const accuracy = Number(position.coords.accuracy);
  // Renvoie le lieu, la précision (0 si elle est inconnue) et le cap du GPS, sinon celui de la boussole.
  return { ...place, accuracyM: accuracy > 0 ? accuracy : 0, headingDeg: heading(position.coords.heading) ?? heading(compass) };
// Fin de pointFromPosition.
}

/** Distance au sol entre deux points (m), assez précise pour de petits écarts. */
// Fonction groundDistanceM.
export function groundDistanceM(a, b) {
  // Écart est-ouest, en radians, réduit selon la latitude.
  const x = (b.lon - a.lon) * RAD * Math.cos(((a.lat + b.lat) / 2) * RAD);
  // Écart nord-sud, en radians.
  const y = (b.lat - a.lat) * RAD;
  // Distance, en mètres.
  return Math.hypot(x, y) * EARTH_RADIUS_M;
// Fin de groundDistanceM.
}

/**
 * La nouvelle mesure change-t-elle quelque chose à l'écran ? Déplacement d'au moins 1 m, précision qui varie de plus
 * de 20 %, ou cap qui tourne de plus de 5°. Sinon le point reste tel quel (aucun travail pour rien).
 */
// Fonction pointChanged.
export function pointChanged(prev, next) {
  // Pas de point avant : changé.
  if (!prev) return true;
  // Déplacement d'un mètre ou plus : changé.
  if (groundDistanceM(prev, next) >= 1) return true;
  // Précision qui varie de plus de 20 % : changé.
  if (Math.abs(next.accuracyM - prev.accuracyM) > 0.2 * Math.max(prev.accuracyM, 1)) return true;
  // Cap qui apparaît ou disparaît : changé.
  if ((prev.headingDeg === null) !== (next.headingDeg === null)) return true;
  // Pas de cap : pas changé.
  if (prev.headingDeg === null) return false;
  // Angle entre les deux caps, par le plus court chemin.
  const turn = Math.abs(((next.headingDeg - prev.headingDeg + 540) % 360) - 180);
  // Changé au-delà de 5°.
  return turn > 5;
// Fin de pointChanged.
}

/**
 * Suivi en direct. État : { status: 'off' | 'waiting' | 'on', point } — `point` reste le dernier connu après l'arrêt.
 * `geolocation` et `doc` sont remplaçables pour les tests.
 */
// Classe LivePosition : le suivi en direct.
export class LivePosition {
  // Constructeur : la localisation et le document, remplaçables.
  constructor({ geolocation, doc } = {}) {
    // Garde la localisation.
    this.geolocation = geolocation;
    // Garde le document.
    this.doc = doc;
    // État : à l'arrêt, sans point.
    this.state = { status: 'off', point: null };
    // Abonnés.
    this.listeners = new Set();
    // Numéro du suivi ouvert chez le navigateur.
    this.watchId = null;
    // Suivi voulu ou non.
    this.wanted = false;
    // Promesse de la première mesure.
    this.first = null;       // { resolve, reject } de la première mesure attendue
    // Démarrage en cours.
    this.pending = null;
    // Cap de la boussole.
    this.compass = null;
    // Écoute de la visibilité de l'onglet.
    this.listening = false;
    // Fonction getState : l'état.
    this.getState = () => this.state;
    // Fonction subscribe : abonne une fonction et rend celle qui la retire.
    this.subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
    // Fonction onVisibility, appelée quand l'onglet change de visibilité :
    this.onVisibility = () => {
      // suivi non voulu : rien ;
      if (!this.wanted) return;
      // onglet caché : ferme le suivi ;
      if (this.document()?.visibilityState === 'hidden') this.clear();
      // onglet revenu, sans suivi ouvert : le rouvre.
      else if (this.watchId === null) this.watch();
    // Fin de onVisibility.
    };
  // Fin du constructeur.
  }

  // Méthode geo : la localisation donnée, sinon celle du navigateur.
  geo() { return this.geolocation ?? globalThis.navigator?.geolocation; }
  // Méthode document : le document donné, sinon celui du navigateur.
  document() { return this.doc ?? globalThis.document; }

  // Méthode set : change l'état.
  set(patch) {
    // Fusionne les nouvelles valeurs.
    this.state = { ...this.state, ...patch };
    // Prévient les abonnés.
    this.listeners.forEach((fn) => fn());
  // Fin de set.
  }

  /**
   * Démarre le suivi (à appeler pendant un appui). Résout avec la première position ; si le suivi tourne déjà, avec
   * la position connue. Rejette avec l'erreur de localisation (refus, délai, indisponible).
   */
  // Méthode start.
  start() {
    // Déjà en marche avec un point : le rend.
    if (this.state.status === 'on' && this.state.point) return Promise.resolve(this.state.point);
    // Démarrage en cours : rend sa promesse.
    if (this.pending) return this.pending;
    // Appareil sans suivi : rejet.
    if (!this.geo()?.watchPosition) return Promise.reject(new Error('indisponible'));
    // Le suivi est voulu.
    this.wanted = true;
    // Promesse de la première mesure.
    this.pending = new Promise((resolve, reject) => { this.first = { resolve, reject }; });
    // La garde sous un nom local.
    const pending = this.pending;
    // Fonction done : oublie le démarrage une fois fini.
    const done = () => { if (this.pending === pending) this.pending = null; };
    // L'appelle en cas de réussite comme d'échec.
    pending.then(done, done);
    // État : en attente.
    this.set({ status: 'waiting' });
    // Ouvre le suivi.
    this.watch();
    // Si la visibilité n'est pas encore écoutée :
    if (!this.listening) {
      // le note ;
      this.listening = true;
      // l'écoute.
      this.document()?.addEventListener?.('visibilitychange', this.onVisibility);
    // Fin du cas.
    }
    // Renvoie la promesse.
    return pending;
  // Fin de start.
  }

  /**
   * Reprend le suivi sans rien demander à l'utilisateur, seulement si le navigateur a déjà l'autorisation de
   * localisation pour ce site : le point de la position s'affiche dès l'ouverture, sans fenêtre de permission et
   * sans déplacer la vue. Renvoie vrai si le suivi est lancé.
   */
  // Méthode resumeIfAllowed ; les permissions du navigateur par défaut.
  async resumeIfAllowed(permissions = globalThis.navigator?.permissions) {
    // Déjà voulu : vrai.
    if (this.wanted) return true;
    // Essaie
    try {
      // de lire l'état de l'autorisation de localisation ;
      const status = await permissions?.query?.({ name: 'geolocation' });
      // pas accordée : faux.
      if (status?.state !== 'granted') return false;
    // En cas d'échec :
    } catch {
      // faux.
      return false; // navigateur sans API des permissions : on attend un appui
    // Fin du cas.
    }
    // Démarre le suivi ; un échec est ignoré.
    this.start().catch(() => {}); // échec silencieux : rien n'a été demandé à l'écran
    // Vrai.
    return true;
  // Fin de resumeIfAllowed.
  }

  // Méthode watch : ouvre le suivi.
  watch() {
    // Ferme le précédent.
    this.clear();
    // Demande les positions au navigateur, avec
    this.watchId = this.geo().watchPosition(
      // la fonction appelée à chaque mesure,
      (position) => this.onFix(position),
      // celle appelée en cas d'erreur,
      (error) => this.onError(error),
      // et les options.
      LIVE_OPTIONS,
    // Fin de la demande.
    );
  // Fin de watch.
  }

  // Méthode clear : ferme le suivi.
  clear() {
    // Aucun suivi ouvert : rien.
    if (this.watchId === null) return;
    // Le ferme chez le navigateur.
    this.geo()?.clearWatch?.(this.watchId);
    // Oublie son numéro.
    this.watchId = null;
  // Fin de clear.
  }

  // Méthode onFix : une mesure arrive.
  onFix(position) {
    // Point de la mesure.
    const point = pointFromPosition(position, this.compass);
    // Invalide, ou suivi non voulu : rien.
    if (!point || !this.wanted) return;
    // Promesse de la première mesure.
    const first = this.first;
    // L'oublie.
    this.first = null;
    // Si le suivi n'était pas en marche ou si le point a changé : met l'état à jour.
    if (this.state.status !== 'on' || pointChanged(this.state.point, point)) this.set({ status: 'on', point });
    // Tient la promesse avec le point.
    first?.resolve(this.state.point);
  // Fin de onFix.
  }

  // Méthode onError : une erreur arrive.
  onError(error) {
    // Première mesure impossible, ou autorisation retirée en cours de route : le suivi s'arrête.
    // Une panne passagère (tunnel, délai) garde le dernier point ; le GPS reprend de lui-même.
    // Première mesure impossible, ou autorisation retirée : arrête le suivi.
    if (this.first || error?.code === 1) this.stop(error);
  // Fin de onError.
  }

  /** Cap de la boussole, utilisé pour le cône quand le GPS n'en donne pas (appareil à l'arrêt). */
  // Méthode setCompass.
  setCompass(headingDeg) {
    // Garde le cap de la boussole, validé.
    this.compass = heading(headingDeg);
    // Point courant.
    const point = this.state.point;
    // S'il n'a pas de cap et que la boussole en donne un : le lui donne.
    if (point && point.headingDeg === null && this.compass !== null) this.set({ point: { ...point, headingDeg: this.compass } });
  // Fin de setCompass.
  }

  /** Arrête le suivi ; le dernier point reste affiché, sans être mis à jour. */
  // Méthode stop ; sans erreur par défaut.
  stop(error = null) {
    // Le suivi n'est plus voulu.
    this.wanted = false;
    // Ferme le suivi.
    this.clear();
    // Promesse de la première mesure.
    const first = this.first;
    // L'oublie.
    this.first = null;
    // Si la visibilité est écoutée :
    if (this.listening) {
      // le note ;
      this.listening = false;
      // cesse de l'écouter.
      this.document()?.removeEventListener?.('visibilitychange', this.onVisibility);
    // Fin du cas.
    }
    // État : à l'arrêt.
    if (this.state.status !== 'off') this.set({ status: 'off' });
    // Rompt la promesse, avec l'erreur ou « arrêté ».
    first?.reject(error || new Error('arrêté'));
  // Fin de stop.
  }
// Fin de la classe.
}

/** Suivi partagé par toute l'application. */
// Suivi unique de l'application.
export const livePosition = new LivePosition();
