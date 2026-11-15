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

// ------------------------------------------------------------------ Repères des astres

// Rayon de l'anneau d'un repère, en pixels CSS (la moitié de sa taille dans SceneStyles.jsx) : planète, planète visée,
// satellite, satellite visé.
const DOT_R = { planet: 6.5, planetFocus: 7.5, satellite: 4, satelliteFocus: 5 };
// Écart entre l'anneau et le nom, en pixels CSS (le « gap » de SceneStyles.jsx) : planète, satellite.
const NAME_GAP = { planet: 5, satellite: 4 };
// Hauteur d'une étiquette de nom, en pixels CSS : planète, satellite.
const NAME_H = { planet: 20, satellite: 15 };
// Deux anneaux plus proches que cette distance (pixels CSS) : le plus lointain est masqué, il ferait une tache.
const DOT_MERGE_PX = 7;
// Intervalle entre deux mesures de la largeur d'un nom (la langue peut changer le texte), en millisecondes.
const MEASURE_EVERY_MS = 2000;

// rectHit : vrai quand deux rectangles { x0, x1, y0, y1 } se recouvrent.
const rectHit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Largeur du nom d'un repère, en pixels CSS : mesurée dans la page, gardée MEASURE_EVERY_MS, estimée à défaut.
 * @param {HTMLElement} el   le repère (el._name : l'élément du nom)
 * @param {number}      now  instant présent, en millisecondes
 * @param {string}      text le nom, pour l'estimation
 */
// nameWidth : le repère, l'instant et le nom (début).
function nameWidth(el, now, text) {
  // Pas d'élément de nom : estimation à 7 pixels par lettre, plus les marges.
  if (!el?._name) return 16 + 7 * text.length;
  // Mesure trop ancienne ou absente (début) :
  if (el._nameW === undefined || now - el._nameAt > MEASURE_EVERY_MS) {
    // largeur réelle de l'étiquette (le repère n'est jamais retiré de la mise en page : opacité seule) ;
    el._nameW = el._name.offsetWidth || 16 + 7 * text.length;
    // instant de la mesure.
    el._nameAt = now;
  // Fin de la mesure.
  }
  // Renvoie la largeur gardée.
  return el._nameW;
// Fin de nameWidth.
}

/**
 * Affiche un repère : fondu d'entrée, côté du nom (droite, gauche ou aucun), mise en avant, position. Écritures dans
 * la page seulement quand quelque chose change (chaque écriture de style coûte un recalcul de mise en page).
 * @param {object}      o     le repère placé : el, x, y, r (rayon de l'anneau), focused
 * @param {string|null} side  « right », « left », ou null (anneau seul, faute de place pour le nom)
 */
// showMarker : le repère et le côté de son nom (début).
function showMarker(o, side) {
  // Son élément.
  const el = o.el;
  // Aucun : rien.
  if (!el) return;
  // Pas encore affiché : fondu d'entrée.
  if (el._shown !== true) { el.classList.add('on'); el._shown = true; }
  // Nom affiché ou non.
  const named = side !== null;
  // Changement : bascule de la classe « anneau seul ».
  if (el._named !== named) { el.classList.toggle('dot-only', !named); el._named = named; }
  // Nom à gauche de l'anneau ?
  const left = side === 'left';
  // Changement de côté : bascule de la classe, et position à réécrire.
  if (el._left !== left) { el.classList.toggle('left', left); el._left = left; el._x = undefined; }
  // Changement de mise en avant : bascule de la classe, et position à réécrire (l'anneau change de taille).
  if (el._focus !== o.focused) { el.classList.toggle('is-focus', o.focused); el._focus = o.focused; el._x = undefined; }
  // Position jamais écrite, ou déplacée de plus de 0,05 pixel (début) :
  if (el._x === undefined || Math.abs(el._x - o.x) > 0.05 || Math.abs(el._y - o.y) > 0.05) {
    // mémorise la position ;
    el._x = o.x; el._y = o.y;
    // centre de l'anneau sur le point de l'astre : bord gauche (nom à droite) ou bord droit (nom à gauche) de
    // l'élément à un rayon de l'astre, et milieu de sa hauteur à la hauteur de l'astre.
    el.style.transform = `translate(${o.x}px,${o.y}px) translate(${left ? `calc(-100% + ${o.r}px)` : `${-o.r}px`},-50%)`;
  // Fin de la mise à jour de la position.
  }
// Fin de showMarker.
}

// hideMarker : masque un repère en fondu de sortie (début).
function hideMarker(o) {
  // Son élément.
  const el = o.el;
  // Affiché : fondu de sortie.
  if (el && el._shown !== false) { el.classList.remove('on'); el._shown = false; }
// Fin de hideMarker.
}

/**
 * Place les repères des astres : l'astre visé d'abord, puis les planètes avant les satellites, puis du plus proche au
 * plus lointain. Deux passages : d'abord les anneaux (chacun garde le sien, sauf s'il se confond avec un anneau déjà
 * retenu), puis les noms : à droite de l'anneau, sinon à gauche, sinon pas de nom, sans jamais recouvrir un anneau,
 * un autre nom ni le bord de l'écran. Les astres hors de l'écran sont masqués.
 * @param {object[]} bodies  repères du moteur : { el, name, pos, kind, enabled, focused }
 */
// layoutBodies : les repères, la caméra et la taille de l'écran (début).
function layoutBodies(bodies, cam, W, H) {
  // Instant présent, pour les mesures des noms.
  const now = performance.now();
  // Pour chaque repère : sa position à l'écran et ses mesures (début).
  const items = bodies.map((b) => {
    // Projection de sa position à l'écran.
    v3.copy(b.pos).project(cam);
    // Abscisse en pixels CSS.
    const x = ((v3.x + 1) / 2) * W;
    // Ordonnée en pixels CSS.
    const y = ((1 - v3.y) / 2) * H;
    // Satellite ?
    const sat = b.kind === 'satellite';
    // Astre visé ?
    const focused = Boolean(b.focused);
    // Renvoie l'objet de placement (début) :
    return {
      // l'élément, le nom, la famille, la mise en avant et l'activation ;
      el: b.el, name: b.name, sat, focused, enabled: b.enabled,
      // la distance à la caméra (priorité) ;
      q: b.pos.distanceTo(cam.position),
      // visible s'il est devant la caméra et à l'écran (marge de 30 pixels) ;
      ok: v3.z <= 1 && x > -30 && x < W + 30 && y > -30 && y < H + 30,
      // sa position ;
      x, y,
      // le rayon de son anneau.
      r: sat ? (focused ? DOT_R.satelliteFocus : DOT_R.satellite) : (focused ? DOT_R.planetFocus : DOT_R.planet),
    // Fin de l'objet.
    };
  // Fin des mesures.
  });
  // Ordre de priorité : l'astre visé, puis les planètes avant les satellites, puis du plus proche au plus lointain.
  items.sort((a, b) => (b.focused - a.focused) || (a.sat - b.sat) || (a.q - b.q));
  // Premier passage : les anneaux. Chaque repère visible garde son anneau, sauf s'il se confond avec un anneau déjà
  // retenu (astres alignés vus de loin) ; les noms seront placés ensuite en évitant TOUS les anneaux.
  // Repères retenus, dans l'ordre de priorité.
  const kept = [];
  // Rectangles déjà occupés : anneaux, puis noms.
  const taken = [];
  // Pour chaque repère, dans l'ordre de priorité (début).
  for (const o of items) {
    // Désactivé (case décochée, astre assez grand pour être vu, caché derrière un autre) ou hors de l'écran : masqué.
    if (o.enabled === false || !o.ok) { hideMarker(o); continue; }
    // Anneau confondu avec un anneau déjà retenu : masqué, sauf l'astre visé.
    if (!o.focused && kept.some((d) => Math.hypot(d.x - o.x, d.y - o.y) < DOT_MERGE_PX)) { hideMarker(o); continue; }
    // Retenu.
    kept.push(o);
    // Rectangle de son anneau, occupé.
    taken.push({ x0: o.x - o.r, x1: o.x + o.r, y0: o.y - o.r, y1: o.y + o.r });
  // Fin du premier passage.
  }
  // Second passage : les noms, dans le même ordre de priorité (début).
  for (const o of kept) {
    // Largeur du nom.
    const w = nameWidth(o.el, now, o.name);
    // Écart entre l'anneau et le nom.
    const gap = o.sat ? NAME_GAP.satellite : NAME_GAP.planet;
    // Demi-hauteur du nom.
    const hh = (o.sat ? NAME_H.satellite : NAME_H.planet) / 2;
    // Rectangle du nom à droite de l'anneau.
    const right = { x0: o.x + o.r + gap, x1: o.x + o.r + gap + w, y0: o.y - hh, y1: o.y + hh };
    // Rectangle du nom à gauche de l'anneau.
    const left = { x0: o.x - o.r - gap - w, x1: o.x - o.r - gap, y0: o.y - hh, y1: o.y + hh };
    // Place libre : dans l'écran (2 pixels de marge), sans recouvrir aucun anneau ni aucun nom déjà placé.
    const free = (rc) => rc.x0 >= 2 && rc.x1 <= W - 2 && rc.y0 >= 2 && rc.y1 <= H - 2 && !taken.some((t) => rectHit(rc, t));
    // Côté du nom : à droite si possible, sinon à gauche, sinon aucun.
    const side = free(right) ? 'right' : free(left) ? 'left' : null;
    // Le nom placé occupe sa place.
    if (side) taken.push(side === 'right' ? right : left);
    // Affiche le repère.
    showMarker(o, side);
  // Fin du second passage.
  }
// Fin de layoutBodies.
}

/**
 * @param {object} s
 *  cam, W, H            caméra et taille de l'écran
 *  bodies               [{ el, name, pos, kind, focused }]  Soleil, planètes et satellites (pos = position scène)
 *                       enabled: false masque le repère (case décochée, ou astre assez grand pour être vu)
 *  cities               [{ el, name, lv, ok, x, y, w }]  objets persistants (le moteur les réutilise)
 *  earthGroup, earthMesh
 */
// Déclare et exporte layoutLabels : l'état nécessaire au placement.
export function layoutLabels(s) {
  // La caméra et la taille de l'écran.
  const { cam, W, H } = s;

  // Repères des astres (Soleil, planètes, satellites) : voir layoutBodies.
  layoutBodies(s.bodies, cam, W, H);
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
