// Fiche Données : Métis (Jupiter XVI), d'après le PDF « Métis (lune) » (article Wikipédia francophone).
// Fiche de Métis (début de l'objet).
export const metis = {
  // Identifiant de la fiche.
  id: 'metis',
  // Nom de l'astre.
  name: 'Métis',
  // Désignation systématique.
  designation: 'Jupiter XVI',
  // Groupe dynamique.
  group: 'Groupe d\'Amalthée',
  // Identifiant du groupe (filtrage).
  groupId: 'amalthee',
  // Sens de l'orbite.
  motion: 'prograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/metis.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Métis_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Stephen P. Synnott',
    // Lieu ou moyen d'observation.
    where: 'images de la sonde Voyager 1',
    // Date de la découverte.
    date: '1979',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/1979 J 3',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '128 000 km',
    // Période de révolution.
    period: '0,294780 d (7 h 4,5 min)',
    // Excentricité.
    eccentricity: '0,0002',
    // Inclinaison.
    inclination: '0,06° (équateur de Jupiter)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '60 × 40 × 34 km',
    // Masse.
    mass: '3,6 × 10¹⁶ kg',
    // Masse volumique.
    density: '0,86 × 10³ kg/m³ (supposée)',
    // Albédo moyen.
    albedo: '0,061 ± 0,003',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Métis est le satellite naturel de Jupiter le plus proche de la planète : elle orbite à 128 000 km en un peu plus de sept heures, sur une orbite quasi circulaire située à l\'intérieur du rayon de l\'orbite synchrone. De forme irrégulière (60 × 40 × 34 km), elle tourne de façon synchrone et participe, comme berger, au maintien de l\'anneau principal de Jupiter.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Métis, Océanide fille de Téthys et d\'Océan, première épouse de Zeus : celui-ci l\'avala pour qu\'elle ne mette pas au monde un enfant plus puissant que lui.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default metis;
