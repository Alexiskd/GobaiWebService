// Recherche d'adresses (rue, numéro) dans les réponses de Photon (OpenStreetMap). Fonctions pures : testables sans réseau.

// Forme d'un résultat du géocodeur Photon.
export interface PhotonFeature {
  // geometry : sa position, longitude puis latitude.
  geometry?: { coordinates?: [number, number] };
  // properties : ses propriétés, toutes en texte et facultatives.
  properties?: Record<string, string | undefined>;
// Fin de PhotonFeature.
}

// Forme d'une adresse trouvée : nom, contexte, longitude, latitude, et la marque « address ».
export interface AddressItem { name: string; context: string; lon: number; lat: number; kind: 'address' }

/** Mots de voie (français et anglais) qui annoncent une adresse plutôt qu'un nom de ville. */
// Expression qui reconnaît un mot de voie isolé (rue, avenue, boulevard, street…), en début de texte ou après une espace ou une virgule, sans tenir compte de la casse.
const STREET_WORDS = /(^|[\s,])(rue|avenue|av\.?|boulevard|bd\.?|chemin|place|all[ée]e|impasse|quai|route|square|passage|street|road|lane)([\s,]|$)/i;

/** Vrai si le texte ressemble à une adresse : un numéro, ou un mot de voie suivi d'un nom. */
// Fonction looksLikeAddress : le texte ressemble-t-il à une adresse ?
export function looksLikeAddress(q: string): boolean {
  // Texte nettoyé de ses espaces (chaîne vide s'il est absent).
  const text = String(q ?? '').trim();
  // Moins de 4 caractères : non.
  if (text.length < 4) return false;
  // Oui s'il contient un chiffre, ou un mot de voie et au moins une espace (donc un nom après le mot).
  return /\d/.test(text) || (STREET_WORDS.test(text) && /\s/.test(text));
// Fin de looksLikeAddress.
}

/** Adresse lisible d'un résultat Photon (maison numérotée ou voie), ou null si ce n'en est pas une. */
// Fonction addressItem : transforme un résultat Photon en adresse, ou null.
export function addressItem(feature: PhotonFeature): AddressItem | null {
  // Ses propriétés, objet vide si elles manquent.
  const p = feature?.properties ?? {};
  // Sa longitude et sa latitude, NaN si elles manquent.
  const [lon, lat] = feature?.geometry?.coordinates ?? [NaN, NaN];
  // Sans coordonnées valides : null.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Nom de la voie : le champ street, ou le nom du résultat si c'est lui-même une voie (highway).
  const street = p.street || (p.osm_key === 'highway' ? p.name : undefined);
  // Sans voie : null.
  if (!street) return null;
  // Y a-t-il un numéro de maison ?
  const isHouse = Boolean(p.housenumber);
  // Ni maison numérotée ni voie (un commerce, par exemple) : null.
  if (!isHouse && p.osm_key !== 'highway') return null;
  // Nom affiché : « numéro voie », ou la voie seule.
  const name = isHouse ? `${p.housenumber} ${street}` : street;
  // Commune : la première valeur présente parmi ville, bourg, village, quartier, comté.
  const town = p.city || p.town || p.village || p.district || p.county;
  // Contexte : « code postal commune », puis le pays,
  const context = [[p.postcode, town].filter(Boolean).join(' '), p.country]
    // sans les morceaux vides ni les répétitions,
    .filter((v, i, a) => v && a.indexOf(v) === i)
    // séparés par une virgule.
    .join(', ');
  // Renvoie l'adresse.
  return { name, context, lon, lat, kind: 'address' };
// Fin de addressItem.
}

/** Adresses d'une réponse Photon, sans doublon (une même voie revient souvent en plusieurs tronçons). */
// Fonction addressItems : les adresses d'une réponse Photon, limitées en nombre.
export function addressItems(features: PhotonFeature[] | undefined, limit: number): AddressItem[] {
  // Adresses déjà vues.
  const seen = new Set<string>();
  // Adresses produites.
  const items: AddressItem[] = [];
  // Pour chaque résultat (aucun si la liste manque) :
  for (const f of features ?? []) {
    // essaie d'en faire une adresse ;
    const item = addressItem(f);
    // ce n'en est pas une : on passe.
    if (!item) continue;
    // Sa clé : nom et contexte, en minuscules.
    const key = `${item.name}|${item.context}`.toLowerCase();
    // Déjà vue : on passe.
    if (seen.has(key)) continue;
    // On la note comme vue,
    seen.add(key);
    // on l'ajoute,
    items.push(item);
    // et on s'arrête à la limite.
    if (items.length >= limit) break;
  // Fin de la boucle.
  }
  // Renvoie les adresses.
  return items;
// Fin de addressItems.
}
