/**
 * Profils d'affichage des astres tuilés : la méthode « Earth Maps » (globe en arbre de tuiles carrées drapées sur le
 * relief) décrite comme une table de données, lue par un seul moteur (TileManager), au lieu d'un moteur par astre.
 *
 * Méthode reprise des applis de globe 3D (Earth Maps, Earth 3D Map) avec des sources ouvertes, sans clé ni licence
 * payante :
 *  - affichage : arbre de tuiles XYZ (quadtree), chaque tuile carrée choisie par son erreur à l'écran, horizon et
 *    champ de la caméra exclus, ancêtre affiché tant que la tuile fine n'est pas arrivée ;
 *  - relief : altitudes Terrarium (Mapterhorn / Copernicus GLO-30, AWS Terrain Tiles) drapées sous les tuiles à
 *    toutes les altitudes de la caméra, fond des océans compris ;
 *  - imagerie : la table de priorité du serveur (orthophotos nationales ouvertes, Sentinel-2 cloudless d'EOX, NASA
 *    GIBS), inchangée.
 */

// Déclare et exporte les profils, par identifiant d'astre (début).
export const GLOBE_PROFILES = Object.freeze({
  // La Terre : méthode « Earth Maps » (début).
  earth: Object.freeze({
    // Nom de la méthode, pour les relevés.
    method: 'earth-maps',
    // Affichage en arbre de tuiles carrées, à la place des cellules hexagonales.
    display: 'quadtree',
    // Relief drapé à toutes les altitudes de la caméra (avant : seulement à 1 km ou moins).
    reliefMaxKm: Infinity,
    // Relief allumé par défaut (l'utilisateur peut toujours le couper dans Paramètres).
    reliefDefaultOn: true,
  // Fin de la Terre.
  }),
// Fin des profils.
});

/** Profil par défaut d'un astre sans entrée : cellules hexagonales, réglages du moteur inchangés. */
// Déclare et exporte le profil par défaut.
export const DEFAULT_GLOBE_PROFILE = Object.freeze({ method: 'hex', display: 'hex' });
