// Fiche Données : Léda (Jupiter XIII), d'après le PDF « Léda (lune) » (article Wikipédia francophone).
// Fiche de Léda (début de l'objet).
export const leda = {
  // Identifiant de la fiche.
  id: 'leda',
  // Nom de l'astre.
  name: 'Léda',
  // Désignation systématique.
  designation: 'Jupiter XIII',
  // Groupe dynamique.
  group: 'Groupe d\'Himalia',
  // Identifiant du groupe (filtrage).
  groupId: 'himalia',
  // Sens de l'orbite.
  motion: 'prograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/leda.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Léda_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Charles T. Kowal',
    // Lieu ou moyen d'observation.
    where: 'observatoire du Mont Palomar',
    // Date de la découverte.
    date: '11 septembre 1974',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'Jupiter XIII',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '11 098 480 km',
    // Période de révolution.
    period: '238,86 d (0,65 an)',
    // Excentricité.
    eccentricity: '0,1801',
    // Inclinaison.
    inclination: '27,38° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 20 km',
    // Masse.
    mass: '≈ 1,1 × 10¹⁶ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Léda est un satellite irrégulier prograde du groupe d\'Himalia, découvert par Charles T. Kowal à l\'observatoire du Mont Palomar en septembre 1974 sur des plaques photographiques prises du 11 au 13 septembre : c\'est le treizième satellite découvert autour de Jupiter. Son diamètre est estimé à environ 20 kilomètres.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Léda, reine de Sparte et mère, entre autres, d\'Hélène, dont Zeus, sous la forme d\'un cygne, était le père.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default leda;
