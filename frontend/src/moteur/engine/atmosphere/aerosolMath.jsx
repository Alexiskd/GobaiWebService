// Calcul des aérosols (sans three.js, donc testable seul) : produits proposés, codage des images servies, échelles de
// couleurs (reprises exactement par le shader du calque), mise en forme de la réponse du serveur et des heures de la
// prévision.

/** Codage des images observées : code = 1 + valeur × 50 ; 0 = aucune mesure. */
// Déclare et exporte le facteur du codage.
export const AEROSOL_CODE_SCALE = 50;
/** Produits proposés : épaisseur optique et indice absorbant (observés), poussières (prévision CAMS). */
// Déclare et exporte les produits.
export const AEROSOL_PRODUCTS = ['aod', 'ai', 'dust'];
/** Libellés courts des produits. */
// Déclare et exporte les libellés.
export const AEROSOL_LABELS = { aod: 'Épaisseur optique', ai: 'Absorbants', dust: 'Poussières (prévision)' };

/** Échelle de l'épaisseur optique (AOD à 550 nm) : air pur presque transparent, puis jaune, orange, rouge, pourpre. */
// Déclare et exporte l'échelle de l'épaisseur optique.
export const AOD_SCALE = [[0.1, '#fff3b0'], [0.3, '#ffd34d'], [0.6, '#ff9a2e'], [1, '#e8541e'], [2, '#a31d3a'], [3, '#5a1a5e']];
/** Échelle de l'indice d'aérosols absorbants : sable clair à brun sombre (poussières et fumées). */
// Déclare et exporte l'échelle de l'indice.
export const AI_SCALE = [[0.7, '#f5e6c8'], [1.5, '#e6b36b'], [2.5, '#c9752e'], [3.5, '#8e3b1c'], [5, '#4a1608']];

/** Valeur d'un code d'image, ou null (0 : aucune mesure). */
// Déclare et exporte aerosolValue : le code.
export const aerosolValue = (code) => (code > 0 ? (code - 1) / AEROSOL_CODE_SCALE : null);

/** Légende d'un produit observé : paliers { value, color, label }. */
// Déclare et exporte aerosolLegend : le produit.
export function aerosolLegend(product) {
  // Échelle du produit.
  const scale = product === 'ai' ? AI_SCALE : AOD_SCALE;
  // Paliers.
  return scale.map(([value, color]) => ({ value, color, label: value.toLocaleString('fr-FR') }));
// Fin de aerosolLegend.
}

// num : un nombre, ou NaN pour une valeur absente (Number(null) vaudrait 0).
const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

/** Produit voulu, borné aux produits proposés (épaisseur optique par défaut). */
// Déclare et exporte aerosolProduct : la valeur.
export const aerosolProduct = (v) => (AEROSOL_PRODUCTS.includes(v) ? v : 'aod');

/**
 * Réponse /atmosphere/aerosols mise en forme : produits observés par identifiant, heures de la prévision (ms, triées),
 * zones de forte charge { lon, lat, aod, absorbing }.
 */
// Déclare et exporte normalizeAerosols : la réponse.
export function normalizeAerosols(data) {
  // Produits reçus.
  const products = Object.fromEntries((Array.isArray(data?.products) ? data.products : []).filter((p) => typeof p?.id === 'string').map((p) => [p.id, { available: p.available === true, reason: typeof p.reason === 'string' ? p.reason : null, today: Number(p.measured?.today) || 0, yesterday: Number(p.measured?.yesterday) || 0 }]));
  // Heures de la prévision, lisibles et triées.
  const times = (Array.isArray(data?.forecast?.times) ? data.forecast.times : []).map((t) => ({ iso: String(t), t: Date.parse(t) })).filter((x) => Number.isFinite(x.t) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x.iso)).sort((a, b) => a.t - b.t);
  // Zones lisibles.
  const plumes = (Array.isArray(data?.plumes) ? data.plumes : []).map((e) => ({ lon: num(e?.lon), lat: num(e?.lat), aod: num(e?.intensity?.value), absorbing: num(e?.details?.aiMax) >= 1.5 })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat) && Number.isFinite(p.aod));
  // Résultat.
  return { products, forecast: { available: data?.forecast?.available === true, reason: data?.forecast?.reason ?? null, times }, plumes, days: data?.days ?? null };
// Fin de normalizeAerosols.
}
