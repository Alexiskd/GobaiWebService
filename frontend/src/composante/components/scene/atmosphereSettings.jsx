// Importe les fenêtres de temps proposées pour les incendies.
import { FIRE_WINDOWS_H } from '../../../moteur/engine/atmosphere/fireMath';
// Importe la mise en forme des cyclones et leur texte court.
import { cycloneSummary, normalizeCyclones } from '../../../moteur/engine/atmosphere/cycloneMath';

// Réglages des calques atmosphériques (sans React, donc testables seuls) : valeurs par défaut, lecture sûre de ce
// qui a été gardé dans le navigateur, bornes, et textes d'aide de la fenêtre des paramètres.

/** Clé du stockage du navigateur. */
// Déclare et exporte la clé : « gobai:atmosphere ».
export const ATMOSPHERE_KEY = 'gobai:atmosphere';
/** Réglages par défaut : tous les calques éteints, opacité 0,9, intensité 1, fenêtre de 24 h pour les incendies. */
// Déclare et exporte les réglages par défaut (début).
export const ATMOSPHERE_DEFAULTS = {
  // Incendies.
  fires: { on: false, opacity: 0.9, intensity: 1, windowHours: 24 },
  // Cyclones.
  cyclones: { on: false, opacity: 0.9, intensity: 1 },
  // Foudre.
  lightning: { on: false, opacity: 0.9, intensity: 1 },
// Fin des réglages par défaut.
};
/** Calques prévus aux lots suivants, affichés comme « à venir » (aucune donnée n'est représentée sans source). */
// Déclare et exporte la liste des calques à venir.
export const ATMOSPHERE_UPCOMING = ['Orages', 'Précipitations', 'Radar', 'Vents', 'Courants-jets', 'Aérosols', 'Poussières', 'Pollution', 'Fumées', 'Brouillard'];

// clamp : borne une valeur numérique ; illisible : la valeur par défaut.
const clamp = (v, min, max, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Number(v))) : fallback);

/** Réglages complets et bornés, à partir d'un objet partiel (gardé dans le navigateur, ou modifié). */
// Déclare et exporte sanitizeAtmosphere : l'objet partiel.
export function sanitizeAtmosphere(raw) {
  // Partie des incendies, celle des cyclones et celle de la foudre.
  const f = raw?.fires ?? {}, c = raw?.cyclones ?? {}, l = raw?.lightning ?? {};
  // Valeurs par défaut.
  const df = ATMOSPHERE_DEFAULTS.fires, dc = ATMOSPHERE_DEFAULTS.cyclones, dl = ATMOSPHERE_DEFAULTS.lightning;
  // Réglages complets (début).
  return {
    // Incendies : allumés, opacité, intensité, fenêtre (une des fenêtres proposées, sinon 24 h).
    fires: { on: f.on === true, opacity: clamp(f.opacity, 0.1, 1, df.opacity), intensity: clamp(f.intensity, 0.5, 2, df.intensity), windowHours: FIRE_WINDOWS_H.includes(Number(f.windowHours)) ? Number(f.windowHours) : df.windowHours },
    // Cyclones : allumés, opacité, intensité.
    cyclones: { on: c.on === true, opacity: clamp(c.opacity, 0.1, 1, dc.opacity), intensity: clamp(c.intensity, 0.5, 2, dc.intensity) },
    // Foudre : allumée, opacité, intensité.
    lightning: { on: l.on === true, opacity: clamp(l.opacity, 0.1, 1, dl.opacity), intensity: clamp(l.intensity, 0.5, 2, dl.intensity) },
  // Fin des réglages.
  };
// Fin de sanitizeAtmosphere.
}

/** Réglages gardés dans le navigateur, ou les valeurs par défaut (stockage refusé ou illisible). */
// Déclare et exporte storedAtmosphere.
export function storedAtmosphere() {
  // Début du bloc protégé.
  try {
    // Texte gardé.
    const text = globalThis.localStorage?.getItem(ATMOSPHERE_KEY);
    // Lu et borné ; absent : valeurs par défaut.
    return sanitizeAtmosphere(text ? JSON.parse(text) : null);
  // Stockage refusé ou texte illisible :
  } catch {
    // valeurs par défaut.
    return sanitizeAtmosphere(null);
  // Fin du bloc protégé.
  }
// Fin de storedAtmosphere.
}

/** Garde les réglages dans le navigateur ; un refus du stockage est ignoré (les réglages valent pour la session). */
// Déclare et exporte rememberAtmosphere : les réglages.
export function rememberAtmosphere(settings) {
  // Début du bloc protégé.
  try {
    // Écrit le texte JSON.
    globalThis.localStorage?.setItem(ATMOSPHERE_KEY, JSON.stringify(settings));
  // Refus : ignoré.
  } catch { /* stockage refusé */ }
// Fin de rememberAtmosphere.
}

// count : un nombre écrit à la française.
const count = (n) => Number(n || 0).toLocaleString('fr-FR');

/** Texte d'aide des incendies, d'après la réponse du serveur (null : chargement ; 'erreur' : échec). */
// Déclare et exporte fireHint : la réponse, ou son état.
export function fireHint(info) {
  // Pas encore de réponse.
  if (info === null || info === undefined) return 'Points chauds satellite (24 h) et incendies confirmés · NASA FIRMS, NASA EONET';
  // Échec.
  if (info === 'erreur') return 'Source indisponible pour le moment · NASA FIRMS, NASA EONET';
  // Nombre de points chauds : somme des cellules.
  const hot = (Array.isArray(info.cells?.n) ? info.cells.n : []).reduce((s, v) => s + (Number(v) || 0), 0);
  // Nombre d'incendies confirmés.
  const conf = Array.isArray(info.confirmed) ? info.confirmed.length : 0;
  // Mention de péremption.
  const stale = info.stale ? ' · une source ne répond plus : dernières données connues' : '';
  // Texte complet.
  return `${count(hot)} points chauds détectés en 24 h (non confirmés) · ${count(conf)} incendie${conf > 1 ? 's' : ''} confirmé${conf > 1 ? 's' : ''} (anneaux) · NASA FIRMS (VIIRS, MODIS), NASA EONET${stale}`;
// Fin de fireHint.
}

/** Texte d'aide des cyclones, d'après la réponse du serveur (null : chargement ; 'erreur' : échec). */
// Déclare et exporte cycloneHint : la réponse, ou son état.
export function cycloneHint(info) {
  // Sources, en clair.
  const src = 'NOAA NHC (positions, prévision officielle, rayons de vent), JTWC (NASA EONET), GDACS';
  // Pas encore de réponse.
  if (info === null || info === undefined) return `Cyclones actifs confirmés, trajectoire observée · ${src}`;
  // Échec.
  if (info === 'erreur') return `Source indisponible pour le moment · ${src}`;
  // Cyclones nettoyés.
  const list = normalizeCyclones(info.cyclones);
  // Écartés (aucune position récente).
  const excluded = Array.isArray(info.excluded) ? info.excluded.length : 0;
  // Mention des écartés.
  const ex = excluded ? ` · ${excluded} suivi${excluded > 1 ? 's' : ''} écarté${excluded > 1 ? 's' : ''} (aucune position récente)` : '';
  // Mention de péremption.
  const stale = info.stale ? ' · une source ne répond plus' : '';
  // Aucun cyclone : texte explicite.
  if (!list.length) return `Aucun cyclone actif confirmé${ex} · ${src}${stale}`;
  // Liste des cyclones, puis les sources.
  return `${list.map(cycloneSummary).join(' ; ')}${ex} · ${src}${stale}`;
// Fin de cycloneHint.
}

/** Texte d'aide de la foudre (null : chargement ; 'erreur' : échec ; `far` : point visé trop lointain pour le détail). */
// Déclare et exporte lightningHint : la réponse, ou son état, et l'éloignement.
export function lightningHint(info, far = false) {
  // Source, en clair.
  const src = 'Xweather (Vaisala)';
  // Rappel du détail : rayon de 100 km en accès standard.
  const zoom = far ? ' · rapprochez-vous (moins de 6 000 km) pour les impacts un par un' : '';
  // Pas encore de réponse.
  if (info === null || info === undefined) return `Zones orageuses du monde et impacts des 5 dernières minutes · ${src}${zoom}`;
  // Échec.
  if (info === 'erreur') return `Source indisponible pour le moment · ${src}`;
  // Indisponible (identifiants absents) : la raison.
  if (info.available === false) return `${info.reason || 'Indisponible'} · ${src}`;
  // Accès refusé par l'API, sans aucune donnée.
  if (info.reason) return `Accès refusé par Xweather (${info.reason}) : vérifier que l'abonnement inclut la foudre · ${src}`;
  // Statistiques.
  const st = info.stats ?? {};
  // Texte complet.
  return `${count(st.count)} impact${st.count > 1 ? 's' : ''} en 5 min dans 100 km autour du point visé (${count(st.cg)} nuage-sol, ${count(st.ic)} intra-nuage, ${st.perMin ?? 0}/min)${st.truncated ? ', limite de 1 000 atteinte' : ''} · relecture ×10 · ${src}${info.stale ? ' · dernières données connues' : ''}${zoom}`;
// Fin de lightningHint.
}
