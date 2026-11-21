/**
 * Données de l'onglet « Théorie quantique » de la fenêtre Node : la théorie Gobai Space, selon laquelle le système
 * solaire serait un atome d'une masse très grande (le Soleil = noyau, les planètes = électrons sur leurs orbites),
 * le tableau périodique des éléments dessiné avec l'élément hypothétique « Solarium » ajouté, et la correspondance
 * entre les couches atomiques (K, L, M…) et les orbites des planètes.
 *
 * La théorie est une analogie spéculative, présentée comme telle dans l'interface.
 */

// Constantes physiques communes (CODATA 2018, UAI 2015).
import { E, EPS0, G, H, HBAR, M_E, M_P, M_SOLEIL, R_PROTON, R_SOLEIL, UA, ANNEE_LUMIERE, EV } from './constantesPhysiques.js';
// Éléments képlériens du moteur : le demi-grand axe de chaque planète vient du catalogue, il n'est pas recopié ici.
import { ASTRE_BY_ID } from '../../../Engine/SystemeEngine/astronomy/data/kepler-elements.ts';
// Masses des astres du moteur, en kilogrammes.
import { BODY_MASS_KG } from '../../../Engine/AstreSolideEngine/OrbitEngine/gravityMath.jsx';

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
/**
 * Exceptions à la règle de Klechkowski : vingt éléments dont la configuration mesurée à l'état fondamental diffère du
 * remplissage régulier (un électron s passe en d, ou un électron f en d). Sans cette table, le chrome sortait en
 * [2, 8, 12, 2] au lieu de [2, 8, 13, 1], le cuivre en [2, 8, 17, 2] au lieu de [2, 8, 18, 1], etc.
 * Source : configurations électroniques de référence du NIST (Atomic Spectra Database).
 */
// EXCEPTIONS_COUCHES : numéro atomique → électrons par couche mesurés.
export const EXCEPTIONS_COUCHES = {
  // Chrome et cuivre (4s¹ au lieu de 4s²).
  24: [2, 8, 13, 1], 29: [2, 8, 18, 1],
  // Niobium, molybdène, ruthénium, rhodium, palladium (4d¹⁰, 5s vide) et argent.
  41: [2, 8, 18, 12, 1], 42: [2, 8, 18, 13, 1], 44: [2, 8, 18, 15, 1], 45: [2, 8, 18, 16, 1], 46: [2, 8, 18, 18], 47: [2, 8, 18, 18, 1],
  // Lanthane, cérium et gadolinium (un électron en 5d).
  57: [2, 8, 18, 18, 9, 2], 58: [2, 8, 18, 19, 9, 2], 64: [2, 8, 18, 25, 9, 2],
  // Platine et or (6s¹).
  78: [2, 8, 18, 32, 17, 1], 79: [2, 8, 18, 32, 18, 1],
  // Actinium, thorium, protactinium, uranium, neptunium et curium (électrons en 6d).
  89: [2, 8, 18, 32, 18, 9, 2], 90: [2, 8, 18, 32, 18, 10, 2], 91: [2, 8, 18, 32, 20, 9, 2], 92: [2, 8, 18, 32, 21, 9, 2],
  93: [2, 8, 18, 32, 22, 9, 2], 96: [2, 8, 18, 32, 25, 9, 2],
  // Lawrencium (7p¹ au lieu de 6d¹).
  103: [2, 8, 18, 32, 32, 8, 3],
};

// couchesElectroniques : calcule les électrons par couche du numéro atomique z.
export function couchesElectroniques(z) {
  // Élément à configuration irrégulière : la répartition mesurée, copiée pour ne pas exposer la table.
  if (EXCEPTIONS_COUCHES[z]) return EXCEPTIONS_COUCHES[z].slice();
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
  // Masse atomique de l'élément hypothétique : la masse du Soleil, 1,00 M☉ (≈ 1,989 × 10^30 kg ≈ 1,2 × 10^57 u).
  masse: '1,00 M☉',
  masseDetail: '≈ 1,989 × 10³⁰ kg (≈ 1,2 × 10⁵⁷ u) — la masse du Soleil',
  note: 'Élément hypothétique de la théorie Gobai Space : le Soleil en serait le noyau.',
};

/**
 * Le deuxième élément ajouté par la théorie, sur la même optique : le « Proximium », placé en n = 3 (période 3, groupe 3,
 * dans le vide du bloc d de la troisième ligne). Son noyau serait Proxima Centauri, l'étoile la plus proche du Soleil
 * (≈ 4,25 années-lumière) : dans l'analogie, chaque étoile serait le noyau d'un atome géant.
 */
// PROXIMUM : l'élément hypothétique n° 120, placé en n = 3.
export const PROXIMUM = {
  z: 120,
  symbole: 'Pr',
  nom: 'Proximium',
  periode: 3,
  groupe: 3,
  couches: couchesElectroniques(120),
  note: 'Élément hypothétique de la théorie Gobai Space : Proxima Centauri en serait le noyau (étoile la plus proche, ≈ 4,25 a.l.).',
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

/** Auteur de la théorie Gobai Space, qui signe la page « Théorie quantique » (même nom que la balise meta author du site). */
// AUTEUR : la signature de la page.
export const AUTEUR = 'Alexis Bouvet-Mallet';

/** Masse du Soleil, en kilogrammes (≈ 99,86 % de la masse du système solaire). */
// La valeur vient de la table commune des constantes.
export const MASSE_SOLEIL_KG = M_SOLEIL;

/**
 * Correspondance de la théorie entre les couches atomiques et les orbites des planètes : la couche K (n = 1) serait
 * l'orbite de Mercure, la L celle de Vénus, et ainsi de suite jusqu'à la couche R (n = 8) pour Neptune. La capacité
 * maximale d'une couche est 2n² électrons (au-delà de n = 4, cette valeur est théorique).
 */
// COUCHES : les huit couches K à R, avec leur planète selon la théorie et son identifiant dans le moteur.
export const COUCHES = [
  { couche: 'K', n: 1, planete: 'Mercure', id: 'mercury' },
  { couche: 'L', n: 2, planete: 'Vénus', id: 'venus' },
  { couche: 'M', n: 3, planete: 'Terre', id: 'earth' },
  { couche: 'N', n: 4, planete: 'Mars', id: 'mars' },
  { couche: 'O', n: 5, planete: 'Jupiter', id: 'jupiter' },
  { couche: 'P', n: 6, planete: 'Saturne', id: 'saturn' },
  { couche: 'Q', n: 7, planete: 'Uranus', id: 'uranus' },
  { couche: 'R', n: 8, planete: 'Neptune', id: 'neptune' },
// Chaque couche reçoit sa capacité 2n², le demi-grand axe de sa planète (en mètres) et la masse de la planète (en kg).
].map((c) => ({ ...c, capacite: 2 * c.n * c.n, a: ASTRE_BY_ID.get(c.id).kepler.a * UA, masse: BODY_MASS_KG[c.id] }));

/* ------------------------------------------------------------------------------------------------------------------
 * Calculs de la théorie : l'analogie « atome ↔ système solaire » mise en nombres.
 * Chaque valeur affichée dans l'onglet est calculée ici à partir des constantes ; rien n'est recopié à la main.
 * ---------------------------------------------------------------------------------------------------------------- */

/**
 * Rayon de Bohr : rayon de l'orbite fondamentale de l'électron dans l'atome d'hydrogène,
 * a₀ = 4π ε₀ ħ² / (m_e e²) ≈ 5,29 × 10⁻¹¹ m. C'est l'unité de taille d'un atome.
 */
// rayonBohr : calcule a₀, en mètres.
export const rayonBohr = () => (4 * Math.PI * EPS0 * HBAR * HBAR) / (M_E * E * E);

/**
 * Énergie du niveau n de l'hydrogène dans le modèle de Bohr : E_n = −m_e e⁴ / (8 ε₀² h² n²) = −13,6 eV / n².
 * Le signe moins dit que l'électron est lié : il faut fournir 13,6 eV pour l'arracher du niveau fondamental.
 */
// energieNiveau : calcule E_n, en électronvolts.
export const energieNiveau = (n) => -(M_E * E ** 4) / (8 * EPS0 * EPS0 * H * H * n * n) / EV;

/** Rayon de l'orbite n du modèle de Bohr : r_n = n² a₀ (les couches s'écartent comme le carré de leur numéro). */
// rayonCouche : calcule r_n, en mètres.
export const rayonCouche = (n) => n * n * rayonBohr();

/**
 * Rapport des forces entre un proton et un électron : attraction électrique / attraction gravitationnelle,
 * e² / (4π ε₀ G m_p m_e) ≈ 2,3 × 10³⁹. Il ne dépend pas de la distance (les deux forces décroissent en 1/r²).
 * C'est la raison pour laquelle l'atome est tenu par l'électricité et le système solaire par la gravité.
 */
// rapportForces : calcule ce rapport, sans unité.
export const rapportForces = () => (E * E) / (4 * Math.PI * EPS0 * G * M_P * M_E);

/** Vitesse d'une orbite circulaire de rayon a autour du Soleil : v = √(G M☉ / a), en mètres par seconde. */
// vitesseOrbitale : calcule v pour un demi-grand axe a (en mètres).
export const vitesseOrbitale = (a) => Math.sqrt((G * M_SOLEIL) / a);

/**
 * Longueur d'onde de De Broglie d'une planète : λ = h / (m v). Un objet se comporte comme une onde quand λ est
 * comparable à la taille de son orbite ; pour une planète, λ vaut ~10⁻⁶³ m : aucun effet quantique n'est observable.
 */
// longueurOnde : calcule λ pour une masse m (kg) sur une orbite de demi-grand axe a (m).
export const longueurOnde = (m, a) => H / (m * vitesseOrbitale(a));

/**
 * « Nombre quantique » d'une planète : la règle de Bohr L = n ħ appliquée à son moment cinétique orbital
 * L = m √(G M☉ a). Pour la Terre, n ≈ 2,5 × 10⁷⁴ : les niveaux voisins sont si serrés que l'orbite paraît continue
 * (principe de correspondance de Bohr : aux grands n, la mécanique quantique rejoint la mécanique classique).
 */
// nombreQuantique : calcule n = L / ħ pour une masse m (kg) et un demi-grand axe a (m).
export const nombreQuantique = (m, a) => (m * Math.sqrt(G * M_SOLEIL * a)) / HBAR;

/**
 * Rayon de Bohr gravitationnel d'une planète : ce que vaudrait son orbite fondamentale (n = 1) si la gravité
 * remplaçait l'électricité dans la formule de Bohr, a_g = ħ² / (G M☉ m²). Pour la Terre : ~10⁻¹³⁸ m.
 */
// rayonBohrGravitationnel : calcule a_g pour une masse m (kg), en mètres.
export const rayonBohrGravitationnel = (m) => (HBAR * HBAR) / (G * M_SOLEIL * m * m);

/**
 * La correspondance couches ↔ planètes mise à l'épreuve : dans le modèle de Bohr le rayon croît en n², donc la
 * planète de la couche n devrait être n² fois plus loin que Mercure (couche K). On compare cette prédiction au
 * demi-grand axe réel. L'écart est donné en pourcentage du rayon prédit : positif si la planète est plus loin.
 */
// ORBITES : pour chaque couche, la distance prédite (n²), la distance réelle et les grandeurs quantiques de la planète.
export const ORBITES = COUCHES.map((c) => {
  // Distance réelle, en multiples du demi-grand axe de Mercure.
  const reel = c.a / COUCHES[0].a;
  // Distance prédite par la loi en n² de Bohr.
  const predit = c.n * c.n;
  // La ligne de la planète.
  return {
    ...c,
    // Demi-grand axe en unités astronomiques.
    ua: c.a / UA,
    // Distance prédite et distance réelle, en multiples de l'orbite de Mercure.
    predit, reel,
    // Écart relatif entre le réel et la prédiction, en pourcentage.
    ecart: ((reel - predit) / predit) * 100,
    // Vitesse orbitale, longueur d'onde de De Broglie et nombre quantique orbital de la planète.
    vitesse: vitesseOrbitale(c.a), lambda: longueurOnde(c.masse, c.a), nQuantique: nombreQuantique(c.masse, c.a),
  };
// Fin du calcul des orbites.
});

/** Écart moyen (en valeur absolue) entre la loi en n² et les orbites réelles, en pourcentage. */
// ecartMoyenOrbites : la moyenne des écarts absolus, Mercure exclu (il sert de référence, son écart est nul).
export const ecartMoyenOrbites = () => ORBITES.slice(1).reduce((s, o) => s + Math.abs(o.ecart), 0) / (ORBITES.length - 1);

// Distance du Soleil à Proxima Centauri, l'étoile la plus proche, en années-lumière (parallaxe Gaia DR3 : 768,07 mas).
export const DISTANCE_PROXIMA_AL = 4.2465;
// Longueur de la liaison H–H de la molécule de dihydrogène, en mètres (74,14 pm).
export const LIAISON_H2 = 74.14e-12;

/**
 * La comparaison chiffrée entre l'atome d'hydrogène et le système solaire, grandeur par grandeur. Chaque ligne
 * donne la valeur côté atome, la valeur côté système solaire et leur rapport (système solaire / atome).
 */
// comparaisonAtomeSysteme : calcule les lignes de la comparaison.
export function comparaisonAtomeSysteme() {
  // Rayon de Bohr et demi-grand axe de Neptune (la dernière couche de la théorie).
  const a0 = rayonBohr(), aNeptune = COUCHES[7].a;
  // Masse totale des huit planètes.
  const planetes = COUCHES.reduce((s, c) => s + c.masse, 0);
  // Les lignes : identifiant, libellé, valeur atome, valeur système solaire.
  return [
    // Taille du centre rapportée à la taille de l'ensemble : le proton dans l'atome, le Soleil dans l'orbite de Neptune.
    { id: 'vide', libelle: 'Taille du noyau / taille de l’ensemble', atome: R_PROTON / a0, systeme: R_SOLEIL / aNeptune },
    // Part de la masse totale portée par le centre.
    { id: 'masse', libelle: 'Part de la masse dans le noyau', atome: M_P / (M_P + M_E), systeme: M_SOLEIL / (M_SOLEIL + planetes) },
    // Taille de la première couche : a₀ pour l'atome, l'orbite de Mercure pour le système solaire.
    { id: 'taille', libelle: 'Rayon de la couche K (m)', atome: a0, systeme: COUCHES[0].a },
    // Distance au voisin rapportée à la taille de l'ensemble : la liaison H–H, puis Soleil–Proxima sur l'orbite de Neptune.
    { id: 'voisin', libelle: 'Distance au voisin / taille de l’ensemble', atome: LIAISON_H2 / a0, systeme: (DISTANCE_PROXIMA_AL * ANNEE_LUMIERE) / aNeptune },
  // Chaque ligne reçoit son rapport système solaire / atome.
  ].map((l) => ({ ...l, rapport: l.systeme / l.atome }));
// Fin de comparaisonAtomeSysteme.
}
