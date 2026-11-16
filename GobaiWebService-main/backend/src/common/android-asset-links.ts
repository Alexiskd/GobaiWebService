/**
 * Lien entre le site et son application Android (Trusted Web Activity) : contenu de `/.well-known/assetlinks.json`.
 * Android le lit pour vérifier que l'application et le site ont le même propriétaire ; sans lui, l'application
 * affiche la barre d'adresse du navigateur. https://developers.google.com/digital-asset-links
 *
 *  - ANDROID_PACKAGE_NAME        : identifiant de l'application (défaut : com.gobaispace.twa) ;
 *  - ANDROID_SHA256_FINGERPRINTS : empreintes SHA-256 des certificats de signature, séparées par des virgules
 *                                  (clé d'import locale et clé de signature Google Play).
 */
// Forme d'une déclaration « Digital Asset Links », telle qu'Android l'attend.
export interface AssetLink {
  // relation : les droits accordés à l'application.
  relation: string[];
  // target : l'application visée, avec son type (android_app), son nom de paquet et les empreintes de ses certificats.
  target: { namespace: 'android_app'; package_name: string; sha256_cert_fingerprints: string[] };
// Fin de AssetLink.
}

// Nom de paquet utilisé quand ANDROID_PACKAGE_NAME n'est pas défini ou n'est pas valide.
export const DEFAULT_ANDROID_PACKAGE = 'com.gobaispace.twa';
// Forme d'une empreinte valide : 32 paires de chiffres hexadécimaux en majuscules, séparées par « : » (31 paires suivies de « : », puis une dernière).
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
// Forme d'un nom de paquet Android valide : au moins deux segments séparés par des points, chacun commençant par une lettre.
const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

/** Empreintes valides (64 chiffres hexadécimaux, avec ou sans « : »), normalisées en `AA:BB:…`. */
// Fonction parseFingerprints : reçoit le texte brut de la variable d'environnement, peut-être absent, et renvoie la liste des empreintes valides.
export function parseFingerprints(raw: string | undefined): string[] {
  // Coupe le texte (vide s'il est absent) aux virgules et aux espaces, transforme chaque morceau, puis retire les doublons en passant par un Set :
  return [...new Set((raw ?? '').split(/[,\s]+/).map((s) => {
    // retire les « : » et met en majuscules ;
    const hex = s.replace(/:/g, '').toUpperCase();
    // si le résultat fait exactement 64 chiffres hexadécimaux, le recoupe en paires jointes par « : » ; sinon garde le morceau d'origine, nettoyé et en majuscules.
    return /^[0-9A-F]{64}$/.test(hex) ? hex.match(/.{2}/g)!.join(':') : s.trim().toUpperCase();
  // Ne garde que les morceaux qui ont la forme d'une empreinte, et referme le tableau sans doublons.
  }).filter((s) => FINGERPRINT.test(s)))];
// Fin de parseFingerprints.
}

/** Déclaration à servir ; liste vide tant qu'aucune empreinte valide n'est configurée. */
// Fonction androidAssetLinks : reçoit les variables d'environnement et renvoie le contenu de assetlinks.json.
export function androidAssetLinks(env: Record<string, string | undefined>): AssetLink[] {
  // Empreintes valides lues dans ANDROID_SHA256_FINGERPRINTS.
  const fingerprints = parseFingerprints(env.ANDROID_SHA256_FINGERPRINTS);
  // Nom de paquet demandé, espaces retirés, ou undefined.
  const name = env.ANDROID_PACKAGE_NAME?.trim();
  // Nom retenu : celui demandé s'il est valide, sinon le nom par défaut.
  const packageName = name && PACKAGE.test(name) ? name : DEFAULT_ANDROID_PACKAGE;
  // Sans aucune empreinte valide : liste vide, aucun lien n'est déclaré.
  if (!fingerprints.length) return [];
  // Sinon une liste d'une seule déclaration :
  return [{
    // droit accordé : ouvrir toutes les adresses du site dans l'application ;
    relation: ['delegate_permission/common.handle_all_urls'],
    // application visée : une application Android, son nom de paquet et ses empreintes.
    target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
  // Fin de la déclaration et de la liste.
  }];
// Fin de androidAssetLinks.
}
