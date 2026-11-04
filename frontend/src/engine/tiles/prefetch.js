// Préchargement prédictif. Fonctions pures (aucun three.js) : testées par tiles.test.mjs.
//
//  [image]  caméra ──(trajectoire)──► prédiction de la vue à T + Δt ──► tuiles du cône élargi ──► file réseau
//                                                                                     (priorité basse, annulable)

/** Horizon de prédiction (s) : on prépare la vue où sera la caméra dans 1,5 s. */
export const PREDICT_SECONDS = 1.5;
/** Champ de vision du cône de préchargement (rad) : 120° au lieu des ≈ 45° affichés. */
export const PREFETCH_FOV = (120 * Math.PI) / 180;

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const norm = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Suit la caméra (repère de l'astre, rayon 1) et estime ses vitesses, lissées pour ignorer les à-coups :
 *  v  translation (rayons/s) — déplacement au sol et zoom (rapprochement du sol) ;
 *  w  rotation de la direction de visée (variation du vecteur avant, /s) — tangage et lacet.
 */
export class CameraPredictor {
  constructor({ smoothing = 0.25 } = {}) {
    this.k = smoothing;
    this.prev = null;
    this.v = [0, 0, 0];
    this.w = [0, 0, 0];
  }

  /** @param cam [x,y,z]  @param fwd direction de visée unitaire  @param t temps en ms */
  update(cam, fwd, t) {
    const p = this.prev;
    this.prev = { cam: [...cam], fwd: [...fwd], t };
    if (!p) return;
    const dt = (t - p.t) / 1000;
    if (!(dt > 0) || dt > 0.5) { this.v = [0, 0, 0]; this.w = [0, 0, 0]; return; } // pause, onglet caché : on repart de zéro
    const k = this.k;
    for (let i = 0; i < 3; i++) {
      this.v[i] += k * ((cam[i] - p.cam[i]) / dt - this.v[i]);
      this.w[i] += k * ((fwd[i] - p.fwd[i]) / dt - this.w[i]);
    }
  }

  /** Vitesse au sol relative à l'altitude (1 = la caméra parcourt son altitude en 1 s). */
  get relativeSpeed() {
    if (!this.prev) return 0;
    const alt = Math.max(len(this.prev.cam) - 1, 1e-9);
    return len(this.v) / alt + len(this.w);
  }

  /**
   * Vue estimée à T + Δt : Position_estimée = Position_actuelle + v·Δt (idem pour la visée).
   * La caméra estimée ne passe jamais sous le sol (au pire au quart de son altitude actuelle).
   */
  predict(dt = PREDICT_SECONDS) {
    if (!this.prev) return null;
    const { cam, fwd } = this.prev;
    let pc = [cam[0] + this.v[0] * dt, cam[1] + this.v[1] * dt, cam[2] + this.v[2] * dt];
    const minLen = 1 + (len(cam) - 1) * 0.25;
    if (len(pc) < minLen) pc = norm(pc).map((c) => c * minLen);
    const pf = norm([fwd[0] + this.w[0] * dt, fwd[1] + this.w[1] * dt, fwd[2] + this.w[2] * dt]);
    return { cam: pc, fwd: pf };
  }
}

/**
 * Test « cône élargi » : la sphère englobante (centre c, rayon r) touche-t-elle le cône de demi-angle `half`
 * autour de la visée `fwd` depuis `cam` ? Sert de filtre de champ de vision pour le préchargement.
 */
export function coneTest(cam, fwd, half) {
  return (c, r) => {
    const d = [c[0] - cam[0], c[1] - cam[1], c[2] - cam[2]];
    const l = len(d);
    if (l <= r) return true;
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(d, fwd) / l)));
    return ang <= half + Math.asin(Math.min(1, r / l));
  };
}

/**
 * Priorité de chargement (plus petit = plus tôt, comme la file TileLoader) : l'inverse de
 *   Priorité = 1 / (distance au centre de l'écran) × importance du niveau.
 * Distance au centre = angle entre la visée et la direction de la tuile ; importance = les niveaux grossiers d'abord
 * (ils servent de remplaçant flou à toute une zone), × 2 par niveau d'écart avec le niveau le plus fin demandé.
 */
export function tilePriority(t, cam, fwd, finestZ) {
  const d = [t.c[0] - cam[0], t.c[1] - cam[1], t.c[2] - cam[2]];
  const l = len(d) || 1;
  const fromCenter = Math.acos(Math.max(-1, Math.min(1, dot(d, fwd) / l))); // rad, 0 = centre de l'écran
  const importance = 2 ** Math.max(0, finestZ - t.z);
  return (0.02 + fromCenter) / importance;
}

/**
 * Portion de la texture d'un ancêtre qui recouvre la tuile `coord`, combinée au rectangle déjà utilisé par cet ancêtre
 * (sur-zoom). Sert au fondu enchaîné parent → enfant. Rectangles [u0, v0, largeur, hauteur], v vers le Nord.
 */
export function ancestorRect(ancestor, coord, rect = [0, 0, 1, 1]) {
  const n = 2 ** (coord.z - ancestor.z);
  const rx = coord.x - ancestor.x * n, ry = coord.y - ancestor.y * n;
  const s = 1 / n;
  return [rect[0] + rx * s * rect[2], rect[1] + (1 - (ry + 1) * s) * rect[3], s * rect[2], s * rect[3]];
}
