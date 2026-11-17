// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le découpage complet et le centre de la cellule d'un point, depuis hexGrid.
import { buildHexGrid, cellCenterOf } from '../hexGrid';
// Importe lonLatToXYZ, la conversion d'une longitude et d'une latitude en point de la sphère, depuis mercator.
import { lonLatToXYZ } from './mercator';
// Importe les deux projections, depuis projection.
import { EQUIRECTANGULAR, MERCATOR } from './projection';
// Importe depuis hexCells (début de la liste).
import {
  // Les fonctions testées : maillage, boîte, clé, champ de la caméra, images, découpe, niveaux, cellule, enfants, racines et sélection.
  buildCellMesh, cellBox, cellKeyOf, cellOutside, cellTiles, cellUVs, clipCellToTile, fallbackLevels, cellZoom, hexCell, hexChildren, hexRoots, selectHexCells, tilesForBox,
// Fin de la liste : le module hexCells.
} from './hexCells';

// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// norm : vecteur rendu unitaire.
const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
// near : vrai quand deux points sont à moins de eps l'un de l'autre.
const near = (a, b, eps = 1e-9) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < eps;
// rng : générateur pseudo-aléatoire à partir d'une graine (début).
function rng(seed) {
  // État du générateur.
  let s = seed;
  // Renvoie une fonction qui fait avancer l'état et donne un nombre entre 0 et 1.
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
// Fin de rng.
}
/** Le point p est-il dans la cellule ? (sa cellule de même fréquence a le même centre) */
// inside : vrai quand un point est dans une cellule, c'est-à-dire quand sa cellule de même fréquence a le même centre.
const inside = (cell, p) => near(cellCenterOf(p, cell.f), cell.center, 1e-9 / cell.f);

// Test : les cellules du niveau 0.
test('niveau 0 : 42 cellules, 12 pentagones, contour qui alterne coins et milieux', () => {
  // Les cellules racines.
  const roots = hexRoots();
  // Il y en a 42.
  assert.equal(roots.length, 42);
  // Dont 12 pentagones.
  assert.equal(roots.filter((c) => c.pentagon).length, 12);
  // Dont 2 aux pôles.
  assert.equal(roots.filter((c) => c.polar).length, 2);
  // Pour chaque cellule (début).
  for (const c of roots) {
    // Nombre de côtés : 5 ou 6.
    const sides = c.pentagon ? 5 : 6;
    // Autant de coins.
    assert.equal(c.corners.length, sides);
    // Autant de milieux.
    assert.equal(c.mids.length, sides);
    // Un contour deux fois plus long.
    assert.equal(c.ring.length, 2 * sides);
    // Un milieu est plus près du centre que les deux coins qui l'entourent, et il est entre eux.
    // Pour chaque milieu du contour (début).
    for (let n = 0; n < c.ring.length; n += 2) {
      // Le coin précédent, le milieu et le coin suivant.
      const a = c.ring[n], m = c.ring[n + 1], b = c.ring[(n + 2) % c.ring.length];
      // Le milieu est plus près du centre que ses deux coins.
      assert.ok(dot(c.center, m) > dot(c.center, a) && dot(c.center, m) > dot(c.center, b));
      // Il est entre ses deux coins.
      assert.ok(dot(m, a) > dot(a, b) && dot(m, b) > dot(a, b), 'le milieu est entre ses deux coins');
    // Fin de la boucle des milieux.
    }
  // Fin de la boucle des cellules.
  }
// Fin du test.
});

// Test : une cellule calculée seule est celle du découpage complet.
test('cellule calculée seule = cellule du découpage complet (coins et milieux identiques)', () => {
  // Découpage complet de fréquence 8.
  const grid = buildHexGrid(8);
  // k : clé d'un point, coordonnées arrondies.
  const k = (p) => p.map((v) => Math.round(v * 1e7)).join(',');
  // Clés des milieux de toutes les limites.
  const mids = new Set(grid.edges.map((e) => k(e[1])));
  // Pour chaque cellule du découpage (début).
  for (const g of grid.cells) {
    // La même cellule, calculée seule.
    const c = hexCell(g.center, 8);
    // Même centre.
    assert.ok(near(c.center, g.center));
    // Mêmes coins.
    assert.deepEqual(new Set(c.corners.map(k)), new Set(g.corners.map(k)));
    // Ses milieux sont des milieux du découpage.
    for (const m of c.mids) assert.ok(mids.has(k(m)));
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : le redécoupage d'une cellule.
test('redécoupage : 1 enfant au centre + 1 par côté, qui recouvrent toute la cellule, à tous les niveaux', () => {
  // Générateur pseudo-aléatoire.
  const r = rng(11);
  // Six lieux d'essai : les deux pôles, Paris, près de l'antiméridien, un sommet de l'icosaèdre et près du pôle sud.
  const spots = [[0, 1, 0], [0, -1, 0], lonLatToXYZ(2.35, 48.85), lonLatToXYZ(179.99, 10), lonLatToXYZ(36, 26.5651), lonLatToXYZ(-70, -89.9)];
  // Pour cinq fréquences, de 2 à 2 puissance 20 (début).
  for (const f of [2, 4, 64, 2 ** 12, 2 ** 20]) {
    // Pour chaque lieu (début).
    for (const spot of spots) {
      // Sa cellule.
      const cell = hexCell(spot, f);
      // Ses enfants.
      const kids = hexChildren(cell);
      // Six enfants pour un pentagone, sept pour un hexagone.
      assert.equal(kids.length, cell.pentagon ? 6 : 7);
      // Tous de clé différente.
      assert.equal(new Set(kids.map((c) => c.key)).size, kids.length);
      // Tous de fréquence double et du niveau suivant.
      assert.ok(kids.every((c) => c.f === 2 * f && c.level === cell.level + 1));
      // Points pris au hasard dans la cellule : chacun tombe dans un de ses enfants.
      // Soixante points au hasard (début).
      for (let n = 0; n < 60; n++) {
        // Deux points du contour pris au hasard.
        const a = cell.ring[Math.floor(r() * cell.ring.length)], b = cell.ring[Math.floor(r() * cell.ring.length)];
        // Deux poids au hasard.
        const u = r(), v = r() * (1 - u);
        // Point combiné du centre et de ces deux points, ramené sur la sphère.
        const p = norm([0, 1, 2].map((i) => cell.center[i] * (1 - u - v) + a[i] * u + b[i] * v));
        // Hors de la cellule : ignoré.
        if (!inside(cell, p)) continue; // combinaison tombée hors de la cellule (pentagone, arrondi au bord)
        // Il est dans un des enfants.
        assert.ok(kids.some((kid) => inside(kid, p)), `point non recouvert par les enfants (f = ${f})`);
      // Fin de la boucle des points.
      }
    // Fin de la boucle des lieux.
    }
  // Fin de la boucle des fréquences.
  }
// Fin du test.
});

// Test : l'enfant partagé par deux cellules voisines.
test('deux cellules voisines partagent l’enfant à cheval sur leur côté commun', () => {
  // Une cellule de fréquence 16.
  const cell = hexCell(lonLatToXYZ(10, 20), 16);
  // Clés de ses enfants.
  const kids = new Set(hexChildren(cell).map((c) => c.key));
  // Pour chacun de ses milieux (début).
  for (const m of cell.mids) {
    // Le voisin de l'autre côté de ce milieu : symétrique du centre par rapport au milieu.
    // Projection du centre sur le milieu.
    const d = dot(cell.center, m);
    // Cellule voisine : celle du symétrique du centre par rapport au milieu.
    const other = hexCell(norm([0, 1, 2].map((i) => 2 * d * m[i] - cell.center[i])), 16);
    // C'est une autre cellule.
    assert.notEqual(other.key, cell.key);
    // Elle a un enfant en commun avec la première.
    assert.ok(hexChildren(other).some((c) => kids.has(c.key)));
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : la couverture du sol par la sélection.
test('sélection : tout le sol visible est recouvert, de loin comme de près, et les cellules proches sont plus fines', () => {
  // Générateur pseudo-aléatoire.
  const r = rng(5);
  // Pour quatre altitudes (début).
  for (const alt of [3, 0.3, 0.01, 1e-4]) {
    // Direction de Paris.
    const camDir = lonLatToXYZ(2.35, 48.85);
    // Position de la caméra à cette altitude.
    const cam = camDir.map((c) => c * (1 + alt));
    // Cellules sélectionnées.
    const cells = selectHexCells({ cam, fovY: 0.8, viewportH: 900 }, { maxCells: 1e5 });
    // Il y en a.
    assert.ok(cells.length > 0);
    // Toutes de clé différente.
    assert.equal(new Set(cells.map((c) => c.key)).size, cells.length);
    // Angle de l'horizon.
    const horizon = Math.acos(1 / (1 + alt));
    // Quatre cents points au hasard (début).
    for (let n = 0; n < 400; n++) {
      // Point au hasard à l'intérieur de l'horizon.
      // Vecteur au hasard.
      const t = [r() - 0.5, r() - 0.5, r() - 0.5];
      // Direction perpendiculaire à celle de la caméra.
      const side = norm([t[1] * camDir[2] - t[2] * camDir[1], t[2] * camDir[0] - t[0] * camDir[2], t[0] * camDir[1] - t[1] * camDir[0]]);
      // Angle au hasard, à l'intérieur de l'horizon.
      const ang = horizon * 0.98 * r();
      // Point du sol à cet angle.
      const p = norm([0, 1, 2].map((i) => camDir[i] * Math.cos(ang) + side[i] * Math.sin(ang)));
      // Il est dans une cellule sélectionnée.
      assert.ok(cells.some((c) => inside(c, p)), `sol non recouvert à l’altitude ${alt}`);
    // Fin de la boucle des points.
    }
    // Sous une altitude de 1 : la première cellule est plus fine que la dernière.
    if (alt < 1) assert.ok(cells[0].level > cells[cells.length - 1].level, 'plus fin près de la caméra');
  // Fin de la boucle des altitudes.
  }
// Fin du test.
});

// Test : le plafond du nombre de cellules et l'arrêt de l'affinage.
test('sélection : plafond du nombre de cellules et arrêt quand les images ne peuvent pas être plus fines', () => {
  // Caméra près du sol.
  const cam = lonLatToXYZ(0, 0).map((c) => c * 1.001);
  // Sélection plafonnée à 40 cellules.
  const capped = selectHexCells({ cam, fovY: 0.8, viewportH: 900 }, { maxCells: 40 });
  // Elle ne dépasse pas 40.
  assert.ok(capped.length <= 40);
  // Sélection où l'affinage s'arrête au niveau 3.
  const coarse = selectHexCells({ cam, fovY: 0.8, viewportH: 900 }, { maxCells: 1e5, canRefine: (c) => c.level < 3 });
  // Aucune cellule au-delà du niveau 3.
  assert.ok(coarse.every((c) => c.level <= 3));
// Fin du test.
});

// Pour chacune des deux projections (début).
for (const proj of [MERCATOR, EQUIRECTANGULAR]) {
  // Test : les images carrées d'une cellule.
  test(`images carrées d’une cellule (${proj.id}) : chaque point de la cellule tombe dans l’une d’elles`, () => {
    // Sept lieux d'essai.
    const spots = [[0, 1, 0], [0, -1, 0], lonLatToXYZ(2.35, 48.85), lonLatToXYZ(179.9, 5), lonLatToXYZ(-179.9, -40), lonLatToXYZ(100, 80), lonLatToXYZ(36, 26.5651)];
    // Pour quatre fréquences (début).
    for (const f of [2, 8, 64, 1024]) {
      // Pour chaque lieu (début).
      for (const spot of spots) {
        // Sa cellule.
        const cell = hexCell(spot, f);
        // Sa boîte en longitude et latitude.
        const box = cellBox(cell);
        // Niveau d'image voulu.
        const zWanted = Math.min(18, cell.level + 2);
        // Niveau retenu et images de la cellule, 16 au plus.
        const { z, tiles } = cellTiles(proj, box, zWanted, 0, 16);
        // Entre 1 et 16 images.
        assert.ok(tiles.length >= 1 && tiles.length <= 16, `${tiles.length} images`);
        // Le niveau retenu est le niveau voulu, sauf pour une cellule polaire ou quand le plafond de 16 images est atteint.
        assert.ok(z === zWanted || cell.polar !== 0 || tiles.length === 16);
        // Maillage de la cellule.
        const mesh = buildCellMesh(cell, 4);
        // Coordonnées de texture du maillage pour chaque image.
        const uvs = tiles.map((t) => cellUVs(mesh, proj, t.z, t.x, t.y));
        // Centre de chaque petit triangle : dans [0, 1]² pour au moins une image (le shader y dessine).
        // Pour chaque triangle du maillage (début).
        for (let v = 0; v < mesh.count; v += 3) {
          // Cherche une image qui le contient (début).
          const hit = uvs.some((uv) => {
            // Centre du triangle en coordonnées de texture.
            const u = (uv[v * 2] + uv[v * 2 + 2] + uv[v * 2 + 4]) / 3, w = (uv[v * 2 + 1] + uv[v * 2 + 3] + uv[v * 2 + 5]) / 3;
            // Il est dans l'image, à 0,002 près.
            return u >= -0.002 && u <= 1.002 && w >= -0.002 && w <= 1.002;
          // Fin de la recherche.
          });
          // Il doit y en avoir une.
          assert.ok(hit, `triangle sans image (f = ${f}, z = ${z})`);
        // Fin de la boucle des triangles.
        }
      // Fin de la boucle des lieux.
      }
    // Fin de la boucle des fréquences.
    }
  // Fin du test.
  });
// Fin de la boucle des projections.
}

// Test : le maillage d'une cellule polaire.
test('maillage d’une cellule : triangles sur la sphère, relatifs au centre, pôle sans longitude', () => {
  // Cellule du pôle nord.
  const cell = hexCell([0, 1, 0], 4);
  // Son maillage.
  const mesh = buildCellMesh(cell, 3);
  // Le nombre de sommets est un multiple de 3.
  assert.equal(mesh.count % 3, 0);
  // Trois coordonnées par sommet.
  assert.equal(mesh.positions.length, mesh.count * 3);
  // Nombre de sommets au pôle.
  let poles = 0;
  // Pour chaque sommet (début).
  for (let v = 0; v < mesh.count; v++) {
    // Sa position absolue : relative, plus le centre.
    const p = [0, 1, 2].map((i) => mesh.positions[v * 3 + i] + cell.center[i]);
    // Il est sur la sphère, à 1e-6 près.
    assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-6);
    // Longitude non définie : c'est le pôle.
    if (Number.isNaN(mesh.lonLat[v * 2])) poles++;
  // Fin de la boucle.
  }
  // Autant de sommets au pôle que de points du contour.
  assert.equal(poles, cell.ring.length); // le pôle est le centre : un sommet par triangle de l'éventail qui le touche
// Fin du test.
});

// Test : le niveau des images d'une cellule.
test('niveau des images : même règle que les tuiles carrées, borné', () => {
  // Une cellule de fréquence 64.
  const cell = hexCell(lonLatToXYZ(0, 0), 64);
  // Pixels par unité de longueur vue à une distance de 1.
  const pxPerUnit = 900 / (2 * Math.tan(0.4));
  // Niveau choisi à une distance de 0,01.
  const z = cellZoom(MERCATOR, cell, 0.01, pxPerUnit, { maxZoom: 19 });
  // À ce niveau, un pixel d'image couvre 2 pixels d'écran au plus.
  assert.ok((MERCATOR.groundSize(z, 0) / 256 / 0.01) * pxPerUnit <= 2);
  // Au niveau précédent, il en couvrirait plus de 2.
  assert.ok(z === 0 || (MERCATOR.groundSize(z - 1, 0) / 256 / 0.01) * pxPerUnit > 2);
  // De très près, avec un maximum de 12 : niveau 12.
  assert.equal(cellZoom(MERCATOR, cell, 1e-9, pxPerUnit, { maxZoom: 12 }), 12);
  // Une boîte de 20° au niveau 0 : une seule tuile.
  assert.equal(tilesForBox(MERCATOR, 0, { west: -10, east: 10, south: -10, north: 10 }).length, 1);
// Fin du test.
});

// ------------------------------------------------------------------ champ de la caméra (vue de dessus et vue 3/4)

// cross : produit vectoriel de deux vecteurs.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Caméra posée à `alt` au-dessus de (lon, lat), qui regarde le sol à `tilt` degrés de la verticale, vers le nord. */
// camera : caméra au-dessus d'un lieu, inclinée d'un angle donné vers le nord (début).
function camera(lon, lat, alt, tilt, fovY = 0.8, aspect = 16 / 9) {
  // Verticale du lieu.
  const upDir = lonLatToXYZ(lon, lat);
  // Position de la caméra.
  const cam = upDir.map((c) => c * (1 + alt));
  // Directions de l'est et du nord au lieu.
  const east = norm(cross([0, 1, 0], upDir)), north = cross(upDir, east);
  // Inclinaison en radians.
  const t = (tilt * Math.PI) / 180;
  // Direction du regard.
  const fwd = norm([0, 1, 2].map((i) => -upDir[i] * Math.cos(t) + north[i] * Math.sin(t)));
  // Direction de la droite de l'écran.
  const right = norm(cross(fwd, upDir.map((c, i) => c * Math.sin(t) + north[i] * Math.cos(t))));
  // Direction du haut de l'écran.
  const up = cross(right, fwd);
  // Demi-angles vertical et horizontal du champ.
  const h = fovY / 2, hx = Math.atan(Math.tan(h) * aspect);
  // plane : plan passant par la caméra, de normale donnée.
  const plane = (n) => [...n, -dot(n, cam)];
  // Les quatre plans du champ (début).
  const planes = [
    // Le plan du haut.
    plane([0, 1, 2].map((i) => -up[i] * Math.cos(h) + fwd[i] * Math.sin(h))),
    // Le plan du bas.
    plane([0, 1, 2].map((i) => up[i] * Math.cos(h) + fwd[i] * Math.sin(h))),
    // Le plan de droite.
    plane([0, 1, 2].map((i) => -right[i] * Math.cos(hx) + fwd[i] * Math.sin(hx))),
    // Le plan de gauche.
    plane([0, 1, 2].map((i) => right[i] * Math.cos(hx) + fwd[i] * Math.sin(hx))),
  // Fin des plans.
  ];
  /** Point du sol vu au point (sx, sy) de l'écran (−1 à 1), ou null si le rayon part dans le ciel. */
  // ground : point du sol vu en un point de l'écran (début).
  const ground = (sx, sy) => {
    // Direction du rayon.
    const d = norm([0, 1, 2].map((i) => fwd[i] + right[i] * sx * Math.tan(hx) + up[i] * sy * Math.tan(h)));
    // Coefficients de l'intersection avec la sphère.
    const b = dot(cam, d), c = dot(cam, cam) - 1, disc = b * b - c;
    // Le rayon manque la sphère : null.
    if (disc < 0) return null;
    // Distance jusqu'à la sphère.
    const s = -b - Math.sqrt(disc);
    // Le point, s'il est devant la caméra ; sinon null.
    return s > 0 ? norm([0, 1, 2].map((i) => cam[i] + d[i] * s)) : null;
  // Fin de ground.
  };
  // Test large par sphère englobante (ancien tri), pour comparer.
  // inFrustum : test large par sphère englobante.
  const inFrustum = (c, r) => planes.every(([nx, ny, nz, d]) => nx * c[0] + ny * c[1] + nz * c[2] + d >= -r * 1.15);
  // Renvoie la vue avec les plans, la vue avec le test large, les plans et la fonction ground.
  return { view: { cam, fovY, viewportH: 900, planes }, loose: { cam, fovY, viewportH: 900, inFrustum }, planes, ground };
// Fin de camera.
}

// Test : le tri par le champ de la caméra.
test('champ de la caméra : seules les cellules qui le touchent sont gardées, et tout ce qui est à l’écran est recouvert', () => {
  // Générateur pseudo-aléatoire.
  const r = rng(21);
  // Cinq vues d'essai (début).
  const views = [
    // De dessus, de loin.
    ['de dessus, de loin', camera(2.35, 48.85, 2, 0)],
    // De dessus, de près.
    ['de dessus, de près', camera(2.35, 48.85, 0.002, 0)],
    // Inclinée de 60°.
    ['vue 3/4', camera(2.35, 48.85, 0.002, 60)],
    // Rasante, à 80°.
    ['vue 3/4 rasante, horizon à l’écran', camera(-120, -30, 0.0005, 80)],
    // Inclinée, près du pôle.
    ['vue 3/4 près du pôle', camera(40, 88, 0.01, 55)],
  // Fin des vues.
  ];
  // Pour chaque vue (début).
  for (const [name, cam] of views) {
    // Cellules sélectionnées.
    const cells = selectHexCells(cam.view, { maxCells: 1e5 });
    // Il y en a.
    assert.ok(cells.length > 0, name);
    // Aucune cellule gardée n'est entièrement d'un mauvais côté du champ.
    // Aucune n'est entièrement hors du champ.
    for (const c of cells) assert.equal(cellOutside(c, cam.planes), false, name);
    // Chaque point du sol visible à l'écran est dans une cellule gardée : pas de trou.
    // Nombre de points du sol vus.
    let seen = 0;
    // Six cents points de l'écran au hasard (début).
    for (let n = 0; n < 600; n++) {
      // Point du sol correspondant.
      const p = cam.ground(r() * 1.98 - 0.99, r() * 1.98 - 0.99);
      // Dans le ciel : ignoré.
      if (!p) continue;
      // Un point vu de plus.
      seen++;
      // Il est dans une cellule sélectionnée.
      assert.ok(cells.some((c) => inside(c, p)), `trou à l’écran (${name})`);
    // Fin de la boucle des points.
    }
    // Plus de cent points ont touché le sol.
    assert.ok(seen > 100, name);
    // Tri plus serré que l'ancien test par sphère englobante.
    // Sélection avec le test large.
    const loose = selectHexCells(cam.loose, { maxCells: 1e5 });
    // La sélection par les plans ne garde pas plus de cellules.
    assert.ok(cells.length <= loose.length, `${name} : ${cells.length} cellules contre ${loose.length}`);
  // Fin de la boucle des vues.
  }
// Fin du test.
});

// Test : la marge du relief dans le tri.
test('champ de la caméra : avec du relief, une cellule juste sous le bord de l’écran est gardée', () => {
  // Une petite cellule à l'équateur.
  const cell = hexCell(lonLatToXYZ(0, 0), 2 ** 14);
  // Plan horizontal qui passe juste au-dessus de la cellule : dedans = au-dessus.
  // Plan horizontal juste au-dessus de la cellule.
  const n = cell.center, d = -(1 + 0.0005);
  // Sans marge : la cellule est hors du champ.
  assert.equal(cellOutside(cell, [[...n, d]]), true);
  // Avec une marge de relief : elle est gardée.
  assert.equal(cellOutside(cell, [[...n, d]], 0.0015), false);
// Fin du test.
});

// ------------------------------------------------------------------ découpe d'une cellule au bord de ses images

/** Aire des triangles (positions relatives, 9 nombres par triangle). */
// meshArea : aire totale des triangles d'un maillage (début).
function meshArea(positions, count) {
  // Aire : 0 au départ.
  let area = 0;
  // Pour chaque triangle (début).
  for (let v = 0; v < count; v += 3) {
    // Premier côté.
    const a = [0, 1, 2].map((i) => positions[(v + 1) * 3 + i] - positions[v * 3 + i]);
    // Second côté.
    const b = [0, 1, 2].map((i) => positions[(v + 2) * 3 + i] - positions[v * 3 + i]);
    // Ajoute la moitié de la longueur de leur produit vectoriel.
    area += Math.hypot(...cross(a, b)) / 2;
  // Fin de la boucle.
  }
  // Renvoie l'aire.
  return area;
// Fin de meshArea.
}

// Pour chacune des deux projections (début).
for (const proj of [MERCATOR, EQUIRECTANGULAR]) {
  // Test : la découpe d'une cellule par ses images.
  test(`découpe (${proj.id}) : les morceaux par image recouvrent la cellule une seule fois, sans rien hors de l’image`, () => {
    // Cinq lieux d'essai.
    const spots = [[0, 1, 0], lonLatToXYZ(2.35, 48.85), lonLatToXYZ(179.9, 5), lonLatToXYZ(-60, -70), lonLatToXYZ(36, 26.5651)];
    // Pour trois fréquences (début).
    for (const f of [4, 32, 512]) {
      // Pour chaque lieu (début).
      for (const spot of spots) {
        // Pour deux finesses de maillage (début).
        for (const segments of [1, 5]) {
          // La cellule.
          const cell = hexCell(spot, f);
          // Son maillage.
          const mesh = buildCellMesh(cell, segments);
          // Ses images, 24 au plus.
          const { tiles } = cellTiles(proj, cellBox(cell), Math.min(18, cell.level + 2), 0, 24);
          // Aire cumulée des morceaux et nombre d'images utilisées.
          let pieces = 0, used = 0;
          // Pour chaque image (début).
          for (const t of tiles) {
            // Morceau de la cellule situé dans cette image.
            const part = clipCellToTile(mesh, cellUVs(mesh, proj, t.z, t.x, t.y));
            // Son nombre de sommets est un multiple de 3.
            assert.equal(part.count % 3, 0);
            // S'il n'est pas vide : une image utilisée de plus.
            if (part.count) used++;
            // Toutes ses coordonnées de texture sont dans l'image, à 0,0021 près.
            for (let i = 0; i < part.uvs.length; i++) assert.ok(part.uvs[i] >= -0.0021 && part.uvs[i] <= 1.0021, 'sommet hors de l’image');
            // Ajoute son aire.
            pieces += meshArea(part.positions, part.count);
          // Fin de la boucle des images.
          }
          // Aire de la cellule entière.
          const whole = meshArea(mesh.positions, mesh.count);
          // Même aire à la marge près (les morceaux voisins se chevauchent d'un demi-pixel de texture).
          // L'aire des morceaux vaut celle de la cellule, à 3 % près par excès.
          assert.ok(pieces >= whole * 0.9999 && pieces <= whole * 1.03, `aire ${pieces / whole} (f = ${f}, ${segments} segments)`);
          // Entre une image utilisée et toutes.
          assert.ok(used >= 1 && used <= tiles.length);
        // Fin de la boucle des finesses.
        }
      // Fin de la boucle des lieux.
      }
    // Fin de la boucle des fréquences.
    }
  // Fin du test.
  });
// Fin de la boucle des projections.
}

// Test : une image qui ne touche pas la cellule.
test('découpe : une image qui ne touche pas la cellule ne donne aucun triangle', () => {
  // Une cellule de fréquence 64.
  const cell = hexCell(lonLatToXYZ(10, 10), 64);
  // Son maillage.
  const mesh = buildCellMesh(cell, 2);
  // Sa découpe par une image lointaine ne donne aucun sommet.
  assert.equal(clipCellToTile(mesh, cellUVs(mesh, MERCATOR, 6, 0, 0)).count, 0);
// Fin du test.
});

// Test : l'ordre des niveaux de repli.
test('niveaux de repli : le niveau voulu, puis plus fin (dézoom sans retour au flou), puis plus grossier', () => {
  // Niveau 5, entre 0 et 19 : 5, puis 6 et 7, puis de 4 à 0.
  assert.deepEqual(fallbackLevels(5, 0, 19), [5, 6, 7, 4, 3, 2, 1, 0]);
  // Niveau 19, entre 3 et 19 : de 19 à 3.
  assert.deepEqual(fallbackLevels(19, 3, 19), [19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  // Niveau 18, entre 17 et 19 : 18, 19, puis 17.
  assert.deepEqual(fallbackLevels(18, 17, 19), [18, 19, 17]);
// Fin du test.
});

// Test : le rattachement d'une cellule fine à une cellule plus grande.
test('dézoom : une cellule fine se rattache à la cellule plus grande qui contient son centre', () => {
  // Pour trois lieux (début).
  for (const spot of [lonLatToXYZ(2.35, 48.85), [0, 1, 0], lonLatToXYZ(36, 26.5651)]) {
    // Grande cellule de fréquence 64.
    const big = hexCell(spot, 64);
    // Ses enfants.
    const kids = hexChildren(big);
    // L'enfant du centre, et ses propres enfants du centre, se rattachent à la grande cellule.
    // Le centre du premier enfant est dans la grande cellule.
    assert.equal(cellKeyOf(kids[0].center, 64), big.key);
    // Le centre du premier petit-enfant de cet enfant aussi.
    assert.equal(cellKeyOf(hexChildren(kids[0])[0].center, 64), big.key);
    // Les petits-enfants : chacun se rattache à une cellule du niveau de la grande (elle ou une voisine).
    // Nombre de petits-enfants rattachés à la grande cellule.
    let own = 0;
    // Pour chaque petit-enfant (début).
    for (const kid of kids) for (const g of hexChildren(kid)) {
      // Clé de la cellule de fréquence 64 qui contient son centre.
      const key = cellKeyOf(g.center, 64);
      // Elle est bien de fréquence 64.
      assert.ok(key.startsWith('64:'));
      // Si c'est la grande cellule : un de plus.
      if (key === big.key) own++;
    // Fin de la boucle.
    }
    // Au moins sept y sont rattachés.
    assert.ok(own >= 7);
  // Fin de la boucle des lieux.
  }
// Fin du test.
});
