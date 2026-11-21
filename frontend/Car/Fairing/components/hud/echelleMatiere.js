/**
 * L'échelle complète de la matière de la théorie Gobai Space, de l'infiniment petit à l'infiniment grand : neuf
 * niveaux en trois groupes, qui fusionnent la structure réelle de la matière (inerte et vivante) avec l'analogie
 * cosmique (particule ↔ astre, atome ↔ système solaire, molécule ↔ constellation).
 *
 *   1. L'échelle subatomique et atomique (analogie cosmique) : particules, atome, molécule.
 *   2. L'échelle de la matière (inerte et vivante) : nanostructures, matière microscopique, objets macroscopiques.
 *   3. L'échelle cosmique (le retour à l'espace) : corps célestes, galaxies, Univers.
 *
 * Pour chaque niveau, un objet de référence donne une taille (son diamètre, en mètres) et une masse (en kilogrammes).
 * Ces deux nombres sont calculés à partir des constantes et de formules simples (sphère de masse volumique connue,
 * densité critique de l'Univers…) : la formule est écrite à côté de la valeur. Ce sont des ordres de grandeur.
 */

// Constantes physiques communes.
import { ANNEE_LUMIERE, G, H0_KM_S_MPC, M_E, M_P, M_SOLEIL, PARSEC, R_PROTON, R_SOLEIL, U, UA } from './constantesPhysiques.js';
// Rayon de Bohr, liaison H–H, distance de Proxima et couches (orbite de Neptune) de la théorie.
import { COUCHES, DISTANCE_PROXIMA_AL, LIAISON_H2, rayonBohr } from './theorieQuantique.js';
// Masses des astres du moteur, en kilogrammes.
import { BODY_MASS_KG } from '../../../Engine/AstreSolideEngine/OrbitEngine/gravityMath.jsx';

/** Masse d'une sphère de diamètre d (m) et de masse volumique rho (kg/m³) : m = ρ · π d³ / 6. */
// masseSphere : calcule cette masse, en kilogrammes.
export const masseSphere = (d, rho) => (rho * Math.PI * d ** 3) / 6;

/** Densité critique de l'Univers : ρ_c = 3 H₀² / (8π G), avec H₀ converti en s⁻¹. ≈ 8,5 × 10⁻²⁷ kg/m³. */
// densiteCritique : calcule ρ_c, en kilogrammes par mètre cube.
export const densiteCritique = () => {
  // H₀ en s⁻¹ : des km/s par mégaparsec aux mètres par seconde par mètre.
  const h0 = (H0_KM_S_MPC * 1000) / (1e6 * PARSEC);
  // La densité critique.
  return (3 * h0 * h0) / (8 * Math.PI * G);
// Fin de densiteCritique.
};

// Rayon comobile de l'Univers observable, en mètres : 46,5 milliards d'années-lumière.
export const RAYON_UNIVERS = 46.5e9 * ANNEE_LUMIERE;
// Part de la matière ordinaire (baryons) dans la densité critique : Ω_b ≈ 0,049 (Planck 2018).
export const OMEGA_BARYONS = 0.049;

/** Masse de matière ordinaire de l'Univers observable : Ω_b · ρ_c · (4/3) π R³ ≈ 1,5 × 10⁵³ kg. */
// masseUnivers : calcule cette masse, en kilogrammes.
export const masseUnivers = () => OMEGA_BARYONS * densiteCritique() * (4 / 3) * Math.PI * RAYON_UNIVERS ** 3;

// Masses volumiques utilisées, en kg/m³ : le quartz (roche), l'eau et une cellule vivante (eau à ~5 % près).
const RHO_QUARTZ = 2650, RHO_EAU = 1000, RHO_CELLULE = 1050;
// Rayon moyen de la Terre, en mètres (UAI).
const R_TERRE = 6.371e6;
// Masse d'une molécule d'eau : 18,015 unités de masse atomique.
const MASSE_EAU = 18.015 * U;
// Masse d'un ribosome bactérien : environ 2,5 millions d'unités de masse atomique (2,5 MDa).
const MASSE_RIBOSOME = 2.5e6 * U;
// Masse de la Voie lactée, matière noire comprise : de l'ordre de 10¹² masses solaires.
const MASSE_VOIE_LACTEE = 1e12 * M_SOLEIL;

/** Les trois groupes de l'échelle : identifiant, titre et sous-titre. */
// GROUPES : dans l'ordre, du plus petit au plus grand.
export const GROUPES = [
  { id: 'atomique', titre: 'L’échelle subatomique et atomique', sousTitre: 'Analogie cosmique' },
  { id: 'matiere', titre: 'L’échelle de la matière', sousTitre: 'Inerte et vivante' },
  { id: 'cosmique', titre: 'L’échelle cosmique', sousTitre: 'Le retour à l’espace' },
];

// objet : fabrique un objet de référence (nom, diamètre en m, masse en kg, formule de la masse ou de la taille).
const objet = (nom, taille, masse, calcul) => ({ nom, taille, masse, calcul });

/**
 * Les neuf niveaux. `reference` est l'objet qui place le niveau sur l'échelle ; `analogie` (niveaux 1 à 3) est
 * l'objet cosmique que la théorie lui associe ; `branches` (niveaux 5 et 6) sépare la matière inerte de la matière
 * vivante, chacune avec son objet de référence ; `exemples` liste les autres objets du niveau.
 */
// NIVEAUX : du rang 1 (particules) au rang 9 (Univers).
export const NIVEAUX = [
  {
    rang: 1, groupe: 'atomique', nom: 'Particules subatomiques', cosmique: 'Planètes et étoiles',
    texte: 'Les briques élémentaires (protons, neutrons, électrons) agissent comme des astres individuels.',
    reference: objet('Proton', 2 * R_PROTON, M_P, 'diamètre = 2 × rayon de charge ; masse m_p'),
    analogie: objet('Soleil', 2 * R_SOLEIL, M_SOLEIL, 'diamètre = 2 R☉ ; masse M☉'),
    exemples: [`Électron : ${(M_P / M_E).toFixed(0)} fois plus léger que le proton`, 'Neutron : neutre, à peine plus lourd que le proton'],
  },
  {
    rang: 2, groupe: 'atomique', nom: 'Atome', cosmique: 'Système solaire',
    texte: 'Un noyau central (comme un soleil) autour duquel gravitent des électrons (comme des planètes).',
    reference: objet('Atome d’hydrogène', 2 * rayonBohr(), M_P + M_E, 'diamètre = 2 a₀ (rayon de Bohr) ; masse m_p + m_e'),
    analogie: objet('Système solaire', 2 * COUCHES[7].a, M_SOLEIL + COUCHES.reduce((s, c) => s + c.masse, 0), 'diamètre = 2 × orbite de Neptune ; masse Soleil + 8 planètes'),
    exemples: ['Noyau au centre, cortège d’électrons en couches K, L, M…'],
  },
  {
    rang: 3, groupe: 'atomique', nom: 'Molécule', cosmique: 'Constellation, amas d’étoiles',
    texte: 'Plusieurs atomes-systèmes reliés entre eux par des liaisons chimiques (comme la gravité ou l’énergie reliant les astres).',
    reference: objet('Molécule d’eau', 2.75e-10, MASSE_EAU, 'diamètre ≈ 0,275 nm ; masse 18,015 u'),
    analogie: objet('Soleil – Alpha Centauri (SoaCen)', DISTANCE_PROXIMA_AL * ANNEE_LUMIERE, 3.11 * M_SOLEIL, 'distance Soleil–Proxima ; masse Soleil + α Cen A, B et Proxima'),
    exemples: [`Liaison H–H du dihydrogène : ${(LIAISON_H2 * 1e12).toFixed(0)} pm`],
  },
  {
    rang: 4, groupe: 'matiere', nom: 'Structures supramoléculaires et nanostructures',
    texte: 'Des assemblages complexes de milliers de molécules.',
    reference: objet('Ribosome', 2.1e-8, MASSE_RIBOSOME, 'diamètre ≈ 21 nm ; masse ≈ 2,5 MDa'),
    exemples: ['Membranes, protéines repliées, virus, nanotubes de carbone'],
  },
  {
    rang: 5, groupe: 'matiere', nom: 'Matière microscopique',
    texte: 'La séparation entre deux mondes : l’organisation géométrique rigide du minéral, et l’unité de base de la vie.',
    branches: [
      { branche: 'inerte', titre: 'Cristal, grain minéral', ...objet('Grain de quartz', 1e-5, masseSphere(1e-5, RHO_QUARTZ), 'sphère de 10 µm, ρ = 2 650 kg/m³') },
      { branche: 'vivante', titre: 'Cellule', ...objet('Cellule animale', 1.5e-5, masseSphere(1.5e-5, RHO_CELLULE), 'sphère de 15 µm, ρ = 1 050 kg/m³') },
    ],
    exemples: ['Inerte : cristal, grain minéral', 'Vivante : cellule, dotée d’organites'],
  },
  {
    rang: 6, groupe: 'matiere', nom: 'Objets macroscopiques',
    texte: 'Tout ce qui est visible à l’œil nu.',
    branches: [
      { branche: 'inerte', titre: 'Cailloux, gouttes, montagnes, océans', ...objet('Caillou', 0.05, masseSphere(0.05, RHO_QUARTZ), 'sphère de 5 cm, ρ = 2 650 kg/m³') },
      { branche: 'vivante', titre: 'Plantes, animaux, êtres humains', ...objet('Être humain', 1.7, 70, 'taille 1,70 m ; masse 70 kg (adulte de référence)') },
    ],
    exemples: [`Goutte d’eau de 2 mm : ${(masseSphere(2e-3, RHO_EAU) * 1e6).toFixed(1).replace('.', ',')} mg`, 'Montagne : ~10⁴ m', 'Océans : ~1,4 × 10²¹ kg'],
  },
  {
    rang: 7, groupe: 'cosmique', nom: 'Corps célestes',
    texte: 'Planètes et étoiles, formées par l’accumulation gigantesque de matière inerte et vivante.',
    reference: objet('Terre', 2 * R_TERRE, BODY_MASS_KG.earth, 'diamètre = 2 × 6 371 km ; masse du catalogue'),
    exemples: [`Soleil : ${(R_SOLEIL / R_TERRE).toFixed(0)} fois le diamètre de la Terre`, `Terre–Soleil : ${(UA / 1e9).toFixed(1).replace('.', ',')} millions de km`],
  },
  {
    rang: 8, groupe: 'cosmique', nom: 'Galaxies',
    texte: 'Des milliards de systèmes stellaires regroupés.',
    reference: objet('Voie lactée', 1e5 * ANNEE_LUMIERE, MASSE_VOIE_LACTEE, 'diamètre ≈ 100 000 a.l. ; masse ≈ 10¹² M☉'),
    exemples: ['100 à 400 milliards d’étoiles dans la Voie lactée'],
  },
  {
    rang: 9, groupe: 'cosmique', nom: 'L’Univers',
    texte: 'L’ensemble de toute la matière, de l’énergie et de l’espace existants.',
    reference: objet('Univers observable', 2 * RAYON_UNIVERS, masseUnivers(), 'diamètre = 2 × 46,5 Ga.l. ; masse = Ω_b ρ_c (4/3) π R³'),
    exemples: ['Environ 2 000 milliards de galaxies dans la partie observable'],
  },
];

/** Objet qui place un niveau sur l'échelle : sa référence, ou sa branche inerte quand le niveau se sépare en deux. */
// repere : renvoie cet objet.
export const repere = (niveau) => niveau.reference ?? niveau.branches[0];

/** Ordre de grandeur d'une valeur : son logarithme décimal (10⁻¹⁰ m → −10). */
// ordre : calcule log₁₀ de la valeur.
export const ordre = (valeur) => Math.log10(valeur);

/**
 * Les sauts de l'échelle : pour chaque niveau, sa taille, sa masse, et par combien il faut multiplier la taille du
 * niveau précédent pour l'atteindre (facteur, et le même facteur en ordres de grandeur).
 */
// ECHELONS : une ligne par niveau, dans l'ordre.
export const ECHELONS = NIVEAUX.map((niveau, i) => {
  // Objet de référence du niveau et du niveau précédent.
  const r = repere(niveau), avant = i ? repere(NIVEAUX[i - 1]) : null;
  // La ligne : le niveau, sa taille, sa masse, et le saut depuis le niveau précédent (null pour le premier).
  return { rang: niveau.rang, nom: niveau.nom, objet: r.nom, taille: r.taille, masse: r.masse, facteur: avant ? r.taille / avant.taille : null, saut: avant ? ordre(r.taille / avant.taille) : null };
// Fin du calcul des échelons.
});

/** Étendue totale de l'échelle, en ordres de grandeur : du proton à l'Univers observable, en taille puis en masse. */
// etendue : calcule les deux étendues.
export const etendue = () => {
  // Premier et dernier échelon.
  const a = ECHELONS[0], z = ECHELONS[ECHELONS.length - 1];
  // Les étendues en taille et en masse.
  return { taille: ordre(z.taille / a.taille), masse: ordre(z.masse / a.masse) };
// Fin de etendue.
};

/**
 * Place d'une taille sur l'échelle, de 0 (le proton) à 1 (l'Univers observable), en échelle logarithmique.
 * L'être humain tombe vers 0,36 : nous sommes plus près de l'atome que de l'Univers.
 */
// placeSurEchelle : calcule cette fraction.
export const placeSurEchelle = (taille) => ordre(taille / ECHELONS[0].taille) / etendue().taille;

/**
 * L'analogie cosmique mise en nombres : pour les niveaux 1 à 3, par combien il faut agrandir l'objet réel pour
 * obtenir l'objet cosmique associé. Si l'analogie était une vraie maquette, ce facteur serait le même aux trois
 * niveaux ; il varie en réalité de plusieurs milliers de fois, ce qui borne l'analogie.
 */
// ANALOGIES : niveau, objet réel, objet cosmique, facteur d'agrandissement en taille et en masse.
export const ANALOGIES = NIVEAUX.filter((n) => n.analogie).map((n) => ({
  rang: n.rang, reel: n.reference.nom, cosmique: n.analogie.nom,
  facteurTaille: n.analogie.taille / n.reference.taille, facteurMasse: n.analogie.masse / n.reference.masse,
}));

/** Écart entre le plus grand et le plus petit facteur d'agrandissement de l'analogie (en taille). */
// dispersionAnalogie : calcule ce rapport.
export const dispersionAnalogie = () => {
  // Les facteurs en taille des trois niveaux.
  const f = ANALOGIES.map((a) => a.facteurTaille);
  // Le plus grand divisé par le plus petit.
  return Math.max(...f) / Math.min(...f);
// Fin de dispersionAnalogie.
};
