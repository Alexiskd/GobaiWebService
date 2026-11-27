/**
 * Adresses anglaises des pages (version /en/ du site) : adresse française → adresse anglaise.
 * Module à part, sans dépendance, pour être lu à la fois par les pages françaises (hreflang) et anglaises.
 */
// Adresse de l'accueil anglais.
export const EN_HOME_PATH = '/en';
// Adresse française → adresse anglaise.
export const EN_SLUG_OF: Readonly<Record<string, string>> = {
  soleil: 'sun', mercure: 'mercury', venus: 'venus', terre: 'earth', lune: 'moon', mars: 'mars', phobos: 'phobos', deimos: 'deimos', jupiter: 'jupiter', saturne: 'saturn', uranus: 'uranus', neptune: 'neptune', pluton: 'pluto', io: 'io', europe: 'europa', ganymede: 'ganymede', callisto: 'callisto', mimas: 'mimas', encelade: 'enceladus', tethys: 'tethys', dione: 'dione', rhea: 'rhea', titan: 'titan', japet: 'iapetus', miranda: 'miranda', ariel: 'ariel', umbriel: 'umbriel', titania: 'titania', oberon: 'oberon', triton: 'triton', charon: 'charon', galerie: 'gallery', node: 'node', 'faire-un-don': 'donate',
};

/** Chemin anglais d'une page française (« /en/moon ») ; accueil anglais si la page n'a pas de jumelle. */
export function englishPathFor(frSlug: string | null): string {
  // Adresse anglaise, si elle existe.
  const en = frSlug ? EN_SLUG_OF[frSlug] : undefined;
  // Chemin complet.
  return en ? `${EN_HOME_PATH}/${en}` : EN_HOME_PATH;
}
