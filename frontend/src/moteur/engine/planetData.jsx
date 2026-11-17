// Caractéristiques physiques fixes de chaque planète, affichées dans sa fiche « Caractéristiques » (bodyFacts.jsx).
// Sources : fiches NASA NSSDCA (Planetary Fact Sheets) pour la densité, la gravité, les températures et le jour
// solaire ; missions MESSENGER (Mercure), InSight (Mars), Juno (Jupiter), Cassini (Saturne), Voyager 2 (Uranus,
// Neptune) et New Horizons (Pluton) pour le noyau et le champ magnétique. Valeurs arrondies.
//
//  - `density`     : masse volumique moyenne, en g/cm³ ;
//  - `gravity`     : pesanteur à l'équateur, en m/s² — au sol pour les planètes solides, au niveau où la pression
//                    vaut 1 bar pour les géantes, qui n'ont pas de sol ;
//  - `temperature` : { value, note } — extrêmes ou moyenne au sol (planètes solides), niveau 1 bar (géantes) ;
//  - `solarDay`    : { value, note } — durée d'un lever de Soleil au suivant, donnée seulement quand elle diffère
//                    nettement de la rotation déjà affichée ;
//  - `core`, `magnetic` : { value, note }.
// Importe BODY_MASS_KG, la table des masses en kilogrammes, depuis gravityMath.
import { BODY_MASS_KG } from './gravityMath';

// Déclare et exporte la table des caractéristiques par planète (début).
export const PLANET_DATA = {
  // Données de « mercury » (début).
  mercury: {
    // Type : Planète tellurique.
    type: 'Planète tellurique',
    // Masse volumique moyenne : 5,43 g/cm³.
    density: 5.43,
    // Pesanteur à l'équateur : 3,7 m/s².
    gravity: 3.7,
    // Température : « −180 à +430 °C », avec sa note.
    temperature: { value: '−180 à +430 °C', note: 'de la nuit au plein jour ; pas d’atmosphère pour garder la chaleur' },
    // Jour solaire : « ≈ 176 j », avec sa note.
    solarDay: { value: '≈ 176 j', note: 'trois tours sur elle-même pour deux orbites (résonance 3:2)' },
    // Noyau : « Fer, ≈ 85 % du rayon », avec sa note.
    core: { value: 'Fer, ≈ 85 % du rayon', note: 'en partie liquide ; la roche ne forme qu’une couche mince' },
    // Champ magnétique : « Global, faible », avec sa note.
    magnetic: { value: 'Global, faible', note: '≈ 1 % de celui de la Terre' },
  // Fin des données de « mercury ».
  },
  // Données de « venus » (début).
  venus: {
    // Type : Planète tellurique.
    type: 'Planète tellurique',
    // Masse volumique moyenne : 5,24 g/cm³.
    density: 5.24,
    // Pesanteur à l'équateur : 8,87 m/s².
    gravity: 8.87,
    // Température : « ≈ 465 °C », avec sa note.
    temperature: { value: '≈ 465 °C', note: 'presque partout, jour et nuit : effet de serre du CO₂' },
    // Jour solaire : « ≈ 117 j », avec sa note.
    solarDay: { value: '≈ 117 j', note: 'rotation rétrograde : le Soleil se lève à l’ouest' },
    // Noyau : « Fer et nickel, ≈ la moitié du rayon », avec sa note.
    core: { value: 'Fer et nickel, ≈ la moitié du rayon', note: 'taille estimée ; état liquide ou solide encore incertain' },
    // Champ magnétique : « Aucun champ propre », avec sa note.
    magnetic: { value: 'Aucun champ propre', note: 'magnétosphère induite par le vent solaire' },
  // Fin des données de « venus ».
  },
  // Données de « earth » (début).
  earth: {
    // Type : Planète tellurique.
    type: 'Planète tellurique',
    // Masse volumique moyenne : 5,51 g/cm³.
    density: 5.51,
    // Pesanteur à l'équateur : 9,8 m/s².
    gravity: 9.8,
    // Température : « −89 à +57 °C », avec sa note.
    temperature: { value: '−89 à +57 °C', note: 'records mesurés au sol ; moyenne ≈ 15 °C' },
    // Jour solaire : « 24 h », avec sa note.
    solarDay: { value: '24 h', note: 'la rotation ci-dessus est mesurée par rapport aux étoiles' },
    // Noyau : « Fer et nickel, ≈ 55 % du rayon », avec sa note.
    core: { value: 'Fer et nickel, ≈ 55 % du rayon', note: 'noyau externe liquide, graine solide au centre' },
    // Champ magnétique : « Global, dipolaire », avec sa note.
    magnetic: { value: 'Global, dipolaire', note: '25 à 65 µT au sol ; produit par le noyau liquide' },
  // Fin des données de « earth ».
  },
  // Données de « mars » (début).
  mars: {
    // Type : Planète tellurique.
    type: 'Planète tellurique',
    // Masse volumique moyenne : 3,93 g/cm³.
    density: 3.93,
    // Pesanteur à l'équateur : 3,71 m/s².
    gravity: 3.71,
    // Température : « −153 à +20 °C », avec sa note.
    temperature: { value: '−153 à +20 °C', note: 'moyenne ≈ −63 °C' },
    // Jour solaire : « 24 h 40 min », avec sa note.
    solarDay: { value: '24 h 40 min', note: 'un « sol »' },
    // Noyau : « Fer et soufre, ≈ la moitié du rayon », avec sa note.
    core: { value: 'Fer et soufre, ≈ la moitié du rayon', note: 'liquide (sismomètre de la sonde InSight)' },
    // Champ magnétique : « Aucun champ global », avec sa note.
    magnetic: { value: 'Aucun champ global', note: 'restes d’aimantation dans la croûte ancienne' },
  // Fin des données de « mars ».
  },
  // Données de « jupiter » (début).
  jupiter: {
    // Type : Géante gazeuse.
    type: 'Géante gazeuse',
    // Masse volumique moyenne : 1,33 g/cm³.
    density: 1.33,
    // Pesanteur à l'équateur : 24,79 m/s².
    gravity: 24.79,
    // Température : « ≈ −108 °C », avec sa note.
    temperature: { value: '≈ −108 °C', note: 'au niveau 1 bar ; ≈ −145 °C au sommet des nuages' },
    // Noyau : « Dilué, jusqu’à ≈ la moitié du rayon », avec sa note.
    core: { value: 'Dilué, jusqu’à ≈ la moitié du rayon', note: 'éléments lourds mêlés à l’hydrogène métallique (sonde Juno)' },
    // Champ magnétique : « Le plus puissant des planètes », avec sa note.
    magnetic: { value: 'Le plus puissant des planètes', note: '≈ 20 fois celui de la Terre au sommet des nuages' },
  // Fin des données de « jupiter ».
  },
  // Données de « saturn » (début).
  saturn: {
    // Type : Géante gazeuse.
    type: 'Géante gazeuse',
    // Masse volumique moyenne : 0,69 g/cm³.
    density: 0.69,
    // Pesanteur à l'équateur : 10,44 m/s².
    gravity: 10.44,
    // Température : « ≈ −139 °C », avec sa note.
    temperature: { value: '≈ −139 °C', note: 'au niveau 1 bar' },
    // Noyau : « Diffus, jusqu’à ≈ 60 % du rayon », avec sa note.
    core: { value: 'Diffus, jusqu’à ≈ 60 % du rayon', note: 'roches et glaces mêlées au gaz (ondes des anneaux, sonde Cassini)' },
    // Champ magnétique : « Global, un peu plus faible que celui de la Terre », avec sa note.
    magnetic: { value: 'Global, un peu plus faible que celui de la Terre', note: 'au sommet des nuages ; presque aligné sur l’axe de rotation' },
  // Fin des données de « saturn ».
  },
  // Données de « uranus » (début).
  uranus: {
    // Type : Géante de glaces.
    type: 'Géante de glaces',
    // Masse volumique moyenne : 1,27 g/cm³.
    density: 1.27,
    // Pesanteur à l'équateur : 8,87 m/s².
    gravity: 8.87,
    // Température : « ≈ −197 °C », avec sa note.
    temperature: { value: '≈ −197 °C', note: 'au niveau 1 bar ; jusqu’à −224 °C plus haut, record des planètes' },
    // Noyau : « Rocheux, petit », avec sa note.
    core: { value: 'Rocheux, petit', note: 'sous un manteau d’eau, d’ammoniac et de méthane' },
    // Champ magnétique : « Global, incliné de 59° », avec sa note.
    magnetic: { value: 'Global, incliné de 59°', note: 'par rapport à l’axe de rotation, et décentré (Voyager 2)' },
  // Fin des données de « uranus ».
  },
  // Données de « neptune » (début).
  neptune: {
    // Type : Géante de glaces.
    type: 'Géante de glaces',
    // Masse volumique moyenne : 1,64 g/cm³.
    density: 1.64,
    // Pesanteur à l'équateur : 11,15 m/s².
    gravity: 11.15,
    // Température : « ≈ −201 °C », avec sa note.
    temperature: { value: '≈ −201 °C', note: 'au niveau 1 bar' },
    // Noyau : « Rocheux, ≈ la masse de la Terre », avec sa note.
    core: { value: 'Rocheux, ≈ la masse de la Terre', note: 'sous un manteau d’eau, d’ammoniac et de méthane' },
    // Champ magnétique : « Global, incliné de 47° », avec sa note.
    magnetic: { value: 'Global, incliné de 47°', note: 'par rapport à l’axe de rotation, et décentré (Voyager 2)' },
  // Fin des données de « neptune ».
  },
  // Données de « pluto » (début).
  pluto: {
    // Type : Planète naine.
    type: 'Planète naine',
    // Masse volumique moyenne : 1,85 g/cm³.
    density: 1.85,
    // Pesanteur à l'équateur : 0,62 m/s².
    gravity: 0.62,
    // Température : « ≈ −230 °C », avec sa note.
    temperature: { value: '≈ −230 °C', note: 'au sol, entre −240 et −220 °C selon la saison' },
    // Noyau : « Rocheux, ≈ 70 % du diamètre », avec sa note.
    core: { value: 'Rocheux, ≈ 70 % du diamètre', note: 'sous un manteau de glace d’eau ; océan interne possible' },
    // Champ magnétique : « Aucun détecté », avec sa note.
    magnetic: { value: 'Aucun détecté', note: 'survol de New Horizons, 2015' },
  // Fin des données de « pluto ».
  },
// Fin de la table.
};

/** Caractéristiques fixes d'une planète, ou null si elle n'est pas renseignée. */
// Déclare et exporte planetData : l'identifiant de la planète.
export function planetData(id) {
  // Renvoie ses caractéristiques, ou null.
  return PLANET_DATA[id] ?? null;
// Fin de planetData.
}

/** Masse d'une planète { kg, earths } (en masses terrestres), ou null si elle n'est pas dans la table des masses. */
// Déclare et exporte planetMass : l'identifiant de la planète.
export function planetMass(id) {
  // Sa masse en kilogrammes.
  const kg = BODY_MASS_KG[id];
  // Renvoie la masse en kilogrammes et en masses terrestres, ou null si elle est inconnue.
  return kg ? { kg, earths: kg / BODY_MASS_KG.earth } : null;
// Fin de planetMass.
}

// Table des caractères en exposant : le signe moins et les dix chiffres.
const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** Écriture scientifique française : 3.3011e23 → « 3,30 × 10²³ ». */
// Déclare et exporte scientific : la valeur et le nombre de décimales (2 par défaut).
export function scientific(value, digits = 2) {
  // Écriture exponentielle de la valeur, coupée en mantisse et exposant.
  const [mantissa, exponent] = Number(value).toExponential(digits).split('e');
  // L'exposant, sans signe plus ni zéros inutiles, chaque caractère étant remplacé par son exposant.
  const power = String(Number(exponent)).replace(/./g, (c) => SUPERSCRIPT[c]);
  // Renvoie la mantisse avec une virgule, suivie de « × 10 » et de l'exposant.
  return `${mantissa.replace('.', ',')} × 10${power}`;
// Fin de scientific.
}
