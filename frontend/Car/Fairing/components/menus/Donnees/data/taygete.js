// Fiche Données : Taygète (Jupiter XX), d'après le PDF « Taygète (lune) » (article Wikipédia francophone).
// Fiche de Taygète (début de l'objet).
export const taygete = {
  // Identifiant de la fiche.
  id: 'taygete',
  // Nom de l'astre.
  name: 'Taygète',
  // Désignation systématique.
  designation: 'Jupiter XX',
  // Groupe dynamique.
  group: 'Groupe de Carmé',
  // Identifiant du groupe (filtrage).
  groupId: 'carme',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/taygete.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Taygète_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Scott S. Sheppard et al.',
    // Lieu ou moyen d'observation.
    where: 'Observatoire Canada-France-Hawaï',
    // Date de la découverte.
    date: 'imagerie du 25 novembre 2000, annonce le 5 janvier 2001',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/2000 J 9',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '22 438 668 km',
    // Période de révolution.
    period: '686,67 d (1,88 ans)',
    // Excentricité.
    eccentricity: '0,3678',
    // Inclinaison.
    inclination: '164,89° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 5,0 km',
    // Masse.
    mass: '≈ 1,7 × 10¹⁴ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Taygète est un petit satellite irrégulier rétrograde du groupe de Carmé, imagé pour la première fois le 25 novembre 2000 par une équipe conduite par Scott Sheppard à l\'Observatoire Canada-France-Hawaï ; sa découverte fut annoncée le 5 janvier 2001 en même temps que celle de dix autres satellites de Jupiter. Son diamètre est estimé à 5,0 kilomètres.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Taygète, l\'une des Pléiades, fille d\'Atlas et conquête amoureuse de Zeus, duquel elle eut Lacédémon.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default taygete;
