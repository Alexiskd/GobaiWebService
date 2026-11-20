/**
 * Constantes physiques communes aux calculs de la fenêtre Node (théorie quantique, charge du Soleil, échelle de la
 * matière). Une seule table : avant, chaque fichier recopiait ses propres valeurs arrondies (e = 1,602 × 10⁻¹⁹ ici,
 * m_p = 1,673 × 10⁻²⁷ là), ce qui donnait des résultats légèrement différents d'une section à l'autre.
 *
 * Valeurs CODATA 2018 (les constantes « exactes » le sont par définition du SI depuis 2019) et constantes
 * astronomiques nominales de l'UAI (résolution B3 de 2015).
 */

// Charge élémentaire, en coulombs (exacte).
export const E = 1.602176634e-19;
// Constante de Planck, en joules-secondes (exacte).
export const H = 6.62607015e-34;
// Constante de Planck réduite ħ = h / 2π, en joules-secondes.
export const HBAR = H / (2 * Math.PI);
// Constante de Boltzmann, en joules par kelvin (exacte).
export const K_B = 1.380649e-23;
// Vitesse de la lumière dans le vide, en mètres par seconde (exacte).
export const C = 299792458;
// Nombre d'Avogadro, par mole (exact).
export const N_A = 6.02214076e23;
// Constante de gravitation, en m³ kg⁻¹ s⁻² (mesurée : la moins bien connue de la table).
export const G = 6.6743e-11;
// Permittivité du vide, en farads par mètre.
export const EPS0 = 8.8541878128e-12;
// Masse de l'électron, en kilogrammes.
export const M_E = 9.1093837015e-31;
// Masse du proton, en kilogrammes.
export const M_P = 1.67262192369e-27;
// Masse du neutron, en kilogrammes.
export const M_N = 1.67492749804e-27;
// Unité de masse atomique (1/12 de la masse d'un atome de carbone 12), en kilogrammes.
export const U = 1.6605390666e-27;
// Rayon de charge du proton, en mètres (CODATA 2018 : 0,8414 fm).
export const R_PROTON = 0.8414e-15;
// Un électronvolt, en joules : la charge élémentaire sous un volt.
export const EV = E;

// Masse nominale du Soleil, en kilogrammes.
export const M_SOLEIL = 1.9885e30;
// Rayon nominal du Soleil, en mètres (UAI 2015).
export const R_SOLEIL = 6.957e8;
// Unité astronomique, en mètres (exacte).
export const UA = 1.495978707e11;
// Année-lumière, en mètres (une année julienne de lumière).
export const ANNEE_LUMIERE = C * 365.25 * 86400;
// Parsec, en mètres.
export const PARSEC = (UA * 648000) / Math.PI;
// Constante de Hubble retenue, en km/s par mégaparsec (Planck 2018).
export const H0_KM_S_MPC = 67.4;
