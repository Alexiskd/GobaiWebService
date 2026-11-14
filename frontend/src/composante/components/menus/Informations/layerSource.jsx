/** Entreprise ou organisme à l'origine des données de chaque fond de carte (affiché sous chaque option). */


// Source de quelques fonds, par identifiant (début de l'objet).
const BY_ID = {
  // Le fond satellite de la NASA.
  satellite: 'NASA GIBS (Blue Marble)',
  // La Terre en haute définition.
  'earth-hd': 'Orthophotos nationales (14 pays) + EOX (Copernicus Sentinel-2)',
  // La Terre en direct.
  'earth-live': 'NOAA (GOES-East, GOES-West) + EUMETSAT (Meteosat) + JMA (Himawari), via NASA GIBS et EUMETView',
  // Sentinel-2.
  sentinel2: 'EOX IT Services (Copernicus Sentinel-2)',
  // Les orthophotos de l'IGN.
  'ign-ortho': 'IGN (Géoplateforme)',
  // La Lune réelle.
  real: 'NASA SVS + JAXA (Kaguya)',
// Fin de l'objet.
};

// Source par fournisseur (début de l'objet).
const BY_PROVIDER = {
  // NASA GIBS.
  gibs: 'NASA GIBS',
  // Les orthophotos nationales et EOX.
  'earth-hd': 'Orthophotos nationales + EOX',
  // Moon Trek.
  'nasa-trek': 'NASA / JPL-Caltech (Moon Trek)',
  // Moon Trek (catalogue).
  'moon-trek': 'NASA / JPL-Caltech (Moon Trek)',
  // Mars Trek.
  'mars-trek': 'NASA / JPL-Caltech (Mars Trek)',
  // Mercury Trek.
  'mercury-trek': 'NASA / JPL-Caltech (Mercury Trek)',
  // Mercury Trek, en WMTS.
  'mercury-trek-wmts': 'NASA / JPL-Caltech (Mercury Trek)',
  // USGS Astrogeology, pour la Lune.
  'usgs-astro': 'USGS Astrogeology',
  // USGS Astrogeology, pour Mars.
  'usgs-astro-mars': 'USGS Astrogeology',
  // USGS Astrogeology, pour Mercure.
  'usgs-astro-mercury': 'USGS Astrogeology',
  // LROC.
  'lroc-lunaserv': 'LROC / Arizona State University',
  // LunaServ, pour Mercure.
  'mercury-lunaserv': 'Arizona State University (LunaServ)',
  // Mercury QuickMap.
  'mercury-quickmap': 'Mercury QuickMap (ASU / Applied Coherent Technology)',
  // OpenPlanetaryMap, pour Mars.
  'opm-mars': 'OpenPlanetaryMap',
  // OpenPlanetaryMap, pour Mercure.
  'opm-mercury': 'OpenPlanetaryMap',
  // Le Murray Lab.
  'murray-lab': 'NASA Mars Trek + Caltech Murray Lab (fusion Gobai)',
// Fin de l'objet.
};

/** Fournisseur d'une couche des catalogues Lune/Mars/Mercure : identifiant `space-<astre>-<fournisseur>-<couche>`. */
// Déclare spaceProvider : reçoit l'identifiant d'une couche.
function spaceProvider(id) {
  // Extrait ce qui suit « space- » et le nom de l'astre.
  const rest = /^space-(?:moon|mars|mercury)-(.+)$/.exec(id || '')?.[1];
  // Identifiant d'une autre forme : pas de fournisseur.
  if (!rest) return null;
  // Parmi les fournisseurs dont le nom commence le reste, garde le plus long ; null s'il n'y en a pas.
  return Object.keys(BY_PROVIDER).filter((p) => rest.startsWith(`${p}-`)).sort((a, b) => b.length - a.length)[0] ?? null;
// Fin de spaceProvider.
}

/** Source d'un fond de carte, ou null si elle est inconnue. */
// Déclare et exporte layerSource : reçoit un calque.
export function layerSource(layer) {
  // Sans calque, pas de source.
  if (!layer) return null;
  // Le nom et la description du calque, réunis.
  const text = `${layer.label || ''} ${layer.description || ''}`;
  // Identifiant connu : sa source.
  if (Object.hasOwn(BY_ID, layer.id)) return BY_ID[layer.id];
  // Calque d'un satellite (fournisseur « satellite-trek »).
  if (layer.provider === 'satellite-trek') {
    // Texte qui cite les Treks suivis d'un tiret : la NASA.
    if (/NASA Solar System Treks —/.test(text)) return 'NASA / JPL-Caltech (Solar System Treks)';
    // Texte qui cite l'USGS suivi d'un tiret, ou nom terminé par « USGS » : l'USGS.
    if (/USGS Astrogeology —/.test(text) || / · USGS$/.test(layer.label || '')) return 'USGS Astrogeology';
    // Sinon : la mention double si les Treks sont cités, l'USGS sinon.
    return /NASA Solar System Treks/.test(text) ? 'NASA Solar System Treks, sinon USGS Astrogeology' : 'USGS Astrogeology';
  // Fin du cas.
  }
  // Cherche le fournisseur dans l'identifiant.
  const space = spaceProvider(layer.id);
  // S'il est trouvé : sa source.
  if (space) return BY_PROVIDER[space];
  // Sinon : la source du fournisseur déclaré, s'il est connu ; null sinon.
  return Object.hasOwn(BY_PROVIDER, layer.provider || '') ? BY_PROVIDER[layer.provider] : null;
// Fin de layerSource.
}
