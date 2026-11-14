/**
 * Ciel au-delà du Système solaire : calculs purs (sans three.js), testés dans skyMath.test.jsx.
 *
 * Repère de la scène (voir ephemeris.jsx) : écliptique J2000, axe Y = pôle nord de l'écliptique,
 * écliptique (x, y, z) → scène (x, z, −y). Les étoiles du catalogue sont en équatorial J2000 :
 * on les tourne de l'obliquité ε autour de l'axe x, puis on passe aux axes de la scène.
 *
 * Le zoom maximal (~2 600 UA) reste très loin de l'étoile la plus proche (~268 000 UA) :
 * la parallaxe est négligeable, le ciel est donc traité comme une sphère à l'infini (directions seules).
 */

// D : le nombre de radians dans un degré.
const D = Math.PI / 180;

/** Obliquité de l'écliptique J2000 (degrés). */
// Déclare et exporte l'obliquité de l'écliptique : 23,4392911 degrés.
export const OBLIQUITY_DEG = 23.4392911;

/** Pôle nord et centre galactiques (IAU, J2000), en degrés. */
// Déclare et exporte l'ascension droite et la déclinaison du pôle nord galactique.
export const GALACTIC_POLE = { ra: 192.85948, dec: 27.12825 };
// Déclare et exporte l'ascension droite et la déclinaison du centre galactique.
export const GALACTIC_CENTER = { ra: 266.40510, dec: -28.93617 };

/**
 * Galaxies visibles à l'œil nu : position J2000, demi-axes apparents (degrés), angle de position
 * (degrés, du nord vers l'est), éclat relatif du halo et du cœur, teinte.
 */
// Déclare et exporte la liste des galaxies visibles à l'œil nu (début).
export const DEEP_SKY = [
  // La galaxie d'Andromède : position, demi-axes de 1,6° et 0,5°, angle de position de 35°, éclats, teinte chaude, sans grumeaux.
  { id: 'm31', name: 'Galaxie d’Andromède', ra: 10.6847, dec: 41.2690, a: 1.6, b: 0.5, pa: 35, glow: 0.55, core: 1.0, color: [1.0, 0.9, 0.78], clumpy: 0 },
  // Le Grand Nuage de Magellan : position, demi-axes de 5,4° et 4,6°, angle de position de 170°, éclats, teinte bleutée, avec grumeaux.
  { id: 'lmc', name: 'Grand Nuage de Magellan', ra: 80.8938, dec: -69.7561, a: 5.4, b: 4.6, pa: 170, glow: 0.7, core: 0.35, color: [0.86, 0.9, 1.0], clumpy: 1 },
  // Le Petit Nuage de Magellan : position, demi-axes de 2,7° et 1,6°, angle de position de 45°, éclats, teinte bleutée, avec grumeaux.
  { id: 'smc', name: 'Petit Nuage de Magellan', ra: 13.1867, dec: -72.8286, a: 2.7, b: 1.6, pa: 45, glow: 0.55, core: 0.25, color: [0.88, 0.92, 1.0], clumpy: 1 },
// Fin de la liste.
];

// norm : rend un vecteur unitaire (début).
const norm = (v) => {
  // Sa longueur, ou 1 si elle est nulle.
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  // Renvoie le vecteur divisé par cette longueur.
  return [v[0] / l, v[1] / l, v[2] / l];
// Fin de norm.
};
// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// cross : produit vectoriel de deux vecteurs.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Cosinus de l'obliquité.
const COS_E = Math.cos(OBLIQUITY_DEG * D);
// Sinus de l'obliquité.
const SIN_E = Math.sin(OBLIQUITY_DEG * D);

/** Vecteur équatorial J2000 → vecteur unitaire dans le repère de la scène. */
// Déclare et exporte equatorialVecToScene : un vecteur équatorial.
export function equatorialVecToScene([xq, yq, zq]) {
  // Coordonnée y dans l'écliptique, après rotation de l'obliquité autour de l'axe x.
  const ye = COS_E * yq + SIN_E * zq;
  // Coordonnée z dans l'écliptique.
  const ze = -SIN_E * yq + COS_E * zq;
  // Renvoie le vecteur dans le repère de la scène : (x, z, −y).
  return [xq, ze, -ye];
// Fin de equatorialVecToScene.
}

/** Ascension droite et déclinaison (radians) → direction unitaire dans la scène. */
// Déclare et exporte equatorialToScene : l'ascension droite et la déclinaison en radians.
export function equatorialToScene(ra, dec) {
  // Cosinus de la déclinaison.
  const c = Math.cos(dec);
  // Renvoie la direction, convertie vers la scène.
  return equatorialVecToScene([c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)]);
// Fin de equatorialToScene.
}

/** Même chose en degrés. */
// Déclare et exporte equatorialDegToScene : la même conversion à partir de degrés.
export const equatorialDegToScene = (raDeg, decDeg) => equatorialToScene(raDeg * D, decDeg * D);

/**
 * Repère galactique exprimé dans la scène : x vers le centre galactique, z vers le pôle nord galactique,
 * y complète le trièdre direct. Renvoie les trois axes unitaires orthogonaux.
 */
// Déclare et exporte galacticFrame.
export function galacticFrame() {
  // Axe z : la direction du pôle nord galactique.
  const z = norm(equatorialDegToScene(GALACTIC_POLE.ra, GALACTIC_POLE.dec));
  // Direction du centre galactique.
  const c = equatorialDegToScene(GALACTIC_CENTER.ra, GALACTIC_CENTER.dec);
  // Part de cette direction qui se trouve le long de z.
  const k = dot(c, z);
  // Axe x : la direction du centre, sans cette part, rendue unitaire.
  const x = norm([c[0] - k * z[0], c[1] - k * z[1], c[2] - k * z[2]]);
  // Axe y : z × x.
  const y = cross(z, x);
  // Renvoie les trois axes.
  return { x, y, z };
// Fin de galacticFrame.
}

/**
 * Base locale d'un objet étendu : centre, axe majeur et axe mineur (unitaires, dans la scène).
 * L'angle de position se mesure depuis le nord céleste, en tournant vers l'est.
 */
// Déclare et exporte deepSkyBasis : l'ascension droite, la déclinaison et l'angle de position en degrés.
export function deepSkyBasis(raDeg, decDeg, paDeg) {
  // Les trois angles en radians.
  const ra = raDeg * D, dec = decDeg * D, pa = paDeg * D;
  // Direction de l'objet, en équatorial.
  const center = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  // Direction du nord céleste à cet endroit.
  const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  // Direction de l'est à cet endroit.
  const east = [-Math.sin(ra), Math.cos(ra), 0];
  // Grand axe : le nord tourné de l'angle de position vers l'est.
  const major = [0, 1, 2].map((i) => Math.cos(pa) * north[i] + Math.sin(pa) * east[i]);
  // Petit axe : perpendiculaire au centre et au grand axe.
  const minor = cross(center, major);
  // Renvoie la base (début).
  return {
    // Le centre, dans la scène.
    center: equatorialVecToScene(center),
    // Le grand axe, dans la scène.
    major: equatorialVecToScene(major),
    // Le petit axe, dans la scène.
    minor: equatorialVecToScene(minor),
  // Fin de la base.
  };
// Fin de deepSkyBasis.
}

// clamp01 : borne une valeur entre 0 et 1.
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Température de couleur (K) → RVB 0..1, d'après l'approximation de Tanner Helland,
 * normalisée sur la composante la plus forte puis désaturée : à l'œil, les étoiles paraissent presque blanches.
 */
// Déclare et exporte temperatureToRgb : la température en kelvins et la saturation (0,6 par défaut).
export function temperatureToRgb(kelvin, saturation = 0.6) {
  // Température bornée entre 1000 et 40 000 K (5800 K si elle manque), divisée par 100.
  const t = Math.min(40000, Math.max(1000, kelvin || 5800)) / 100;
  // Les trois composantes.
  let r, g, b;
  // Jusqu'à 6600 K (début).
  if (t <= 66) {
    // Rouge au maximum.
    r = 255;
    // Vert : formule logarithmique.
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    // Bleu : nul jusqu'à 1900 K, puis formule logarithmique.
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  // Au-delà de 6600 K (début).
  } else {
    // Rouge : formule en puissance.
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    // Vert : formule en puissance.
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    // Bleu au maximum.
    b = 255;
  // Fin du choix.
  }
  // Les trois composantes ramenées entre 0 et 1.
  const rgb = [clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)];
  // La plus grande des trois, ou 1 si elle est nulle.
  const m = Math.max(...rgb) || 1;
  // Renvoie chaque composante normalisée sur la plus grande, puis rapprochée du blanc selon la saturation.
  return rgb.map((v) => 1 - saturation + saturation * (v / m));
// Fin de temperatureToRgb.
}

// ------------------------------------------------------------- catalogue binaire

/** Octets par étoile : 4 × Uint16 (AD, Déc, magnitude, température). */
// Déclare et exporte la taille d'une étoile dans le catalogue : 8 octets.
export const STAR_RECORD_BYTES = 8;
// Plus grande valeur d'un entier sur 16 bits.
const U16 = 65535;

/** Encodage d'une étoile (utilisé par le script de génération et les tests). */
// Déclare et exporte encodeStar : l'ascension droite, la déclinaison, la magnitude et la température.
export function encodeStar({ ra, dec, mag, kelvin }) {
  // Ascension droite ramenée entre 0 et 2π.
  const wrap = ((ra % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // Renvoie les quatre entiers (début).
  return [
    // L'ascension droite, répartie sur 16 bits ; un tour complet revient à 0.
    Math.round((wrap / (2 * Math.PI)) * U16) % (U16 + 1),
    // La déclinaison, de −π/2 à π/2, répartie sur 16 bits.
    Math.round(((dec + Math.PI / 2) / Math.PI) * U16),
    // La magnitude : (magnitude + 2) × 1000, bornée à 16 bits.
    Math.round(Math.min(U16, Math.max(0, (mag + 2) * 1000))),
    // La température : la moitié des kelvins (5800 K si elle manque), bornée à 16 bits.
    Math.round(Math.min(U16, Math.max(0, (kelvin || 5800) / 2))),
  // Fin des quatre entiers.
  ];
// Fin de encodeStar.
}

/**
 * Lecture du catalogue (little-endian) → tampons prêts pour une géométrie de points :
 * positions (directions unitaires dans la scène), magnitudes et couleurs.
 */
// Déclare et exporte decodeStarCatalog : le tampon binaire du catalogue.
export function decodeStarCatalog(buffer) {
  // Vue pour lire des nombres dans le tampon.
  const view = new DataView(buffer);
  // Nombre d'étoiles.
  const count = Math.floor(buffer.byteLength / STAR_RECORD_BYTES);
  // Tableau des positions : trois nombres par étoile.
  const positions = new Float32Array(count * 3);
  // Tableau des magnitudes.
  const mags = new Float32Array(count);
  // Tableau des couleurs : trois nombres par étoile.
  const colors = new Float32Array(count * 3);
  // Pour chaque étoile (début).
  for (let i = 0; i < count; i++) {
    // Position de son enregistrement dans le tampon.
    const o = i * STAR_RECORD_BYTES;
    // Ascension droite, en radians.
    const ra = (view.getUint16(o, true) / U16) * 2 * Math.PI;
    // Déclinaison, en radians.
    const dec = (view.getUint16(o + 2, true) / U16) * Math.PI - Math.PI / 2;
    // Direction de l'étoile dans la scène.
    const p = equatorialToScene(ra, dec);
    // La range dans les positions.
    positions.set(p, i * 3);
    // Magnitude : l'entier divisé par 1000, moins 2.
    mags[i] = view.getUint16(o + 4, true) / 1000 - 2;
    // Couleur : celle de sa température, le double de l'entier.
    colors.set(temperatureToRgb(view.getUint16(o + 6, true) * 2), i * 3);
  // Fin de la boucle.
  }
  // Renvoie le nombre d'étoiles et les trois tableaux.
  return { count, positions, mags, colors };
// Fin de decodeStarCatalog.
}

// ------------------------------------------------------------- visibilité

// smoothstep : passage progressif de 0 à 1 entre deux bornes (début).
const smoothstep = (a, b, x) => {
  // Avancement entre les bornes, entre 0 et 1.
  const t = clamp01((x - a) / (b - a));
  // Courbe en S.
  return t * t * (3 - 2 * t);
// Fin de smoothstep.
};

/**
 * Éblouissement par le Soleil : 1 quand le disque solaire est au centre de l'image, 0 hors du champ.
 * cosAngle : cosinus entre l'axe de visée et la direction du Soleil ; halfDiag : demi-diagonale du champ (rad) ;
 * sunRadius : rayon apparent du Soleil (rad).
 */
// Déclare et exporte sunGlare : le cosinus de l'angle avec le Soleil, la demi-diagonale du champ et le rayon apparent du Soleil.
export function sunGlare(cosAngle, halfDiag, sunRadius = 0) {
  // Angle entre l'axe de visée et le bord du disque solaire.
  const edge = Math.acos(Math.min(1, Math.max(-1, cosAngle))) - sunRadius;
  // Renvoie 1 jusqu'à la moitié de la demi-diagonale, puis décroît jusqu'à 0 un peu au-delà du champ.
  return 1 - smoothstep(halfDiag * 0.5, halfDiag + 0.1, edge);
// Fin de sunGlare.
}

/** Échelle de hauteur de l'atmosphère terrestre (km). */
// Hauteur d'échelle de l'atmosphère terrestre : 8 km.
const SCALE_HEIGHT_KM = 8;

/**
 * Voile du ciel de jour : 1 au sol en plein jour, ~0 la nuit (Soleil sous −6°) ou au-dessus de ~50 km.
 * altitudeKm : altitude de la caméra ; sinSunAlt : sinus de la hauteur du Soleil au point sous la caméra.
 */
// Déclare et exporte daySkyVeil : l'altitude en kilomètres et le sinus de la hauteur du Soleil.
export function daySkyVeil(altitudeKm, sinSunAlt) {
  // Densité de l'air à cette altitude, par rapport au sol.
  const density = Math.exp(-Math.max(0, altitudeKm) / SCALE_HEIGHT_KM);
  // Renvoie la densité multipliée par la part de jour, progressive entre −0,105 et 0,05.
  return density * smoothstep(-0.105, 0.05, sinSunAlt);
// Fin de daySkyVeil.
}

/** Intensité du ciel lointain (0..1) selon l'éblouissement solaire et le voile atmosphérique. */
// Déclare et exporte skyVisibility : l'éblouissement et le voile, nuls par défaut.
export function skyVisibility({ glare = 0, veil = 0 } = {}) {
  // Renvoie le produit de deux facteurs : jusqu'à 70 % de moins avec l'éblouissement, et un effacement progressif pour un voile entre 0,003 et 0,05.
  return (1 - 0.7 * clamp01(glare)) * (1 - smoothstep(0.003, 0.05, veil));
// Fin de skyVisibility.
}
