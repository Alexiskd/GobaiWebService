// Progression de l'écran de chargement : la barre et la vidéo du survol lunaire avancent ensemble.
// Chaque étape réelle du démarrage occupe une tranche de la barre ; à l'intérieur d'une tranche,
// la progression ralentit en approchant de la fin sans jamais la dépasser tant que l'étape n'est pas finie.

/** Tranche [début, fin] de la barre pour chaque étape. */
// Tranche de la barre pour chaque étape :
export const STEP_RANGE = {
  // l'API : de 0 à 45 % ;
  api: [0, 0.45],       // réponse de l'API (peut être longue : réveil du service Render)
  // le moteur : de 45 à 92 %.
  engine: [0.45, 0.92], // téléchargement du moteur 3D puis création de la scène
// Fin des tranches.
};
/** Temps caractéristique (s) pour parcourir une tranche. */
// Temps caractéristique de chaque étape : 6 s pour l'API, 3 s pour le moteur.
const STEP_TAU = { api: 6, engine: 3 };
/** Temps (s) pour rattraper le début d'une tranche quand l'étape précédente a fini tôt. */
// Temps de rattrapage : 0,45 s.
const CATCH_UP_TAU = 0.45;

/** Vitesse de lecture maximale de la vidéo (× temps réel) et écart toléré (s). */
// Vitesse maximale de la vidéo : 16 fois le temps réel.
export const VIDEO_MAX_RATE = 16;
/** Téléphone : lecture accélérée deux fois moins vite, le décodage vidéo chauffe l'appareil au lancement. */
// Sur téléphone : 8 fois.
export const VIDEO_MAX_RATE_HANDHELD = 8;
// Vitesse minimale de la vidéo : 0,1.
const VIDEO_MIN_RATE = 0.1;
// Retard toléré : 0,04 s.
const VIDEO_SLACK = 0.04;

/**
 * Progression (0–1) après `dt` secondes passées dans l'étape `step`.
 * 'done' : avance à vitesse constante `doneRate` (par seconde) jusqu'à 1. 'error' : figée.
 */
// Fonction advanceProgress.
export function advanceProgress(p, step, dt, doneRate = 1) {
  // Durée nulle ou négative : rien ne change.
  if (!(dt > 0)) return p;
  // Étape finale : avance à vitesse constante, jusqu'à 1.
  if (step === 'done') return Math.min(1, p + doneRate * dt);
  // Tranche de l'étape.
  const range = STEP_RANGE[step];
  // Étape inconnue (erreur) : rien ne change.
  if (!range) return p;
  // Début et fin de la tranche.
  const [floor, ceil] = range;
  // Nouvelle valeur.
  let next = p;
  // Sous le début de la tranche : la rattrape.
  if (next < floor) next += (floor - next) * (1 - Math.exp(-dt / CATCH_UP_TAU));
  // Avance vers la fin de la tranche, de moins en moins vite.
  next += (ceil - next) * (1 - Math.exp(-dt / STEP_TAU[step]));
  // Jamais au-delà de la fin, jamais en arrière.
  return Math.min(ceil, Math.max(p, next));
// Fin de advanceProgress.
}

/**
 * Vitesse (par seconde) de la fin de barre : l'app est prête, la barre se remplit en `seconds`,
 * le temps de laisser défiler la fin du survol en accéléré.
 */
// Fonction finishRate ; 1,5 s par défaut.
export function finishRate(p, seconds = 1.5) {
  // Ce qui reste à remplir, divisé par la durée.
  return Math.max(0, 1 - p) / seconds;
// Fin de finishRate.
}

/**
 * Vitesse de lecture qui ramène la vidéo sur la barre. `lag` = retard de la vidéo en secondes.
 * 0 = pause (la vidéo est à jour ou en avance : elle attend le chargement).
 */
// Fonction videoRate.
export function videoRate(lag, maxRate = VIDEO_MAX_RATE) {
  // Retard sous le seuil : pause.
  if (!(lag > VIDEO_SLACK)) return 0;
  // Quatre fois le retard, entre le minimum et le maximum.
  return Math.min(maxRate, Math.max(VIDEO_MIN_RATE, lag * 4));
// Fin de videoRate.
}
