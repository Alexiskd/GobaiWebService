// Fiche Données : Élara (Jupiter VII), d'après le PDF « Élara (lune) » (article Wikipédia francophone).
// Fiche de Élara (début de l'objet).
export const elara = {
  // Identifiant de la fiche.
  id: 'elara',
  // Nom de l'astre.
  name: 'Élara',
  // Désignation systématique.
  designation: 'Jupiter VII',
  // Groupe dynamique.
  group: 'Groupe d\'Himalia',
  // Identifiant du groupe (filtrage).
  groupId: 'himalia',
  // Sens de l'orbite.
  motion: 'prograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/elara.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Élara_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Charles Dillon Perrine',
    // Lieu ou moyen d'observation.
    where: 'observatoire Lick',
    // Date de la découverte.
    date: '2 janvier 1905',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'Jupiter VII',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '11 676 677 km',
    // Période de révolution.
    period: '257,77 d (0,71 an)',
    // Excentricité.
    eccentricity: '0,2099',
    // Inclinaison.
    inclination: '30,54° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 86 km',
    // Masse.
    mass: '≈ 8,7 × 10¹⁷ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Élara est un satellite irrégulier prograde du groupe d\'Himalia, découvert sur des photographies d\'Himalia prises par Charles Dillon Perrine à l\'observatoire Lick le 2 janvier 1905 : c\'est le septième satellite découvert autour de Jupiter. Avec un diamètre d\'environ 86 km, c\'est le plus grand membre du groupe après Himalia. En février et mars 2007, la sonde New Horizons, en route vers Pluton, en a pris une série d\'images à environ 8 millions de kilomètres.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom d\'Élara, une maîtresse de Zeus dont elle eut pour fils le titan Tityos.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default elara;
