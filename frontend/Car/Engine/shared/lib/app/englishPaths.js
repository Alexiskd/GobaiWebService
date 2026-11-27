/**
 * Version anglaise du site (/en, /en/moon…) côté navigateur : même table que le serveur
 * (backend/src/services/core/data/en-slugs.ts), dans l'autre sens. Le moteur et les fenêtres ne connaissent que les
 * adresses françaises : on traduit l'adresse anglaise en française à l'arrivée, et l'inverse en tenant la barre
 * d'adresse à jour.
 */

// Adresse française → adresse anglaise (copie de en-slugs.ts : toute page ajoutée là-bas doit l'être ici).
export const EN_SLUG_OF = {
  soleil: 'sun', mercure: 'mercury', venus: 'venus', terre: 'earth', lune: 'moon', mars: 'mars', phobos: 'phobos', deimos: 'deimos', jupiter: 'jupiter', saturne: 'saturn', uranus: 'uranus', neptune: 'neptune', pluton: 'pluto', io: 'io', europe: 'europa', ganymede: 'ganymede', callisto: 'callisto', mimas: 'mimas', encelade: 'enceladus', tethys: 'tethys', dione: 'dione', rhea: 'rhea', titan: 'titan', japet: 'iapetus', miranda: 'miranda', ariel: 'ariel', umbriel: 'umbriel', titania: 'titania', oberon: 'oberon', triton: 'triton', charon: 'charon', galerie: 'gallery', node: 'node', 'faire-un-don': 'donate', ceres: 'ceres', recherche: 'search', astres: 'bodies', trajet: 'trip', relativite: 'relativity', assistant: 'assistant',
};
// Adresse anglaise → adresse française.
const FR_SLUG_OF = Object.fromEntries(Object.entries(EN_SLUG_OF).map(([fr, en]) => [en, fr]));

/** Le chemin est-il celui de la version anglaise (/en ou /en/…) ? */
export function isEnglishPath(pathname = globalThis.location?.pathname || '') {
  // /en, /en/ ou /en/<quelque chose>, majuscules comprises.
  return /^\/en(\/|$)/i.test(pathname);
}

/** Adresse française de la page affichée (« terre » pour /en/earth, « mars » pour /mars), sans barres obliques. */
export function frenchSlugFromPath(pathname = globalThis.location?.pathname || '') {
  // Chemin sans barres de début et de fin.
  let slug = pathname.replace(/^\/+|\/+$/g, '');
  // Décodage (un encodage invalide : adresse ignorée).
  try { slug = decodeURIComponent(slug); } catch { return ''; }
  // Version anglaise : partie après « en/ », traduite.
  if (isEnglishPath(pathname)) {
    // Adresse anglaise, en minuscules.
    const en = slug.replace(/^en\/?/i, '').toLowerCase();
    // Adresse française jumelle, ou vide (accueil).
    return FR_SLUG_OF[en] || '';
  }
  // Version française : telle quelle.
  return slug;
}

/** Chemin anglais d'un chemin français (« /mars » → « /en/mars », « / » → « /en »). */
export function englishPathOf(frPath) {
  // Adresse française sans barre.
  const raw = String(frPath || '').replace(/^\/+|\/+$/g, '');
  // « /donnees » (adresse de la galerie ouverte) : même page que « /galerie ».
  const fr = raw === 'donnees' ? 'galerie' : raw;
  // Accueil, ou page jumelle, ou accueil anglais si la page n'en a pas.
  return fr && EN_SLUG_OF[fr] ? `/en/${EN_SLUG_OF[fr]}` : '/en';
}
