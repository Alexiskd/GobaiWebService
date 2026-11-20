// Fiche Données : Pasiphaé (Jupiter VIII), d'après le PDF « Pasiphaé (lune) » (article Wikipédia francophone).
// Fiche de Pasiphaé (début de l'objet).
export const pasiphoe = {
  // Identifiant de la fiche.
  id: 'pasiphoe',
  // Nom de l'astre.
  name: 'Pasiphaé',
  // Désignation systématique.
  designation: 'Jupiter VIII',
  // Groupe dynamique.
  group: 'Groupe de Pasiphaé',
  // Identifiant du groupe (filtrage).
  groupId: 'pasiphoe',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/pasiphoe.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Pasiphaé_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Philibert Jacques Melotte',
    // Lieu ou moyen d'observation.
    where: 'observatoire royal de Greenwich',
    // Date de la découverte.
    date: '28 février 1908',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'Jupiter VIII',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '23 912 238 km',
    // Période de révolution.
    period: '755,42 d (2,1 ans)',
    // Excentricité.
    eccentricity: '0,3303',
    // Inclinaison.
    inclination: '143,03° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 60 km',
    // Masse.
    mass: '≈ 3,0 × 10¹⁷ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Pasiphaé est le plus grand satellite rétrograde de Jupiter et le troisième plus grand satellite irrégulier après Himalia et Élara : elle donne son nom au groupe de Pasiphaé, des lunes irrégulières rétrogrades dont on pense qu\'elles sont des fragments d\'un astéroïde capturé par Jupiter. Son spectre est gris, semblable à celui d\'un astéroïde de type C, et elle est en résonance orbitale avec Jupiter. Découverte par Philibert Jacques Melotte à l\'observatoire royal de Greenwich le 28 février 1908, elle fut retrouvée a posteriori sur des plaques datant du 27 janvier 1908.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Pasiphaé, épouse de Minos et mère du Minotaure dans la mythologie grecque.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default pasiphoe;
