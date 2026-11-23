/**
 * Service earth-globe : applique le profil d'affichage d'un astre (voir earth-globe.profile.js) à sa description et
 * répond aux questions du moteur de tuiles (affichage, plafond du relief, relief par défaut). Fonctions pures.
 */

// Importe les profils et le profil par défaut.
import { DEFAULT_GLOBE_PROFILE, GLOBE_PROFILES } from './earth-globe.profile.js';

/** Profil d'un astre : celui de la table, sinon le profil par défaut. */
// Déclare et exporte globeProfile : l'identifiant de l'astre et la table (injectable pour les tests).
export function globeProfile(id, profiles = GLOBE_PROFILES) {
  // L'entrée de la table, ou le profil par défaut.
  return profiles[id] ?? DEFAULT_GLOBE_PROFILE;
// Fin de globeProfile.
}

/** Description d'un astre tuilé complétée par son profil (affichage, plafond et défaut du relief). */
// Déclare et exporte withGlobeProfile : la description de l'astre et la table.
export function withGlobeProfile(cfg, profiles = GLOBE_PROFILES) {
  // Le profil de l'astre.
  const p = globeProfile(cfg.id, profiles);
  // La description, avec l'affichage et, s'ils sont donnés, le plafond et le défaut du relief.
  return {
    // La description d'origine.
    ...cfg,
    // L'affichage : « quadtree » ou « hex ».
    display: p.display,
    // Le plafond d'altitude du relief, s'il est donné.
    ...(p.reliefMaxKm !== undefined ? { reliefMaxKm: p.reliefMaxKm } : {}),
    // Le relief allumé par défaut, s'il est donné.
    ...(p.reliefDefaultOn !== undefined ? { reliefDefaultOn: p.reliefDefaultOn } : {}),
  // Fin de la description.
  };
// Fin de withGlobeProfile.
}

/** Vrai si l'astre s'affiche en cellules hexagonales (tout affichage autre que « quadtree »). */
// Déclare et exporte usesHexCells : la description de l'astre.
export const usesHexCells = (body) => body?.display !== 'quadtree';

/** Plafond d'altitude (km) du relief : celui de l'astre, sinon `legacyCap` (1 km pour la Terre avant ce profil). */
// Déclare et exporte reliefCapKm : la description de l'astre et le plafond d'avant.
export function reliefCapKm(body, legacyCap) {
  // Le plafond de l'astre s'il est un nombre (Infinity compris), sinon celui d'avant.
  return typeof body?.reliefMaxKm === 'number' ? body.reliefMaxKm : legacyCap;
// Fin de reliefCapKm.
}

/**
 * Relief affiché d'après la valeur gardée dans le navigateur (« gobai:relief-3d ») : nombre positif = allumé,
 * « 0 » ou moins = coupé, absent ou illisible = le défaut du profil.
 */
// Déclare et exporte reliefShown : la valeur gardée et le défaut.
export function reliefShown(raw, defaultOn = false) {
  // Rien de gardé : le défaut.
  if (raw === null || raw === undefined || raw === '') return Boolean(defaultOn);
  // Valeur en nombre.
  const n = Number(raw);
  // Illisible : le défaut ; sinon allumé si positif.
  return Number.isFinite(n) ? n > 0 : Boolean(defaultOn);
// Fin de reliefShown.
}
