// Appareils acceptés sur téléphone : iPhone 15, Samsung Galaxy équivalent et modèles équivalents des autres marques.
// En dessous, l'app (rendu 3D en continu) fait chauffer l'appareil : on affiche un mot d'excuse à la place
// (composante AppareilNonCompatible) et rien de lourd n'est chargé.
//
// Un navigateur ne donne pas le modèle exact du téléphone ; on s'appuie sur ce qu'il expose :
//  - iPhone : taille de l'écran en points (l'iPhone 15 fait 393 × 852, comme l'iPhone 14 Pro qui a la même puce A16)
//    et version d'iOS (l'iPhone 15 est sorti avec iOS 17) ;
//  - Android : mémoire vive et nombre de cœurs annoncés (un haut de gamme de 2023 a au moins 8 Go et 8 cœurs).
// Une information absente ne bloque pas : mieux vaut laisser passer un appareil que refuser à tort un téléphone récent.
// Les ordinateurs, les tablettes et les robots d'indexation (référencement) ne sont pas concernés.

// Petit côté minimal de l'écran d'un iPhone : 393 points.
export const MIN_IPHONE_SCREEN_PT = 393; // petit côté de l'écran de l'iPhone 15
// Version minimale d'iOS : 17.
export const MIN_IOS_VERSION = 17;
// Mémoire minimale d'un téléphone Android : 8 Go.
export const MIN_ANDROID_MEMORY_GB = 8;
// Nombre minimal de cœurs d'un téléphone Android : 8.
export const MIN_ANDROID_CORES = 8;

// Mots qui signalent un robot d'indexation ou un aperçu de lien.
const BOT = /bot|crawl|spider|slurp|lighthouse|pagespeed|headless|facebookexternalhit|whatsapp|preview/i;

/**
 * L'appareil peut-il ouvrir l'app ? `device` : { userAgent, screenWidth, screenHeight, deviceMemory, hardwareConcurrency }.
 */
// Fonction isDeviceSupported.
export function isDeviceSupported(device = {}) {
  // Identité du navigateur.
  const ua = String(device.userAgent || '');
  // Robot : accepté.
  if (BOT.test(ua)) return true;

  // iPhone ou iPod :
  if (/iPhone|iPod/.test(ua)) {
    // version d'iOS ;
    const ios = Number(/OS (\d+)[_.]/.exec(ua)?.[1]);
    // connue et trop ancienne : refusé ;
    if (Number.isFinite(ios) && ios > 0 && ios < MIN_IOS_VERSION) return false;
    // petit côté de l'écran ;
    const side = Math.min(Number(device.screenWidth) || 0, Number(device.screenHeight) || 0);
    // accepté s'il est inconnu ou assez grand.
    return side === 0 || side >= MIN_IPHONE_SCREEN_PT;
  // Fin du cas.
  }

  // Téléphone Android :
  if (/Android/.test(ua) && /Mobile/.test(ua)) {
    // mémoire annoncée ;
    const memory = Number(device.deviceMemory);
    // connue et trop faible : refusé ;
    if (Number.isFinite(memory) && memory > 0 && memory < MIN_ANDROID_MEMORY_GB) return false;
    // nombre de cœurs ;
    const cores = Number(device.hardwareConcurrency);
    // connu et trop faible : refusé ;
    if (Number.isFinite(cores) && cores > 0 && cores < MIN_ANDROID_CORES) return false;
    // sinon accepté.
    return true;
  // Fin du cas.
  }

  // Tout autre appareil : accepté.
  return true; // ordinateur, tablette
// Fin de isDeviceSupported.
}

/** Lecture des informations du navigateur courant (rien côté serveur ou en test). */
// Fonction currentDevice ; la fenêtre du navigateur par défaut, s'il y en a une.
export function currentDevice(win = typeof window === 'undefined' ? null : window) {
  // Son objet navigator.
  const nav = win?.navigator;
  // Renvoie
  return {
    // l'identité du navigateur ;
    userAgent: nav?.userAgent || '',
    // la largeur de l'écran ;
    screenWidth: win?.screen?.width,
    // sa hauteur ;
    screenHeight: win?.screen?.height,
    // la mémoire annoncée ;
    deviceMemory: nav?.deviceMemory,
    // le nombre de cœurs.
    hardwareConcurrency: nav?.hardwareConcurrency,
  // Fin de l'objet.
  };
// Fin de currentDevice.
}
