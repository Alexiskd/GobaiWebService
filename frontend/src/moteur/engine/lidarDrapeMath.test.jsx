// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe readFileSync, la lecture d'un fichier, depuis le module fs de Node.
import { readFileSync } from 'node:fs';
// Importe les sept fonctions testées du drapage.
import { drapePlan, drapeTiles, drapeUv, localToMercator, mercatorOf, nodeDrape, tileRect } from './lidarDrapeMath';

// Manifeste de la dalle LiDAR de Paris, lu dans les données du backend.
const manifest = JSON.parse(readFileSync(new URL('../../../../backend/data/lidar/paris-0652-6863/manifest.json', import.meta.url), 'utf8'));

// Test : la projection Web Mercator normalisée.
test('Web Mercator normalisé : origine, équateur, sens des axes', () => {
  // Longitude 0, latitude 0 : le centre, (0,5, 0,5).
  assert.deepEqual(mercatorOf(0, 0), [0.5, 0.5]);
  // Longitude −180 : x vaut 0.
  assert.equal(mercatorOf(-180, 0)[0], 0);
  // Paris : y inférieur à 0,5.
  assert.ok(mercatorOf(2.35, 48.86)[1] < 0.5, 'le nord est en haut (y plus petit)');
  // Latitude 85,0511287798066° : y vaut 0, à 1e-9 près.
  assert.ok(Math.abs(mercatorOf(0, 85.0511287798066)[1]) < 1e-9);
// Fin du test.
});

// Test : le plan de drapage de la dalle de Paris.
test('plan de drapage de la dalle de Paris : tuiles qui couvrent le kilomètre carré', () => {
  // Plan calculé au niveau 18.
  const plan = drapePlan(manifest, 18);
  // Son niveau : 18.
  assert.equal(plan.z, 18);
  // À Paris une tuile de niveau 18 fait ≈ 100 m : 10 à 12 tuiles par côté.
  // Entre 10 et 12 colonnes, et entre 10 et 12 lignes.
  assert.ok(plan.cols >= 10 && plan.cols <= 12 && plan.rows >= 10 && plan.rows <= 12, `${plan.cols} × ${plan.rows}`);
  // Largeur de l'image : 256 pixels par colonne.
  assert.equal(plan.width, plan.cols * 256);
  // Tuile du centre de la dalle (Beaubourg) : colonne 132785 environ au niveau 18.
  // Coordonnées Mercator du point d'ancrage de la dalle.
  const [mx, my] = mercatorOf(manifest.anchor.lon, manifest.anchor.lat);
  // Sa colonne de tuile au niveau 18 est dans le plan.
  assert.ok(Math.floor(mx * 2 ** 18) >= plan.x0 && Math.floor(mx * 2 ** 18) < plan.x0 + plan.cols);
  // Sa ligne de tuile au niveau 18 est dans le plan.
  assert.ok(Math.floor(my * 2 ** 18) >= plan.y0 && Math.floor(my * 2 ** 18) < plan.y0 + plan.rows);
  // Toute la dalle tombe dans l'atlas.
  // Pour les quatre coins de la dalle (à 500 m du centre) et son centre (début).
  for (const [x, y] of [[-500, -500], [500, -500], [500, 500], [-500, 500], [0, 0]]) {
    // Coordonnées du point dans l'image.
    const [u, v] = drapeUv(plan, x, y);
    // Elles sont entre 0 et 1.
    assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1, `(${x}, ${y}) → ${u}, ${v}`);
  // Fin de la boucle.
  }
  // L'est va vers la droite de l'image, le nord vers le haut.
  // Un point à 400 m à l'est a un u plus grand qu'un point à 400 m à l'ouest.
  assert.ok(drapeUv(plan, 400, 0)[0] > drapeUv(plan, -400, 0)[0]);
  // Un point à 400 m au nord a un v plus petit qu'un point à 400 m au sud.
  assert.ok(drapeUv(plan, 0, 400)[1] < drapeUv(plan, 0, -400)[1]);
// Fin du test.
});

// Test : la précision de la transformation affine du drapage.
test('affine du drapage : moins d’un demi-pixel d’écart avec la projection exacte sur toute la dalle', () => {
  // Plan calculé au niveau 18.
  const plan = drapePlan(manifest, 18);
  // Nombre de tuiles par côté à ce niveau.
  const n = 2 ** plan.z;
  // Plus grand écart trouvé : 0 au départ.
  let worst = 0;
  // Pour x de −500 à 500 m par pas de 250 m (début).
  for (let x = -500; x <= 500; x += 250) {
    // Pour y de −500 à 500 m par pas de 250 m (début).
    for (let y = -500; y <= 500; y += 250) {
      // Projection exacte du point en Mercator.
      const [mx, my] = localToMercator(manifest, x, y);
      // Sa position exacte dans l'image, en pixels.
      const exact = [(mx * n - plan.x0) * 256, (my * n - plan.y0) * 256];
      // Sa position par la transformation affine.
      const [u, v] = drapeUv(plan, x, y);
      // Garde le plus grand écart entre les deux, en pixels.
      worst = Math.max(worst, Math.hypot(u * plan.width - exact[0], v * plan.height - exact[1]));
    // Fin de la boucle sur y.
    }
  // Fin de la boucle sur x.
  }
  // L'écart maximal reste inférieur à un demi-pixel.
  assert.ok(worst < 0.5, `écart maximal ${worst} px`);
// Fin du test.
});

// Test : le plafonnement de la taille de l'image.
test('atlas plafonné : le niveau baisse tant que l’image dépasse la taille permise', () => {
  // Plan demandé au niveau 18 avec une taille maximale de 2048 pixels.
  const phone = drapePlan(manifest, 18, 2048);
  // Le niveau retenu est 17.
  assert.equal(phone.z, 17);
  // La largeur et la hauteur ne dépassent pas 2048 pixels.
  assert.ok(phone.width <= 2048 && phone.height <= 2048);
  // Avec une taille maximale de 256 pixels : une seule colonne.
  assert.equal(drapePlan(manifest, 18, 256).cols, 1);
// Fin du test.
});

// Test : la transformation affine d'un nœud.
test('affine d’un nœud : mêmes coordonnées que par les mètres de la dalle', () => {
  // Plan calculé au niveau 17.
  const plan = drapePlan(manifest, 17);
  // Origine du nœud en mètres, et pas de quantification de 4 cm.
  const origin = [-250, 125], step = 0.04;
  // Les coefficients a et b de la transformation du nœud.
  const { a, b } = nodeDrape(plan, origin, step);
  // Coordonnées quantifiées d'essai.
  const q = [1200, 3100]; // coordonnées quantifiées dans le nœud
  // Calcul direct : coordonnées reconverties en mètres, puis passées à drapeUv.
  const direct = drapeUv(plan, origin[0] + q[0] * step, origin[1] + q[1] * step);
  // Le u donné par les coefficients est le même, à 1e-12 près.
  assert.ok(Math.abs(a[0] * q[0] + a[1] * q[1] + b[0] - direct[0]) < 1e-12);
  // Le v donné par les coefficients est le même, à 1e-12 près.
  assert.ok(Math.abs(a[2] * q[0] + a[3] * q[1] + b[1] - direct[1]) < 1e-12);
// Fin du test.
});

// Test : la liste des tuiles à charger.
test('tuiles à charger : aperçu grossier d’abord, puis les tuiles fines du centre vers les bords', () => {
  // Plan calculé au niveau 18.
  const plan = drapePlan(manifest, 18);
  // Les tuiles grossières et les tuiles fines.
  const { coarse, fine } = drapeTiles(plan);
  // Autant de tuiles fines que de cases du plan.
  assert.equal(fine.length, plan.cols * plan.rows);
  // Entre une et neuf tuiles grossières.
  assert.ok(coarse.length >= 1 && coarse.length <= 9, `${coarse.length} tuiles grossières`);
  // Elles sont toutes au niveau 15.
  assert.ok(coarse.every((t) => t.z === 15));
  // Centre du plan, en coordonnées de tuile.
  const cx = plan.x0 + (plan.cols - 1) / 2, cy = plan.y0 + (plan.rows - 1) / 2;
  // d : distance d'une tuile à ce centre.
  const d = (t) => Math.hypot(t.x - cx, t.y - cy);
  // Les tuiles fines sont rangées par distance croissante au centre.
  for (let i = 1; i < fine.length; i++) assert.ok(d(fine[i]) >= d(fine[i - 1]) - 1e-9);
  // Une tuile fine occupe 256 px ; une tuile grossière (3 niveaux au-dessus) 2 048 px, calée sur la même grille.
  // La tuile fine à deux colonnes et une ligne de l'origine occupe le carré de 256 pixels placé en (512, 256).
  assert.deepEqual(tileRect(plan, { z: 18, x: plan.x0 + 2, y: plan.y0 + 1 }), { x: 512, y: 256, size: 256 });
  // Rectangle de la première tuile grossière.
  const big = tileRect(plan, coarse[0]);
  // Sa taille : 2048 pixels.
  assert.equal(big.size, 2048);
  // Elle commence au bord de l'image ou avant.
  assert.ok(big.x <= 0 && big.y <= 0, 'la première tuile grossière commence au bord ou avant');
// Fin du test.
});
