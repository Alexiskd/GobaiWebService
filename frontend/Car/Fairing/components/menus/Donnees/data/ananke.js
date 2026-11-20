// Fiche Données : Ananké (Jupiter XII), d'après le PDF « Ananké (lune) » (article Wikipédia francophone).
// Fiche de Ananké (début de l'objet).
export const ananke = {
  // Identifiant de la fiche.
  id: 'ananke',
  // Nom de l'astre.
  name: 'Ananké',
  // Désignation systématique.
  designation: 'Jupiter XII',
  // Groupe dynamique.
  group: 'Groupe d\'Ananké',
  // Identifiant du groupe (filtrage).
  groupId: 'ananke',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/ananke.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Ananké_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Seth Barnes Nicholson',
    // Lieu ou moyen d'observation.
    where: 'observatoire du Mont Wilson',
    // Date de la découverte.
    date: '28 septembre 1951',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'Jupiter XII',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '20 439 111 km',
    // Période de révolution.
    period: '596,96 d (1,63 an)',
    // Excentricité.
    eccentricity: '0,3121',
    // Inclinaison.
    inclination: '150,19° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 28 km',
    // Masse.
    mass: '≈ 3,0 × 10¹⁶ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Ananké est un satellite irrégulier rétrograde qui orbite Jupiter sur une orbite très inclinée et fortement excentrique ; elle donne son nom au groupe d\'Ananké (orbites entre 19,3 et 22,7 millions de kilomètres, inclinaisons d\'environ 150°), dont elle est le plus grand membre. Son spectre infrarouge est similaire à celui des astéroïdes de type P, avec une présence possible d\'eau, et sa couleur est légèrement rougeâtre dans le visible.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom d\'Ananké, déesse grecque du destin et de la nécessité, maîtresse de Zeus et mère d\'Adrastée.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default ananke;
