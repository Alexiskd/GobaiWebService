/**
 * Caractéristiques d'un élément du tableau périodique, pour l'onglet « Théorie quantique » : le numéro atomique Z
 * (nombre de protons, charge du noyau +Z·e, Z électrons dans l'atome neutre, rang dans le tableau, loi de Moseley)
 * et la masse atomique A_r (1 u = 1/12 de la masse du carbone 12, moyenne pondérée des isotopes — exemple du
 * chlore calculé ici — lien avec la masse molaire via le nombre d'Avogadro). Valeurs calculées, pas recopiées.
 */

// Constantes.
// Constantes physiques communes (CODATA 2018) : avant, ce fichier recopiait ses propres valeurs arrondies.
import { C, E, M_E, M_N, M_P, N_A, U } from './constantesPhysiques.js';

export const E_CHARGE = E; // charge élémentaire (C)
export const U_KG = U; // 1 u = 1/12 de la masse du carbone 12 (kg)
export const NA = N_A; // nombre d'Avogadro (mol⁻¹)

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

// Masse d'un atome d'hélium 4, en unités de masse atomique (mesure : 4,002 603 254 u).
export const MASSE_HELIUM4_U = 4.002603254;

/**
 * Défaut de masse de l'hélium 4 : la somme de ses constituants séparés (2 protons, 2 neutrons, 2 électrons) moins la
 * masse mesurée de l'atome, Δm = 2 m_p + 2 m_n + 2 m_e − m(⁴He) ≈ 0,0304 u (0,76 % de la masse).
 */
// defautMasseHelium : calcule Δm, en unités de masse atomique.
export const defautMasseHelium = () => (2 * M_P + 2 * M_N + 2 * M_E) / U - MASSE_HELIUM4_U;

/** Énergie de liaison de l'hélium 4 : E = Δm · c² ≈ 28,3 MeV, soit ≈ 7,07 MeV par nucléon. */
// energieLiaisonHelium : calcule E, en mégaélectronvolts.
export const energieLiaisonHelium = () => (defautMasseHelium() * U * C * C) / E / 1e6;
