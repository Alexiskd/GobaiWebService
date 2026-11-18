// Fiche Données : Autonoé (Jupiter XXVIII), d'après le PDF « Autonoé (lune) » (article Wikipédia francophone).
// Fiche de Autonoé (début de l'objet).
export const autonoe = {
  // Identifiant de la fiche.
  id: 'autonoe',
  // Nom de l'astre.
  name: 'Autonoé',
  // Désignation systématique.
  designation: 'Jupiter XXVIII',
  // Groupe dynamique.
  group: 'Groupe de Pasiphaé',
  // Identifiant du groupe (filtrage).
  groupId: 'pasiphoe',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/autonoe.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Autonoé_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Scott S. Sheppard, David Jewitt et Jan Kleyna',
    // Lieu ou moyen d'observation.
    where: 'Observatoire Canada-France-Hawaï',
    // Date de la découverte.
    date: '10 décembre 2001',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/2001 J 1',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '24 046 000 km',
    // Période de révolution.
    period: '760,95 d',
    // Excentricité.
    eccentricity: '0,3168',
    // Inclinaison.
    inclination: '152,42°',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 4 km',
    // Masse.
    mass: '≈ 9,0 × 10¹³ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Autonoé est un petit satellite irrégulier rétrograde du groupe de Pasiphaé, découverte le 10 décembre 2001 par Scott S. Sheppard, David Jewitt et Jan Kleyna (d\'où sa désignation provisoire S/2001 J 1). Son diamètre est estimé à environ 4 kilomètres.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom d\'Autonoé, fille de Cadmos et d\'Harmonie, sœur de Sémélé.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default autonoe;
