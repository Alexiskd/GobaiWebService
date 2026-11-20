// Fiche Données : Eurydomé (Jupiter XXXII), d'après le PDF « Eurydomé (lune) » (article Wikipédia francophone).
// Fiche de Eurydomé (début de l'objet).
export const eurydome = {
  // Identifiant de la fiche.
  id: 'eurydome',
  // Nom de l'astre.
  name: 'Eurydomé',
  // Désignation systématique.
  designation: 'Jupiter XXXII',
  // Groupe dynamique.
  group: 'Groupe de Pasiphaé',
  // Identifiant du groupe (filtrage).
  groupId: 'pasiphoe',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/eurydome.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Eurydomé_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Scott S. Sheppard, David Jewitt et Jan Kleyna',
    // Lieu ou moyen d'observation.
    where: '',
    // Date de la découverte.
    date: '9 décembre 2001',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/2001 J 4',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '22 865 000 km',
    // Période de révolution.
    period: '717,33 d',
    // Excentricité.
    eccentricity: '0,2759',
    // Inclinaison.
    inclination: '150,27°',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 3 km',
    // Masse.
    mass: '≈ 4,5 × 10¹³ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Eurydomé est un petit satellite irrégulier rétrograde du groupe de Pasiphaé, découvert le 9 décembre 2001 par Scott S. Sheppard, David Jewitt et Jan Kleyna (d\'où sa désignation provisoire S/2001 J 4). Son diamètre est estimé à environ 3 kilomètres.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom d\'Eurydomé, mère des Charites (les Grâces), dont Zeus serait le père d\'après certains auteurs.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default eurydome;
