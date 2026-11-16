/**
 * Reconstruction de la mosaïque Kaguya de la Lune : calculs sur les pixels, sans dépendance (testés dans
 * moon-reconstruct.spec.ts). Le décodage et l'encodage des images sont faits par l'appelant (MoonTileCacheService,
 * avec sharp).
 *
 * Zones vides. La mosaïque de la caméra TC de Kaguya a des trous : bandes jamais photographiées, pixels transparents
 * ou noirs. Chaque trou est comblé par la même zone de la mosaïque mondiale de la caméra grand angle de LRO (LROC WAC,
 * 100 m par pixel, sans trou), ramenée à la luminosité et au contraste des pixels Kaguya valides de la tuile, avec un
 * bord adouci sur quelques pixels pour que le raccord ne se voie pas.
 *
 * Pôles. Au-delà de 70° de latitude, la mosaïque Kaguya n'est plus réaliste par endroits : bandes d'orbites éclairées
 * différemment, longues plages noires ou saturées. Là, et là seulement, elle est fondue avec la mosaïque LROC WAC
 * (éclairage homogène) : la luminosité vient de LROC, le grain fin reste celui de Kaguya. Le fondu grandit avec la
 * latitude (nul à 70°, complet à 84°) ; les parties de Kaguya qui s'accordent avec LROC ne sont pas touchées.
 */

/**
 * Mosaïque de remplissage chez NASA Moon Trek (plate carrée, même découpage que Kaguya), JPEG. Niveaux 0 à 7 sûrs ;
 * le niveau 8 (303 pixels par degré = un peu plus fin que le niveau 7) est essayé d'abord, et abandonné s'il manque.
 */
// MOON_FILL : la mosaïque de remplissage : son chemin, son jeu de tuiles, son extension, son niveau sûr (7) et le niveau à essayer (8).
export const MOON_FILL = { path: 'LRO_WAC_Mosaic_Global_303ppd_v02', matrixSet: 'default028mm', extension: 'jpg', maxZoom: 7, probeZoom: 8 } as const;

/** En dessous : pixel noir, donc sans image (les ombres réelles gardent un peu de signal). Sur 255. */
// Seuil du noir : 4 sur 255.
const BLACK = 4;
/** Nombre minimal de pixels vides pour reconstruire une tuile (quelques pixels isolés sont du bruit). */
// Nombre minimal de pixels vides : 16.
export const MIN_HOLE_PIXELS = 16;

/** Fondu des pôles : latitude (degrés, valeur absolue) où il commence, et où il est complet. */
// Latitudes de début et de fin du fondu des pôles.
export const POLAR = { start: 70, full: 84 } as const;
/** Écart de luminosité (sur 255, moyenné sur 9 × 9 pixels) entre Kaguya et LROC : début et fin du fondu. */
// Écarts de luminosité de début et de fin du fondu.
const DEVIATION = { from: 28, to: 70 } as const;
/** Kaguya trop sombre pour être fiable près des pôles (sur 255, moyenné) : fondu complet en dessous de `from`. */
// Seuils du « trop sombre ».
const DARK = { from: 6, to: 26 } as const;
/** Kaguya saturé (sur 255, moyenné) : fondu complet au-dessus de `to`. */
// Seuils du « saturé ».
const BRIGHT = { from: 244, to: 253 } as const;
/**
 * Grain fin de Kaguya gardé sur les zones fondues : écart du pixel à sa moyenne locale (sur 255). Entier jusqu'à
 * `from`, nul à partir de `to` : un écart fort est le bord d'une ombre ou d'une bande de Kaguya, à ne pas redessiner.
 */
// Seuils du grain fin.
const GRAIN = { from: 12, to: 36 } as const;
/** Rayon (pixels) de la moyenne locale qui sépare la luminosité d'ensemble du grain fin. */
// Rayon de la moyenne locale : 4 pixels, soit 9 × 9.
const LOW_RADIUS = 4;

// Forme du masque des pixels vides.
export interface HoleMask {
  /** 1 = pixel vide, 0 = pixel valide. */
  // mask : un octet par pixel.
  mask: Uint8Array;
  // holes : le nombre de pixels vides.
  holes: number;
// Fin de HoleMask.
}

/** Accord linéaire d'une mosaïque sur l'autre : valeur accordée = valeur × gain + offset. */
// Forme d'un accord linéaire.
export interface LinearMatch {
  // gain : le facteur.
  gain: number;
  // offset : le décalage.
  offset: number;
// Fin de LinearMatch.
}
// Accord qui ne change rien : gain 1, décalage 0.
export const IDENTITY: LinearMatch = { gain: 1, offset: 0 };

/** Sommes sur les pixels valides : Kaguya (k) et remplissage (f). */
// Forme des sommes.
export interface MatchStats {
  // count : nombre de pixels.
  count: number;
  // sk : somme des valeurs de Kaguya.
  sk: number;
  // sf : somme des valeurs du remplissage.
  sf: number;
  // sff : somme des carrés du remplissage.
  sff: number;
  // skf : somme des produits Kaguya × remplissage.
  skf: number;
// Fin de MatchStats.
}
// Fonction emptyStats : des sommes à zéro.
export const emptyStats = (): MatchStats => ({ count: 0, sk: 0, sf: 0, sff: 0, skf: 0 });

/** Pixels vides d'une tuile RGBA : transparents, ou noirs. */
// Fonction holeMask.
export function holeMask(rgba: Uint8Array, width: number, height: number): HoleMask {
  // Nombre de pixels.
  const n = width * height;
  // Masque, à zéro.
  const mask = new Uint8Array(n);
  // Compteur de pixels vides.
  let holes = 0;
  // Pour chaque pixel :
  for (let i = 0; i < n; i++) {
    // position de ses 4 octets ;
    const p = i * 4;
    // transparent (alpha sous 128) ou noir (les trois couleurs au plus à 4) : marqué vide et compté.
    if (rgba[p + 3] < 128 || Math.max(rgba[p], rgba[p + 1], rgba[p + 2]) <= BLACK) { mask[i] = 1; holes++; }
  // Fin de la boucle.
  }
  // Renvoie le masque et le compte.
  return { mask, holes };
// Fin de holeMask.
}

/**
 * Tuile de la mosaïque de remplissage qui couvre la tuile (z, x, y), et la portion à en extraire (en fraction de la
 * tuile, de 0 à 1). Au-delà du niveau natif du remplissage, c'est un ancêtre agrandi.
 */
// Fonction fillSource ; le niveau natif du remplissage vaut 7 par défaut.
export function fillSource(z: number, x: number, y: number, maxZoom: number = MOON_FILL.maxZoom) {
  // Nombre de niveaux à remonter.
  const up = Math.max(0, z - maxZoom);
  // Nombre de tuiles demandées par côté de la tuile ancêtre.
  const k = 2 ** up;
  // Renvoie la tuile ancêtre, et la position et la taille de la portion à extraire.
  return { z: z - up, x: Math.floor(x / k), y: Math.floor(y / k), left: (x % k) / k, top: (y % k) / k, size: 1 / k };
// Fin de fillSource.
}

/** Latitudes (degrés) du bord haut et du bord bas de la ligne de tuiles `y` au niveau `z` (2^z lignes de 90° à −90°). */
// Fonction tileLatitudes.
export function tileLatitudes(z: number, y: number): { top: number; bottom: number } {
  // Hauteur d'une ligne de tuiles, en degrés.
  const step = 180 / 2 ** z;
  // Renvoie le bord haut et le bord bas.
  return { top: 90 - y * step, bottom: 90 - (y + 1) * step };
// Fin de tileLatitudes.
}

// Fonction smoothstep : passage progressif de 0 à 1 entre a et b.
const smoothstep = (a: number, b: number, v: number) => {
  // Position de v entre a et b, ramenée entre 0 et 1.
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  // Courbe en S : départ et arrivée en douceur.
  return t * t * (3 - 2 * t);
// Fin de smoothstep.
};

/** Force du fondu des pôles à une latitude (degrés) : 0 jusqu'à 70°, 1 à partir de 84°, des deux côtés. */
// Fonction polarWeight.
export function polarWeight(latitude: number): number {
  // Courbe en S entre 70° et 84°, sur la valeur absolue de la latitude.
  return smoothstep(POLAR.start, POLAR.full, Math.abs(latitude));
// Fin de polarWeight.
}

/** Latitudes de la tuile si elle touche une zone polaire (au-delà de 70°), sinon null. */
// Fonction polarRows.
export function polarRows(z: number, y: number): { top: number; bottom: number } | null {
  // Latitudes de la tuile.
  const lat = tileLatitudes(z, y);
  // Les renvoie si un des bords dépasse 70°, sinon null.
  return Math.max(Math.abs(lat.top), Math.abs(lat.bottom)) > POLAR.start ? lat : null;
// Fin de polarRows.
}

/** Ajoute aux sommes les pixels valides d'une tuile (Kaguya RGBA et remplissage en gris, mêmes dimensions). */
// Fonction accumulate.
export function accumulate(stats: MatchStats, rgba: Uint8Array, fill: Uint8Array, mask: Uint8Array): MatchStats {
  // Pour chaque pixel :
  for (let i = 0; i < mask.length; i++) {
    // vide : ignoré ;
    if (mask[i]) continue;
    // k : gris de Kaguya (moyenne des trois couleurs) ; f : gris du remplissage ;
    const k = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3, f = fill[i];
    // ajoute aux cinq sommes.
    stats.count++; stats.sk += k; stats.sf += f; stats.sff += f * f; stats.skf += k * f;
  // Fin de la boucle.
  }
  // Renvoie les sommes.
  return stats;
// Fin de accumulate.
}

/**
 * Accord du remplissage sur Kaguya : même moyenne, et le contraste qui suit le mieux Kaguya (droite des moindres
 * carrés, gain borné de 0,6 à 1,6). Le grain fin de Kaguya, ses bandes et ses ombres, que le remplissage n'a pas,
 * ne gonflent donc pas le contraste du remplissage. null sans pixel.
 */
// Fonction linearMatch.
export function linearMatch(stats: MatchStats): LinearMatch | null {
  // Aucun pixel : null.
  if (stats.count < 1) return null;
  // Moyennes de Kaguya et du remplissage.
  const mk = stats.sk / stats.count, mf = stats.sf / stats.count;
  // Variance du remplissage.
  const variance = stats.sff / stats.count - mf * mf;
  // Gain : covariance divisée par la variance, bornée de 0,6 à 1,6 ; 1 si le remplissage est presque uni.
  const gain = variance > 1 ? Math.min(1.6, Math.max(0.6, (stats.skf / stats.count - mk * mf) / variance)) : 1;
  // Renvoie le gain, et le décalage qui donne la même moyenne que Kaguya.
  return { gain, offset: mk - mf * gain };
// Fin de linearMatch.
}

/** Moyenne en boîte (2R + 1)², bords prolongés. */
// Fonction boxBlur.
function boxBlur(src: Float32Array, width: number, height: number, R: number): Float32Array {
  // Deux tableaux : l'intermédiaire et le résultat.
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  // Premier passage, pour chaque ligne,
  for (let y = 0; y < height; y++) {
    // et chaque colonne :
    for (let x = 0; x < width; x++) {
      // somme à zéro ;
      let s = 0;
      // ajoute les voisins de gauche et de droite, sans sortir de l'image ;
      for (let d = -R; d <= R; d++) s += src[y * width + Math.min(width - 1, Math.max(0, x + d))];
      // range la moyenne.
      tmp[y * width + x] = s / (2 * R + 1);
    // Fin de la colonne.
    }
  // Fin du premier passage (horizontal).
  }
  // Second passage, pour chaque ligne,
  for (let y = 0; y < height; y++) {
    // et chaque colonne :
    for (let x = 0; x < width; x++) {
      // somme à zéro ;
      let s = 0;
      // ajoute les voisins du dessus et du dessous, sans sortir de l'image ;
      for (let d = -R; d <= R; d++) s += tmp[Math.min(height - 1, Math.max(0, y + d)) * width + x];
      // range la moyenne.
      out[y * width + x] = s / (2 * R + 1);
    // Fin de la colonne.
    }
  // Fin du second passage (vertical).
  }
  // Renvoie l'image floutée.
  return out;
// Fin de boxBlur.
}

// Forme des options de la reconstruction.
export interface ReconstructOptions {
  /** Latitudes (degrés) du haut et du bas de la tuile : active le fondu des pôles. */
  // polar : les latitudes de la tuile, ou rien.
  polar?: { top: number; bottom: number } | null;
  /** Accord mesuré sur la Lune entière : utilisé près des pôles, et pour une tuile presque vide. Identité par défaut. */
  // global : l'accord de la Lune entière.
  global?: LinearMatch;
// Fin de ReconstructOptions.
}

/**
 * Reconstruit la tuile `rgba` (modifiée sur place et renvoyée) avec l'image de remplissage `fill` (un octet de gris
 * par pixel, mêmes dimensions).
 *
 * Accord des deux mosaïques : le remplissage est ramené à la moyenne des pixels valides de la tuile, avec le
 * contraste qui les suit le mieux (voir linearMatch).
 * Si la tuile n'a presque aucun pixel valide (moins de 2 %), c'est l'accord mesuré sur la Lune entière qui sert.
 * Près des pôles, l'accord glisse vers celui de la Lune entière (le même pour toutes les tuiles : pas de damier).
 *
 * Zones vides : remplacées par le remplissage ; les pixels valides à moins de 3 pixels d'un trou y sont mêlés (60 %).
 * Pôles (`polar`) : là où Kaguya s'écarte de LROC, est noir ou saturé, il prend la luminosité de LROC et garde son
 * grain fin ; la force suit la latitude de chaque ligne (voir polarWeight).
 */
// Fonction reconstruct ; ses paramètres :
export function reconstruct(
  // la tuile, le remplissage, la largeur, la hauteur, le masque des vides et les options.
  rgba: Uint8Array, fill: Uint8Array, width: number, height: number, hole: HoleMask, options: ReconstructOptions = {},
// Elle renvoie la tuile.
): Uint8Array {
  // Nombre de pixels.
  const n = width * height;
  // Accord de la Lune entière, ou l'accord qui ne change rien.
  const global = options.global ?? IDENTITY;
  // Sommes sur les pixels valides de la tuile.
  const stats = accumulate(emptyStats(), rgba, fill, hole.mask);
  // Accord de la tuile si au moins 2 % des pixels sont valides ; sinon celui de la Lune entière.
  const local = (stats.count >= n * 0.02 ? linearMatch(stats) : null) ?? global;

  // Force du fondu polaire par ligne (latitude du milieu de la ligne).
  // Force du fondu polaire de chaque ligne : aucune au départ.
  let rows: Float32Array | null = null;
  // Si la tuile est en zone polaire :
  if (options.polar) {
    // une valeur par ligne ;
    rows = new Float32Array(height);
    // indicateur « au moins une ligne concernée » ;
    let any = false;
    // pour chaque ligne :
    for (let y = 0; y < height; y++) {
      // force à la latitude du milieu de la ligne ;
      rows[y] = polarWeight(options.polar.top + (options.polar.bottom - options.polar.top) * (y + 0.5) / height);
      // retient si elle est positive.
      any ||= rows[y] > 0;
    // Fin de la boucle.
    }
    // Aucune ligne concernée : pas de fondu.
    if (!any) rows = null;
  // Fin du cas.
  }

  // Remplissage accordé, pixel par pixel. Jamais noir : un trou comblé ne doit pas revenir.
  // Remplissage accordé, un gris par pixel.
  const ref = new Float32Array(n);
  // Pour chaque ligne :
  for (let y = 0, i = 0; y < height; y++) {
    // force du fondu de la ligne ;
    const wl = rows ? rows[y] : 0;
    // gain et décalage : ceux de la tuile, glissant vers ceux de la Lune entière avec la force du fondu ;
    const gain = local.gain + (global.gain - local.gain) * wl, offset = local.offset + (global.offset - local.offset) * wl;
    // pour chaque pixel : gris accordé, borné de 5 à 255.
    for (let x = 0; x < width; x++, i++) ref[i] = Math.min(255, Math.max(BLACK + 1, fill[i] * gain + offset));
  // Fin de la boucle.
  }

  // Masque en nombres décimaux.
  const softMask = new Float32Array(n);
  // Y copie le masque.
  for (let i = 0; i < n; i++) softMask[i] = hole.mask[i];
  // Le floute sur 5 × 5 pixels : c'est le bord adouci des trous.
  const soft = boxBlur(softMask, width, height, 2);

  // Pôles : luminosité d'ensemble de Kaguya (les trous prennent celle du remplissage) et du remplissage.
  // Luminosités d'ensemble de Kaguya et du remplissage : aucune au départ.
  let lowK: Float32Array | null = null, lowRef: Float32Array | null = null;
  // Gris de Kaguya.
  const kGray = new Float32Array(n);
  // Pour chaque pixel : le remplissage si le pixel est vide, sinon la moyenne des trois couleurs.
  for (let i = 0; i < n; i++) kGray[i] = hole.mask[i] ? ref[i] : (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3;
  // Irréalisme de Kaguya à l'échelle de 9 × 9 pixels (noir, saturé, ou loin de LROC), et son voisinage.
  // Irréalisme de Kaguya et son voisinage : aucun au départ.
  let unrealLow: Float32Array | null = null, near: Float32Array | null = null;
  // Si un fondu polaire est à faire :
  if (rows) {
    // luminosité d'ensemble de Kaguya ;
    lowK = boxBlur(kGray, width, height, LOW_RADIUS);
    // luminosité d'ensemble du remplissage ;
    lowRef = boxBlur(ref, width, height, LOW_RADIUS);
    // irréalisme, une valeur par pixel ;
    unrealLow = new Float32Array(n);
    // pour chaque pixel,
    for (let i = 0; i < n; i++) {
      // le plus grand de trois signes :
      unrealLow[i] = Math.max(
        // trop sombre ;
        1 - smoothstep(DARK.from, DARK.to, lowK[i]),
        // saturé ;
        smoothstep(BRIGHT.from, BRIGHT.to, lowK[i]),
        // loin du remplissage.
        smoothstep(DEVIATION.from, DEVIATION.to, Math.abs(lowK[i] - lowRef[i])),
      // Fin du calcul.
      );
    // Fin de la boucle.
    }
    // Voisinage : l'irréalisme flouté.
    near = boxBlur(unrealLow, width, height, LOW_RADIUS);
  // Fin du cas.
  }

  // Écriture du résultat, pour chaque ligne :
  for (let y = 0, i = 0; y < height; y++) {
    // force du fondu de la ligne ;
    const wl = rows ? rows[y] : 0;
    // pour chaque pixel :
    for (let x = 0; x < width; x++, i++) {
      // position de ses 4 octets ;
      const p = i * 4;
      // s'il est vide :
      if (hole.mask[i]) {
        // ses trois couleurs prennent le gris du remplissage ;
        rgba[p] = rgba[p + 1] = rgba[p + 2] = Math.round(ref[i]);
        // il devient opaque ;
        rgba[p + 3] = 255;
        // pixel suivant.
        continue;
      // Fin du cas.
      }
      // Poids du mélange : 60 % du bord adouci ; cible : le remplissage.
      let w = soft[i] * 0.6, target = ref[i];
      // Si la ligne est en zone polaire :
      if (wl > 0 && lowK && unrealLow && near) {
        // Au bord d'une zone irréaliste, la moyenne locale hésite : le pixel lui-même tranche (sinon un liseré de
        // Kaguya resterait autour de la zone). Loin de toute zone irréaliste, un pixel isolé n'est jamais touché :
        // les petites ombres réelles de Kaguya restent.
        // bord : le pixel s'écarte du remplissage et se trouve près d'une zone irréaliste ;
        const edge = Math.min(smoothstep(DEVIATION.from, DEVIATION.to, Math.abs(kGray[i] - ref[i])), smoothstep(0.05, 0.35, near[i]));
        // irréalisme retenu : le plus grand des deux.
        const unreal = Math.max(unrealLow[i], edge);
        // Grain fin de Kaguya, seulement là où Kaguya a du signal, et jamais le bord d'une ombre ou d'une bande.
        // Écart du pixel à sa moyenne locale.
        const d = kGray[i] - lowK[i];
        // Signal : fort si Kaguya n'est ni trop sombre ni saturé.
        const signal = smoothstep(DARK.from, DARK.to, lowK[i]) * (1 - smoothstep(BRIGHT.from, BRIGHT.to, lowK[i]));
        // Grain gardé : l'écart, réduit s'il est fort, multiplié par le signal.
        const grain = d * (1 - smoothstep(GRAIN.from, GRAIN.to, Math.abs(d))) * signal;
        // Cible : le remplissage plus le grain, borné de 5 à 255.
        target = Math.min(255, Math.max(BLACK + 1, ref[i] + grain * wl));
        // Poids : le plus grand entre le bord adouci et la force du fondu multipliée par l'irréalisme.
        w = Math.max(w, wl * unreal);
      // Fin du cas.
      }
      // Si le poids est positif, mêle chaque couleur avec la cible.
      if (w > 0) for (let c = 0; c < 3; c++) rgba[p + c] = Math.round(rgba[p + c] * (1 - w) + target * w);
    // Fin de la boucle des pixels.
    }
  // Fin de la boucle des lignes.
  }
  // Renvoie la tuile.
  return rgba;
// Fin de reconstruct.
}
