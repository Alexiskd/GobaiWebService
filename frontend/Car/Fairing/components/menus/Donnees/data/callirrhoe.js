// Fiche Données : Callirrhoé (Jupiter XVII), d'après le PDF « Callirrhoé (lune) » (article Wikipédia francophone).
// Fiche de Callirrhoé (début de l'objet).
export const callirrhoe = {
  // Identifiant de la fiche.
  id: 'callirrhoe',
  // Nom de l'astre.
  name: 'Callirrhoé',
  // Désignation systématique.
  designation: 'Jupiter XVII',
  // Groupe dynamique.
  group: 'Groupe de Pasiphaé',
  // Identifiant du groupe (filtrage).
  groupId: 'pasiphoe',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/callirrhoe.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Callirrhoé_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'James V. Scotti, Timothy B. Spahr, Robert S. McMillan, Jeffrey A. Larsen, Joe Montani, Arianna E. Gleason et Tom Gehrels (Spacewatch)',
    // Lieu ou moyen d'observation.
    where: '',
    // Date de la découverte.
    date: '6 octobre 1999',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/1999 J 1 (d\'abord astéroïde 1999 UX18)',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '24 103 000 km',
    // Période de révolution.
    period: '758,77 d',
    // Excentricité.
    eccentricity: '0,2828',
    // Inclinaison.
    inclination: '147,16°',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 9 km',
    // Masse.
    mass: '≈ 8,7 × 10¹⁴ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Callirrhoé est un satellite irrégulier rétrograde du groupe de Pasiphaé, découverte le 6 octobre 1999 dans le cadre du projet Spacewatch. Elle fut d\'abord répertoriée comme un astéroïde (1999 UX18) avant que Timothy B. Spahr ne réalise qu\'il s\'agissait d\'une lune de Jupiter.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Callirrhoé, fille d\'Achéloos et épouse d\'Alcméon : elle pria Zeus de rendre adultes ses enfants afin qu\'ils puissent venger leur père, et Zeus le lui accorda.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default callirrhoe;
