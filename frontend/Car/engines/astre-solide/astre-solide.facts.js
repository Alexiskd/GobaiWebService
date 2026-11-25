/**
 * Astres solides du globe CesiumJS, décrits par les mêmes données que la composante « Caractéristiques et
 * informations » (useBodyView → moonFacts / planetFacts / satelliteFacts) : le rayon affiché dans la fiche donne
 * l'ellipsoïde et le découpage en tuiles du globe, le type affiché (« Géante gazeuse », « Géante de glaces ») écarte
 * les astres sans sol, l'épaisseur d'atmosphère affichée (« Aucune ») dit si l'astre est sans air, et la couleur de
 * l'astre dans l'interface teinte le sol tant qu'il n'a pas de fond de carte. Fonctions pures.
 */

// Rayon moyen de la Terre (km) : unité des rayons des planètes dans les données (fiche : diamètre = 2 × rayon × 6 371).
export const EARTH_RADIUS_KM = 6371;
// Rayon moyen de la Lune (km) : la fiche de la Lune affiche un diamètre moyen de 3 474,8 km.
export const MOON_RADIUS_KM = 1737.4;
// Astres solides laissés à three.js : Vénus, sans fond de carte, couverte de nuages opaques dessinés par three.js.
export const THREE_ONLY_SOLIDS = Object.freeze(new Set(['venus']));

// finite : vrai si la valeur est un nombre fini et positif.
const positive = (v) => Number.isFinite(v) && v > 0;

/**
 * Données d'un astre pour le globe CesiumJS, lues dans les données de la fiche d'information.
 * @param {string} id identifiant de l'astre ('earth', 'moon', 'mars', 'io'…)
 * @param {{
 *   bodies?: { moon?: object, planets?: object[], satellites?: object[] },  données de l'app (data.bodies)
 *   bodyIdOf?: (def: object) => string,     identifiant d'une planète des données (bodyId)
 *   typeOf?: (id: string) => string|null,   type affiché dans la fiche (planetData(id).type)
 *   atmosphereKmOf?: (id: string) => number|null,  épaisseur d'atmosphère affichée (atmosphereThickness(id).km)
 *   cfg?: object,                           réglages des tuiles de l'astre (tiledBodies.jsx), en repli
 * }} o
 * @returns {{ id: string, name: string|null, radiusKm: number, solid: boolean, airless: boolean, color: string|null }|null}
 */
// Déclare et exporte solidBodyFacts : l'identifiant et les données (début).
export function solidBodyFacts(id, { bodies = {}, bodyIdOf = () => null, typeOf = () => null, atmosphereKmOf = () => null, cfg = null } = {}) {
  // Sans identifiant : rien.
  if (!id) return null;
  // La Lune : sa fiche propre.
  const moon = id === 'moon' ? bodies.moon : null;
  // Une planète (naines comprises) : cherchée par son identifiant.
  const planet = moon ? null : (bodies.planets || []).find((p) => bodyIdOf(p) === id) || null;
  // Un satellite naturel : cherché dans la liste des satellites.
  const sat = moon || planet ? null : (bodies.satellites || []).find((s) => s.id === id) || null;
  // Rayon affiché dans la fiche (km) : Lune, satellite (radiusKm), planète (rayons terrestres) ; sinon les réglages.
  const radiusKm = moon ? MOON_RADIUS_KM
    : positive(sat?.radiusKm) ? sat.radiusKm
    : positive(planet?.radius) ? planet.radius * EARTH_RADIUS_KM
    : positive(cfg?.radiusKm) ? cfg.radiusKm : null;
  // Sans rayon connu : pas de globe possible.
  if (!radiusKm) return null;
  // Type affiché dans la fiche (planètes seulement).
  const type = typeOf(id) || '';
  // Sans sol : géante (type de la fiche) ou astre marqué gazeux dans ses réglages.
  const gas = type.startsWith('Géante') || Boolean(cfg?.gas);
  // Forme irrégulière (Phobos, Deimos) : son modèle 3D reste affiché, pas de sphère à découper.
  const irregular = Boolean(cfg?.modelAlways);
  // Solide et découpable en tuiles par CesiumJS.
  const solid = !gas && !irregular && !THREE_ONLY_SOLIDS.has(id);
  // Épaisseur d'atmosphère affichée ; inconnue : les réglages des tuiles décident.
  const atmo = atmosphereKmOf(id);
  // Sans air : « Aucune » dans la fiche, sinon d'après les réglages (la Lune et les satellites sans air).
  const airless = Number.isFinite(atmo) ? atmo === 0 : Boolean(cfg?.airless ?? moon);
  // Nom et couleur de l'astre dans l'interface.
  const def = moon || planet || sat;
  // Renvoie les données du globe.
  return { id, name: def?.name ?? null, radiusKm, solid, airless, color: typeof def?.color === 'string' ? def.color : null };
// Fin de solidBodyFacts.
}
