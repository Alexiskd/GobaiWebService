import * as THREE from 'three';

// Placement des étiquettes HTML au-dessus de la scène 3D : projection écran,
// puis masquage des étiquettes qui se chevauchent ou qui sont cachées par la Terre.

const v3 = new THREE.Vector3();
const vWorld = new THREE.Vector3();
const vNormal = new THREE.Vector3();
const vCamRel = new THREE.Vector3();

const overlaps = (a, b, marginX, marginY) =>
  a.x < b.x + b.w + marginX && b.x < a.x + a.w + marginX && Math.abs(a.y - b.y) < marginY;

// Écritures DOM seulement quand quelque chose change (affichage, ou déplacement d'au moins 0,05 px) :
// chaque écriture de style coûte un recalcul de mise en page du navigateur.
function show(item) {
  const el = item.el;
  if (!el) return;
  if (el._shown !== true) { el.style.display = 'block'; el._shown = true; }
  if (el._x === undefined || Math.abs(el._x - item.x) > 0.05 || Math.abs(el._y - item.y) > 0.05) {
    el._x = item.x; el._y = item.y;
    el.style.transform = `translate(${item.x}px,${item.y}px)`;
  }
}
const hide = (item) => {
  const el = item.el;
  if (el && el._shown !== false) { el.style.display = 'none'; el._shown = false; }
};

// Étiquettes d'un point de la surface terrestre (villes, routes) : visibles seulement
// si la caméra est assez proche et que le point fait face à la caméra.
function projectSurface(item, { cam, W, H, earthMesh, earthPos, camRel, camDist, maxDist, charW, enabled }) {
  item.ok = false;
  if (!enabled || camDist >= maxDist) return;
  const world = vWorld.copy(item.lv).applyMatrix4(earthMesh.matrixWorld);
  const normal = vNormal.copy(world).sub(earthPos).normalize();
  if (normal.dot(camRel) <= 1.0003) return;
  v3.copy(world).project(cam);
  if (v3.z <= 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1) {
    item.ok = true;
    item.x = ((v3.x + 1) / 2) * W;
    item.y = ((1 - v3.y) / 2) * H - 7;
    item.w = 14 + charW * item.name.length;
  }
}

/**
 * @param {object} s
 *  cam, W, H            caméra et taille de l'écran
 *  bodies               [{ el, name, pos }]  soleil + planètes (pos = position scène)
 *  cities               [{ el, name, lv, ok, x, y, w }]  objets persistants (le moteur les réutilise)
 *  earthGroup, earthMesh
 */
export function layoutLabels(s) {
  const { cam, W, H } = s;

  // Soleil et planètes : les plus proches de la caméra ont priorité.
  const bodies = s.bodies.map((b) => {
    v3.copy(b.pos).project(cam);
    return {
      el: b.el,
      q: b.pos.distanceTo(cam.position),
      ok: v3.z <= 1,
      x: ((v3.x + 1) / 2) * W,
      y: ((1 - v3.y) / 2) * H - 8,
      w: 14 + 7 * b.name.length,
    };
  });
  bodies.sort((a, b) => a.q - b.q);
  const shownBodies = [];
  bodies.forEach((o) => {
    if (o.ok && !shownBodies.some((p) => overlaps(o, p, 0, 18))) {
      shownBodies.push(o);
      show(o);
    } else hide(o);
  });

  // Villes (Terre uniquement).
  const earthPos = s.earthGroup.position;
  const camRel = vCamRel.copy(s.cam.position).sub(earthPos);
  s.earthMesh.updateWorldMatrix(true, false); // groupe + maillage, sans les tuiles
  const ctx = { cam, W, H, earthMesh: s.earthMesh, earthPos, camRel, camDist: camRel.length(), maxDist: 25, charW: 6, enabled: s.citiesEnabled !== false };

  s.cities.forEach((c) => projectSurface(c, ctx));
  const shownCities = [];
  s.cities.forEach((c) => {
    if (c.ok && !shownCities.some((p) => overlaps(c, p, 8, 16))) {
      shownCities.push(c);
      show(c);
    } else hide(c);
  });

}
