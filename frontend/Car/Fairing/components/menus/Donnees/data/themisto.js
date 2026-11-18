// Fiche Données : Thémisto (Jupiter XVIII), d'après le PDF « Thémisto (lune) » (article Wikipédia francophone).
// Fiche de Thémisto (début de l'objet).
export const themisto = {
  // Identifiant de la fiche.
  id: 'themisto',
  // Nom de l'astre.
  name: 'Thémisto',
  // Désignation systématique.
  designation: 'Jupiter XVIII',
  // Groupe dynamique.
  group: 'Satellite isolé',
  // Identifiant du groupe (filtrage).
  groupId: 'isolee',
  // Sens de l'orbite.
  motion: 'prograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/themisto.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Thémisto_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'C. Kowal et E. Roemer (1975), puis S. Sheppard et al. (2000)',
    // Lieu ou moyen d'observation.
    where: '',
    // Date de la découverte.
    date: '30 septembre 1975, perdue puis redécouverte le 21 novembre 2000',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/1975 J 1 = S/2000 J 1',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '7 393 220 km',
    // Période de révolution.
    period: '129,87 d (0,36 an)',
    // Excentricité.
    eccentricity: '0,2116',
    // Inclinaison.
    inclination: '45,76° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 8 km',
    // Masse.
    mass: '≈ 7 × 10¹⁴ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Thémisto est un petit satellite de forme patatoïde oblongue, d\'environ 8 km, dont l\'orbite est inhabituelle : contrairement à la plupart des satellites de Jupiter, elle orbite seule, à peu près à mi-chemin entre les quatre lunes galiléennes et le groupe d\'Himalia. Découverte en 1975, elle fut perdue puis redécouverte en 2000 sous une nouvelle désignation provisoire avant d\'être identifiée comme le même objet.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Thémisto, une des cinquante Néréides, conquête amoureuse de Zeus dont elle eut Ister (le Danube).',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default themisto;
