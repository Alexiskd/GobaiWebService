// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';

// Placement des étiquettes HTML au-dessus de la scène 3D : projection écran,
// puis masquage des étiquettes qui se chevauchent ou qui sont cachées par la Terre.

// Vecteur de travail pour les projections à l'écran.
const v3 = new THREE.Vector3();
// Vecteur de travail pour une position dans le monde.
const vWorld = new THREE.Vector3();
// Vecteur de travail pour une normale.
const vNormal = new THREE.Vector3();
// Vecteur de travail pour la position de la caméra relative à la Terre.
const vCamRel = new THREE.Vector3();

// overlaps : vrai quand deux étiquettes se chevauchent, avec une marge horizontale et une marge verticale.
const overlaps = (a, b, marginX, marginY) =>
  // Les deux intervalles horizontaux se recouvrent, marge comprise, et l'écart vertical est inférieur à la marge.
  a.x < b.x + b.w + marginX && b.x < a.x + a.w + marginX && Math.abs(a.y - b.y) < marginY;

// Écritures DOM seulement quand quelque chose change (affichage, ou déplacement d'au moins 0,05 px) :
// chaque écriture de style coûte un recalcul de mise en page du navigateur.
// show : affiche une étiquette à sa position (début).
function show(item) {
  // Son élément HTML.
  const el = item.el;
  // Aucun : rien à faire.
  if (!el) return;
  // S'il n'est pas déjà noté comme affiché : l'affiche et le note.
  if (el._shown !== true) { el.style.display = 'block'; el._shown = true; }
  // Si la position n'a jamais été écrite, ou si elle a bougé de plus de 0,05 pixel (début).
  if (el._x === undefined || Math.abs(el._x - item.x) > 0.05 || Math.abs(el._y - item.y) > 0.05) {
    // Mémorise la nouvelle position.
    el._x = item.x; el._y = item.y;
    // Déplace l'élément par une translation CSS.
    el.style.transform = `translate(${item.x}px,${item.y}px)`;
  // Fin de la mise à jour de la position.
  }
// Fin de show.
}
// hide : masque une étiquette (début).
const hide = (item) => {
  // Son élément HTML.
  const el = item.el;
  // S'il existe et n'est pas déjà noté comme masqué : le masque et le note.
  if (el && el._shown !== false) { el.style.display = 'none'; el._shown = false; }
// Fin de hide.
};

// Étiquettes d'un point de la surface terrestre (villes, routes) : visibles seulement
// si la caméra est assez proche et que le point fait face à la caméra.
// projectSurface : calcule la position à l'écran d'une étiquette posée sur la Terre (début).
function projectSurface(item, { cam, W, H, earthMesh, earthPos, camRel, camDist, maxDist, charW, enabled }) {
  // Non visible par défaut.
  item.ok = false;
  // Étiquettes désactivées, ou caméra trop loin : terminé.
  if (!enabled || camDist >= maxDist) return;
  // Position du point dans le monde, par la matrice de la Terre.
  const world = vWorld.copy(item.lv).applyMatrix4(earthMesh.matrixWorld);
  // Normale au point : direction unitaire depuis le centre de la Terre.
  const normal = vNormal.copy(world).sub(earthPos).normalize();
  // Si la projection de la caméra sur cette normale ne dépasse pas 1,0003 : le point n'est pas assez face à la caméra, terminé.
  if (normal.dot(camRel) <= 1.0003) return;
  // Projection du point à l'écran.
  v3.copy(world).project(cam);
  // S'il est devant le plan lointain et à l'intérieur de l'écran, avec 10 % de marge (début).
  if (v3.z <= 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1) {
    // Étiquette visible.
    item.ok = true;
    // Abscisse en pixels.
    item.x = ((v3.x + 1) / 2) * W;
    // Ordonnée en pixels, remontée de 7 pixels.
    item.y = ((1 - v3.y) / 2) * H - 7;
    // Largeur estimée : 14 pixels plus la largeur d'un caractère par lettre.
    item.w = 14 + charW * item.name.length;
  // Fin du cas visible.
  }
// Fin de projectSurface.
}

/**
 * @param {object} s
 *  cam, W, H            caméra et taille de l'écran
 *  bodies               [{ el, name, pos }]  soleil + planètes (pos = position scène)
 *                       enabled: false masque le repère (case décochée, ou astre assez grand pour être vu)
 *  cities               [{ el, name, lv, ok, x, y, w }]  objets persistants (le moteur les réutilise)
 *  earthGroup, earthMesh
 */
// Déclare et exporte layoutLabels : l'état nécessaire au placement.
export function layoutLabels(s) {
  // La caméra et la taille de l'écran.
  const { cam, W, H } = s;

  // Soleil et planètes : les plus proches de la caméra ont priorité.
  // Pour chaque astre (début).
  const bodies = s.bodies.map((b) => {
    // Projection de sa position à l'écran.
    v3.copy(b.pos).project(cam);
    // Renvoie un objet de placement (début).
    return {
      // Son élément HTML.
      el: b.el,
      // Son activation.
      enabled: b.enabled,
      // Sa distance à la caméra.
      q: b.pos.distanceTo(cam.position),
      // Visible s'il est devant le plan lointain.
      ok: v3.z <= 1,
      // Abscisse en pixels.
      x: ((v3.x + 1) / 2) * W,
      // Ordonnée en pixels, remontée de 8 pixels.
      y: ((1 - v3.y) / 2) * H - 8,
      // Largeur estimée : 14 pixels plus 7 par lettre.
      w: 14 + 7 * b.name.length,
      // Vrai pour l'astre ciblé.
      focused: Boolean(b.focused),
    // Fin de l'objet.
    };
  // Fin de la boucle.
  });
  // L'astre ciblé d'abord (un satellite vu de loin chevauche sa planète), puis les plus proches de la caméra.
  // Trie : l'astre ciblé d'abord, puis par distance croissante.
  bodies.sort((a, b) => (b.focused - a.focused) || (a.q - b.q));
  // Liste des étiquettes d'astres déjà affichées.
  const shownBodies = [];
  // Pour chaque astre, dans cet ordre (début).
  bodies.forEach((o) => {
    // S'il est activé, visible et ne chevauche aucune étiquette déjà affichée, à 18 pixels près en hauteur (début).
    if (o.enabled !== false && o.ok && !shownBodies.some((p) => overlaps(o, p, 0, 18))) {
      // L'ajoute à la liste.
      shownBodies.push(o);
      // L'affiche.
      show(o);
    // Sinon : le masque.
    } else hide(o);
  // Fin de la boucle.
  });

  // Villes (Terre uniquement).
  // Position de la Terre.
  const earthPos = s.earthGroup.position;
  // Position de la caméra relative à la Terre.
  const camRel = vCamRel.copy(s.cam.position).sub(earthPos);
  // Met à jour la matrice de la Terre, parents compris, sans ses enfants.
  s.earthMesh.updateWorldMatrix(true, false); // groupe + maillage, sans les tuiles
  // Contexte commun aux villes : distance maximale de 25, 6 pixels par caractère, et activation des villes.
  const ctx = { cam, W, H, earthMesh: s.earthMesh, earthPos, camRel, camDist: camRel.length(), maxDist: 25, charW: 6, enabled: s.citiesEnabled !== false };

  // Calcule la position de chaque ville.
  s.cities.forEach((c) => projectSurface(c, ctx));
  // Liste des étiquettes de villes déjà affichées.
  const shownCities = [];
  // Pour chaque ville (début).
  s.cities.forEach((c) => {
    // Si elle est visible et ne chevauche aucune étiquette déjà affichée, avec 8 pixels de marge en largeur et 16 en hauteur (début).
    if (c.ok && !shownCities.some((p) => overlaps(c, p, 8, 16))) {
      // L'ajoute à la liste.
      shownCities.push(c);
      // L'affiche.
      show(c);
    // Sinon : la masque.
    } else hide(c);
  // Fin de la boucle.
  });

// Fin de layoutLabels.
}
