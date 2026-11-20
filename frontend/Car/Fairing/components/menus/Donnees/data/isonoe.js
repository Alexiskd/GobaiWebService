// Fiche Données : Isonoé (Jupiter XXVI), d'après le PDF « Isonoé (lune) » (article Wikipédia francophone).
// Fiche de Isonoé (début de l'objet).
export const isonoe = {
  // Identifiant de la fiche.
  id: 'isonoe',
  // Nom de l'astre.
  name: 'Isonoé',
  // Désignation systématique.
  designation: 'Jupiter XXVI',
  // Groupe dynamique.
  group: 'Groupe de Carmé',
  // Identifiant du groupe (filtrage).
  groupId: 'carme',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/isonoe.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Isonoé_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Scott S. Sheppard et al.',
    // Lieu ou moyen d'observation.
    where: 'Observatoire Canada-France-Hawaï',
    // Date de la découverte.
    date: 'imagerie du 23 novembre 2000, annonce le 5 janvier 2001',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/2000 J 6',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '23 800 668 km',
    // Période de révolution.
    period: '750,13 d (2,05 ans)',
    // Excentricité.
    eccentricity: '0,1776',
    // Inclinaison.
    inclination: '144,21° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 3,8 km',
    // Masse.
    mass: '≈ 7,5 × 10¹³ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Isonoé est un petit satellite irrégulier rétrograde du groupe de Carmé, imagé pour la première fois le 23 novembre 2000 par une équipe conduite par Scott Sheppard ; sa découverte fut annoncée le 5 janvier 2001 en même temps que celle de dix autres satellites de Jupiter. Son diamètre est estimé à 3,8 kilomètres. À noter : bien que classée dans le groupe de Carmé, son inclinaison (144°) s\'écarte de celle des autres membres (~165°).',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom d\'Isonoé, une danaïde, conquête amoureuse de Zeus, duquel elle eut Orchomène.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default isonoe;
