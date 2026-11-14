// Préchargement prédictif. Fonctions pures (aucun three.js) : testées par tiles.test.mjs.
//
//  [image]  caméra ──(trajectoire)──► prédiction de la vue à T + Δt ──► tuiles du cône élargi ──► file réseau
//                                                                                     (priorité basse, annulable)

/** Horizon de prédiction (s) : on prépare la vue où sera la caméra dans 1,5 s. */
// Déclare et exporte l'horizon de prédiction : 1,5 seconde.
export const PREDICT_SECONDS = 1.5;
/** Champ de vision du cône de préchargement (rad) : 120° au lieu des ≈ 45° affichés. */
// Déclare et exporte le champ du cône de préchargement : 120 degrés, en radians.
export const PREFETCH_FOV = (120 * Math.PI) / 180;

// len : longueur d'un vecteur.
const len = (v) => Math.hypot(v[0], v[1], v[2]);
// norm : vecteur rendu unitaire ; une longueur nulle est remplacée par 1.
const norm = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Suit la caméra (repère de l'astre, rayon 1) et estime ses vitesses, lissées pour ignorer les à-coups :
 *  v  translation (rayons/s) — déplacement au sol et zoom (rapprochement du sol) ;
 *  w  rotation de la direction de visée (variation du vecteur avant, /s) — tangage et lacet.
 */
// Déclare et exporte la classe CameraPredictor (début).
export class CameraPredictor {
  // Constructeur : le coefficient de lissage, 0,25 par défaut (début).
  constructor({ smoothing = 0.25 } = {}) {
    // Garde le coefficient.
    this.k = smoothing;
    // Dernier relevé de la caméra : aucun.
    this.prev = null;
    // Vitesse de translation : nulle.
    this.v = [0, 0, 0];
    // Vitesse de rotation de la visée : nulle.
    this.w = [0, 0, 0];
  // Fin du constructeur.
  }

  /** @param cam [x,y,z]  @param fwd direction de visée unitaire  @param t temps en ms */
  // update : la position de la caméra, sa visée et l'instant (début).
  update(cam, fwd, t) {
    // Le relevé précédent.
    const p = this.prev;
    // Nouveau relevé : copies de la position et de la visée, et l'instant.
    this.prev = { cam: [...cam], fwd: [...fwd], t };
    // Premier relevé : rien à calculer.
    if (!p) return;
    // Temps écoulé en secondes.
    const dt = (t - p.t) / 1000;
    // Temps nul, négatif ou supérieur à une demi-seconde : les vitesses sont remises à zéro.
    if (!(dt > 0) || dt > 0.5) { this.v = [0, 0, 0]; this.w = [0, 0, 0]; return; } // pause, onglet caché : on repart de zéro
    // Le coefficient de lissage.
    const k = this.k;
    // Pour chacune des trois composantes (début).
    for (let i = 0; i < 3; i++) {
      // Rapproche la vitesse de translation de la vitesse mesurée.
      this.v[i] += k * ((cam[i] - p.cam[i]) / dt - this.v[i]);
      // Rapproche la vitesse de rotation de la vitesse mesurée.
      this.w[i] += k * ((fwd[i] - p.fwd[i]) / dt - this.w[i]);
    // Fin de la boucle.
    }
  // Fin de update.
  }

  /** Vitesse au sol relative à l'altitude (1 = la caméra parcourt son altitude en 1 s). */
  // relativeSpeed : la vitesse rapportée à l'altitude (début).
  get relativeSpeed() {
    // Sans relevé : 0.
    if (!this.prev) return 0;
    // Altitude de la caméra, jamais nulle.
    const alt = Math.max(len(this.prev.cam) - 1, 1e-9);
    // Renvoie la vitesse de translation divisée par l'altitude, plus la vitesse de rotation.
    return len(this.v) / alt + len(this.w);
  // Fin de relativeSpeed.
  }

  /**
   * Vue estimée à T + Δt : Position_estimée = Position_actuelle + v·Δt (idem pour la visée).
   * La caméra estimée ne passe jamais sous le sol (au pire au quart de son altitude actuelle).
   */
  // predict : la vue estimée après un délai, celui de l'horizon par défaut (début).
  predict(dt = PREDICT_SECONDS) {
    // Sans relevé : null.
    if (!this.prev) return null;
    // La position et la visée du dernier relevé.
    const { cam, fwd } = this.prev;
    // Position estimée : la position plus la vitesse multipliée par le délai.
    let pc = [cam[0] + this.v[0] * dt, cam[1] + this.v[1] * dt, cam[2] + this.v[2] * dt];
    // Distance minimale au centre : le quart de l'altitude actuelle au-dessus du sol.
    const minLen = 1 + (len(cam) - 1) * 0.25;
    // Plus bas que ce minimum : la position est ramenée à cette distance.
    if (len(pc) < minLen) pc = norm(pc).map((c) => c * minLen);
    // Visée estimée, rendue unitaire.
    const pf = norm([fwd[0] + this.w[0] * dt, fwd[1] + this.w[1] * dt, fwd[2] + this.w[2] * dt]);
    // Renvoie la position et la visée estimées.
    return { cam: pc, fwd: pf };
  // Fin de predict.
  }
// Fin de la classe CameraPredictor.
}

/** Zoom en cours : l'altitude de la caméra change de plus de 0,2 % d'une image à la suivante. */
// Déclare et exporte le seuil de zoom : 0,2 % de variation d'altitude.
export const ZOOM_RATE_MIN = 2e-3;
/** Le zoom est tenu pour « en cours » encore 400 ms après le dernier mouvement (molette, pincement par à-coups). */
// Déclare et exporte la durée de maintien du zoom : 400 ms.
export const ZOOM_HOLD_MS = 400;

/**
 * Détecte un zoom en cours à partir de la position de la caméra (repère de l'astre, rayon 1). Pendant un zoom, la
 * couche de tuiles ne demande que les tuiles du champ de la caméra : ni préchargement prédictif, ni préchargement de
 * fond (voir TileLayer.update).
 */
// Déclare et exporte la classe ZoomWatch (début).
export class ZoomWatch {
  // Constructeur : le seuil et la durée de maintien, avec leurs valeurs par défaut (début).
  constructor({ rate = ZOOM_RATE_MIN, holdMs = ZOOM_HOLD_MS } = {}) {
    // Garde le seuil.
    this.rate = rate;
    // Garde la durée de maintien.
    this.holdMs = holdMs;
    // Dernière altitude : 0, donc inconnue.
    this.alt = 0;
    // Instant jusqu'auquel le zoom est tenu pour en cours : jamais.
    this.until = -Infinity;
  // Fin du constructeur.
  }

  /** @param cam [x,y,z]  @param t temps en ms  @returns {boolean} vrai tant qu'un zoom est en cours */
  // update : la position de la caméra et l'instant (début).
  update(cam, t) {
    // Altitude de la caméra, jamais nulle.
    const alt = Math.max(len(cam) - 1, 1e-9);
    // Si l'altitude a varié de plus que le seuil : le zoom est tenu pour en cours pendant la durée de maintien.
    if (this.alt && Math.abs(alt - this.alt) / this.alt > this.rate) this.until = t + this.holdMs;
    // Mémorise l'altitude.
    this.alt = alt;
    // Vrai tant que cet instant n'est pas dépassé.
    return t < this.until;
  // Fin de update.
  }
// Fin de la classe ZoomWatch.
}

/**
 * Test « cône élargi » : la sphère englobante (centre c, rayon r) touche-t-elle le cône de demi-angle `half`
 * autour de la visée `fwd` depuis `cam` ? Sert de filtre de champ de vision pour le préchargement.
 */
// Déclare et exporte coneTest : la position de la caméra, la visée et le demi-angle du cône.
export function coneTest(cam, fwd, half) {
  // Renvoie un test qui reçoit le centre et le rayon d'une sphère (début).
  return (c, r) => {
    // Vecteur de la caméra au centre de la sphère.
    const d = [c[0] - cam[0], c[1] - cam[1], c[2] - cam[2]];
    // Sa longueur.
    const l = len(d);
    // Caméra dans la sphère : vrai.
    if (l <= r) return true;
    // Angle entre la visée et ce vecteur.
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(d, fwd) / l)));
    // Vrai si cet angle ne dépasse pas le demi-angle du cône plus le rayon angulaire de la sphère.
    return ang <= half + Math.asin(Math.min(1, r / l));
  // Fin du test.
  };
// Fin de coneTest.
}

/**
 * Priorité de chargement (plus petit = plus tôt, comme la file TileLoader) : l'inverse de
 *   Priorité = 1 / (distance au centre de l'écran) × importance du niveau.
 * Distance au centre = angle entre la visée et la direction de la tuile ; importance = les niveaux grossiers d'abord
 * (ils servent de remplaçant flou à toute une zone), × 2 par niveau d'écart avec le niveau le plus fin demandé.
 */
// Déclare et exporte tilePriority : la tuile, la position de la caméra, la visée et le niveau le plus fin demandé.
export function tilePriority(t, cam, fwd, finestZ) {
  // Vecteur de la caméra au centre de la tuile.
  const d = [t.c[0] - cam[0], t.c[1] - cam[1], t.c[2] - cam[2]];
  // Sa longueur, ou 1 si elle est nulle.
  const l = len(d) || 1;
  // Angle entre la visée et la tuile.
  const fromCenter = Math.acos(Math.max(-1, Math.min(1, dot(d, fwd) / l))); // rad, 0 = centre de l'écran
  // Importance : doublée pour chaque niveau au-dessus du plus fin.
  const importance = 2 ** Math.max(0, finestZ - t.z);
  // Renvoie l'angle, augmenté de 0,02, divisé par l'importance.
  return (0.02 + fromCenter) / importance;
// Fin de tilePriority.
}

/**
 * Portion de la texture d'un ancêtre qui recouvre la tuile `coord`, combinée au rectangle déjà utilisé par cet ancêtre
 * (sur-zoom). Sert au fondu enchaîné parent → enfant. Rectangles [u0, v0, largeur, hauteur], v vers le Nord.
 */
// Déclare et exporte ancestorRect : la tuile ancêtre, la tuile visée et le rectangle déjà utilisé (toute la texture par défaut).
export function ancestorRect(ancestor, coord, rect = [0, 0, 1, 1]) {
  // Nombre de tuiles du niveau visé dans un côté de l'ancêtre.
  const n = 2 ** (coord.z - ancestor.z);
  // Colonne et ligne de la tuile à l'intérieur de l'ancêtre.
  const rx = coord.x - ancestor.x * n, ry = coord.y - ancestor.y * n;
  // Part d'un côté occupée par la tuile.
  const s = 1 / n;
  // Renvoie le rectangle : origine horizontale, origine verticale comptée depuis le bas, largeur et hauteur.
  return [rect[0] + rx * s * rect[2], rect[1] + (1 - (ry + 1) * s) * rect[3], s * rect[2], s * rect[3]];
// Fin de ancestorRect.
}
