// Moteur de mouvement de la météo : les nuages de la Terre sont entraînés par le vent.
//
//  - Champ de vent : une petite grille mondiale (vitesse vers l'est et vers le nord, en m/s). Elle vient des vents
//    réels du moment relayés par l'API (GET /tiles/earth-wind), ou, à défaut, d'un modèle de la circulation générale :
//    alizés d'est sous les tropiques, vents d'ouest aux latitudes moyennes, vents d'est près des pôles.
//  - Animation : chaque point de la couche de nuages est déplacé le long du vent local. Le déplacement réel est trop
//    lent pour être vu (un nuage met des heures à traverser un pays) : le mouvement est accéléré, FLOW_SPAN_S secondes
//    de vent défilant en FLOW_PERIOD_S secondes d'écran, en boucle. Deux copies décalées d'une demi-boucle sont
//    fondues l'une dans l'autre pour que le retour au départ ne se voie pas.
// Les directions et les vitesses relatives sont donc celles du vent ; seule l'échelle de temps est changée.

// Déclare et exporte la durée d'une boucle à l'écran : 10 secondes.
export const FLOW_PERIOD_S = 10;        // durée d'une boucle à l'écran
// Déclare et exporte la durée de vent simulée pendant une boucle : 86 400 secondes.
export const FLOW_SPAN_S = 24 * 3600;   // vent simulé pendant une boucle : une journée
// Déclare et exporte l'accélération : le rapport des deux durées.
export const FLOW_ACCELERATION = FLOW_SPAN_S / FLOW_PERIOD_S; // ×8 640
// Déclare et exporte la largeur de la texture de vent : 36 cases.
export const WIND_TEXTURE_WIDTH = 36;   // cases de 10° de longitude, depuis -180°
// Déclare et exporte sa hauteur : 18 cases.
export const WIND_TEXTURE_HEIGHT = 18;  // cases de 10° de latitude, du sud au nord
// Déclare et exporte la plus grande vitesse codée : 60 m/s.
export const WIND_MAX_MS = 60;          // vitesse codée au maximum (un octet par composante)

/** Vent moyen de la circulation générale à une latitude (degrés) : [vers l'est, vers le nord] en m/s. */
// Déclare et exporte modelWind : la latitude en degrés.
export function modelWind(latDeg) {
  // Latitude en radians.
  const lat = (latDeg * Math.PI) / 180;
  // Sa valeur absolue.
  const al = Math.abs(lat);
  // bump : courbe en cloche centrée sur une latitude, d'une largeur donnée.
  const bump = (center, width) => Math.exp(-(((al - center) / width) ** 2));
  // Vent vers l'est : −7 m/s autour de l'équateur, +16 m/s autour de 0,85 radian, −4 m/s autour de 1,35 radian.
  const east = -7 * Math.exp(-((lat / 0.35) ** 2)) + 16 * bump(0.85, 0.3) - 4 * bump(1.35, 0.2);
  // Renvoie ce vent, sans composante vers le nord.
  return [east, 0];
// Fin de modelWind.
}

/**
 * Vent d'une grille { width, height, latStart, latStep, lonStart, lonStep, u[], v[] } (lignes du sud au nord) en un
 * point, par interpolation ; la longitude boucle, la latitude est bornée aux lignes extrêmes.
 */
// Déclare et exporte sampleWind : la grille, la longitude et la latitude en degrés.
export function sampleWind(grid, lonDeg, latDeg) {
  // Position en colonnes, ramenée entre 0 et la largeur : la longitude boucle.
  const fx = ((((lonDeg - grid.lonStart) / grid.lonStep) % grid.width) + grid.width) % grid.width;
  // Position en lignes, bornée entre la première et la dernière ligne.
  const fy = Math.min(grid.height - 1, Math.max(0, (latDeg - grid.latStart) / grid.latStep));
  // Colonne et ligne de la case, la ligne ne dépassant pas la dernière.
  const x0 = Math.floor(fx), y0 = Math.min(grid.height - 1, Math.floor(fy));
  // Colonne suivante (qui boucle) et ligne suivante (bornée).
  const x1 = (x0 + 1) % grid.width, y1 = Math.min(grid.height - 1, y0 + 1);
  // Parts de la colonne et de la ligne suivantes.
  const tx = fx - x0, ty = fy - y0;
  // at : valeur d'un tableau à une colonne et une ligne, ou 0 si elle manque.
  const at = (a, x, y) => a[y * grid.width + x] ?? 0;
  // mix : interpolation entre les quatre valeurs voisines.
  const mix = (a) => (at(a, x0, y0) * (1 - tx) + at(a, x1, y0) * tx) * (1 - ty) + (at(a, x0, y1) * (1 - tx) + at(a, x1, y1) * tx) * ty;
  // Renvoie les deux composantes interpolées.
  return [mix(grid.u), mix(grid.v)];
// Fin de sampleWind.
}

/** Grille de vent utilisable ? */
// Déclare et exporte isWindGrid : la grille à contrôler.
export function isWindGrid(grid) {
  // Vrai si la grille existe, avec une largeur et une hauteur entières d'au moins 2,
  return Boolean(grid) && Number.isInteger(grid.width) && Number.isInteger(grid.height) && grid.width >= 2 && grid.height >= 2
    // des tableaux u et v de la bonne longueur,
    && Array.isArray(grid.u) && Array.isArray(grid.v) && grid.u.length === grid.width * grid.height && grid.v.length === grid.u.length
    // et des origines et des pas finis, les pas étant positifs.
    && [grid.latStart, grid.latStep, grid.lonStart, grid.lonStep].every(Number.isFinite) && grid.latStep > 0 && grid.lonStep > 0;
// Fin de isWindGrid.
}

// encode : vitesse en m/s vers un octet ; 0 m/s donne le milieu de l'échelle, ±60 m/s les extrémités.
const encode = (ms) => Math.round(Math.min(1, Math.max(0, 0.5 + ms / (2 * WIND_MAX_MS))) * 255);

/**
 * Texture de vent du shader : RGBA, WIND_TEXTURE_WIDTH × WIND_TEXTURE_HEIGHT, rouge = vers l'est, vert = vers le nord
 * (127,5 = calme). `grid` nul ou invalide : modèle de circulation générale.
 */
// Déclare et exporte windTexels : la grille de vent, aucune par défaut.
export function windTexels(grid = null) {
  // Vrai si la grille est utilisable.
  const real = isWindGrid(grid);
  // Tableau de la texture : quatre octets par case.
  const out = new Uint8Array(WIND_TEXTURE_WIDTH * WIND_TEXTURE_HEIGHT * 4);
  // Pour chaque ligne de la texture (début).
  for (let y = 0; y < WIND_TEXTURE_HEIGHT; y++) {
    // Latitude du milieu de la ligne, du sud au nord.
    const lat = -90 + (y + 0.5) * (180 / WIND_TEXTURE_HEIGHT);
    // Pour chaque colonne (début).
    for (let x = 0; x < WIND_TEXTURE_WIDTH; x++) {
      // Longitude du milieu de la colonne, depuis −180°.
      const lon = -180 + (x + 0.5) * (360 / WIND_TEXTURE_WIDTH);
      // Vent de ce point : lu dans la grille réelle, sinon donné par le modèle.
      const [east, north] = real ? sampleWind(grid, lon, lat) : modelWind(lat);
      // Indice du premier octet de la case.
      const i = (y * WIND_TEXTURE_WIDTH + x) * 4;
      // Rouge : vent vers l'est ; vert : vent vers le nord ; bleu : 0 ; opacité : 255.
      out[i] = encode(east); out[i + 1] = encode(north); out[i + 2] = 0; out[i + 3] = 255;
    // Fin de la boucle des colonnes.
    }
  // Fin de la boucle des lignes.
  }
  // Renvoie la texture.
  return out;
// Fin de windTexels.
}

/**
 * État de l'animation à l'instant `seconds` : secondes de vent appliquées aux deux copies (de -SPAN/2 à +SPAN/2)
 * et poids de la seconde. La copie qui revient au départ a toujours un poids nul à cet instant.
 */
// Déclare et exporte flowState : l'instant en secondes.
export function flowState(seconds) {
  // Avancement de la première copie dans la boucle, entre 0 et 1, même pour un instant négatif.
  const phase0 = (((seconds / FLOW_PERIOD_S) % 1) + 1) % 1;
  // Avancement de la seconde copie : décalé d'une demi-boucle.
  const phase1 = (phase0 + 0.5) % 1;
  // Renvoie les secondes de vent des deux copies et le poids de la seconde : 1 quand la première est au départ ou à la fin de sa boucle, 0 à son milieu.
  return { s0: (phase0 - 0.5) * FLOW_SPAN_S, s1: (phase1 - 0.5) * FLOW_SPAN_S, weight1: Math.abs(2 * phase0 - 1) };
// Fin de flowState.
}
