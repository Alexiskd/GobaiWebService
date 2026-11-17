// Importe les fenêtres de temps proposées pour les incendies.
import { FIRE_WINDOWS_H } from '../../../moteur/engine/atmosphere/fireMath';
// Importe la mise en forme des cyclones et leur texte court.
import { cycloneSummary, normalizeCyclones } from '../../../moteur/engine/atmosphere/cycloneMath';
// Importe la lecture des images radar.
import { normalizeFrames } from '../../../moteur/engine/atmosphere/radarMath';
// Importe la lecture des aérosols et le choix du produit.
import { aerosolProduct, normalizeAerosols } from '../../../moteur/engine/atmosphere/aerosolMath';
// Importe les niveaux des vents et la lecture de leur réponse.
import { FLOW_LEVEL_IDS, normalizeWinds } from '../../../moteur/engine/atmosphere/flowMath';

// Réglages des calques atmosphériques (sans React, donc testables seuls) : valeurs par défaut, lecture sûre de ce
// qui a été gardé dans le navigateur, bornes, et textes d'aide de la fenêtre des paramètres.

/** Clé du stockage du navigateur. */
// Déclare et exporte la clé : « gobai:atmosphere ».
export const ATMOSPHERE_KEY = 'gobai:atmosphere';
/**
 * Réglages par défaut : tous les calques éteints, opacité 0,9 (0,85 pour le radar et les aérosols), intensité 1,
 * fenêtre de 24 h pour les incendies ; radar animé, limite de portée des radars affichée ; aérosols : épaisseur optique ;
 * vents : niveau des courants-jets.
 */
// Déclare et exporte les réglages par défaut (début).
export const ATMOSPHERE_DEFAULTS = {
  // Incendies.
  fires: { on: false, opacity: 0.9, intensity: 1, windowHours: 24 },
  // Cyclones.
  cyclones: { on: false, opacity: 0.9, intensity: 1 },
  // Foudre.
  lightning: { on: false, opacity: 0.9, intensity: 1 },
  // Précipitations (radar).
  precipitation: { on: false, opacity: 0.85, intensity: 1, animate: true, coverage: true },
  // Orages.
  storms: { on: false, opacity: 0.9, intensity: 1 },
  // Aérosols : épaisseur optique observée par défaut, prévision animée.
  aerosols: { on: false, opacity: 0.85, intensity: 1, product: 'aod', animate: true },
  // Vents : niveau des courants-jets par défaut, axes affichés.
  winds: { on: false, opacity: 0.85, intensity: 1, level: '250hPa', jets: true },
// Fin des réglages par défaut.
};
/** Calques prévus aux lots suivants, affichés comme « à venir » (aucune donnée n'est représentée sans source). */
// Déclare et exporte la liste des calques à venir.
export const ATMOSPHERE_UPCOMING = ['Pollution gazeuse', 'Brouillard'];

// clamp : borne une valeur numérique ; illisible : la valeur par défaut.
const clamp = (v, min, max, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Number(v))) : fallback);

/** Réglages complets et bornés, à partir d'un objet partiel (gardé dans le navigateur, ou modifié). */
// Déclare et exporte sanitizeAtmosphere : l'objet partiel.
export function sanitizeAtmosphere(raw) {
  // Partie des incendies, des cyclones, de la foudre, du radar et des orages.
  const f = raw?.fires ?? {}, c = raw?.cyclones ?? {}, l = raw?.lightning ?? {}, p = raw?.precipitation ?? {}, o = raw?.storms ?? {}, a = raw?.aerosols ?? {}, w = raw?.winds ?? {};
  // Valeurs par défaut.
  const df = ATMOSPHERE_DEFAULTS.fires, dc = ATMOSPHERE_DEFAULTS.cyclones, dl = ATMOSPHERE_DEFAULTS.lightning, dp = ATMOSPHERE_DEFAULTS.precipitation, ds = ATMOSPHERE_DEFAULTS.storms, da = ATMOSPHERE_DEFAULTS.aerosols, dw = ATMOSPHERE_DEFAULTS.winds;
  // Réglages complets (début).
  return {
    // Incendies : allumés, opacité, intensité, fenêtre (une des fenêtres proposées, sinon 24 h).
    fires: { on: f.on === true, opacity: clamp(f.opacity, 0.1, 1, df.opacity), intensity: clamp(f.intensity, 0.5, 2, df.intensity), windowHours: FIRE_WINDOWS_H.includes(Number(f.windowHours)) ? Number(f.windowHours) : df.windowHours },
    // Cyclones : allumés, opacité, intensité.
    cyclones: { on: c.on === true, opacity: clamp(c.opacity, 0.1, 1, dc.opacity), intensity: clamp(c.intensity, 0.5, 2, dc.intensity) },
    // Foudre : allumée, opacité, intensité.
    lightning: { on: l.on === true, opacity: clamp(l.opacity, 0.1, 1, dl.opacity), intensity: clamp(l.intensity, 0.5, 2, dl.intensity) },
    // Radar : allumé, opacité, intensité, animation et couverture (allumées sauf refus explicite).
    precipitation: { on: p.on === true, opacity: clamp(p.opacity, 0.1, 1, dp.opacity), intensity: clamp(p.intensity, 0.5, 2, dp.intensity), animate: p.animate !== false, coverage: p.coverage !== false },
    // Orages : allumés, opacité, intensité.
    storms: { on: o.on === true, opacity: clamp(o.opacity, 0.1, 1, ds.opacity), intensity: clamp(o.intensity, 0.5, 2, ds.intensity) },
    // Aérosols : allumés, opacité, intensité, produit (parmi les proposés), animation de la prévision.
    aerosols: { on: a.on === true, opacity: clamp(a.opacity, 0.1, 1, da.opacity), intensity: clamp(a.intensity, 0.5, 2, da.intensity), product: aerosolProduct(a.product), animate: a.animate !== false },
    // Vents : allumés, opacité, intensité, niveau (parmi les proposés), axes des courants-jets.
    winds: { on: w.on === true, opacity: clamp(w.opacity, 0.1, 1, dw.opacity), intensity: clamp(w.intensity, 0.5, 2, dw.intensity), level: FLOW_LEVEL_IDS.includes(w.level) ? w.level : dw.level, jets: w.jets !== false },
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

// hhmm : heure locale (heures et minutes) d'une date ISO ou en ms.
const hhmm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Texte d'aide du radar des précipitations (null : chargement ; 'erreur' : échec). */
// Déclare et exporte precipitationHint : la réponse, ou son état.
export function precipitationHint(info) {
  // Source, en clair (mention obligatoire).
  const src = 'Rain Viewer (radars météorologiques au sol)';
  // Pas encore de réponse.
  if (info === null || info === undefined) return `Pluie et neige mesurées par les radars au sol, 50 dernières minutes · ${src}`;
  // Échec.
  if (info === 'erreur') return `Source indisponible pour le moment · ${src}`;
  // Aucune image.
  if (!info.available) return `${info.reason || 'Aucune image radar'} · ${src}`;
  // Images.
  const frames = normalizeFrames(info);
  // Dernière image.
  const last = frames[frames.length - 1];
  // Âge de la dernière image.
  const age = Number.isFinite(info.ageMin) ? ` (il y a ${info.ageMin} min)` : '';
  // Texte complet.
  return `Dernière image radar ${last ? hhmm(last.time) : '—'}${age}${info.stale ? ' · image ancienne : la source ne s’est pas mise à jour' : ''} · hors de portée des radars (océans, une grande partie de l’Afrique et de l’Asie centrale), aucune mesure · ${src}`;
// Fin de precipitationHint.
}

/** Texte d'aide des orages (null : chargement ; 'erreur' : échec). */
// Déclare et exporte stormHint : la réponse, ou son état.
export function stormHint(info) {
  // Sources, en clair.
  const src = 'cellules estimées d’après Rain Viewer ; avertissements NOAA NWS (États-Unis)';
  // Pas encore de réponse.
  if (info === null || info === undefined) return `Cellules convectives estimées d’après le radar et avertissements officiels · ${src}`;
  // Échec.
  if (info === 'erreur') return `Source indisponible pour le moment · ${src}`;
  // Décomptes.
  const s = info.stats ?? {};
  // pl : marque du pluriel.
  const pl = (n) => (n > 1 ? 's' : '');
  // Avertissements.
  const warn = s.warnings ? ` · ${count(s.warnings)} avertissement${pl(s.warnings)} officiel${pl(s.warnings)} en vigueur${s.tornado ? `, dont ${count(s.tornado)} de tornade` : ''}` : ' · aucun avertissement officiel en vigueur';
  // Heure de l'image des cellules.
  const at = info.frame?.time ? ` (radar de ${hhmm(info.frame.time)})` : '';
  // Texte complet.
  return `${count(s.cells)} cellule${pl(s.cells)} convective${pl(s.cells)} estimée${pl(s.cells)}${at}, dont ${count(s.strong)} forte${pl(s.strong)} (≥ 50 dBZ) et ${count(s.persistent)} suivie${pl(s.persistent)} sur plusieurs images${warn} · ${src}${info.stale ? ' · une source ne répond plus' : ''}`;
// Fin de stormHint.
}

// pct : une part (0 à 1) en pourcentage arrondi.
const pct = (v) => `${Math.round((Number(v) || 0) * 100)} %`;

/** Texte d'aide des aérosols pour le produit choisi (null : chargement ; 'erreur' : échec). */
// Déclare et exporte aerosolHint : la réponse, ou son état, et le produit.
export function aerosolHint(info, product = 'aod') {
  // Sources, en clair.
  const src = product === 'dust' ? 'Copernicus Atmosphere Monitoring Service (prévision)' : product === 'ai' ? 'NASA GIBS · OMPS (NOAA-20, NOAA-21)' : 'NASA GIBS · VIIRS Deep Blue (NOAA-20, NOAA-21)';
  // Pas encore de réponse.
  if (info === null || info === undefined) return `Aérosols mesurés par satellite (jour et veille) et poussières prévues · NASA GIBS, Copernicus CAMS`;
  // Échec.
  if (info === 'erreur') return `Source indisponible pour le moment · ${src}`;
  // Réponse mise en forme.
  const n = normalizeAerosols(info);
  // Prévision des poussières (début).
  if (product === 'dust') {
    // Indisponible : la raison.
    if (!n.forecast.available) return `Prévision indisponible${n.forecast.reason ? ` (${n.forecast.reason})` : ''} · ${src}`;
    // Première et dernière échéances.
    const first = n.forecast.times[0], last = n.forecast.times[n.forecast.times.length - 1];
    // fmt : jour et heure.
    const fmt = (t) => new Date(t).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    // Texte complet.
    return `Poussières prévues par le modèle CAMS, toutes les 6 h${first && last ? ` du ${fmt(first.t)} au ${fmt(last.t)}` : ''} : une prévision, pas une mesure · ${src}`;
  // Fin de la prévision.
  }
  // Produit observé.
  const p = n.products[product];
  // Indisponible : la raison.
  if (!p?.available) return `${p?.reason || 'Aucune image'} · ${src}`;
  // Zones de forte charge.
  const plumes = n.plumes.length, absorbing = n.plumes.filter((x) => x.absorbing).length;
  // Mention des zones (épaisseur optique seulement).
  const zones = product === 'aod' ? ` · ${plumes} zone${plumes > 1 ? 's' : ''} de forte charge (AOD ≥ 1)${plumes ? `, dont ${absorbing} absorbante${absorbing > 1 ? 's' : ''} (poussières ou fumées, nature estimée)` : ''}` : '';
  // Limites de la mesure : l'épaisseur optique ne voit pas sous les nuages ; l'indice voit au-dessus, mais jamais de nuit.
  const gaps = product === 'ai' ? 'aucune mesure la nuit ; l’indice voit aussi au-dessus des nuages' : 'aucune mesure sous les nuages, la nuit ni sur la neige';
  // Texte complet.
  return `Mesuré aujourd’hui sur ${pct(p.today)} du globe, hier sur ${pct(p.yesterday)} (${gaps})${zones} · ${src}${info.stale ? ' · une source ne répond plus' : ''}`;
// Fin de aerosolHint.
}

/** Texte d'aide des vents pour le niveau choisi (null : chargement ; 'erreur' : échec). */
// Déclare et exporte windHint : la réponse, ou son état, et le niveau.
export function windHint(info, level = '250hPa') {
  // Source, en clair (mention demandée par la licence CC BY 4.0).
  const src = 'Open-Meteo (modèles météo, CC BY 4.0)';
  // Pas encore de réponse.
  if (info === null || info === undefined) return `Vents du moment du sol aux courants-jets, d’après les modèles météo · ${src}`;
  // Échec.
  if (info === 'erreur') return `Source indisponible pour le moment · ${src}`;
  // Indisponible : la raison.
  if (!info.available) return `${info.reason || 'Aucun vent'} · ${src}`;
  // Réponse mise en forme.
  const n = normalizeWinds(info);
  // Niveau choisi.
  const l = n.levels[level];
  // Absent de la réponse : le dire.
  if (!l) return `Niveau indisponible dans la réponse du modèle · ${src}`;
  // Heure de validité.
  const at = n.validAt ? ` à ${new Date(n.validAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '';
  // Courants-jets.
  const jets = n.jets.length ? ` · ${n.jets.length} courant${n.jets.length > 1 ? 's' : ''}-jet${n.jets.length > 1 ? 's' : ''} (jusqu’à ${count(Math.max(...n.jets.map((j) => j.maxKmh)))} km/h, axes estimés)` : ' · aucun courant-jet au-dessus de 108 km/h';
  // Texte complet.
  return `${l.label}, vent du modèle${at}, jusqu’à ${count(Math.round(l.maxMs * 3.6))} km/h sur une grille de 12° × 10°${jets} · ${src}${info.stale ? ' · dernières données connues' : ''}`;
// Fin de windHint.
}
