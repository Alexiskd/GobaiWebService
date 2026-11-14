/**
 * Structure interne des astres, couches du centre vers la surface.
 * `r` = rayon extérieur de la couche en fraction du rayon de l'astre. Modèles simplifiés, ordres de grandeur issus
 * des fiches NASA (Planetary Fact Sheets, missions InSight, GRAIL, Juno, Cassini, Galileo) ; les intérieurs des
 * géantes et des satellites glacés restent débattus.
 */

/** Couleur de chaque matériau. */
// Déclare et exporte la table des couleurs par matériau (début).
export const LAYER_COLORS = {
  // innerCore : couleur #ffd27a.
  innerCore: '#ffd27a',
  // core : couleur #f0a050.
  core: '#f0a050',
  // mantle : couleur #c2573a.
  mantle: '#c2573a',
  // crust : couleur #8f7560.
  crust: '#8f7560',
  // metallicH : couleur #b4bdcc.
  metallicH: '#b4bdcc',   // hydrogène métallique : fluide conducteur à l'éclat de métal, gris argenté
  // molecularH : couleur #e7c98f.
  molecularH: '#e7c98f',
  // Nuages de Jupiter, à la couleur réelle de chaque composé.
  // ammoniaIce : couleur #f3efe6.
  ammoniaIce: '#f3efe6',  // glace d'ammoniac (NH₃) : cristaux blancs
  // ammoniumHydrosulfide : couleur #c98b52.
  ammoniumHydrosulfide: '#c98b52', // hydrosulfure d'ammonium (NH₄SH) : cristaux brun orangé
  // waterCloud : couleur #a9cdea.
  waterCloud: '#a9cdea',  // eau (H₂O) : glace et vapeur, blanc bleuté
  // ices : couleur #6fbfd4.
  ices: '#6fbfd4',
  // ocean : couleur #2f6fb3.
  ocean: '#2f6fb3',
  // ice : couleur #dce9f2.
  ice: '#dce9f2',
  // rock : couleur #8c7c6c.
  rock: '#8c7c6c',
  // rockIce : couleur #9fa7ad.
  rockIce: '#9fa7ad',
  // radiative : couleur #ffb347.
  radiative: '#ffb347',
  // convective : couleur #ff8a3d.
  convective: '#ff8a3d',
  // sunCore : couleur #fff0b0.
  sunCore: '#fff0b0',
// Fin de la table.
};

// L : fabrique une couche à partir de son nom, de son rayon extérieur et de son matériau.
const L = (name, r, kind) => ({ name, r, kind });

// Déclare et exporte la table des intérieurs par astre (début).
export const INTERIORS = {
  // sun : couleur de surface #ffb300 et 3 couches, du centre vers la surface : Cœur (fusion) jusqu'à 0,25 ; Zone radiative jusqu'à 0,7 ; Zone convective jusqu'à 1.
  sun: { surface: '#ffb300', layers: [L('Cœur (fusion)', 0.25, 'sunCore'), L('Zone radiative', 0.7, 'radiative'), L('Zone convective', 1, 'convective')] },
  // mercury : couleur de surface #b5b5b5 et 3 couches, du centre vers la surface : Noyau métallique jusqu'à 0,83 ; Manteau silicaté jusqu'à 0,985 ; Croûte jusqu'à 1.
  mercury: { surface: '#b5b5b5', layers: [L('Noyau métallique', 0.83, 'core'), L('Manteau silicaté', 0.985, 'mantle'), L('Croûte', 1, 'crust')] },
  // venus : couleur de surface #e8c37a et 3 couches, du centre vers la surface : Noyau de fer jusqu'à 0,5 ; Manteau jusqu'à 0,99 ; Croûte jusqu'à 1.
  venus: { surface: '#e8c37a', layers: [L('Noyau de fer', 0.5, 'core'), L('Manteau', 0.99, 'mantle'), L('Croûte', 1, 'crust')] },
  // earth : couleur de surface #3d7bd6 et 4 couches, du centre vers la surface : Graine (noyau solide) jusqu'à 0,19 ; Noyau externe liquide jusqu'à 0,55 ; Manteau jusqu'à 0,995 ; Croûte jusqu'à 1.
  earth: { surface: '#3d7bd6', layers: [L('Graine (noyau solide)', 0.19, 'innerCore'), L('Noyau externe liquide', 0.55, 'core'), L('Manteau', 0.995, 'mantle'), L('Croûte', 1, 'crust')] },
  // moon : couleur de surface #a9a7a2 et 3 couches, du centre vers la surface : Noyau jusqu'à 0,2 ; Manteau jusqu'à 0,98 ; Croûte jusqu'à 1.
  moon: { surface: '#a9a7a2', layers: [L('Noyau', 0.2, 'core'), L('Manteau', 0.98, 'mantle'), L('Croûte', 1, 'crust')] },
  // mars : couleur de surface #c1440e et 3 couches, du centre vers la surface : Noyau liquide jusqu'à 0,54 ; Manteau jusqu'à 0,985 ; Croûte jusqu'à 1.
  mars: { surface: '#c1440e', layers: [L('Noyau liquide', 0.54, 'core'), L('Manteau', 0.985, 'mantle'), L('Croûte', 1, 'crust')] },
  // jupiter : couleur de surface #d9a066 et 3 couches, du centre vers la surface : Noyau dilué jusqu'à 0,3 ; Hydrogène métallique jusqu'à 0,8 ; Hydrogène et hélium jusqu'à 1.
  jupiter: { surface: '#d9a066', layers: [L('Noyau dilué', 0.3, 'rock'), L('Hydrogène métallique', 0.8, 'metallicH'), L('Hydrogène et hélium', 1, 'molecularH')] },
  // saturn : couleur de surface #e4cf8f et 3 couches, du centre vers la surface : Noyau dilué jusqu'à 0,25 ; Hydrogène métallique jusqu'à 0,5 ; Hydrogène et hélium jusqu'à 1.
  saturn: { surface: '#e4cf8f', layers: [L('Noyau dilué', 0.25, 'rock'), L('Hydrogène métallique', 0.5, 'metallicH'), L('Hydrogène et hélium', 1, 'molecularH')] },
  // uranus : couleur de surface #9fd8dc et 3 couches, du centre vers la surface : Noyau rocheux jusqu'à 0,2 ; Manteau de glaces (eau, ammoniac, méthane) jusqu'à 0,75 ; Hydrogène, hélium, méthane jusqu'à 1.
  uranus: { surface: '#9fd8dc', layers: [L('Noyau rocheux', 0.2, 'rock'), L('Manteau de glaces (eau, ammoniac, méthane)', 0.75, 'ices'), L('Hydrogène, hélium, méthane', 1, 'molecularH')] },
  // neptune : couleur de surface #5b7fe0 et 3 couches, du centre vers la surface : Noyau rocheux jusqu'à 0,25 ; Manteau de glaces (eau, ammoniac, méthane) jusqu'à 0,8 ; Hydrogène, hélium, méthane jusqu'à 1.
  neptune: { surface: '#5b7fe0', layers: [L('Noyau rocheux', 0.25, 'rock'), L('Manteau de glaces (eau, ammoniac, méthane)', 0.8, 'ices'), L('Hydrogène, hélium, méthane', 1, 'molecularH')] },
  // io : couleur de surface #d9c45c et 3 couches, du centre vers la surface : Noyau fer et sulfure de fer jusqu'à 0,52 ; Manteau partiellement fondu jusqu'à 0,98 ; Croûte volcanique jusqu'à 1.
  io: { surface: '#d9c45c', layers: [L('Noyau fer et sulfure de fer', 0.52, 'core'), L('Manteau partiellement fondu', 0.98, 'mantle'), L('Croûte volcanique', 1, 'crust')] },
  // europa : couleur de surface #cdbca3 et 4 couches, du centre vers la surface : Noyau métallique jusqu'à 0,4 ; Manteau rocheux jusqu'à 0,9 ; Océan d’eau salée jusqu'à 0,985 ; Coquille de glace jusqu'à 1.
  europa: { surface: '#cdbca3', layers: [L('Noyau métallique', 0.4, 'core'), L('Manteau rocheux', 0.9, 'mantle'), L('Océan d’eau salée', 0.985, 'ocean'), L('Coquille de glace', 1, 'ice')] },
  // ganymede : couleur de surface #8e8476 et 4 couches, du centre vers la surface : Noyau métallique jusqu'à 0,25 ; Manteau silicaté jusqu'à 0,55 ; Glace et océan profond jusqu'à 0,95 ; Croûte de glace jusqu'à 1.
  ganymede: { surface: '#8e8476', layers: [L('Noyau métallique', 0.25, 'core'), L('Manteau silicaté', 0.55, 'mantle'), L('Glace et océan profond', 0.95, 'ocean'), L('Croûte de glace', 1, 'ice')] },
  // callisto : couleur de surface #6c6053 et 3 couches, du centre vers la surface : Mélange roche et glace jusqu'à 0,75 ; Océan possible jusqu'à 0,93 ; Croûte de glace jusqu'à 1.
  callisto: { surface: '#6c6053', layers: [L('Mélange roche et glace', 0.75, 'rockIce'), L('Océan possible', 0.93, 'ocean'), L('Croûte de glace', 1, 'ice')] },
  // mimas : couleur de surface #bcbcbc et 2 couches, du centre vers la surface : Noyau rocheux jusqu'à 0,45 ; Manteau de glace jusqu'à 1.
  mimas: { surface: '#bcbcbc', layers: [L('Noyau rocheux', 0.45, 'rock'), L('Manteau de glace', 1, 'ice')] },
  // enceladus : couleur de surface #f1f3f6 et 3 couches, du centre vers la surface : Noyau rocheux poreux jusqu'à 0,75 ; Océan global jusqu'à 0,92 ; Coquille de glace jusqu'à 1.
  enceladus: { surface: '#f1f3f6', layers: [L('Noyau rocheux poreux', 0.75, 'rock'), L('Océan global', 0.92, 'ocean'), L('Coquille de glace', 1, 'ice')] },
  // tethys : couleur de surface #d8d8d4 et 2 couches, du centre vers la surface : Noyau roche et glace jusqu'à 0,3 ; Glace d’eau jusqu'à 1.
  tethys: { surface: '#d8d8d4', layers: [L('Noyau roche et glace', 0.3, 'rockIce'), L('Glace d’eau', 1, 'ice')] },
  // dione : couleur de surface #c9c9c5 et 3 couches, du centre vers la surface : Noyau rocheux jusqu'à 0,5 ; Océan possible jusqu'à 0,85 ; Croûte de glace jusqu'à 1.
  dione: { surface: '#c9c9c5', layers: [L('Noyau rocheux', 0.5, 'rock'), L('Océan possible', 0.85, 'ocean'), L('Croûte de glace', 1, 'ice')] },
  // rhea : couleur de surface #bdbab4 et 2 couches, du centre vers la surface : Mélange roche et glace jusqu'à 0,6 ; Manteau de glace jusqu'à 1.
  rhea: { surface: '#bdbab4', layers: [L('Mélange roche et glace', 0.6, 'rockIce'), L('Manteau de glace', 1, 'ice')] },
  // titan : couleur de surface #d6a446 et 4 couches, du centre vers la surface : Noyau rocheux hydraté jusqu'à 0,6 ; Glace haute pression jusqu'à 0,8 ; Océan d’eau salée jusqu'à 0,92 ; Croûte de glace jusqu'à 1.
  titan: { surface: '#d6a446', layers: [L('Noyau rocheux hydraté', 0.6, 'rock'), L('Glace haute pression', 0.8, 'ices'), L('Océan d’eau salée', 0.92, 'ocean'), L('Croûte de glace', 1, 'ice')] },
  // iapetus : couleur de surface #9b9081 et 2 couches, du centre vers la surface : Noyau rocheux jusqu'à 0,4 ; Manteau de glace jusqu'à 1.
  iapetus: { surface: '#9b9081', layers: [L('Noyau rocheux', 0.4, 'rock'), L('Manteau de glace', 1, 'ice')] },
// Fin de la table.
};

/**
 * Ponts nuageux des géantes gazeuses, du sommet vers la profondeur. NASA (science.nasa.gov/jupiter/jupiter-facts) :
 * trois couches distinctes qui s'étendent ensemble sur environ 71 km — glace d'ammoniac en haut, cristaux
 * d'hydrosulfure d'ammonium au milieu, glace et vapeur d'eau en bas. L'épaisseur de chaque pont n'est pas donnée :
 * seul le total est affiché.
 */
// Déclare et exporte la table des ponts nuageux (début).
export const CLOUD_DECKS = {
  // Jupiter (début).
  jupiter: {
    // Épaisseur totale des trois ponts : 71 km.
    totalKm: 71,
    // Liste des ponts, du sommet vers la profondeur (début).
    decks: [
      // Nuages de glace d’ammoniac, de formule NH₃.
      { name: 'Nuages de glace d’ammoniac', formula: 'NH₃', kind: 'ammoniaIce' },
      // Nuages d’hydrosulfure d’ammonium, de formule NH₄SH.
      { name: 'Nuages d’hydrosulfure d’ammonium', formula: 'NH₄SH', kind: 'ammoniumHydrosulfide' },
      // Nuages d’eau (glace et vapeur), de formule H₂O.
      { name: 'Nuages d’eau (glace et vapeur)', formula: 'H₂O', kind: 'waterCloud' },
    // Fin de la liste.
    ],
  // Fin de Jupiter.
  },
// Fin de la table.
};

/** Ponts nuageux d'un astre avec leur couleur, du sommet vers la profondeur ([] s'il n'en a pas de modélisés). */
// Déclare et exporte cloudDecks : l'identifiant de l'astre.
export function cloudDecks(id) {
  // Renvoie ses ponts nuageux, chacun avec la couleur de son matériau ; liste vide s'il n'en a pas.
  return (CLOUD_DECKS[id]?.decks || []).map((d) => ({ ...d, color: LAYER_COLORS[d.kind] }));
// Fin de cloudDecks.
}

/** Rayon moyen (km), pour donner l'épaisseur de chaque couche. */
// Déclare et exporte la table des rayons moyens en kilomètres (début).
export const RADIUS_KM = {
  // Le Soleil, Mercure, Vénus, la Terre, la Lune et Mars.
  sun: 695700, mercury: 2439.7, venus: 6051.8, earth: 6371, moon: 1737.4, mars: 3389.5,
  // Jupiter, Saturne, Uranus et Neptune.
  jupiter: 69911, saturn: 58232, uranus: 25362, neptune: 24622,
  // Io, Europe, Ganymède et Callisto.
  io: 1821.6, europa: 1560.8, ganymede: 2634.1, callisto: 2410.3,
  // Mimas, Encelade, Téthys, Dioné, Rhéa, Titan et Japet.
  mimas: 198.2, enceladus: 252.1, tethys: 531.1, dione: 561.4, rhea: 763.8, titan: 2574.7, iapetus: 734.5,
// Fin de la table.
};

/** Couches avec rayons intérieur et extérieur (fractions) et épaisseur en km. */
// Déclare et exporte interiorLayers : l'identifiant de l'astre.
export function interiorLayers(id) {
  // L'intérieur de cet astre.
  const it = INTERIORS[id];
  // Inconnu : liste vide.
  if (!it) return [];
  // Son rayon en kilomètres, ou 0 s'il est inconnu.
  const R = RADIUS_KM[id] || 0;
  // Pour chaque couche (début).
  return it.layers.map((l, i) => {
    // Rayon intérieur : le rayon extérieur de la couche précédente, ou 0 pour la première.
    const inner = i ? it.layers[i - 1].r : 0;
    // Renvoie la couche avec son rayon intérieur, sa couleur et son épaisseur arrondie au kilomètre.
    return { ...l, inner, color: LAYER_COLORS[l.kind], thicknessKm: Math.round((l.r - inner) * R) };
  // Fin du traitement d'une couche.
  });
// Fin de interiorLayers.
}
