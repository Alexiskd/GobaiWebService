/**
 * Imagerie des astres solides autres que la Terre dans le globe CesiumJS : le fond de carte déjà choisi dans l'app
 * (sa source de tuiles three.js : NASA Trek, USGS, composite « Lune réelle »…) est lu tel quel par CesiumJS, avec le
 * même découpage. Une seule source de tuiles sert donc aux deux moteurs (mêmes images, mêmes couleurs, mêmes caches).
 *
 * Découpages : Web Mercator (2^z × 2^z tuiles) ↔ WebMercatorTilingScheme ; plate carrée NASA Trek (2^(z+1) × 2^z
 * tuiles, du pôle Nord au pôle Sud) ↔ GeographicTilingScheme (2 × 1 tuiles au niveau 0, le réglage par défaut).
 */

/**
 * Réglages d'une source de tuiles three.js pour CesiumJS : découpage, niveaux extrêmes et taille des tuiles.
 * Fonction pure.
 * @param {{ minZoom?: number, maxZoom?: number }} source la source de tuiles three.js (TileSource)
 * @param {string} projectionId 'mercator' ou 'equirectangular'
 */
// Déclare et exporte imageryOptions : la source et l'identifiant du découpage (début).
export function imageryOptions(source, projectionId) {
  // Niveau le plus grossier servi par la source (0 si inconnu).
  const minimumLevel = Math.max(0, source?.minZoom ?? 0);
  // Niveau le plus fin servi par la source (jamais sous le plus grossier).
  const maximumLevel = Math.max(minimumLevel, source?.maxZoom ?? 0);
  // Découpage : plate carrée pour NASA Trek, Web Mercator sinon.
  const scheme = projectionId === 'equirectangular' ? 'geographic' : 'webmercator';
  // Réglages.
  return { scheme, minimumLevel, maximumLevel, tileSize: 256 };
// Fin de imageryOptions.
}

/**
 * Adresse des tuiles d'une source three.js (`info.urlTemplate`, avec {z}, {x} et {y}), ou null. Fonction pure.
 * @param {{ info?: { urlTemplate?: string } }} source
 */
// Déclare et exporte templateOf : la source (début).
export function templateOf(source) {
  // Adresse décrite par la source.
  const t = source?.info?.urlTemplate;
  // Seulement une adresse complète.
  return typeof t === 'string' && t.includes('{z}') && t.includes('{x}') && t.includes('{y}') ? t : null;
// Fin de templateOf.
}

/**
 * Fournisseur d'images CesiumJS qui lit une source de tuiles three.js (`source.loadImage({ z, x, y }, signal)`).
 * Sous le niveau le plus grossier de la source, une image transparente d'un pixel (CesiumJS demande toujours le
 * niveau 0). Une tuile en échec est signalée à CesiumJS, qui garde l'image du niveau au-dessus.
 * @param {object} Cesium la bibliothèque CesiumJS
 * @param {{ source: object, projectionId: string, ellipsoid: object, credit?: string }} o
 */
// Déclare et exporte tileSourceImageryProvider : la bibliothèque et la source (début).
export function tileSourceImageryProvider(Cesium, { source, projectionId, ellipsoid, credit = '' }) {
  // Réglages de la source.
  const o = imageryOptions(source, projectionId);
  // Découpage de l'astre (même ellipsoïde que le globe).
  const tilingScheme = o.scheme === 'geographic' ? new Cesium.GeographicTilingScheme({ ellipsoid }) : new Cesium.WebMercatorTilingScheme({ ellipsoid });
  // Adresse des tuiles de la source ({z}/{x}/{y}), si elle en a une servie dès le niveau 0.
  const template = templateOf(source);
  // Cas courant (NASA Trek, USGS, relais du serveur) : le fournisseur d'adresses de CesiumJS, le même que pour la Terre
  // (chargement, file d'attente et nouveaux essais de CesiumJS). Le fournisseur maison ci-dessous reste pour les
  // sources sans adresse (images composées dans le navigateur).
  if (template && o.minimumLevel === 0) {
    // Le fournisseur d'adresses (début) :
    return new Cesium.UrlTemplateImageryProvider({
      // l'adresse (relative : même serveur que la page), le découpage, la taille et les niveaux ;
      url: template, tilingScheme, tileWidth: o.tileSize, tileHeight: o.tileSize, minimumLevel: 0, maximumLevel: o.maximumLevel,
      // image opaque, mention de la source.
      hasAlphaChannel: false, ...(credit ? { credit: new Cesium.Credit(credit) } : {}),
    // Fin du fournisseur d'adresses.
    });
  // Fin de ce cas.
  }
  // Image transparente d'un pixel, pour les niveaux trop grossiers (créée à la première demande).
  let blank = null;
  // Le fournisseur (début) :
  return {
    // Découpage, emprise et taille des tuiles.
    tilingScheme, rectangle: tilingScheme.rectangle, tileWidth: o.tileSize, tileHeight: o.tileSize,
    // Niveaux : CesiumJS demande dès 0, on répond pour tous jusqu'au plus fin de la source.
    minimumLevel: 0, maximumLevel: o.maximumLevel,
    // Prêt tout de suite, sans transparence (fond opaque), sans politique de rejet.
    ready: true, readyPromise: Promise.resolve(true), hasAlphaChannel: false, tileDiscardPolicy: undefined,
    // Événement des erreurs, mention de la source, pas de mandataire.
    errorEvent: new Cesium.Event(), credit: credit ? new Cesium.Credit(credit) : undefined, proxy: undefined,
    // Pas de mention par tuile.
    getTileCredits() { return []; },
    // Pas d'objet à choisir sur la carte.
    pickFeatures() { return undefined; },
    // requestImage : l'image d'une tuile (début).
    requestImage(x, y, level) {
      // Niveau plus grossier que la source : image transparente d'un pixel.
      if (level < o.minimumLevel) {
        // Créée une fois.
        if (!blank) { blank = document.createElement('canvas'); blank.width = 1; blank.height = 1; }
        // Renvoyée tout de suite.
        return Promise.resolve(blank);
      // Fin de ce cas.
      }
      // Sinon : l'image de la source three.js (image ou canevas), ou un rejet si elle est indisponible.
      return source.loadImage({ z: level, x, y }).then((img) => img || Promise.reject(new Error('Tuile vide')));
    // Fin de requestImage.
    },
  // Fin du fournisseur.
  };
// Fin de tileSourceImageryProvider.
}
