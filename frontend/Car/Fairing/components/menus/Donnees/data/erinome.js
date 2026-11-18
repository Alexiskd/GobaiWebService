// Fiche Données : Érinomé (Jupiter XXV), d'après le PDF « Érinomé (lune) » (article Wikipédia francophone).
// Fiche de Érinomé (début de l'objet).
export const erinome = {
  // Identifiant de la fiche.
  id: 'erinome',
  // Nom de l'astre.
  name: 'Érinomé',
  // Désignation systématique.
  designation: 'Jupiter XXV',
  // Groupe dynamique.
  group: 'Groupe de Carmé',
  // Identifiant du groupe (filtrage).
  groupId: 'carme',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/erinome.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Érinomé',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Scott S. Sheppard et al.',
    // Lieu ou moyen d'observation.
    where: 'Observatoire Canada-France-Hawaï',
    // Date de la découverte.
    date: 'imagerie du 23 novembre 2000, annonce le 5 janvier 2001',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/2000 J 4',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '22 986 286 km',
    // Période de révolution.
    period: '711,96 d (1,95 an)',
    // Excentricité.
    eccentricity: '0,2552',
    // Inclinaison.
    inclination: '163,74° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 3,2 km',
    // Masse.
    mass: '≈ 4,5 × 10¹³ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Érinomé est un petit satellite irrégulier rétrograde du groupe de Carmé, imagé pour la première fois le 23 novembre 2000 par une équipe conduite par Scott Sheppard ; sa découverte fut annoncée le 5 janvier 2001 en même temps que celle de dix autres satellites de Jupiter. Son diamètre est estimé à quelques kilomètres (3,2 à 5,2 km selon l\'albédo supposé).',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom d\'Érinoma, fille de Célés, qui tomba amoureuse de Zeus par l\'intervention d\'Aphrodite.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default erinome;
