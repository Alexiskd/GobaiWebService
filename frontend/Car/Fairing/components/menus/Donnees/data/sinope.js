// Fiche Données : Sinopé (Jupiter IX), d'après le PDF « Sinopé (lune) » (article Wikipédia francophone).
// Fiche de Sinopé (début de l'objet).
export const sinope = {
  // Identifiant de la fiche.
  id: 'sinope',
  // Nom de l'astre.
  name: 'Sinopé',
  // Désignation systématique.
  designation: 'Jupiter IX',
  // Groupe dynamique.
  group: 'Groupe de Pasiphaé',
  // Identifiant du groupe (filtrage).
  groupId: 'pasiphoe',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/sinope.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Sinopé_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Seth Barnes Nicholson',
    // Lieu ou moyen d'observation.
    where: 'observatoire Lick',
    // Date de la découverte.
    date: '21 juillet 1914',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'Jupiter IX',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '23 368 614 km',
    // Période de révolution.
    period: '729,80 d (2,0 ans)',
    // Excentricité.
    eccentricity: '0,2685',
    // Inclinaison.
    inclination: '153,98° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 38 km',
    // Masse.
    mass: '≈ 7,5 × 10¹⁶ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Sinopé est un satellite irrégulier rétrograde souvent rattaché au groupe de Pasiphaé, mais sa couleur rougeâtre (spectre proche des astéroïdes de type D, différent du gris de Pasiphaé) et son inclinaison moyenne suggèrent qu\'il pourrait s\'agir d\'un objet indépendant, capturé séparément par Jupiter. Elle est en résonance orbitale avec Jupiter, mais peut en sortir : elle alterne des périodes de résonance et de non-résonance sur des échelles de dix millions d\'années. Découverte par Seth Barnes Nicholson à l\'observatoire Lick le 21 juillet 1914.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Sinopé, une nymphe de la mythologie grecque.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default sinope;
