// Fiche Données : Lysithéa (Jupiter X), d'après le PDF « Lysithéa (lune) » (article Wikipédia francophone).
// Fiche de Lysithéa (début de l'objet).
export const lysithea = {
  // Identifiant de la fiche.
  id: 'lysithea',
  // Nom de l'astre.
  name: 'Lysithéa',
  // Désignation systématique.
  designation: 'Jupiter X',
  // Groupe dynamique.
  group: 'Groupe d\'Himalia',
  // Identifiant du groupe (filtrage).
  groupId: 'himalia',
  // Sens de l'orbite.
  motion: 'prograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/lysithea.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Lysithéa_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Seth Barnes Nicholson',
    // Lieu ou moyen d'observation.
    where: 'observatoire du Mont Wilson',
    // Date de la découverte.
    date: '6 juillet 1938',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'Jupiter X',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '11 665 380 km',
    // Période de révolution.
    period: '257,40 d (0,70 an)',
    // Excentricité.
    eccentricity: '0,1409',
    // Inclinaison.
    inclination: '26,65° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 36 km',
    // Masse.
    mass: '≈ 6,3 × 10¹⁶ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Lysithéa est un satellite irrégulier prograde du groupe d\'Himalia, découvert par Seth Barnes Nicholson à l\'observatoire du Mont Wilson le 6 juillet 1938 : c\'est le dixième satellite découvert autour de Jupiter, découvert pendant la même campagne d\'observations que Carmé. Son diamètre est estimé à une trentaine de kilomètres (32 à 36 km selon l\'albédo supposé).',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Lysithéa, fille de Cadmos qui eut un fils, Hélénos, de Zeus ; elle serait également Sémélé (mère de Dionysos) sous un autre nom.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default lysithea;
