// Importe la gamme de l'appareil et la lecture des informations du navigateur.
import { currentDeviceInfo, deviceTier } from './deviceTier.jsx';
// Rythme d'images et économie d'énergie, selon l'appareil.
// Ordinateur : qualité complète, densité de pixels jusqu'à 2, aucun plafond logiciel d'images.
// Appareil tenu en main (tous les smartphones, voir deviceTier.jsx) : profil de sa gamme (HANDHELD_TIERS) —
// 30 images par seconde en mouvement (24 en gamme basse), 20 / 15 / 10 au repos, densité 1,5 / 1,25 / 1,
// shaders allégés (QUALITY_TIERS). Un téléphone n'a pas de ventilateur : c'est ce qui évite la surchauffe.
// Sur tous les appareils, tant que l'écran de chargement recouvre la scène, le moteur ne dessine que quelques
// images par seconde (COVERED_FRAME_MS) : les shaders se compilent et les tuiles arrivent, sans chauffer pour rien.
// Sur téléphone, zoomé dans le système d'une planète (voir systemView.jsx) : le rythme en mouvement est tenu même au
// repos (systemProfile) ; les autres planètes et leurs satellites ne sont alors plus dessinés.
//
// Le rythme est tenu par `paceFrame`, quelle que soit la fréquence de l'écran (60, 120 Hz…). Pour TENIR ce rythme
// quand la scène est lourde, la résolution adaptative (Engine.adaptResolution) baisse la densité de pixels jusqu'au
// plancher du profil, et les tuiles envoyées au GPU par image sont réduites (`uploadShare`).

/** Durée d'une image à 60 images par seconde : référence des seuils de la résolution adaptative. */
// Déclare et exporte la durée d'une image à 60 images par seconde.
export const FULL_FRAME_MS = 1000 / 60;

/** Rythme visé et plafond du moteur, sur tous les appareils : 50 images par seconde. */
// Déclare et exporte le rythme visé : 50 images par seconde.
export const TARGET_FPS = 50;
// Déclare et exporte la durée d'une image à ce rythme : 20 ms.
export const TARGET_FRAME_MS = 1000 / TARGET_FPS;

// Déclare et exporte le profil d'un ordinateur : densité de pixels plafonnée à 2 dès le départ, plancher de la
// résolution adaptative à 0,75, anticrénelage, anisotropie de 8 (16 pour les tuiles des cartes : vues rasantes nettes,
// toujours bornée par la carte graphique). Aucun plafond logiciel d'images : 60 par seconde et plus.
export const DESKTOP_PROFILE = { handheld: false, tier: 'desktop', dprMax: 2, dprStart: 2, dprMin: 0.75, frameMs: 0, antialias: true, anisotropy: 8, tileAnisotropy: 16 };

/** Rythme d'un téléphone en mouvement : 30 images par seconde (haut et milieu de gamme), 24 en gamme basse. */
// Déclare et exporte le rythme d'un téléphone en mouvement.
export const HANDHELD_FPS = 30;

/**
 * Profils des appareils tenus en main, par gamme (voir deviceTier.jsx). Un téléphone n'a pas de ventilateur : le rythme
 * est plafonné (30 images par seconde en mouvement, moins au repos) et la densité de pixels limitée (un écran à
 * 3 pixels par point CSS dessiné à 3 coûte 4 fois plus qu'à 1,5, pour une différence à peine visible).
 *  - high (iPhone 15+, Android haut de gamme) : densité 1,5, anticrénelage, 30 / 20 images par seconde ;
 *  - mid (iPhone 11-14, Android milieu de gamme) : densité 1,25, sans anticrénelage, 30 / 15 ;
 *  - low (anciens téléphones) : densité 1, sans anticrénelage, 24 / 10, anisotropie réduite.
 */
// Déclare et exporte les profils par gamme (début).
export const HANDHELD_TIERS = {
  // Haut de gamme.
  high: { handheld: true, tier: 'high', dprMax: 1.5, dprStart: 1.5, dprMin: 1, frameMs: 1000 / HANDHELD_FPS, idleFrameMs: 1000 / 20, antialias: true, anisotropy: 8, tileAnisotropy: 8 },
  // Milieu de gamme.
  mid: { handheld: true, tier: 'mid', dprMax: 1.25, dprStart: 1.25, dprMin: 1, frameMs: 1000 / HANDHELD_FPS, idleFrameMs: 1000 / 15, antialias: false, anisotropy: 4, tileAnisotropy: 4 },
  // Gamme basse.
  low: { handheld: true, tier: 'low', dprMax: 1, dprStart: 1, dprMin: 0.75, frameMs: 1000 / 24, idleFrameMs: 1000 / 10, antialias: false, anisotropy: 2, tileAnisotropy: 2 },
// Fin des profils par gamme.
};
// Déclare et exporte le profil d'un appareil tenu en main de référence : le haut de gamme.
export const HANDHELD_PROFILE = HANDHELD_TIERS.high;

/** Profil d'un téléphone dans le système d'une planète : son rythme en mouvement tenu même au repos (pas de 20). */
// Déclare et exporte systemProfile : le profil de l'appareil.
export const systemProfile = (base) => ({ ...base, system: true });
// Déclare et exporte le profil du système d'une planète pour le haut de gamme.
export const SYSTEM_PROFILE = systemProfile(HANDHELD_PROFILE);

/** Au repos (aucun geste depuis IDLE_AFTER_MS) sur téléphone, et en mode économie d'énergie : 20 images par seconde. */
// Déclare et exporte la durée d'une image au repos : 50 ms.
export const IDLE_FRAME_MS = 1000 / 20;
// Déclare et exporte le délai sans geste après lequel l'appareil est au repos : 2,5 secondes.
export const IDLE_AFTER_MS = 2500;

/**
 * Durée visée d'une image (0 = sans limite) selon l'état du moteur :
 *  - scène recouverte par l'écran de chargement : 8 images par seconde ;
 *  - mode économie d'énergie (Paramètres) : 20 images par seconde, sur tous les appareils ;
 *  - téléphone au repos : 20 images par seconde ; dès qu'on touche l'écran ou que la caméra voyage : 50 ;
 *  - téléphone dans le système d'une planète : sans limite, même au repos ;
 *  - sinon le rythme du profil.
 */
// Déclare et exporte targetFrameMs : le profil et l'état (scène recouverte, économie d'énergie, repos).
export function targetFrameMs(profile, { covered = false, saving = false, idle = false } = {}) {
  // Scène recouverte : la durée d'une image sous l'écran de chargement.
  if (covered) return COVERED_FRAME_MS;
  // Économie d'énergie : la durée d'une image au repos.
  if (saving) return IDLE_FRAME_MS;
  // Appareil tenu en main au repos, hors du système d'une planète : la plus longue des deux durées, celle du profil ou celle du repos.
  if (profile.handheld && idle && !profile.system) return Math.max(profile.frameMs, profile.idleFrameMs ?? IDLE_FRAME_MS);
  // Sinon : la durée du profil.
  return profile.frameMs;
// Fin de targetFrameMs.
}

/** Durée d'une image tant que l'écran de chargement recouvre la scène : 8 images par seconde. */
// Déclare et exporte la durée d'une image sous l'écran de chargement : 125 ms.
export const COVERED_FRAME_MS = 1000 / 8;

/**
 * Échantillons par pixel des shaders coûteux (atmosphère, nuages, ciel), par gamme : l'ordinateur garde la qualité
 * complète (16 pas de diffusion × 6 vers le Soleil, bruit à 5 octaves) ; un téléphone en fait moins (ces shaders
 * tournent sur chaque pixel de l'écran : c'est la première source de chauffe).
 */
// Déclare et exporte la qualité des shaders par gamme.
export const QUALITY_TIERS = {
  // Ordinateur : qualité complète.
  desktop: { scatterSteps: 16, lightSteps: 6, octaves: 5 },
  // Haut de gamme.
  high: { scatterSteps: 12, lightSteps: 4, octaves: 4 },
  // Milieu de gamme.
  mid: { scatterSteps: 8, lightSteps: 4, octaves: 4 },
  // Gamme basse.
  low: { scatterSteps: 6, lightSteps: 3, octaves: 3 },
// Fin des qualités.
};

/** Somme des amplitudes d'un bruit à `octaves` octaves (0,5 + 0,25 + …) : sert à garder la même luminosité. */
// Déclare et exporte fbmNorm : 1 − 0,5 puissance le nombre d'octaves.
export const fbmNorm = (octaves) => 1 - 0.5 ** octaves;

/** Appareil tenu en main : écran tactile sans souris ni pavé (téléphone, tablette). */
// Déclare et exporte isHandheld : la fenêtre du navigateur, ou null hors d'un navigateur.
export function isHandheld(win = typeof window === 'undefined' ? null : window) {
  // match : vrai quand la fenêtre répond à une requête média.
  const match = (query) => Boolean(win?.matchMedia?.(query).matches);
  // Vrai si le pointeur principal est imprécis et qu'aucun pointeur précis n'est présent.
  return match('(pointer: coarse)') && !match('(any-pointer: fine)');
// Fin de isHandheld.
}

/** Profil de rendu de l'appareil (selon sa gamme sur téléphone) : { handheld, tier, dprMax, dprStart, dprMin, frameMs (0 = sans limite), antialias, anisotropy }. */
// Déclare et exporte renderProfile : la fenêtre.
export function renderProfile(win = typeof window === 'undefined' ? null : window, device = currentDeviceInfo(win)) {
  // Appareil tenu en main : le profil de sa gamme ; sinon le profil d'ordinateur.
  return isHandheld(win) ? HANDHELD_TIERS[deviceTier(device)] : DESKTOP_PROFILE;
// Fin de renderProfile.
}

/**
 * Limiteur d'images : faut-il sauter cet appel de la boucle d'affichage ? `elapsedMs` = temps écoulé depuis la
 * dernière image rendue. La tolérance absorbe l'irrégularité des rappels du navigateur : sur un écran à 60 Hz, une
 * image sur deux est rendue (30 par seconde), sans dériver vers une sur trois.
 */
// Déclare et exporte skipFrame : le temps écoulé, la durée visée et la tolérance (4 ms par défaut).
export function skipFrame(elapsedMs, frameMs, toleranceMs = 4) {
  // Vrai si une durée est visée et que le temps écoulé, positif, est inférieur à cette durée moins la tolérance.
  return frameMs > 0 && elapsedMs >= 0 && elapsedMs < frameMs - toleranceMs;
// Fin de skipFrame.
}

/**
 * Cadenceur : plafonne le moteur à `frameMs` par image en moyenne, quelle que soit la fréquence de l'écran.
 * `skipFrame` ne sait rendre qu'une image sur N (60, 30, 20… sur un écran à 60 Hz) ; 50 images par seconde demande de
 * rendre 5 rappels sur 6 à 60 Hz, 5 sur 12 à 120 Hz. Le cadenceur tient donc une échéance (`pacer.due`) qui avance de
 * `frameMs` à chaque image rendue : un rappel arrivé avant l'échéance est sauté. Si le moteur est plus lent que le
 * rythme visé, l'échéance est déjà passée à chaque rappel : rien n'est sauté, aucun retard ne s'accumule.
 * @returns {boolean} vrai s'il faut rendre cette image
 */
// Déclare et exporte paceFrame : le cadenceur, l'instant, la durée visée et la tolérance (1 ms par défaut).
export function paceFrame(pacer, now, frameMs, toleranceMs = 1) {
  // Sans durée visée : l'échéance est remise à 0 et l'image est rendue.
  if (!(frameMs > 0)) { pacer.due = 0; return true; }
  // Avant l'échéance, si elle n'est pas à plus de quatre images dans le futur : l'image est sautée.
  if (now + toleranceMs < pacer.due && pacer.due - now < 4 * frameMs) return false; // (échéance aberrante : on rend)
  // Nouvelle échéance : l'ancienne plus une image, sans jamais être dans le passé.
  pacer.due = Math.max(pacer.due + frameMs, now);
  // L'image est rendue.
  return true;
// Fin de paceFrame.
}

/**
 * Part des envois de tuiles au GPU autorisée cette image (1, 1/2 ou 1/4), selon la durée moyenne des images ramenée
 * à l'échelle 60 images par seconde (16,7 ms = rythme visé tenu). Quand le rythme fléchit pendant un zoom, les tuiles
 * arrivent un peu plus étalées au lieu de faire chuter l'affichage.
 */
// Déclare et exporte uploadShare : la durée moyenne normalisée d'une image.
export function uploadShare(avgNormalizedMs) {
  // Plus de 19,5 ms : un quart des envois.
  if (avgNormalizedMs > 19.5) return 0.25;
  // Plus de 17,8 ms : la moitié.
  if (avgNormalizedMs > 17.8) return 0.5;
  // Sinon : tous les envois.
  return 1;
// Fin de uploadShare.
}

/** Durée d'image ramenée à l'échelle « 60 images par seconde », pour juger la fluidité quel que soit le rythme visé. */
// Déclare et exporte normalizedFrameMs : la durée brute et la durée visée.
export function normalizedFrameMs(rawDt, frameMs) {
  // Avec une durée visée : la durée brute multipliée par le rapport entre 16,7 ms et cette durée ; sinon la durée brute.
  return frameMs > 0 ? rawDt * (FULL_FRAME_MS / frameMs) : rawDt;
// Fin de normalizedFrameMs.
}

/** Qualité des shaders de l'appareil courant, lue une fois au chargement (ordinateur, tests : qualité complète). */
// Déclare et exporte QUALITY : celle de la gamme du profil de l'appareil.
export const QUALITY = QUALITY_TIERS[renderProfile().tier] || QUALITY_TIERS.desktop;
