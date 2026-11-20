/**
 * Caractéristiques d'un élément du tableau périodique, pour l'onglet « Théorie quantique » : le numéro atomique Z
 * (nombre de protons, charge du noyau +Z·e, Z électrons dans l'atome neutre, rang dans le tableau, loi de Moseley)
 * et la masse atomique A_r (1 u = 1/12 de la masse du carbone 12, moyenne pondérée des isotopes — exemple du
 * chlore calculé ici — lien avec la masse molaire via le nombre d'Avogadro). Valeurs calculées, pas recopiées.
 */

// Constantes.
export const E_CHARGE = 1.602e-19; // charge élémentaire (C)
export const U_KG = 1.6605e-27; // 1 u = 1/12 de la masse du carbone 12 (kg)
export const NA = 6.022e23; // nombre d'Avogadro (mol⁻¹)

/**
 * Charge électrique du noyau d'un élément de numéro atomique Z : chaque proton porte +e, les neutrons sont neutres,
 * donc Q_noyau = +Z·e. L'atome neutre possède exactement Z électrons (cortège électronique).
 */
// chargeNoyau : la charge du noyau (+Z·e), en coulombs.
export const chargeNoyau = (z) => z * E_CHARGE;

/** Les deux isotopes stables du chlore (Z = 17) : masses exactes (u) et abondances relatives. */
// CHLORE : isotopes 35 et 37.
export const CHLORE = { m35: 34.9689, p35: 0.7576, m37: 36.9659, p37: 0.2424 };

/**
 * Masse atomique du chlore : moyenne pondérée des masses isotopiques par les abondances relatives,
 * A_r = m35·p35 + m37·p37 ≈ 35,45 u. (On évite ici toute référence à une « présence sur Terre » : les abondances
 * sont les abondances mesurées de l'élément, quel que soit l'endroit.)
 */
// masseAtomiqueChlore : la masse atomique du chlore, en u.
export const masseAtomiqueChlore = () => CHLORE.m35 * CHLORE.p35 + CHLORE.m37 * CHLORE.p37;

/**
 * Lien masse atomique / masse molaire : la valeur numérique de A_r (en u) est identique à la masse molaire
 * (en g/mol), grâce à N_A : 1 atome de chlore « moyen » pèse A_r u, 1 mole pèse A_r g.
 */
// masseMolaireChlore : la masse molaire du chlore, en g/mol (numériquement égale à A_r en u).
export const masseMolaireChlore = () => masseAtomiqueChlore();
