/**
 * Données de l'onglet « Théorie quantique » de la fenêtre Node : la théorie Gobai Space, selon laquelle le système
 * solaire serait un atome d'une masse très grande (le Soleil = noyau, les planètes = électrons sur leurs orbites),
 * le tableau périodique des éléments dessiné avec l'élément hypothétique « Solarium » ajouté, et la correspondance
 * entre les couches atomiques (K, L, M…) et les orbites des planètes.
 *
 * La théorie est une analogie spéculative, présentée comme telle dans l'interface.
 */

// Les 118 symboles chimiques connus, dans l'ordre des numéros atomiques (1 = hydrogène … 118 = oganesson).
export const SYMBOLES = [
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
  'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
  'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th',
  'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm',
  'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds',
  'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
];

// Nombre d'éléments de chaque période du tableau périodique (2, 8, 8, 18, 18, 32, 32 = 118 éléments).
export const CAPACITES_PERIODES = [2, 8, 8, 18, 18, 32, 32];

// Nombre total d'éléments connus : la somme des capacités.
export const NOMBRE_ELEMENTS = CAPACITES_PERIODES.reduce((s, n) => s + n, 0);

/**
 * Position d'un élément dans le dessin du tableau périodique : sa période (ligne 1 à 7), son groupe (colonne 1 à 18)
 * ou, pour les lanthanides et actinides, sa ligne du bloc f (9 = lanthanides, 10 = actinides) et sa colonne du bloc f
 * (1 à 15, affichée à partir du groupe 3).
 */
// position : calcule la position du numéro atomique z (1 à 118) dans le dessin.
export function position(z) {
  // Le numéro doit être un élément connu.
  if (z < 1 || z > NOMBRE_ELEMENTS) throw new RangeError(`numéro atomique hors tableau : ${z}`);
  // Période : la première dont la capacité cumulée atteint z.
  let periode = 1, cumule = 0;
  // Tant que z dépasse la capacité cumulée : on passe à la période suivante.
  while (cumule + CAPACITES_PERIODES[periode - 1] < z) { cumule += CAPACITES_PERIODES[periode - 1]; periode += 1; }
  // Index de l'élément dans sa période, de 1 à la capacité de la période.
  const i = z - cumule;
  // L'hélium (z = 2) est placé en haut à droite, dans le groupe 18.
  if (z === 2) return { periode, groupe: 18 };
  // Périodes 2 et 3 (8 éléments) : groupes 1, 2, puis 13 à 18.
  if (periode <= 3) return { periode, groupe: i <= 2 ? i : i + 10 };
  // Périodes 4 et 5 (18 éléments) : le groupe est l'index lui-même.
  if (periode <= 5) return { periode, groupe: i };
  // Périodes 6 et 7 (32 éléments) : index 3 à 17 = bloc f (lanthanides ou actinides), le reste décalé de 14.
  if (i <= 2) return { periode, groupe: i };
  // Bloc f : ligne 9 pour la période 6 (lanthanides, z 57 à 71), ligne 10 pour la période 7 (actinides, z 89 à 103).
  if (i <= 17) return { blocF: periode === 6 ? 9 : 10, colonneF: i - 2 };
  // Le reste du bloc principal : groupes 4 à 18.
  return { periode, groupe: i - 14 };
// Fin de position.
}

/**
 * Sous-couches remplies dans l'ordre de Klechkowski (1s, 2s, 2p, 3s, 3p, 4s, 3d…) : chacune avec sa couche (n de 1
 * à 7) et sa capacité maximale en électrons.
 */
// SOUS_COUCHES : [couche n, capacité], dans l'ordre de remplissage.
const SOUS_COUCHES = [
  [1, 2], [2, 2], [2, 6], [3, 2], [3, 6], [4, 2], [3, 10], [4, 6],
  [5, 2], [4, 10], [5, 6], [6, 2], [4, 14], [5, 10], [6, 6], [7, 2], [5, 14], [6, 10], [7, 6],
];

/**
 * Répartition des électrons d'un élément par couche atomique (K, L, M, N…) : le tableau des électrons par couche,
 * de K (n = 1) à la dernière couche occupée. Ex. fer (26) → [2, 8, 14, 2]. Pour le Solarium (119), le dernier électron
 * partirait sur la couche R (n = 8).
 */
// couchesElectroniques : calcule les électrons par couche du numéro atomique z.
export function couchesElectroniques(z) {
  // Huit couches, de K (n = 1) à R (n = 8), à zéro au départ.
  const couches = [0, 0, 0, 0, 0, 0, 0, 0];
  // Électrons restant à placer.
  let reste = z;
  // Chaque sous-couche, dans l'ordre de remplissage : on y place le maximum, ou ce qui reste.
  for (const [n, cap] of SOUS_COUCHES) {
    // Les électrons placés dans cette sous-couche.
    const pris = Math.min(reste, cap);
    // Ajoutés à la couche.
    couches[n - 1] += pris;
    // Retirés du reste.
    reste -= pris;
    // Tout est placé : on s'arrête.
    if (reste === 0) break;
  // Fin du parcours.
  }
  // Au-delà de 118 (Solarium) : le surplus part sur la couche R (n = 8).
  if (reste > 0) couches[7] = reste;
  // Les couches vides de la fin sont retirées (au moins la couche K reste).
  while (couches.length > 1 && couches[couches.length - 1] === 0) couches.pop();
  // La répartition, de K à la dernière couche occupée.
  return couches;
// Fin de couchesElectroniques.
}

/** Les 118 éléments avec leur position dans le dessin et leurs couches atomiques : z, symbole, periodes/groupes, couches. */
// ELEMENTS : le tableau périodique complet, calculé une fois.
export const ELEMENTS = SYMBOLES.map((symbole, index) => ({ z: index + 1, symbole, ...position(index + 1), couches: couchesElectroniques(index + 1) }));

/**
 * L'élément ajouté par la théorie Gobai Space : le « Solarium », numéro atomique 119, symbole « So », première case
 * de la période 8 (groupe 1, comme un alcalin « super-francium »). Dans la théorie, le Soleil serait le noyau de cet
 * atome géant ; dans la réalité, le plus lourd élément connu reste l'oganesson (118) et le 119 n'existe pas encore.
 */
// SOLARIUM : l'élément hypothétique n° 119 ajouté au tableau.
export const SOLARIUM = {
  z: 119,
  symbole: 'So',
  nom: 'Solarium',
  periode: 8,
  groupe: 1,
  couches: couchesElectroniques(119),
  note: 'Élément hypothétique de la théorie Gobai Space : le Soleil en serait le noyau.',
};

/**
 * Le deuxième élément ajouté par la théorie, sur la même optique : le « Proximium », placé en n = 3 (période 3, groupe 3,
 * dans le vide du bloc d de la troisième ligne). Son noyau serait Proxima Centauri, l'étoile la plus proche du Soleil
 * (≈ 4,24 années-lumière) : dans l'analogie, chaque étoile serait le noyau d'un atome géant.
 */
// PROXIMUM : l'élément hypothétique n° 120, placé en n = 3.
export const PROXIMUM = {
  z: 120,
  symbole: 'Pr',
  nom: 'Proximium',
  periode: 3,
  groupe: 3,
  couches: couchesElectroniques(120),
  note: 'Élément hypothétique de la théorie Gobai Space : Proxima Centauri en serait le noyau (étoile la plus proche, ≈ 4,24 a.l.).',
};

/**
 * La molécule ajoutée par la théorie, sur la même optique que le Solarium et le Proximium : « SoaCen », molécule
 * diatomique formée du Solarium (So, noyau = le Soleil) et d'« aCen » (Alpha Centauri / Proxima Centauri — le
 * Proximium du tableau hypothétique), liés par une liaison simple (paire d'électrons partagée) — dans l'analogie,
 * la « liaison » serait la gravitation entre le Soleil et Alpha Centauri, les deux étoiles les plus proches.
 * Le symbole « Pr » est abandonné dans la molécule au profit du code « aCen » (alpha Centauri).
 */
// MOLECULE : la molécule hypothétique SoaCen (So–aCen).
export const MOLECULE = {
  nom: 'SoaCen',
  formule: 'So–aCen',
  symboles: ['So', 'aCen'],
  atomes: [SOLARIUM, PROXIMUM],
  liaison: 'Liaison simple (paire d’électrons partagée) ; dans l’analogie, la gravitation entre le Soleil et Alpha Centauri.',
};

/** Masse du Soleil, en kilogrammes (≈ 99,86 % de la masse du système solaire). */
export const MASSE_SOLEIL_KG = 1.989e30;

/**
 * Correspondance de la théorie entre les couches atomiques et les orbites des planètes : la couche K (n = 1) serait
 * l'orbite de Mercure, la L celle de Vénus, et ainsi de suite jusqu'à la couche R (n = 8) pour Neptune. La capacité
 * maximale d'une couche est 2n² électrons (au-delà de n = 4, cette valeur est théorique).
 */
// COUCHES : les huit couches K à R, avec leur planète selon la théorie.
export const COUCHES = [
  { couche: 'K', n: 1, planete: 'Mercure' },
  { couche: 'L', n: 2, planete: 'Vénus' },
  { couche: 'M', n: 3, planete: 'Terre' },
  { couche: 'N', n: 4, planete: 'Mars' },
  { couche: 'O', n: 5, planete: 'Jupiter' },
  { couche: 'P', n: 6, planete: 'Saturne' },
  { couche: 'Q', n: 7, planete: 'Uranus' },
  { couche: 'R', n: 8, planete: 'Neptune' },
].map((c) => ({ ...c, capacite: 2 * c.n * c.n }));
