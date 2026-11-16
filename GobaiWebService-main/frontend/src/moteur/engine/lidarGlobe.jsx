// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe l'origine du calage d'un nuage et la conversion d'un point du nuage en point du globe, depuis lidarAnchor.
import { lidarAnchorOrigin, lidarToGlobe } from './lidarAnchor';
// Importe toLonLat, la conversion d'un vecteur en longitude et latitude, depuis gps.
import { toLonLat } from './gps';

// Tuiles LiDAR sur le globe : chaque nuage calé par GPS (coordonnée posée au centre de son emprise, au bas du nuage)
// est dessiné comme une boîte filaire (emprise X/Y × hauteur Z) et un repère au point d'ancrage, toujours visible.
// Le tout est rattaché au maillage de la Terre : il suit sa rotation propre comme les tuiles.
// Un aperçu (position pas encore validée) se dessine en couleur d'accent ; le mode « placement » transforme
// le prochain clic sur la Terre en coordonnée GPS.

// Couleur d'un aperçu : orange.
const PREVIEW = 0xffb300;
// Les douze arêtes d'une boîte, par paires de numéros de coins.
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

// boxPositions : les positions des arêtes de la boîte d'un nuage (début).
function boxPositions(cloud, radius) {
  // Les limites de l'emprise du nuage.
  const { minX, minY, minZ, maxX, maxY, maxZ } = cloud.bounds;
  // Liste des huit coins.
  const corners = [];
  // Pour le bas puis le haut de la boîte (début).
  for (const z of [minZ, maxZ]) {
    // Pour chacun des quatre coins de l'emprise (début).
    for (const [x, y] of [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]) {
      // Ajoute le coin, converti en point du globe et mis à l'échelle du rayon.
      corners.push(lidarToGlobe({ x, y, z }, cloud).map((v) => v * radius));
    // Fin de la boucle des coins.
    }
  // Fin de la boucle des hauteurs.
  }
  // Tableau de six nombres par arête.
  const out = new Float32Array(EDGES.length * 6);
  // Range les deux bouts de chaque arête.
  EDGES.forEach(([a, b], i) => out.set([...corners[a], ...corners[b]], i * 6));
  // Renvoie le tableau.
  return out;
// Fin de boxPositions.
}

// Déclare et exporte la classe LidarGlobe (début).
export class LidarGlobe {
  /** @param {{ earth: { mesh: THREE.Mesh, def: { radius: number } } }} engine */
  // Constructeur : le moteur (début).
  constructor(engine) {
    // Garde le moteur.
    this.engine = engine;
    // Rayon de la Terre dans la scène, ou 1.
    this.radius = engine.earth.def.radius || 1;
    // Objet qui porte tous les nuages.
    this.root = new THREE.Object3D();
    // Son nom : « lidar ».
    this.root.name = 'lidar';
    // Ordre de dessin : 10.
    this.root.renderOrder = 10;
    // Le rattache au maillage de la Terre.
    engine.earth.mesh.add(this.root);
    // Table des nuages dessinés, par nom.
    this.items = new Map();   // nom → { cloud, group, normal }
    // Liste des nuages du catalogue.
    this.clouds = [];
    // Aperçu : aucun.
    this.preview = null;      // { name, anchor }
    // Fonction de placement : aucune.
    this.onPlace = null;      // (lat, lon) => void en mode placement
    // Vecteur de travail.
    this.tmp = new THREE.Vector3();
    // Vecteur de travail pour la caméra.
    this.tmpCam = new THREE.Vector3();
  // Fin du constructeur.
  }

  /** Nuages du catalogue ; seuls ceux qui ont une emprise et un calage GPS sont dessinés. */
  // setClouds : reçoit les nuages du catalogue (début).
  setClouds(clouds = []) {
    // Les garde.
    this.clouds = clouds;
    // Reconstruit le dessin.
    this.rebuild();
  // Fin de setClouds.
  }

  /** Aperçu d'un nuage (objet du catalogue) à une position non validée ; null = aucun aperçu. */
  // setPreview : reçoit un nuage et une position d'aperçu (début).
  setPreview(cloud, anchor) {
    // Garde l'aperçu si les deux sont donnés, sinon aucun.
    this.preview = cloud && anchor ? { name: cloud.name, cloud, anchor } : null;
    // Reconstruit le dessin.
    this.rebuild();
  // Fin de setPreview.
  }

  /** Mode placement : le prochain clic sur la Terre appelle `fn({ lat, lon })`. null pour en sortir. */
  // setPlacement : reçoit la fonction de placement, ou null (début).
  setPlacement(fn) {
    // La garde.
    this.onPlace = fn || null;
    // Curseur en croix pendant le placement, sinon en main ouverte.
    this.engine.canvas.style.cursor = fn ? 'crosshair' : 'grab';
  // Fin de setPlacement.
  }

  /** Clic sur l'écran pendant le placement : true si le clic a été consommé. */
  // handleClick : un clic à l'écran (début).
  handleClick(x, y) {
    // Hors du mode placement : le clic n'est pas consommé.
    if (!this.onPlace) return false;
    // Point de la Terre sous le clic.
    const g = this.engine.pickEarth(x, y);
    // S'il y en a un : appelle la fonction de placement.
    if (g) this.onPlace(g);
    // Le clic est consommé.
    return true;
  // Fin de handleClick.
  }

  // rebuild : reconstruit le dessin de tous les nuages (début).
  rebuild() {
    // Pour chaque nuage déjà dessiné (début).
    for (const { group } of this.items.values()) {
      // Retire son groupe.
      this.root.remove(group);
      // Libère ses géométries et ses matériaux.
      group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    // Fin de la boucle.
    }
    // Vide la table.
    this.items.clear();
    // L'aperçu en cours.
    const p = this.preview;
    // Nuages à dessiner : ceux du catalogue, sauf celui qui est en aperçu.
    const shown = this.clouds.filter((c) => c.name !== p?.name);
    // Ajoute l'aperçu : le nuage avec la position proposée, marqué comme aperçu.
    if (p) shown.push({ ...p.cloud, anchor: { ...p.cloud.anchor, ...p.anchor }, preview: true });
    // Pour chaque nuage à dessiner (début).
    for (const cloud of shown) {
      // Sans emprise, sans calage ou sans latitude valable : ignoré.
      if (!cloud.bounds || !cloud.anchor || !Number.isFinite(cloud.anchor.lat)) continue;
      // Couleur de l'aperçu (orange) ; un nuage validé n'a plus de couleur propre, son cadre et son repère sont masqués.
      const color = PREVIEW;
      // Groupe du nuage.
      const group = new THREE.Group();
      // Son nom : « lidar: » suivi du nom du nuage.
      group.name = `lidar:${cloud.name}`;

      // Géométrie de la boîte.
      const box = new THREE.BufferGeometry();
      // Ses positions.
      box.setAttribute('position', new THREE.BufferAttribute(boxPositions(cloud, this.radius), 3));
      // Les arêtes, dessinées sans test de profondeur.
      const lines = new THREE.LineSegments(box, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }));
      // Jamais écartées par le test de visibilité.
      lines.frustumCulled = false;
      // Nuage validé : cadre masqué (plus de bleu clair sur le globe). Seul l'aperçu orange reste visible.
      lines.visible = Boolean(cloud.preview);
      // Ordre de dessin : 10.
      lines.renderOrder = 10;
      // Les ajoute au groupe.
      group.add(lines);

      // Repère du point d'ancrage (centre, bas), taille fixe à l'écran : visible même de loin.
      // Point d'ancrage du nuage sur le globe, à l'échelle du rayon.
      const o = lidarToGlobe(lidarAnchorOrigin(cloud.bounds), cloud).map((v) => v * this.radius);
      // Géométrie du repère.
      const dot = new THREE.BufferGeometry();
      // Sa position.
      dot.setAttribute('position', new THREE.BufferAttribute(new Float32Array(o), 3));
      // Le repère : un point de taille fixe à l'écran, plus gros pour un aperçu.
      const marker = new THREE.Points(dot, new THREE.PointsMaterial({ color, size: cloud.preview ? 11 : 8, sizeAttenuation: false, depthTest: false }));
      // Jamais écarté par le test de visibilité.
      marker.frustumCulled = false;
      // Nuage validé : repère masqué, comme le cadre.
      marker.visible = Boolean(cloud.preview);
      // Ordre de dessin : 11.
      marker.renderOrder = 11;
      // L'ajoute au groupe.
      group.add(marker);

      // Ajoute le groupe à l'objet des nuages.
      this.root.add(group);
      // Range le nuage dans la table, avec la direction de son point d'ancrage.
      this.items.set(cloud.name, { cloud, group, normal: new THREE.Vector3(...o).normalize() });
    // Fin de la boucle.
    }
  // Fin de rebuild.
  }

  /** À chaque image : masque les nuages situés sur la face cachée de la Terre (dessinés sans test de profondeur). */
  // update : reçoit la caméra (début).
  update(camera) {
    // Aucun nuage dessiné : rien à faire.
    if (!this.items.size) return;
    // Le maillage de la Terre.
    const mesh = this.engine.earth.mesh;
    // Met à jour sa matrice.
    mesh.updateWorldMatrix(true, false);
    // Position de la caméra dans le repère de la Terre, en rayons.
    const local = mesh.worldToLocal(this.tmpCam.copy(camera.position)).divideScalar(this.radius);
    // Pour chaque nuage dessiné (début).
    for (const { group, normal } of this.items.values()) {
      // Visible si la caméra est au-dessus de l'horizon du point : (caméra − point) · normale > 0.
      // Visible si la caméra est au-dessus de l'horizon de son point d'ancrage.
      group.visible = this.tmp.copy(local).sub(normal).dot(normal) > -1e-6;
    // Fin de la boucle.
    }
  // Fin de update.
  }

  // dispose : libère tout (début).
  dispose() {
    // Vide les nuages.
    this.setClouds([]);
    // Retire l'objet des nuages du maillage de la Terre.
    this.engine.earth.mesh.remove(this.root);
  // Fin de dispose.
  }
// Fin de la classe LidarGlobe.
}

/** Point de la Terre sous un pixel : { lat, lon } ou null (rayon caméra × sphère du maillage). */
// Déclare et exporte pickEarthAt : le moteur et un point de l'écran.
export function pickEarthAt(engine, x, y) {
  // Rectangle du canevas dans la page.
  const rect = engine.canvas.getBoundingClientRect();
  // Coordonnées du point entre −1 et 1, l'axe vertical vers le haut.
  const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  // Met à jour la matrice de la caméra.
  engine.cam.updateMatrixWorld(true);
  // Le maillage de la Terre.
  const mesh = engine.earth.mesh;
  // Met à jour sa matrice.
  mesh.updateWorldMatrix(true, false);
  // Lanceur de rayons.
  const ray = new THREE.Raycaster();
  // Rayon partant de la caméra et passant par le point.
  ray.setFromCamera(ndc, engine.cam);
  // Centre de la Terre dans le monde.
  const center = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
  // Échelle du maillage.
  const scale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x;
  // Intersection du rayon et de la sphère de la Terre.
  const hit = ray.ray.intersectSphere(new THREE.Sphere(center, (engine.earth.def.radius || 1) * scale), new THREE.Vector3());
  // Aucune : null.
  if (!hit) return null;
  // Longitude et latitude du point touché, dans le repère de la Terre.
  const [lon, lat] = toLonLat(mesh.worldToLocal(hit).toArray());
  // Renvoie la latitude et la longitude si elles sont valables, sinon null.
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
// Fin de pickEarthAt.
}
