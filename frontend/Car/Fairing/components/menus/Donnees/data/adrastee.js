// Fiche Données : Adrastée (Jupiter XV), d'après le PDF « Adrastée (lune) » (article Wikipédia francophone).
// Fiche de Adrastée (début de l'objet).
export const adrastee = {
  // Identifiant de la fiche.
  id: 'adrastee',
  // Nom de l'astre.
  name: 'Adrastée',
  // Désignation systématique.
  designation: 'Jupiter XV',
  // Groupe dynamique.
  group: 'Groupe d\'Amalthée',
  // Identifiant du groupe (filtrage).
  groupId: 'amalthee',
  // Sens de l'orbite.
  motion: 'prograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/adrastee.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Adrastée_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'D. C. Jewitt, G. E. Danielson',
    // Lieu ou moyen d'observation.
    where: 'images de la sonde Voyager 2',
    // Date de la découverte.
    date: '8 juillet 1979',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/1979 J 1',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '129 000 km (1,806 rayon de Jupiter)',
    // Période de révolution.
    period: '0,29826 d (7 h 9,5 min)',
    // Excentricité.
    eccentricity: '0,0015',
    // Inclinaison.
    inclination: '0,03° (équateur de Jupiter)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '20 × 16 × 14 km',
    // Masse.
    mass: '≈ 2 × 10¹⁵ kg',
    // Masse volumique.
    density: '0,86 × 10³ kg/m³ (supposée)',
    // Albédo moyen.
    albedo: '0,1 ± 0,045',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Adrastée est le deuxième satellite le plus proche de Jupiter, après Métis : son orbite quasi circulaire de 7 h 9,5 min se trouve à l\'intérieur de l\'anneau principal, dans le rayon de l\'orbite synchrone. Plus petit membre du groupe d\'Amalthée, elle tourne de façon synchrone et serait composée de glace d\'eau poreuse (10 à 15 % de porosité). Sa surface reste inconnue, faute d\'images assez résolues.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom d\'Adrastée, nymphe fille d\'Ananké et de Mélissé, sœur d\'Ida, chargée par Rhéa de protéger Zeus enfant contre Cronos.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default adrastee;
