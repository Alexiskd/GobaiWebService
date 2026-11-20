// Fiche Données : Hermippé (Jupiter XXX), d'après le PDF « Hermippé (lune) » (article Wikipédia francophone).
// Fiche de Hermippé (début de l'objet).
export const hermippe = {
  // Identifiant de la fiche.
  id: 'hermippe',
  // Nom de l'astre.
  name: 'Hermippé',
  // Désignation systématique.
  designation: 'Jupiter XXX',
  // Groupe dynamique.
  group: 'Groupe d\'Ananké',
  // Identifiant du groupe (filtrage).
  groupId: 'ananke',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/hermippe.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Hermippé',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Scott S. Sheppard, David Jewitt et Jan Kleyna',
    // Lieu ou moyen d'observation.
    where: '',
    // Date de la découverte.
    date: '9 décembre 2001',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/2001 J 3',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '21 131 000 km',
    // Période de révolution.
    period: '633,90 d',
    // Excentricité.
    eccentricity: '0,2096',
    // Inclinaison.
    inclination: '150,73°',
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
  summary: 'Hermippé est un petit satellite irrégulier rétrograde du groupe d\'Ananké, découvert le 9 décembre 2001 par Scott S. Sheppard, David Jewitt et Jan Kleyna (d\'où sa désignation provisoire S/2001 J 3). Son diamètre est estimé à environ 4 kilomètres.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom d\'Hermippé, une conquête amoureuse de Zeus.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default hermippe;
