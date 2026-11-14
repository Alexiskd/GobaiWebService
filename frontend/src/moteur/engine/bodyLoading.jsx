// Moteur de chargement planétaire : décide, à chaque image, ce que chaque astre mérite d'après sa taille à l'écran,
// sa présence dans le champ de la caméra et l'astre visé. Même idée qu'un moteur de tuiles cartographiques, appliquée
// aux astres : rien n'est chargé ni dessiné tant que le niveau de zoom ne le justifie pas, et jamais tout à la fois.
// Fonctions pures (aucun accès à three.js) : le moteur 3D leur donne des nombres et applique leurs réponses.

/** Niveaux de détail d'un astre, du moins coûteux au plus coûteux. */
// Table des niveaux, figée (début).
export const LOD = Object.freeze({
  // Hors du champ de la caméra : rien à mettre à jour.
  CULLED: 0,
  // Trop petit pour qu'on y voie un disque : un point.
  POINT: 1,
  // Disque visible, trop petit pour une carte : la sphère seule.
  SPHERE: 2,
  // Assez grand pour une carte : la sphère et ses tuiles.
  TILES: 3,
// Fin de la table.
});

/** Rayon apparent (px) à partir duquel un astre est dessiné comme un disque. */
// Seuil du disque : un demi-pixel de rayon.
export const SPHERE_MIN_PX = 0.5;
/** Rayon apparent (px) à partir duquel on voit une carte sur un astre : ses tuiles sont alors chargées. */
// Seuil des tuiles : 3 pixels de rayon.
export const TILE_MIN_PX = 3;
/** Nombre d'astres dont les tuiles sont mises à jour en même temps (ordinateur, puis téléphone ou mode économie). */
// Budget : 3 astres à la fois.
export const MAX_TILED_BODIES = 3;
// Budget allégé : 2 astres à la fois.
export const MAX_TILED_BODIES_LITE = 2;
/** Rayon apparent (px) de l'orbite d'un satellite à partir duquel il se détache de sa planète : il apparaît. */
// Seuil d'apparition d'un satellite : orbite de 14 pixels de rayon.
export const SAT_SHOW_PX = 14;
/** Seuil de disparition, plus bas que celui d'apparition : pas de clignotement autour du seuil. */
// Seuil de disparition d'un satellite : orbite de 10 pixels de rayon.
export const SAT_HIDE_PX = 10;

/** Pixels par unité de scène à une unité de distance, pour une hauteur d'écran et un champ vertical (radians). */
// Déclare et exporte pixelScale : hauteur de l'écran sur deux fois la tangente du demi-champ.
export const pixelScale = (height, fovY) => height / (2 * Math.tan(fovY / 2));

/** Taille apparente (px) d'une longueur de scène vue à une distance donnée. */
// Déclare et exporte apparentPx : longueur fois l'échelle, divisée par la distance (jamais nulle).
export const apparentPx = (length, distance, pxScale) => (length * pxScale) / Math.max(1e-9, distance);

/** Demi-angle (radians) du cône qui contient tout le champ de la caméra, coins de l'écran compris. */
// Déclare et exporte viewConeHalfAngle : champ vertical et rapport largeur / hauteur.
export function viewConeHalfAngle(fovY, aspect) {
  // Tangente du demi-champ vertical.
  const t = Math.tan(fovY / 2);
  // Angle jusqu'au coin de l'écran : la diagonale de la demi-hauteur et de la demi-largeur.
  return Math.atan(t * Math.hypot(1, aspect));
// Fin de viewConeHalfAngle.
}

/**
 * Vrai si une sphère touche le cône de vue. `rel` : centre de la sphère par rapport à la caméra ; `dir` : direction
 * de visée, de longueur 1. Test prudent : il ne dit jamais « hors champ » pour une sphère visible.
 */
// Déclare et exporte sphereInView : position relative, direction de visée, rayon et demi-angle du cône.
export function sphereInView(rel, dir, radius, halfAngle) {
  // Distance de la caméra au centre de la sphère.
  const dist = Math.hypot(rel[0], rel[1], rel[2]);
  // Caméra dans la sphère ou à sa surface : visible.
  if (dist <= radius) return true;
  // Cosinus de l'angle entre la visée et le centre, borné entre -1 et 1.
  const cos = Math.max(-1, Math.min(1, (rel[0] * dir[0] + rel[1] * dir[1] + rel[2] * dir[2]) / dist));
  // Visible si cet angle ne dépasse pas le demi-angle du cône plus le rayon angulaire de la sphère.
  return Math.acos(cos) <= halfAngle + Math.asin(radius / dist);
// Fin de sphereInView.
}

/** Niveau de détail d'un astre : l'astre visé a toujours ses tuiles ; sinon le champ puis la taille décident. */
// Déclare et exporte bodyLevel : rayon apparent, présence dans le champ et astre visé ou non.
export function bodyLevel({ px, inView, focused }) {
  // L'astre visé : toujours au niveau des tuiles.
  if (focused) return LOD.TILES;
  // Hors du champ : rien.
  if (!inView) return LOD.CULLED;
  // Assez grand pour une carte : tuiles.
  if (px >= TILE_MIN_PX) return LOD.TILES;
  // Disque visible : sphère ; sinon un point.
  return px >= SPHERE_MIN_PX ? LOD.SPHERE : LOD.POINT;
// Fin de bodyLevel.
}

/**
 * Astres dont les tuiles sont mises à jour à cette image : l'astre visé d'abord, puis les plus grands à l'écran,
 * dans la limite du budget. Les suivants passent chacun leur tour, un par image (`tick` : numéro de l'image) : tous
 * finissent par être servis, sans jamais être mis à jour tous à la fois.
 */
// Déclare et exporte planTiledBodies : candidats { id, px, level, focused }, budget et numéro de l'image.
export function planTiledBodies(candidates, max = MAX_TILED_BODIES, tick = 0) {
  // Garde ceux au niveau des tuiles, l'astre visé en tête, puis du plus grand au plus petit.
  const ranked = candidates.filter((c) => c.level === LOD.TILES)
    // Tri : astre visé d'abord, puis rayon apparent décroissant.
    .sort((a, b) => Number(Boolean(b.focused)) - Number(Boolean(a.focused)) || b.px - a.px);
  // Budget effectif : au moins un astre.
  const budget = Math.max(1, max);
  // Les identifiants retenus à chaque image : les premiers du classement.
  const plan = new Set(ranked.slice(0, budget).map((c) => c.id));
  // Ceux qui dépassent le budget.
  const rest = ranked.slice(budget);
  // S'il y en a : un seul d'entre eux est servi à cette image, à tour de rôle.
  if (rest.length) plan.add(rest[Math.abs(Math.trunc(tick)) % rest.length].id);
  // Renvoie le plan.
  return plan;
// Fin de planTiledBodies.
}

/**
 * Vrai si un satellite doit être dessiné : toujours s'il est visé ; sinon quand son orbite est assez grande à l'écran
 * pour qu'il se détache de sa planète. `shown` : son état à l'image précédente (seuil de disparition plus bas).
 */
// Déclare et exporte satelliteShown : rayon apparent de l'orbite, satellite visé ou non, état précédent.
export function satelliteShown({ orbitPx, focused, shown }) {
  // Visé : toujours dessiné.
  if (focused) return true;
  // Déjà dessiné : le reste jusqu'au seuil de disparition ; sinon il faut atteindre le seuil d'apparition.
  return orbitPx >= (shown ? SAT_HIDE_PX : SAT_SHOW_PX);
// Fin de satelliteShown.
}
