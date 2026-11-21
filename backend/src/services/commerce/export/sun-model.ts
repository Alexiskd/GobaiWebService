/**
 * Modèle 3D du Soleil (export GLB, ouvert dans Blender) : le plasma et ses éruptions, en objets à part.
 *  - « Soleil — plasma » : la sphère aux dimensions réelles, texture lumineuse (matière émissive) calculée ici :
 *    réseau de granulation, couloirs sombres de plasma plus froid, et régions actives brillantes aux positions des
 *    groupes de taches du jour (NOAA SWPC, longitude de Carrington), aux couleurs de l'ultraviolet extrême des images
 *    de SDO (or et orangé) ;
 *  - « Soleil — boucles coronales » : tubes de plasma en arc, ancrés de part et d'autre de chaque région active ;
 *  - « Soleil — protubérances et éruption » : grands arcs au-dessus des régions les plus actives (probabilités
 *    d'éruption de la NOAA, éruptions observées par DONKI), et une éruption qui s'arrache, en brins torsadés.
 * Sans données du jour, des régions sont tirées au hasard (graine fixe) dans les deux bandes de latitude des taches.
 * La texture est procédurale : elle évoque la surface vue par SDO, elle n'en est pas une photographie.
 * Fonctions pures, testées dans sun-model.spec.ts.
 */

// Importe le type d'un maillage.
import type { SphereMesh } from './glb';

// ------------------------------------------------------------------ bruit

// hash : nombre pseudo-aléatoire dans [0, 1] d'un point entier de l'espace et d'une graine.
function hash(x: number, y: number, z: number, seed: number): number {
  // Mélange des coordonnées et de la graine, en entiers de 32 bits.
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440670441) ^ Math.imul(seed, 2246822519);
  // Brassage.
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  // Ramené dans [0, 1].
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
// Fin de hash.
}

// fade : lissage d'un poids (courbe en S).
const fade = (t: number): number => t * t * (3 - 2 * t);

/** Bruit de valeur en 3D, dans [0, 1], continu : interpolé entre les huit coins de la maille. */
// Fonction noise3 : le point et la graine.
export function noise3(x: number, y: number, z: number, seed: number): number {
  // Maille entière et position dans la maille.
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  // lerp : interpolation linéaire.
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  // Interpolation des huit coins, sur x, puis y, puis z.
  return lerp(
    // Face du bas.
    lerp(lerp(hash(xi, yi, zi, seed), hash(xi + 1, yi, zi, seed), u), lerp(hash(xi, yi + 1, zi, seed), hash(xi + 1, yi + 1, zi, seed), u), v),
    // Face du haut.
    lerp(lerp(hash(xi, yi, zi + 1, seed), hash(xi + 1, yi, zi + 1, seed), u), lerp(hash(xi, yi + 1, zi + 1, seed), hash(xi + 1, yi + 1, zi + 1, seed), u), v),
    // Poids en z.
    w,
  // Fin de l'interpolation.
  );
// Fin de noise3.
}

/** Bruit fractal (somme d'octaves de plus en plus fines), dans [0, 1]. */
// Fonction fbm : le point, la graine et le nombre d'octaves.
export function fbm(x: number, y: number, z: number, seed: number, octaves = 4): number {
  // Somme, amplitude et total des amplitudes.
  let sum = 0, amp = 0.5, total = 0;
  // Pour chaque octave : ajoute le bruit, deux fois plus fin, deux fois plus faible.
  for (let o = 0; o < octaves; o++) { sum += amp * noise3(x, y, z, seed + o * 101); total += amp; x *= 2.03; y *= 2.03; z *= 2.03; amp *= 0.5; }
  // Renvoie la moyenne pondérée.
  return sum / total;
// Fin de fbm.
}

/** Bruit « en crêtes », dans [0, 1] : 1 sur des lignes fines et sinueuses (couloirs de plasma). */
// Fonction ridged : le point, la graine et le nombre d'octaves.
export const ridged = (x: number, y: number, z: number, seed: number, octaves = 3): number => (1 - Math.abs(2 * fbm(x, y, z, seed, octaves) - 1)) ** 4;

// ------------------------------------------------------------------ géométrie

// Type d'un vecteur.
type Vec3 = [number, number, number];

/**
 * Direction (sphère unité, +Y vers le nord) d'un point de latitude et de longitude de texture (degrés, −180 … 180) :
 * la même convention que la sphère texturée de glb.ts (u = 0 à −180°, v = 0 au pôle nord).
 */
// Fonction direction : la latitude et la longitude, en degrés.
export function direction(latDeg: number, lonDeg: number): Vec3 {
  // Latitude en radians, et angle de la colonne de texture.
  const lat = (latDeg * Math.PI) / 180, phi = ((lonDeg + 180) / 360) * 2 * Math.PI;
  // Même formule que sphereMesh : (−sinθ cosφ, cosθ, sinθ sinφ), avec θ mesuré depuis le pôle nord.
  return [-Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi)];
// Fin de direction.
}

// normalize : vecteur ramené à la longueur 1.
const normalize = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// cross : produit vectoriel.
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Tube de plasma en arc (boucle coronale, protubérance) entre deux pieds A et B (directions unité) : son axe suit
 * le grand cercle de A à B, soulevé de `heightKm` au sommet (sinus), sur une sphère de `radiusKm`. `tubeKm` : rayon
 * du tube (affiné aux pieds) ; `lean` : inclinaison de l'arc hors de son plan (−1 … 1) ; `rise` : élongation vers
 * le haut (une éruption qui s'arrache) ; `twist` : décalage du brin autour de l'axe (tours).
 */
// Fonction arcTube : les pieds, les dimensions et la forme.
export function arcTube(a: Vec3, b: Vec3, { radiusKm, heightKm, tubeKm, lean = 0, rise = 0, twist = 0, phase = 0, segments = 32, sides = 8 }: { radiusKm: number; heightKm: number; tubeKm: number; lean?: number; rise?: number; twist?: number; phase?: number; segments?: number; sides?: number }): SphereMesh {
  // Points de l'axe.
  const axis: Vec3[] = [];
  // Normale du plan de l'arc (perpendiculaire aux deux pieds).
  const planeN = normalize(cross(a, b));
  // Pour chaque pas le long de l'arc (début).
  for (let s = 0; s <= segments; s++) {
    // Avancement de 0 à 1.
    const t = s / segments;
    // Point du grand cercle entre A et B (interpolation puis normalisation).
    const d = normalize([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    // Hauteur : sinus, étiré vers le haut par `rise` (le sommet monte plus que les flancs).
    const h = heightKm * (Math.sin(Math.PI * t) + rise * Math.sin(Math.PI * t) ** 3);
    // Inclinaison hors du plan, maximale au sommet.
    const off = lean * heightKm * 0.5 * Math.sin(Math.PI * t);
    // Point de l'axe.
    axis.push([d[0] * (radiusKm + h) + planeN[0] * off, d[1] * (radiusKm + h) + planeN[1] * off, d[2] * (radiusKm + h) + planeN[2] * off]);
  // Fin des pas.
  }
  // Tableaux du maillage.
  const n = (segments + 1) * (sides + 1), positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
  // Indices des triangles.
  const indices = new Uint32Array(segments * sides * 6);
  // Pour chaque point de l'axe (début).
  for (let s = 0; s <= segments; s++) {
    // Tangente (différence avec les voisins).
    const p0 = axis[Math.max(0, s - 1)], p1 = axis[Math.min(segments, s + 1)], tan = normalize([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
    // Deux axes perpendiculaires à la tangente.
    const side1 = normalize(cross(tan, planeN)), side2 = cross(tan, side1);
    // Rayon du tube, affiné aux pieds.
    const r = tubeKm * (0.45 + 0.55 * Math.sin((Math.PI * s) / segments));
    // Décalage du brin autour de l'axe (torsade) : angle et distance.
    const ta = 2 * Math.PI * (twist * (s / segments) + phase), td = twist ? tubeKm * 1.6 * Math.sin((Math.PI * s) / segments) : 0;
    // Centre du cercle du tube, décalé par la torsade.
    const c: Vec3 = [axis[s][0] + (side1[0] * Math.cos(ta) + side2[0] * Math.sin(ta)) * td, axis[s][1] + (side1[1] * Math.cos(ta) + side2[1] * Math.sin(ta)) * td, axis[s][2] + (side1[2] * Math.cos(ta) + side2[2] * Math.sin(ta)) * td];
    // Pour chaque côté du tube (début).
    for (let k = 0; k <= sides; k++) {
      // Angle autour de l'axe.
      const ang = (2 * Math.PI * k) / sides, ca = Math.cos(ang), sa = Math.sin(ang);
      // Direction vers l'extérieur du tube.
      const nrm: Vec3 = [side1[0] * ca + side2[0] * sa, side1[1] * ca + side2[1] * sa, side1[2] * ca + side2[2] * sa];
      // Indice du sommet.
      const i = s * (sides + 1) + k;
      // Position, normale et coordonnées de texture.
      positions.set([c[0] + nrm[0] * r, c[1] + nrm[1] * r, c[2] + nrm[2] * r], 3 * i); normals.set(nrm, 3 * i); uvs.set([s / segments, k / sides], 2 * i);
    // Fin des côtés.
    }
  // Fin des points.
  }
  // Deux triangles par case.
  let q = 0;
  // Pour chaque case : deux triangles.
  for (let s = 0; s < segments; s++) for (let k = 0; k < sides; k++) { const i = s * (sides + 1) + k, j = i + sides + 1; indices.set([i, j, i + 1, j, j + 1, i + 1], q); q += 6; }
  // Le maillage.
  return { positions, normals, uvs, indices, vertexCount: n, triangleCount: q / 3 };
// Fin de arcTube.
}

/** Réunit plusieurs maillages en un seul (un objet dans Blender). */
// Fonction mergeMeshes : les maillages.
export function mergeMeshes(meshes: SphereMesh[]): SphereMesh {
  // Totaux de sommets et d'indices.
  const nv = meshes.reduce((t, m) => t + m.vertexCount, 0), ni = meshes.reduce((t, m) => t + m.indices.length, 0);
  // Tableaux de sortie.
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), indices = new Uint32Array(ni);
  // Décalages de sommets et d'indices.
  let v = 0, i = 0;
  // Pour chaque maillage : copie de ses données, indices décalés.
  for (const m of meshes) { positions.set(m.positions, v * 3); normals.set(m.normals, v * 3); uvs.set(m.uvs, v * 2); for (let k = 0; k < m.indices.length; k++) indices[i + k] = m.indices[k] + v; v += m.vertexCount; i += m.indices.length; }
  // Le maillage réuni.
  return { positions, normals, uvs, indices, vertexCount: nv, triangleCount: ni / 3 };
// Fin de mergeMeshes.
}

// ------------------------------------------------------------------ régions actives

/** Une région active telle que le modèle l'emploie : position (degrés, longitude de texture), taille et activité. */
export interface SunRegion {
  // lat : latitude (degrés, nord positif).
  lat: number;
  // lon : longitude de texture (degrés, −180 … 180).
  lon: number;
  // radiusDeg : rayon de la zone brillante (degrés).
  radiusDeg: number;
  // extentDeg : écart entre les pieds des boucles (degrés).
  extentDeg: number;
  // loops : nombre de boucles coronales.
  loops: number;
  // activity : activité de 0 à 1 (probabilités d'éruption, éruptions observées).
  activity: number;
// Fin de SunRegion.
}

// Forme d'une région de la NOAA, réduite à ce qui sert ici (voir solar-regions.service.ts).
export interface RegionInput { number: number; lat: number; lon: number; carringtonLon: number | null; area: number; extent: number; spots: number; probability: { c: number; m: number; x: number } }

/**
 * Régions actives du modèle, à partir de celles de la NOAA : longitude de Carrington (fixée au Soleil) quand elle est
 * connue, sinon de Stonyhurst ; zone brillante d'après la surface du groupe ; activité d'après les probabilités
 * d'éruption, renforcée par les éruptions observées (`flaredRegions`). Sans région : six régions tirées au hasard.
 */
// Fonction sunRegions : les régions de la NOAA, les numéros des régions qui ont fait une éruption, et la graine.
export function sunRegions(input: RegionInput[], flaredRegions: number[] = [], seed = 7): SunRegion[] {
  // Régions de la NOAA (début).
  const out = input.map((r): SunRegion => {
    // Longitude de texture : Carrington (0 … 360) ramenée entre −180 et 180, sinon Stonyhurst.
    const lon = r.carringtonLon !== null ? ((((r.carringtonLon + 180) % 360) + 360) % 360) - 180 : r.lon;
    // Rayon du groupe de taches : surface en millionièmes d'hémisphère → angle (rad), en degrés.
    const spotDeg = (Math.sqrt((2 * Math.max(0, r.area)) / 1e6) * 180) / Math.PI;
    // Activité : X pèse dix fois, M trois fois, plus une éruption observée.
    const activity = Math.min(1, (r.probability.x * 10 + r.probability.m * 3 + r.probability.c) / 300 + (flaredRegions.includes(r.number) ? 0.4 : 0));
    // La région : zone brillante d'au moins 4°, pieds écartés de 2 à 12°, 2 à 8 boucles.
    return { lat: r.lat, lon, radiusDeg: Math.max(4, spotDeg * 4), extentDeg: Math.min(12, Math.max(2, r.extent || spotDeg * 3)), loops: Math.min(8, Math.max(2, Math.round(2 + r.spots / 3))), activity };
  // Fin des régions de la NOAA.
  });
  // Des régions : les renvoie.
  if (out.length) return out;
  // Sinon : six régions tirées au hasard dans les bandes des taches (5 à 30° de latitude, nord et sud).
  return Array.from({ length: 6 }, (_, k): SunRegion => ({ lat: (k % 2 ? -1 : 1) * (5 + 25 * hash(k, 1, 0, seed)), lon: -180 + 360 * hash(k, 2, 0, seed), radiusDeg: 4 + 6 * hash(k, 3, 0, seed), extentDeg: 3 + 6 * hash(k, 4, 0, seed), loops: 3 + Math.floor(4 * hash(k, 5, 0, seed)), activity: hash(k, 6, 0, seed) }));
// Fin de sunRegions.
}

// ------------------------------------------------------------------ texture du plasma

// Couleurs de l'ultraviolet extrême (palette or de SDO) : de l'ombre au blanc, à intervalles réguliers.
const PALETTE: Vec3[] = [[8, 2, 0], [70, 18, 0], [150, 50, 4], [215, 105, 15], [250, 165, 40], [255, 215, 110], [255, 248, 215]];

/** Couleur de la palette pour une intensité de 0 à 1 (interpolée, bornée). */
// Fonction sunColour : l'intensité.
export function sunColour(t: number): Vec3 {
  // Position dans la palette, bornée.
  const p = Math.min(1, Math.max(0, t)) * (PALETTE.length - 1), k = Math.min(PALETTE.length - 2, Math.floor(p)), f = p - k;
  // Couleur interpolée.
  return [0, 1, 2].map((c) => PALETTE[k][c] + (PALETTE[k + 1][c] - PALETTE[k][c]) * f) as Vec3;
// Fin de sunColour.
}

/**
 * Texture du plasma : pixels RGB (`width` × `height`, équirectangulaire, nord en haut, depuis 180° O). Intensité :
 * marbrure de la supergranulation, grain fin de la granulation, couloirs sombres de plasma plus froid, zones sombres
 * étendues (trous coronaux), et éclat des régions actives.
 */
// Fonction sunTexture : les dimensions, les régions et la graine.
export function sunTexture(width: number, height: number, regions: SunRegion[], seed = 7): Uint8Array {
  // Pixels de sortie.
  const out = new Uint8Array(width * height * 3);
  // Directions et rayons (cosinus) des régions, calculés une fois.
  const rs = regions.map((r) => ({ d: direction(r.lat, r.lon), cosR: Math.cos(((r.radiusDeg * Math.PI) / 180) * 2.5), sig: (r.radiusDeg * Math.PI) / 180, a: 0.35 + 0.45 * r.activity }));
  // Pour chaque ligne (début).
  for (let j = 0; j < height; j++) {
    // Latitude du centre de la ligne.
    const lat = 90 - ((j + 0.5) / height) * 180;
    // Pour chaque colonne (début).
    for (let i = 0; i < width; i++) {
      // Direction du centre du pixel.
      const d = direction(lat, -180 + ((i + 0.5) / width) * 360);
      // Marbrure (supergranulation) et grain fin (granulation).
      const mottle = fbm(d[0] * 6, d[1] * 6, d[2] * 6, seed, 4), grain = fbm(d[0] * 48, d[1] * 48, d[2] * 48, seed + 7, 2);
      // Couloirs sombres, sinueux.
      const lanes = ridged(d[0] * 3.2 + 11, d[1] * 3.2, d[2] * 3.2, seed + 13, 3);
      // Zones sombres étendues (trous coronaux), surtout vers les pôles.
      const hole = Math.max(0, fbm(d[0] * 1.4, d[1] * 1.4, d[2] * 1.4, seed + 29, 2) - 0.64) * 2 * (0.4 + Math.abs(d[1]));
      // Intensité de base.
      let t = 0.5 + 0.32 * (mottle - 0.5) + 0.18 * (grain - 0.5) - 0.32 * lanes - hole;
      // Éclat des régions actives, en cloche autour de chacune.
      for (const r of rs) { const c = d[0] * r.d[0] + d[1] * r.d[1] + d[2] * r.d[2]; if (c < r.cosR) continue; const ang = Math.acos(Math.min(1, c)); t += r.a * Math.exp(-((ang / r.sig) ** 2)) * (0.7 + 0.6 * grain); }
      // Couleur.
      const col = sunColour(t);
      // Indice du rouge.
      const k = (j * width + i) * 3;
      // Pixel.
      out[k] = col[0]; out[k + 1] = col[1]; out[k + 2] = col[2];
    // Fin des colonnes.
    }
  // Fin des lignes.
  }
  // Renvoie les pixels.
  return out;
// Fin de sunTexture.
}

// ------------------------------------------------------------------ boucles et éruptions

/**
 * Boucles coronales de toutes les régions : pour chacune, `loops` arcs dont les pieds encadrent la région, de
 * hauteurs et d'orientations variées (hauteur 3 à 12 % du rayon solaire).
 */
// Fonction coronalLoops : les régions, le rayon (km) et la graine.
export function coronalLoops(regions: SunRegion[], radiusKm: number, seed = 7): SphereMesh {
  // Les tubes.
  const tubes: SphereMesh[] = [];
  // Pour chaque région (début).
  regions.forEach((r, ri) => {
    // Pour chaque boucle (début).
    for (let k = 0; k < r.loops; k++) {
      // Orientation de la boucle autour du centre de la région, et décalage de son centre.
      const ang = Math.PI * hash(ri, k, 1, seed), dl = (hash(ri, k, 2, seed) - 0.5) * r.radiusDeg, dn = (hash(ri, k, 3, seed) - 0.5) * r.radiusDeg;
      // Demi-écart des pieds.
      const half = (r.extentDeg / 2) * (0.6 + 0.8 * hash(ri, k, 4, seed));
      // Pieds A et B.
      const a = direction(r.lat + dn + Math.sin(ang) * half, r.lon + dl + Math.cos(ang) * half), b = direction(r.lat + dn - Math.sin(ang) * half, r.lon + dl - Math.cos(ang) * half);
      // Tube de la boucle : hauteur selon l'écart des pieds et l'activité.
      tubes.push(arcTube(a, b, { radiusKm, heightKm: radiusKm * (0.03 + 0.09 * hash(ri, k, 5, seed)) * (0.7 + 0.6 * r.activity), tubeKm: radiusKm * 0.0045, lean: hash(ri, k, 6, seed) - 0.5, segments: 24, sides: 6 }));
    // Fin des boucles.
    }
  // Fin des régions.
  });
  // Toutes réunies.
  return mergeMeshes(tubes);
// Fin de coronalLoops.
}

/**
 * Protubérances et éruption : un grand arc à plusieurs brins au-dessus des deux régions les plus actives, et, sur la
 * plus active, une éruption qui s'arrache (arc étiré vers le haut, brins torsadés).
 */
// Fonction prominences : les régions, le rayon (km) et la graine.
export function prominences(regions: SunRegion[], radiusKm: number, seed = 7): SphereMesh {
  // Les deux régions les plus actives.
  const top = [...regions].sort((p, q) => q.activity - p.activity).slice(0, 2);
  // Les tubes.
  const tubes: SphereMesh[] = [];
  // Pour chacune (début).
  top.forEach((r, ri) => {
    // Éruption sur la plus active, protubérance sur l'autre.
    const erupting = ri === 0;
    // Demi-écart des pieds : large (une protubérance enjambe sa région).
    const half = Math.max(6, r.extentDeg * 1.5);
    // Orientation.
    const ang = Math.PI * hash(ri, 9, 1, seed);
    // Pieds.
    const a = direction(r.lat + Math.sin(ang) * half, r.lon + Math.cos(ang) * half), b = direction(r.lat - Math.sin(ang) * half, r.lon - Math.cos(ang) * half);
    // Cinq brins torsadés autour de l'arc.
    for (let s = 0; s < 5; s++) tubes.push(arcTube(a, b, { radiusKm, heightKm: radiusKm * (erupting ? 0.32 : 0.16), tubeKm: radiusKm * (erupting ? 0.012 : 0.009), rise: erupting ? 1.6 : 0.2, lean: 0.25 * (hash(ri, s, 2, seed) - 0.5), twist: erupting ? 1.5 : 0.6, phase: s / 5, segments: 48, sides: 8 }));
  // Fin des régions.
  });
  // Tous réunis.
  return mergeMeshes(tubes);
// Fin de prominences.
}
