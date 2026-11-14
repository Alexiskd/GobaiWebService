// Calculs purs des noms de pays posés sur le globe (sans three.js ni DOM, testés par countryLabelsMath.test.jsx).

// Fenêtre d'affichage selon l'altitude de la caméra (en rayons terrestres). Les noms étant posés sur le sol, ils
// grandissent avec le zoom : la taille à l'écran (countryLabelSizeAlpha) fait le reste du tri.
// Déclare et exporte l'altitude sous laquelle les noms apparaissent : 6 rayons terrestres.
export const COUNTRY_SHOW_ABOVE = 6;    // altitude sous laquelle les noms commencent à apparaître
// Déclare et exporte la longueur du fondu d'apparition : 1,25 rayon.
export const COUNTRY_FADE_IN = 1.25;
// Déclare et exporte l'altitude sous laquelle les noms disparaissent : 0,3 rayon.
export const COUNTRY_HIDE_BELOW = 0.3;  // au plus près, les noms de villes prennent le relais
// Déclare et exporte la longueur du fondu de disparition : 0,25 rayon.
export const COUNTRY_FADE_OUT = 0.25;

// Hauteur du texte à l'écran (px) : invisible trop petit, effacé quand il devient envahissant.
// Déclare et exporte la hauteur minimale du texte : 7 pixels.
export const LABEL_MIN_PX = 7;
// Déclare et exporte la hauteur à partir de laquelle il est entièrement visible : 10 pixels.
export const LABEL_FULL_PX = 10;
// Déclare et exporte la hauteur à partir de laquelle il commence à s'effacer : 70 pixels.
export const LABEL_FADE_PX = 70;
// Déclare et exporte la hauteur maximale : 110 pixels.
export const LABEL_MAX_PX = 110;

// Hauteur du texte sur le globe (degrés) : plafond selon l'importance du pays, plancher pour rester lisible.
// Hauteur maximale du texte, en degrés, selon le rang du pays.
const MAX_HEIGHT_BY_RANK = { 2: 2.4, 3: 1.8, 4: 1.3, 5: 1 };
// Déclare et exporte la hauteur minimale du texte : 0,15 degré.
export const MIN_LABEL_HEIGHT_DEG = 0.15;
// Rayon supposé d'un pays sans contour : 0,6 degré.
const FALLBACK_RADIUS_DEG = 0.6;  // place supposée quand le pays n'a pas de contour (îlot) : ≈ 65 km

// clamp : borne x entre a et b.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Opacité du calque des pays : fondu à l'apparition, puis effacement au niveau des villes. */
// Déclare et exporte countryLabelOpacity : l'altitude de la caméra.
export function countryLabelOpacity(altitude) {
  // Altitude nulle, négative ou non numérique : opacité 0.
  if (!(altitude > 0)) return 0;
  // Renvoie la plus petite de deux valeurs (début).
  return Math.min(
    // Le fondu d'apparition : de 0 à l'altitude 6 à 1 à l'altitude 4,75.
    clamp((COUNTRY_SHOW_ABOVE - altitude) / COUNTRY_FADE_IN, 0, 1),
    // Le fondu de disparition : de 1 à l'altitude 0,55 à 0 à l'altitude 0,3.
    clamp((altitude - COUNTRY_HIDE_BELOW) / COUNTRY_FADE_OUT, 0, 1),
  // Fin du minimum.
  );
// Fin de countryLabelOpacity.
}

/** Opacité d'un nom selon sa hauteur à l'écran (px). */
// Déclare et exporte countryLabelSizeAlpha : la hauteur du texte en pixels.
export function countryLabelSizeAlpha(px) {
  // Sous la hauteur minimale, à la hauteur maximale ou au-delà : opacité 0.
  if (!(px >= LABEL_MIN_PX) || px >= LABEL_MAX_PX) return 0;
  // Renvoie la plus petite de deux valeurs (début).
  return Math.min(
    // Le fondu d'apparition : de 0 à 7 pixels à 1 à 10 pixels.
    clamp((px - LABEL_MIN_PX) / (LABEL_FULL_PX - LABEL_MIN_PX), 0, 1),
    // Le fondu de disparition : de 1 à 70 pixels à 0 à 110 pixels.
    clamp((LABEL_MAX_PX - px) / (LABEL_MAX_PX - LABEL_FADE_PX), 0, 1),
  // Fin du minimum.
  );
// Fin de countryLabelSizeAlpha.
}

/**
 * Hauteur du texte (degrés) pour qu'il tienne dans le pays : sa largeur ne dépasse pas le diamètre du plus grand
 * cercle inscrit (r = distance du milieu à la frontière la plus proche), sa hauteur un peu plus de la moitié de r.
 * @param r      distance du milieu à la frontière (degrés), ou null si inconnue
 * @param aspect largeur / hauteur du texte
 * @param rank   importance cartographique (2 = majeur … 5)
 */
// Déclare et exporte countryLabelHeightDeg : la distance à la frontière, le rapport largeur/hauteur du texte et le rang.
export function countryLabelHeightDeg(r, aspect, rank) {
  // Place disponible : cette distance, ou le rayon supposé quand elle est inconnue.
  const room = r > 0 ? r : FALLBACK_RADIUS_DEG;
  // Hauteur qui tient : largeur limitée à 1,9 fois la place, hauteur limitée à 0,6 fois la place.
  const fit = Math.min((1.9 * room) / Math.max(aspect, 1), 0.6 * room);
  // Renvoie cette hauteur, bornée entre le minimum et le plafond du rang (1 degré pour un rang inconnu).
  return clamp(fit, MIN_LABEL_HEIGHT_DEG, MAX_HEIGHT_BY_RANK[rank] ?? 1);
// Fin de countryLabelHeightDeg.
}

/** Point dans un anneau plat [lon1, lat1, lon2, lat2, …] (règle pair-impair). */
// Déclare et exporte pointInRing : la longitude, la latitude et le contour.
export function pointInRing(lon, lat, ring) {
  // Résultat : dehors au départ.
  let inside = false;
  // Nombre de points du contour.
  const n = ring.length / 2;
  // Pour chaque arête, du point j au point i (début).
  for (let i = 0, j = n - 1; i < n; j = i++) {
    // Coordonnées des deux bouts de l'arête.
    const xi = ring[2 * i], yi = ring[2 * i + 1], xj = ring[2 * j], yj = ring[2 * j + 1];
    // Si l'arête croise la latitude du point et que le croisement est à l'est du point, le résultat s'inverse.
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  // Fin de la boucle.
  }
  // Renvoie le résultat.
  return inside;
// Fin de pointInRing.
}

/**
 * Morceau de pays (continent, île) qui contient le point d'ancrage d'un nom, parmi tous les pays reçus de
 * GET /borders. Le plus petit morceau gagne quand plusieurs contours simplifiés se chevauchent (enclaves).
 * @returns {{ lon, lat, r, area } | null}
 */
// Déclare et exporte findCountryPart : la longitude, la latitude et la liste des pays.
export function findCountryPart(lon, lat, countries) {
  // Meilleur morceau : aucun au départ.
  let best = null;
  // Pour chaque pays (début).
  for (const c of countries || []) {
    // Pour chacun de ses morceaux (début).
    for (const p of c.parts || []) {
      // Sans contour, ou contour de moins de quatre points : ignoré.
      if (!p.ring || p.ring.length < 8) continue;
      // Le point n'est pas dans le contour : ignoré.
      if (!pointInRing(lon, lat, p.ring)) continue;
      // Premier morceau trouvé, ou plus petit que le meilleur : il devient le meilleur.
      if (!best || p.area < best.area) best = p;
    // Fin de la boucle des morceaux.
    }
  // Fin de la boucle des pays.
  }
  // Renvoie le meilleur morceau, ou null.
  return best;
// Fin de findCountryPart.
}
