// Importe le point du globe d'une longitude et d'une latitude (même repère que les autres calques de la Terre).
import { lonLatToUnit } from '../EruptionEngine/volcanoesMath.jsx';

// Calculs du calque de la foudre (sans three.js, donc testables seuls) : nettoyage des impacts reçus du serveur
// (/atmosphere/lightning), relecture accélérée des 5 dernières minutes, tableaux envoyés au shader de lightningLayer.jsx.
//
// Seules la POSITION et l'HEURE d'un impact sont mesurées (réseau Vaisala, via Xweather). Le point posé à l'impact est
// donc la donnée ; la lueur et l'éclair ramifié qui l'accompagnent sont une animation PROCÉDURALE, rejouée dans l'ordre
// réel des impacts, jamais la forme réelle de l'éclair.

/** Durée des données relues (accès standard Xweather : 5 minutes), en secondes. */
// Déclare et exporte la fenêtre relue : 300 s.
export const LIGHTNING_WINDOW_S = 300;
/** Durée d'une boucle de relecture, en secondes : les 5 minutes sont rejouées en 30 s (×10). */
// Déclare et exporte la boucle : 30 s.
export const LIGHTNING_LOOP_S = 30;
/** Nombre maximal d'impacts dessinés. */
// Déclare et exporte le maximum : 5 000.
export const MAX_STRIKES = 5000;
/** Natures : 1 nuage-sol, 2 intra-nuage, 0 inconnue (comme le serveur). */
// Déclare et exporte les natures.
export const STRIKE_KIND = { unknown: 0, cg: 1, ic: 2 };

// col : la colonne `name` de l'objet si c'est un tableau, sinon un tableau vide.
const col = (o, name) => (Array.isArray(o?.[name]) ? o[name] : []);

/** Colonnes du serveur vers des impacts { lon, lat, ageS, kind, peak, conf } : illisibles écartés, MAX_STRIKES au plus. */
// Déclare et exporte normalizeStrikes : les colonnes.
export function normalizeStrikes(columns) {
  // Colonnes.
  const lon = col(columns, 'lon'), lat = col(columns, 'lat'), age = col(columns, 'ageS'), kind = col(columns, 'kind'), peak = col(columns, 'peak'), conf = col(columns, 'conf');
  // Impacts gardés.
  const out = [];
  // Pour chaque ligne (début).
  for (let i = 0; i < lon.length && out.length < MAX_STRIKES; i++) {
    // Position.
    const lo = Number(lon[i]), la = Number(lat[i]);
    // Hors du globe ou illisible : ignoré.
    if (!Number.isFinite(lo) || !Number.isFinite(la) || Math.abs(la) > 90 || Math.abs(lo) > 180) continue;
    // Nature connue, sinon inconnue.
    const k = Number(kind[i]) === 1 || Number(kind[i]) === 2 ? Number(kind[i]) : 0;
    // Impact.
    out.push({ lon: lo, lat: la, ageS: Math.max(0, Number(age[i]) || 0), kind: k, peak: Number(peak[i]) || 0, conf: Math.min(1, Math.max(0, Number(conf[i] ?? 0.7) || 0)) });
  // Fin de la boucle.
  }
  // Renvoie les impacts.
  return out;
// Fin de normalizeStrikes.
}

/**
 * Moment de l'impact dans la boucle de relecture (secondes, de 0 à LIGHTNING_LOOP_S) : l'impact le plus ancien de la
 * fenêtre au début, le plus récent à la fin. L'ordre et les écarts réels entre impacts sont conservés (×10).
 */
// Déclare et exporte replayOffset : l'âge de l'impact à la réception (s).
export function replayOffset(ageS, windowS = LIGHTNING_WINDOW_S, loopS = LIGHTNING_LOOP_S) {
  // Âge borné à la fenêtre.
  const a = Math.min(windowS, Math.max(0, ageS));
  // Place dans la boucle.
  return ((windowS - a) / windowS) * loopS;
// Fin de replayOffset.
}

/** Force relative d'un impact (0 à 1) d'après son courant de crête, en échelle logarithmique. */
// Déclare et exporte strikeStrength : le courant signé.
export function strikeStrength(peak) {
  // Valeur absolue.
  const a = Math.abs(Number(peak) || 0);
  // 1 000 → 0, 100 000 et plus → 1.
  return Math.min(1, Math.max(0, (Math.log10(Math.max(a, 1)) - 3) / 2));
// Fin de strikeStrength.
}

/** Tableaux du shader : `position` (point du globe), `strike` (moment de relecture, nature, force, confiance), `seed`. */
// Déclare et exporte buildStrikeAttributes : les impacts.
export function buildStrikeAttributes(strikes) {
  // Nombre d'impacts.
  const count = strikes.length;
  // Positions, données et graines.
  const position = new Float32Array(count * 3), strike = new Float32Array(count * 4), seed = new Float32Array(count);
  // Pour chaque impact (début).
  strikes.forEach((s, i) => {
    // Point du globe.
    position.set(lonLatToUnit(s.lon, s.lat), i * 3);
    // Moment de relecture, nature, force et confiance.
    strike.set([replayOffset(s.ageS), s.kind, strikeStrength(s.peak), s.conf], i * 4);
    // Graine stable tirée de la position.
    seed[i] = Math.abs(Math.sin(s.lon * 91.7 + s.lat * 47.3) * 43758.5453) % 1;
  // Fin du parcours.
  });
  // Renvoie les tableaux.
  return { count, position, strike, seed };
// Fin de buildStrikeAttributes.
}
