// Fiche Données : Carmé (Jupiter XI), d'après le PDF « Carmé (lune) » (article Wikipédia francophone).
// Fiche de Carmé (début de l'objet).
export const carme = {
  // Identifiant de la fiche.
  id: 'carme',
  // Nom de l'astre.
  name: 'Carmé',
  // Désignation systématique.
  designation: 'Jupiter XI',
  // Groupe dynamique.
  group: 'Groupe de Carmé',
  // Identifiant du groupe (filtrage).
  groupId: 'carme',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/carme.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Carmé_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Seth Barnes Nicholson',
    // Lieu ou moyen d'observation.
    where: 'observatoire du Mont Wilson',
    // Date de la découverte.
    date: '30 juillet 1938',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'Jupiter XI',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '24 097 020 km',
    // Période de révolution.
    period: '764,19 d (2,09 ans)',
    // Excentricité.
    eccentricity: '0,1630',
    // Inclinaison.
    inclination: '166,15° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 46 km',
    // Masse.
    mass: '≈ 1,3 × 10¹⁷ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Carmé est un satellite irrégulier rétrograde qui donne son nom au groupe de Carmé : des satellites qui orbitent autour de Jupiter entre 22,9 et 24,1 millions de kilomètres, avec des inclinaisons de 164,9° à 165,5° par rapport à l\'équateur de Jupiter. Découverte par Seth Barnes Nicholson à l\'observatoire du Mont Wilson le 30 juillet 1938, c\'est le onzième satellite découvert autour de Jupiter, pendant la même campagne d\'observations que Lysithéa.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Carmé, nymphe servante d\'Artémis et mère, par Zeus, de Britomartis.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default carme;
