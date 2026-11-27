// Gamme d'un appareil tenu en main (téléphone, tablette) : « high », « mid » ou « low ».
// Tous les smartphones ouvrent l'app ; la gamme règle seulement la charge du rendu (voir powerSaver.jsx) :
// densité de pixels, rythme d'images, anticrénelage, finesse des shaders et des tuiles.
//
// Un navigateur ne donne pas le modèle exact du téléphone ; on s'appuie sur ce qu'il expose :
//  - iPhone : version d'iOS et petit côté de l'écran en points (iPhone 15 : iOS 17, 393 pt) ;
//  - Android : mémoire vive annoncée (navigator.deviceMemory, plafonnée à 8 par Chrome) et nombre de cœurs ;
//  - autres (tablettes, navigateurs qui cachent la mémoire) : gamme moyenne par défaut.
// Une information absente ne fait jamais descendre en gamme basse : la résolution adaptative du moteur
// (Engine.adaptResolution) corrige ensuite en direct si l'appareil peine.

/** Gammes, de la plus chargée à la plus légère. */
// Déclare et exporte la liste des gammes.
export const TIERS = ['high', 'mid', 'low'];

// Seuils iPhone : haut de gamme à partir d'iOS 17 et d'un écran de 393 pt (iPhone 15 et au-delà).
// Déclare et exporte la version d'iOS du haut de gamme.
export const HIGH_IOS = 17;
// Déclare et exporte le petit côté d'écran du haut de gamme (points).
export const HIGH_IPHONE_PT = 393;
// Déclare et exporte la version d'iOS de la gamme moyenne (iPhone 11 et au-delà le plus souvent).
export const MID_IOS = 15;
// Déclare et exporte le petit côté d'écran de la gamme moyenne (iPhone 8 / SE : 375 pt et moins → gamme basse).
export const MID_IPHONE_PT = 376;

// Seuils Android : mémoire (Go) et cœurs.
// Déclare et exporte la mémoire du haut de gamme.
export const HIGH_ANDROID_GB = 8;
// Déclare et exporte le nombre de cœurs du haut de gamme.
export const HIGH_ANDROID_CORES = 8;
// Déclare et exporte la mémoire de la gamme moyenne.
export const MID_ANDROID_GB = 4;

/**
 * Gamme de l'appareil. `device` : { userAgent, screenWidth, screenHeight, deviceMemory, hardwareConcurrency }.
 * Fonction pure.
 * @returns {'high'|'mid'|'low'}
 */
// Déclare et exporte deviceTier : les informations de l'appareil (début).
export function deviceTier(device = {}) {
  // Identité du navigateur.
  const ua = String(device.userAgent || '');
  // Mémoire annoncée (Go), si elle est connue.
  const memory = Number(device.deviceMemory);
  // Mémoire connue ?
  const hasMemory = Number.isFinite(memory) && memory > 0;
  // Nombre de cœurs, s'il est connu.
  const cores = Number(device.hardwareConcurrency);
  // Cœurs connus ?
  const hasCores = Number.isFinite(cores) && cores > 0;

  // iPhone ou iPod (début).
  if (/iPhone|iPod/.test(ua)) {
    // Version d'iOS (0 si inconnue).
    const ios = Number(/OS (\d+)[_.]/.exec(ua)?.[1]) || 0;
    // Petit côté de l'écran (0 si inconnu).
    const side = Math.min(Number(device.screenWidth) || 0, Number(device.screenHeight) || 0);
    // Version et écran récents (ou inconnus) : haut de gamme.
    if ((ios === 0 || ios >= HIGH_IOS) && (side === 0 || side >= HIGH_IPHONE_PT)) return 'high';
    // Petit écran (iPhone 8, SE) ou iOS ancien : gamme basse.
    if ((side > 0 && side < MID_IPHONE_PT) || (ios > 0 && ios < MID_IOS)) return 'low';
    // Sinon : gamme moyenne (iPhone 11 à 14 non Pro).
    return 'mid';
  // Fin du cas iPhone.
  }

  // Android (téléphone ou tablette) (début).
  if (/Android/.test(ua)) {
    // Mémoire et cœurs du haut de gamme : haut de gamme.
    if (hasMemory && memory >= HIGH_ANDROID_GB && (!hasCores || cores >= HIGH_ANDROID_CORES)) return 'high';
    // Mémoire connue et faible, ou très peu de cœurs : gamme basse.
    if ((hasMemory && memory < MID_ANDROID_GB) || (hasCores && cores < 4)) return 'low';
    // Sinon : gamme moyenne.
    return 'mid';
  // Fin du cas Android.
  }

  // iPad et autres tablettes : haut de gamme si la mémoire le dit, sinon gamme moyenne.
  if (hasMemory && memory >= HIGH_ANDROID_GB) return 'high';
  // Mémoire connue et faible : gamme basse.
  if (hasMemory && memory < MID_ANDROID_GB) return 'low';
  // Par défaut : gamme moyenne.
  return 'mid';
// Fin de deviceTier.
}

/** Informations du navigateur courant (objet vide hors d'un navigateur ou dans les tests). */
// Déclare et exporte currentDeviceInfo : la fenêtre du navigateur, s'il y en a une.
export function currentDeviceInfo(win = typeof window === 'undefined' ? null : window) {
  // Son objet navigator.
  const nav = win?.navigator;
  // Renvoie l'identité, la taille de l'écran, la mémoire et le nombre de cœurs.
  return {
    // Identité du navigateur.
    userAgent: nav?.userAgent || '',
    // Largeur de l'écran.
    screenWidth: win?.screen?.width,
    // Hauteur de l'écran.
    screenHeight: win?.screen?.height,
    // Mémoire annoncée.
    deviceMemory: nav?.deviceMemory,
    // Nombre de cœurs.
    hardwareConcurrency: nav?.hardwareConcurrency,
  // Fin de l'objet.
  };
// Fin de currentDeviceInfo.
}
