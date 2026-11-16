// Importe D (radians par degré), centuriesTT (siècles de Temps terrestre) et earthPosition (centre de la Terre).
import { D, centuriesTT, earthPosition } from './planetOrbits';

// Le Soleil vu de la Terre, à partir de la position VSOP87A de la Terre (même état que la scène).

// Déclare et exporte l'unité astronomique en kilomètres.
export const AU_KM = 149597870.7;
// Déclare et exporte le rayon du Soleil en kilomètres.
export const SUN_RADIUS_KM = 696340;
// Déclare et exporte la vitesse de la lumière en km/s.
export const LIGHT_KM_S = 299792.458;
// Déclare et exporte la constante solaire : 1361 W/m².
export const SOLAR_CONSTANT = 1361; // W/m² à 1 UA

// Nombre de millisecondes dans un jour.
const DAY_MS = 864e5;
// tOf : millisecondes UTC → siècles juliens de Temps terrestre depuis J2000, l'échelle des éléments d'orbite.
const tOf = centuriesTT;

/**
 * Position héliocentrique du centre de la Terre dans l'écliptique J2000 (UA). La scène renvoie [x, z, -y].
 * earthPosition renvoie directement le centre de la Terre depuis VSOP87A EARTH ; le modèle ancien appliquait une correction barycentrique.
 */
// earthEcl : l'identifiant historique des éléments de la Terre et l'instant (début).
function earthEcl(el, ms) {
  // Position de la Terre dans le repère de la scène.
  const p = earthPosition(el, tOf(ms));
  // La ramène dans l'écliptique : [x, z, −y] de la scène redevient [x, y, z].
  return [p[0], -p[2], p[1]];
// Fin de earthEcl.
}

/** Distance Terre–Soleil (UA) et longitude écliptique apparente du Soleil (degrés, 0 = équinoxe de mars). */
// Déclare et exporte sunFromEarth : les éléments orbitaux et l'instant.
export function sunFromEarth(el, ms) {
  // Position de la Terre autour du Soleil.
  const [x, y, z] = earthEcl(el, ms);
  // Distance Terre-Soleil.
  const r = Math.hypot(x, y, z);
  // Écliptique J2000 → équinoxe de la date (précession) : les saisons se comptent depuis l'équinoxe du jour.
  // Longitude du Soleil vu de la Terre (direction opposée à celle de la Terre), corrigée de la précession et ramenée entre 0 et 360°.
  const lon = ((Math.atan2(-y, -x) / D + 1.3969713 * tOf(ms)) % 360 + 360) % 360;
  // Renvoie la distance et la longitude.
  return { au: r, lon };
// Fin de sunFromEarth.
}

/** Grandeurs en direct : distance, temps de lumière, diamètre apparent, éclairement au sommet de l'atmosphère. */
// Déclare et exporte sunLive : les éléments orbitaux et l'instant.
export function sunLive(el, ms) {
  // Distance en unités astronomiques et longitude.
  const { au, lon } = sunFromEarth(el, ms);
  // Distance en kilomètres.
  const km = au * AU_KM;
  // Renvoie les grandeurs (début).
  return {
    // La distance dans les deux unités et la longitude.
    au, km, lon,
    // Le temps de trajet de la lumière, en secondes.
    lightSeconds: km / LIGHT_KM_S,
    // Le diamètre apparent, en minutes d'arc.
    diameterArcmin: (2 * Math.atan(SUN_RADIUS_KM / km) / D) * 60,
    // L'éclairement : la constante solaire divisée par le carré de la distance.
    irradiance: SOLAR_CONSTANT / (au * au),
  // Fin des grandeurs.
  };
// Fin de sunLive.
}

/** Prochaines saisons : instants où la longitude du Soleil franchit 0°, 90°, 180°, 270°. */
// Déclare et exporte nextSeasons : les éléments orbitaux et l'instant de départ (maintenant par défaut).
export function nextSeasons(el, fromMs = Date.now()) {
  // Nom de la saison pour chacune des quatre longitudes.
  const NAMES = { 0: 'Équinoxe de mars', 90: 'Solstice de juin', 180: 'Équinoxe de septembre', 270: 'Solstice de décembre' };
  // Liste des résultats.
  const out = [];
  // lonAt : longitude du Soleil à un instant.
  const lonAt = (ms) => sunFromEarth(el, ms).lon;
  // Longitude au départ.
  let prev = lonAt(fromMs);
  // Jour après jour, pendant 400 jours au plus, tant que quatre saisons ne sont pas trouvées (début).
  for (let k = 1; k <= 400 && out.length < 4; k++) {
    // Instant de ce jour.
    const ms = fromMs + k * DAY_MS;
    // Longitude ce jour-là.
    const cur = lonAt(ms);
    // Pour chacune des quatre longitudes cibles (début).
    for (const target of [0, 90, 180, 270]) {
      // Écart de la veille à la cible, ramené entre −180° et 180°.
      const a = ((prev - target + 540) % 360) - 180;
      // Écart du jour à la cible, ramené de la même façon.
      const b = ((cur - target + 540) % 360) - 180;
      // Si la cible a été franchie pendant la journée (début).
      if (a < 0 && b >= 0) {
        // Bissection sur la journée.
        // Bornes de la recherche : la veille et le jour.
        let lo = ms - DAY_MS, hi = ms;
        // Trente divisions par deux (début).
        for (let i = 0; i < 30; i++) {
          // Milieu de l'intervalle.
          const mid = (lo + hi) / 2;
          // Avant la cible : le milieu devient la borne basse ; sinon la borne haute.
          if (((lonAt(mid) - target + 540) % 360) - 180 < 0) lo = mid; else hi = mid;
        // Fin des divisions.
        }
        // Ajoute la saison, avec son nom et son instant.
        out.push({ name: NAMES[target], ms: (lo + hi) / 2 });
      // Fin du cas d'un franchissement.
      }
    // Fin de la boucle des cibles.
    }
    // La longitude du jour devient celle de la veille.
    prev = cur;
  // Fin de la boucle des jours.
  }
  // Renvoie les saisons triées par date.
  return out.sort((x, y) => x.ms - y.ms);
// Fin de nextSeasons.
}

/** Prochain périhélie et prochain aphélie (extrema de la distance), à la journée près puis affinés. */
// Déclare et exporte nextApsides : les éléments orbitaux et l'instant de départ (maintenant par défaut).
export function nextApsides(el, fromMs = Date.now()) {
  // dist : distance Terre-Soleil à un instant.
  const dist = (ms) => sunFromEarth(el, ms).au;
  // Résultat, vide au départ.
  const out = {};
  // Distances au départ et un jour plus tard.
  let d0 = dist(fromMs), d1 = dist(fromMs + DAY_MS);
  // Jour après jour, pendant 400 jours au plus, tant que les deux extrema ne sont pas trouvés (début).
  for (let k = 2; k <= 400 && !(out.perihelion && out.aphelion); k++) {
    // Instant de ce jour.
    const ms = fromMs + k * DAY_MS;
    // Distance ce jour-là.
    const d2 = dist(ms);
    // La veille était un minimum : périhélie ; un maximum : aphélie ; sinon rien.
    const key = d1 < d0 && d1 <= d2 ? 'perihelion' : d1 > d0 && d1 >= d2 ? 'aphelion' : null;
    // Si un extremum est trouvé et pas encore noté (début).
    if (key && !out[key]) {
      // Bornes de la recherche : les deux jours autour de la veille.
      let a = ms - 2 * DAY_MS, b = ms;
      // Signe : 1 pour chercher un minimum, −1 pour un maximum.
      const sign = key === 'perihelion' ? 1 : -1;
      // Quarante étapes de recherche par le nombre d'or (début).
      for (let i = 0; i < 40; i++) {
        // Deux points intermédiaires de l'intervalle.
        const m1 = b - (b - a) * 0.618, m2 = a + (b - a) * 0.618;
        // Garde la partie de l'intervalle qui contient l'extremum.
        if (sign * dist(m1) < sign * dist(m2)) b = m2; else a = m1;
      // Fin des étapes.
      }
      // Instant de l'extremum : le milieu de l'intervalle final.
      const t = (a + b) / 2;
      // Note l'instant et la distance.
      out[key] = { ms: t, au: dist(t) };
    // Fin du cas d'un extremum.
    }
    // Décale les deux distances d'un jour.
    d0 = d1; d1 = d2;
  // Fin de la boucle des jours.
  }
  // Renvoie le résultat.
  return out;
// Fin de nextApsides.
}

/** Libellé de l'indice Kp (échelle NOAA des orages géomagnétiques). */
// Déclare et exporte kpLabel : l'indice Kp.
export function kpLabel(kp) {
  // 9 ou plus : orage extrême.
  if (kp >= 9) return 'Orage extrême (G5)';
  // 8 ou plus : orage sévère.
  if (kp >= 8) return 'Orage sévère (G4)';
  // 7 ou plus : orage fort.
  if (kp >= 7) return 'Orage fort (G3)';
  // 6 ou plus : orage modéré.
  if (kp >= 6) return 'Orage modéré (G2)';
  // 5 ou plus : orage mineur.
  if (kp >= 5) return 'Orage mineur (G1)';
  // 4 ou plus : agité.
  if (kp >= 4) return 'Agité';
  // En dessous : calme.
  return 'Calme';
// Fin de kpLabel.
}
