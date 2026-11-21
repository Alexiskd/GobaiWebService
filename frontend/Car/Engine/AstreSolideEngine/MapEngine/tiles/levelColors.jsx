// Accord des couleurs entre les niveaux de zoom d'une couche de carte. Les images d'un niveau n'ont pas toujours les
// mêmes teintes que celles du niveau voisin (autre prise de vue, autre traitement) : en zoomant, on voit la carte
// changer de couleur. Ici chaque niveau est accordé sur le niveau le plus grossier de la couche (l'astre vu de loin) :
// on compare les mêmes endroits vus aux deux niveaux, et on en tire un gain et un décalage par canal, appliqués par
// le shader à toutes les tuiles du niveau. Une seule correction par niveau : aucun raccord entre tuiles voisines.

// Importe les statistiques de couleur, la correction de pixels, le rectangle de découpe et l'écart maximal de découpe.
import { ColorStats, MAX_CROP_LEVELS, applyGain, cropRect } from '../earth/earthDirect.jsx';
// Importe le calcul de la clé d'une tuile.
import { tileKey } from '../mercator.jsx';

/** Côté (px) des vignettes comparées : 4 px, pour ne comparer que les tons d'ensemble, pas le détail d'un niveau. */
// Côté des vignettes : 4.
export const LEVEL_PX = 4;
/** Tuiles mesurées par niveau avant de figer sa correction. */
// Nombre maximal de mesures : 24.
export const LEVEL_MAX_SAMPLES = 24;

/** Bornes de la correction d'un niveau : contraste entre 0,75 et 1,35, décalage de 0,2 au plus. */
// Bornes du gain et du décalage.
const GAIN_MIN = 0.75, GAIN_MAX = 1.35, OFFSET_MAX = 0.2;
/** Écart-type (sur 0 … 1) sous lequel le contraste n'est pas touché, et à partir duquel il est accordé en entier. */
// Seuils de confiance du contraste.
const FLAT_SD = 0.02, FULL_SD = 0.08;

/**
 * Correction d'un niveau d'après ses mesures : par canal, le gain accorde le contraste (rapport des écarts-types) et
 * le décalage accorde la teinte moyenne. Sur des images presque unies (mer, désert), le rapport des écarts-types ne
 * veut rien dire : le gain reste alors à 1 et seule la teinte moyenne est accordée.
 * @returns {{ gain: number[], offset: number[] } | null} null tant qu'il n'y a pas assez de mesures.
 */
// Déclare et exporte levelFit : les statistiques d'un niveau (début).
export function levelFit(stats) {
  // Pas assez de mesures : rien.
  if (!stats.ready || !stats.n) return null;
  // Gain et décalage neutres au départ.
  const gain = [1, 1, 1], offset = [0, 0, 0];
  // Pour chaque canal (début).
  for (let c = 0; c < 3; c++) {
    // Moyennes de la tuile et de la référence.
    const ms = stats.s[c] / stats.n, mr = stats.r[c] / stats.n;
    // Écarts-types de la tuile et de la référence.
    const sd = Math.sqrt(Math.max(0, stats.s2[c] / stats.n - ms * ms)), rd = Math.sqrt(Math.max(0, stats.r2[c] / stats.n - mr * mr));
    // Confiance dans le contraste : 0 sur une image unie, 1 sur une image variée.
    const trust = Math.min(1, Math.max(0, (Math.min(sd, rd) - FLAT_SD) / (FULL_SD - FLAT_SD)));
    // Gain : rapport des écarts-types, pesé par la confiance, puis borné.
    const g = Math.min(GAIN_MAX, Math.max(GAIN_MIN, 1 + (sd > 1e-3 ? rd / sd - 1 : 0) * trust));
    // Le garde.
    gain[c] = g;
    // Décalage : ramène la moyenne de la tuile sur celle de la référence, borné.
    offset[c] = Math.min(OFFSET_MAX, Math.max(-OFFSET_MAX, mr - g * ms));
  // Fin de la boucle.
  }
  // Renvoie la correction.
  return { gain, offset };
// Fin de levelFit.
}

/** Copie corrigée de pixels RGBA : gain et décalage par canal (rien à corriger : simple copie). */
// Déclare et exporte corrected : les pixels, le gain et le décalage.
export function corrected(data, gain, offset) {
  // Copie, pour ne pas toucher aux pixels d'origine (ils peuvent être partagés).
  const copy = new Uint8ClampedArray(data);
  // Renvoie la copie, corrigée si une correction est donnée.
  return gain && offset ? applyGain(copy, gain, offset) : copy;
// Fin de corrected.
}

/** Corrections de couleur des niveaux d'une couche. */
// Déclare et exporte la classe LevelColors (début).
export class LevelColors {
  /** @param {{ baseZoom?: number, maxSamples?: number }} o  baseZoom : niveau de référence, jamais corrigé. */
  // Constructeur : le niveau de référence et le nombre maximal de mesures.
  constructor({ baseZoom = 0, maxSamples = LEVEL_MAX_SAMPLES } = {}) {
    // Niveau de référence.
    this.baseZoom = Math.max(0, baseZoom);
    // Nombre maximal de mesures par niveau.
    this.maxSamples = maxSamples;
    // État de chaque niveau.
    this.levels = new Map();
  // Fin du constructeur.
  }

  /** État d'un niveau : gain et décalage (tableaux partagés avec le shader, mis à jour sur place), mesures. */
  // of : l'état d'un niveau, créé au premier besoin (début).
  of(z) {
    // État déjà créé.
    let st = this.levels.get(z);
    // Sinon : correction neutre, aucune mesure.
    if (!st) this.levels.set(z, (st = { z, gain: new Float32Array([1, 1, 1]), offset: new Float32Array(3), stats: new ColorStats(), busy: false }));
    // Renvoie l'état.
    return st;
  // Fin de of.
  }

  /** Vrai quand les couleurs d'un niveau sont connues : niveau de référence, ou niveau assez mesuré. */
  // settled : le niveau peut-il servir de référence.
  settled(z) { return z <= this.baseZoom || this.of(z).stats.ready; }

  /** Vrai quand un niveau a encore besoin de mesures et qu'aucune n'est en cours. */
  // wants : le niveau attend-il une mesure.
  wants(z) { const st = this.of(z); return z > this.baseZoom && !st.busy && st.stats.samples < this.maxSamples; }

  /**
   * Tuile de référence d'une tuile : son ancêtre le plus grossier (6 niveaux d'écart au plus, pour garder au moins
   * 4 px dans la découpe) dont les couleurs sont connues et dont l'image est là (`has(key)`). null s'il n'y en a pas.
   * @returns {{ z, x, y, key, depth } | null}
   */
  // reference : la tuile et la fonction qui dit si une image est disponible (début).
  reference({ z, x, y }, has) {
    // Du plus grand écart au plus petit (début).
    for (let depth = Math.min(MAX_CROP_LEVELS, z - this.baseZoom); depth >= 1; depth--) {
      // Niveau de l'ancêtre.
      const az = z - depth;
      // Couleurs pas encore connues à ce niveau : suivant.
      if (!this.settled(az)) continue;
      // Coordonnées et clé de l'ancêtre.
      const ax = Math.floor(x / 2 ** depth), ay = Math.floor(y / 2 ** depth), key = tileKey(az, ax, ay);
      // Image disponible : c'est la référence.
      if (has(key)) return { z: az, x: ax, y: ay, key, depth };
    // Fin de la boucle.
    }
    // Aucune référence.
    return null;
  // Fin de reference.
  }

  /**
   * Ajoute une mesure à un niveau : pixels RGBA de la tuile et du même endroit dans sa référence (déjà corrigés de
   * ce qui leur est appliqué à l'écran). Met la correction du niveau à jour. Renvoie true si la mesure compte.
   */
  // add : le niveau, les pixels de la tuile et ceux de la référence (début).
  add(z, src, ref) {
    // État du niveau.
    const st = this.of(z);
    // Niveau de référence, niveau figé, ou mesure sans assez d'endroits communs : rien.
    if (z <= this.baseZoom || st.stats.samples >= this.maxSamples || !st.stats.add(src, ref)) return false;
    // Correction tirée des mesures (null tant qu'il n'y en a pas assez).
    const fit = levelFit(st.stats);
    // S'il y en a une : recopiée dans les tableaux partagés avec le shader.
    if (fit) { st.gain.set(fit.gain); st.offset.set(fit.offset); }
    // La mesure compte.
    return true;
  // Fin de add.
  }

  /** Rectangle à lire dans l'image de référence, de `size` px de côté, pour une tuile `depth` niveaux plus bas. */
  // crop : la taille de l'image, l'écart de niveaux et la tuile.
  crop(size, depth, { x, y }) { return cropRect(size, depth, x, y); }
// Fin de la classe LevelColors.
}
