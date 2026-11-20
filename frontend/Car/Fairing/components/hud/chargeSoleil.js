/**
 * Description des calculs de la charge électrique du Soleil en fonction de sa température T (en kelvins), pour
 * l'onglet « Théorie quantique » : deux réalités physiques — la charge totale libérée par le plasma ionisé
 * (+Q et −Q libres, quasi équilibrées) et la charge nette (légèrement positive, équilibre d’Eddington /
 * Pannekoek-Rosseland qui retient les électrons). Les valeurs sont calculées ici, pas recopiées.
 */

// Constantes physiques (SI) et données solaires utilisées par les calculs.
export const CONSTANTES = {
  e: 1.602e-19, // charge élémentaire (C)
  mP: 1.673e-27, // masse du proton (kg)
  mE: 9.11e-31, // masse de l’électron (kg)
  kB: 1.381e-23, // constante de Boltzmann (J/K)
  G: 6.674e-11, // constante de gravitation (m³ kg⁻¹ s⁻²)
  eps0: 8.854e-12, // permittivité du vide (F/m)
  M_SOL: 1.9885e30, // masse du Soleil (kg)
  R_SOL: 6.96e8, // rayon du Soleil (m)
  chiH: 2.18e-18, // énergie d’ionisation de l’hydrogène, 13,6 eV (J)
  X: 0.735, // fraction massique d’hydrogène
  Y: 0.249, // fraction massique d’hélium
  T_COURONNE: 1.5e6, // température de la couronne (K)
  T_COEUR: 1.57e7, // température au cœur du Soleil (K)
};

/**
 * Charge électrique nette du Soleil (équilibre hydrostatique : la force électrique sur un proton compense la moitié
 * de l’attraction gravitationnelle) : Q_nette = 2π ε0 G m_p M☉ / e — indépendante de T, ≈ +77 C.
 */
// qNette : la charge nette statique, en coulombs.
export const qNette = () => (2 * Math.PI * CONSTANTES.eps0 * CONSTANTES.G * CONSTANTES.mP * CONSTANTES.M_SOL) / CONSTANTES.e;

/**
 * Charge nette « coronale » liée à la température T : le potentiel d’échappement qui égalise les flux de protons et
 * d’électrons est proportionnel à k_B T, d’où Q_couronne = 4π ε0 R☉ k_B T / e — ≈ +10 C à T = 1,5 × 10⁶ K.
 */
// qCouronne : la charge nette coronale à la température T (K), en coulombs.
export const qCouronne = (T) => (4 * Math.PI * CONSTANTES.eps0 * CONSTANTES.R_SOL * CONSTANTES.kB * T) / CONSTANTES.e;

/**
 * Taux d’ionisation de l’hydrogène selon Saha (forme du facteur de Boltzmann) : x(T) = exp(−χ_H / (k_B T)).
 * Dès ~10 000 K l’ionisation démarre ; au cœur (T ≈ 1,57 × 10⁷ K), x ≈ 0,99 (ionisation quasi totale).
 */
// tauxIonisation : la fraction d’atomes d’hydrogène ionisés à la température T (K).
export const tauxIonisation = (T) => Math.exp(-CONSTANTES.chiH / (CONSTANTES.kB * T));

/**
 * Charge totale ionisée libérée à la température T : Q_+ = x(T) · e · (M☉/m_p) · (X + Y/2), avec son opposée −Q
 * pour les électrons. Au cœur du Soleil (x ≈ 1) : ≈ +1,63 × 10³⁸ C (et −1,63 × 10³⁸ C).
 */
// qIonisee : la charge totale des charges positives libérées à la température T (K), en coulombs.
export const qIonisee = (T) => tauxIonisation(T) * CONSTANTES.e * (CONSTANTES.M_SOL / CONSTANTES.mP) * (CONSTANTES.X + CONSTANTES.Y / 2);

/** Les trois lignes du tableau de synthèse : grandeur, formule de passage depuis T, valeur pour le Soleil. */
// LIGNES_SYNTHESE : le tableau récapitulatif (formules en texte, valeurs calculées).
export const LIGNES_SYNTHESE = [
  {
    grandeur: 'Charge ionisée positive (et −Q opposée pour les électrons)',
    formule: 'Q₊ = x(T) · e M☉/m_p · (X + Y/2), avec x(T) = exp(−χ_H / k_B T)',
    valeur: qIonisee(CONSTANTES.T_COEUR),
    unite: 'C',
    note: `x ≈ ${tauxIonisation(CONSTANTES.T_COEUR).toFixed(2).replace('.', ',')} au cœur (T = 1,57 × 10⁷ K) ; seuil d’ionisation vers 10 000 K`,
  },
  {
    grandeur: 'Charge nette statique (équilibre gravité / pression)',
    formule: 'Q_nette = 2π ε0 G m_p M☉ / e — indépendante de T',
    valeur: qNette(),
    unite: 'C',
    note: '≈ la charge d’un éclair d’orage ; le plasma reste quasi neutre',
  },
  {
    grandeur: 'Charge nette coronale (liée à T_couronne)',
    formule: 'Q_couronne = 4π ε0 R☉ k_B T / e',
    valeur: qCouronne(CONSTANTES.T_COURONNE),
    unite: 'C',
    note: `à T = ${(CONSTANTES.T_COURONNE / 1e6).toFixed(1).replace('.', ',')} × 10⁶ K`,
  },
];
