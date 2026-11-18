// Fiche Données : Mégaclité (Jupiter XIX), d'après le PDF « Mégaclité (lune) » (article Wikipédia francophone).
// Fiche de Mégaclité (début de l'objet).
export const megaclite = {
  // Identifiant de la fiche.
  id: 'megaclite',
  // Nom de l'astre.
  name: 'Mégaclité',
  // Désignation systématique.
  designation: 'Jupiter XIX',
  // Groupe dynamique.
  group: 'Groupe de Pasiphaé',
  // Identifiant du groupe (filtrage).
  groupId: 'pasiphoe',
  // Sens de l'orbite.
  motion: 'rétrograde',
  // Chemin du PDF source, servi depuis frontend/public.
  file: '/data/documents/megaclite.pdf',
  // Source du document.
  source: 'https://fr.wikipedia.org/wiki/Mégaclité_(lune)',
  // Découverte (début de l'objet).
  discovery: {
    // Découvreur ou équipe.
    who: 'Scott S. Sheppard et al.',
    // Lieu ou moyen d'observation.
    where: 'Observatoire Canada-France-Hawaï',
    // Date de la découverte.
    date: 'imagerie du 25 novembre 2000, annonce le 5 janvier 2001',
    // Désignation provisoire ou ancienne désignation.
    provisional: 'S/2000 J 8',
  // Fin de l'objet découverte.
  },
  // Orbite (début de l'objet).
  orbit: {
    // Demi-grand axe.
    semiMajorAxis: '24 687 260 km',
    // Période de révolution.
    period: '792,44 d (2,17 ans)',
    // Excentricité.
    eccentricity: '0,3071',
    // Inclinaison.
    inclination: '150,40° (écliptique)',
  // Fin de l'objet orbite.
  },
  // Caractéristiques physiques (début de l'objet).
  physical: {
    // Dimensions.
    size: '≈ 5,4 km',
    // Masse.
    mass: '≈ 2,1 × 10¹⁴ kg',
    // Masse volumique.
    density: '2,6 × 10³ kg/m³ (présumée)',
    // Albédo moyen.
    albedo: '0,04',
  // Fin de l'objet physique.
  },
  // Résumé du document.
  summary: 'Mégaclité est un petit satellite irrégulier rétrograde du groupe de Pasiphaé, imagée pour la première fois le 25 novembre 2000 par une équipe conduite par Scott Sheppard ; sa découverte fut annoncée le 5 janvier 2001 en même temps que celle de dix autres satellites de Jupiter. Son diamètre est estimé à 5,4 kilomètres.',
  // Origine du nom (mythologie grecque).
  mythology: 'Elle porte le nom de Mégaclité, conquête amoureuse de Zeus, duquel elle eut Thébé et Locros.',
// Fin de l'objet.
};

// Exporte la fiche par défaut.
export default megaclite;
