/**
 * Calculs de la charge électrique du Soleil en fonction de sa température T (en kelvins), pour l'onglet « Théorie
 * quantique ». Deux réalités physiques :
 *  - la charge totale libérée par le plasma ionisé (+Q et −Q libres, qui s'équilibrent presque parfaitement) ;
 *  - la charge nette, légèrement positive : les électrons, plus rapides que les protons à même température, tendent
 *    à s'échapper, et un champ électrique radial les retient (équilibre de Pannekoek-Rosseland, repris par Eddington).
 *
 * Refonte des calculs : les constantes viennent de la table commune (CODATA 2018), l'ionisation est calculée par la
 * vraie équation de Saha (qui dépend de la température ET de la densité), et la charge ionisée compte aussi les
 * électrons des éléments lourds. Les valeurs sont calculées ici, jamais recopiées.
 */

// Constantes physiques communes.
import { E, EPS0, G, H, K_B, M_E, M_P, M_SOLEIL, R_SOLEIL, EV } from './constantesPhysiques.js';

// Fraction massique d'hydrogène et d'hélium de la photosphère (Asplund et al. 2009), le reste étant les « métaux ».
const X = 0.7381, Y = 0.2485;

/** Constantes et grandeurs du Soleil utilisées par les calculs (unités SI). */
// CONSTANTES : la table affichée et testée.
export const CONSTANTES = {
  e: E, // charge élémentaire (C)
  mP: M_P, // masse du proton (kg)
  mE: M_E, // masse de l’électron (kg)
  kB: K_B, // constante de Boltzmann (J/K)
  G, // constante de gravitation (m³ kg⁻¹ s⁻²)
  eps0: EPS0, // permittivité du vide (F/m)
  M_SOL: M_SOLEIL, // masse du Soleil (kg)
  R_SOL: R_SOLEIL, // rayon du Soleil (m)
  chiH: 13.598434 * EV, // énergie d’ionisation de l’hydrogène, 13,598 eV (J)
  X, // fraction massique d’hydrogène
  Y, // fraction massique d’hélium
  Z: 1 - X - Y, // fraction massique des éléments plus lourds
  T_PHOTOSPHERE: 5772, // température effective de la photosphère (K, UAI 2015)
  N_PHOTOSPHERE: 1e23, // densité de noyaux d’hydrogène dans la photosphère (m⁻³, ordre de grandeur)
  T_COURONNE: 1.5e6, // température de la couronne (K)
  T_COEUR: 1.57e7, // température au cœur du Soleil (K)
};

/**
 * Charge électrique nette du Soleil (équilibre hydrostatique d'un plasma d'hydrogène : la force électrique sur un
 * proton compense la moitié de la différence de poids entre proton et électron) :
 * Q_nette = 2π ε₀ G (m_p − m_e) M☉ / e — indépendante de T, ≈ +77 C.
 */
// qNette : calcule cette charge, en coulombs.
export const qNette = () => (2 * Math.PI * EPS0 * G * (M_P - M_E) * M_SOLEIL) / E;

/**
 * Charge nette « coronale » liée à la température T : le potentiel qui égalise les flux d’échappement des protons et
 * des électrons est de l'ordre de k_B T / e, d’où Q_couronne = 4π ε₀ R☉ k_B T / e — ≈ +10 C à T = 1,5 × 10⁶ K.
 */
// qCouronne : calcule cette charge pour une température T, en coulombs.
export const qCouronne = (T) => (4 * Math.PI * EPS0 * R_SOLEIL * K_B * T) / E;

/**
 * Rapport des vitesses thermiques électron / proton à même température : v ∝ √(k_B T / m), donc √(m_p / m_e) ≈ 43.
 * Les électrons sont 1 836 fois plus légers, donc ~43 fois plus rapides : c'est eux qui tendent à s'échapper.
 */
// rapportVitesses : calcule ce rapport, sans unité.
export const rapportVitesses = () => Math.sqrt(M_P / M_E);

/** Facteur de Boltzmann de l'ionisation : exp(−χ_H / k_B T), la part d'atomes assez agités pour perdre leur électron. */
// facteurBoltzmann : calcule ce facteur pour une température T.
export const facteurBoltzmann = (T) => Math.exp(-CONSTANTES.chiH / (K_B * T));

/**
 * Taux d’ionisation de l’hydrogène par l'équation de Saha : x² / (1 − x) = (1/n) (2π m_e k_B T / h²)^(3/2) exp(−χ_H / k_B T),
 * où n est la densité de noyaux d'hydrogène (m⁻³). On résout l'équation du second degré en x.
 * Dans la photosphère (5 772 K, n ≈ 10²³ m⁻³) : x ≈ 10⁻⁴ ; vers 20 000 K à la même densité : x ≈ 0,96.
 * Dans l'intérieur du Soleil, l'ionisation est totale (x = 1) : la matière y est trop dense pour que Saha s'applique.
 */
// tauxIonisation : calcule x pour une température T (K) et une densité n (m⁻³).
export function tauxIonisation(T, n = CONSTANTES.N_PHOTOSPHERE) {
  // Second membre de Saha, divisé par la densité.
  const s = ((2 * Math.PI * M_E * K_B * T) / (H * H)) ** 1.5 * facteurBoltzmann(T) / n;
  // Gaz trop froid (s arrondi à zéro) : aucun atome ionisé ; gaz très chaud (s infini) : tous le sont.
  if (!(s > 0)) return 0;
  if (!Number.isFinite(s)) return 1;
  // Racine positive de x² + s·x − s = 0, écrite sans soustraction pour rester exacte quand s est très grand ou très petit.
  return Math.min(1, (2 * s) / (s + Math.sqrt(s * s + 4 * s)));
// Fin de tauxIonisation.
}

/**
 * Charge totale des ions du Soleil pour un taux d'ionisation x : chaque kilogramme de plasma libère
 * (X + Y/2 + Z/2) / m_p électrons (1 par proton d'hydrogène, 2 pour les 4 nucléons de l'hélium, environ 1 pour 2
 * nucléons dans les éléments lourds). Q₊ = x · e · (M☉ / m_p) · (X + Y/2 + Z/2), et −Q₊ pour les électrons.
 * Presque toute la masse du Soleil est totalement ionisée (x = 1) : Q₊ ≈ 1,65 × 10³⁸ C.
 */
// qIonisee : calcule cette charge pour un taux x (1 par défaut), en coulombs.
export const qIonisee = (x = 1) => x * E * (M_SOLEIL / M_P) * (X + Y / 2 + CONSTANTES.Z / 2);

/** Ionisation de l'hydrogène à plusieurs températures, à la densité de la photosphère : le seuil se voit vers 10⁴ K. */
// SEUIL_IONISATION : [température en K, taux d'ionisation de Saha].
export const SEUIL_IONISATION = [CONSTANTES.T_PHOTOSPHERE, 8000, 10000, 15000, 20000].map((T) => [T, tauxIonisation(T)]);

// virgule : écrit un nombre avec une virgule décimale.
const virgule = (n, d) => n.toFixed(d).replace('.', ',');

/** Les trois lignes du tableau de synthèse : grandeur, formule de passage, valeur pour le Soleil. */
// LIGNES_SYNTHESE : le tableau de synthèse.
export const LIGNES_SYNTHESE = [
  {
    grandeur: 'Charge ionisée positive (et −Q₊ pour les électrons)',
    formule: 'Q₊ = x · e · (M☉/m_p) · (X + Y/2 + Z/2)',
    valeur: qIonisee(),
    unite: 'C',
    note: `ionisation totale (x = 1) dans l’intérieur ; x ≈ ${virgule(tauxIonisation(CONSTANTES.T_PHOTOSPHERE) * 1e4, 1)} × 10⁻⁴ seulement à la surface (Saha)`,
  },
  {
    grandeur: 'Charge nette statique (équilibre gravité / pression)',
    formule: 'Q_nette = 2π ε₀ G (m_p − m_e) M☉ / e',
    valeur: qNette(),
    unite: 'C',
    note: 'indépendante de T ; de l’ordre de la charge de quelques éclairs d’orage',
  },
  {
    grandeur: 'Charge nette coronale (liée à T)',
    formule: 'Q_couronne = 4π ε₀ R☉ k_B T / e',
    valeur: qCouronne(CONSTANTES.T_COURONNE),
    unite: 'C',
    note: `à T = ${virgule(CONSTANTES.T_COURONNE / 1e6, 1)} × 10⁶ K`,
  },
];
