// Crochet d'effet de React.
import { useEffect } from 'react';
// Bibliothèque 3D.
import * as THREE from 'three';
// Placement d'un point natif de relevé sur le globe, et point d'ancrage d'une emprise.
import { lidarAnchorOrigin, lidarToGlobe } from '@/moteur/engine/lidarAnchor';
// Teintes des états de placement.
import { placementState } from './format';

/**
 * Emprises des contributions dessinées sur le globe : un rectangle au sol et un point en son centre, de la
 * couleur de l'état du placement (validé, contesté, en attente).
 *
 * Les emprises sont dessinées sans test de profondeur, pour rester visibles par-dessus les tuiles de la carte ;
 * celles qui se trouvent sur la face cachée de la Terre sont masquées à chaque image, comme les dalles LiDAR
 * (voir moteur/engine/lidarGlobe.jsx).
 */
// Les quatre côtés du rectangle, par les indices de ses coins.
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0]];

/** Coordonnées des quatre coins du bas de l'emprise, dans le repère du maillage de la Terre. */
function footprintPositions(item, radius) {
  // Emprise native du relevé.
  const { minX, minY, minZ, maxX, maxY } = item.bounds;
  // Les quatre coins, placés sur le globe.
  const corners = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
    .map(([x, y]) => lidarToGlobe({ x, y, z: minZ }, item).map((v) => v * radius));
  // Deux sommets par côté.
  const out = new Float32Array(EDGES.length * 6);
  // Remplit les côtés.
  EDGES.forEach(([a, b], i) => out.set([...corners[a], ...corners[b]], i * 6));
  // Les sommets.
  return out;
// Fin de footprintPositions.
}

/** Calque des emprises : rien à afficher dans la page, tout est dans la scène 3D. */
export function ContributionLayer({ engine, items }) {
  // Construit le calque à chaque changement de moteur ou de liste.
  useEffect(() => {
    // Pas de moteur, pas de Terre, ou rien à dessiner.
    if (!engine?.earth?.mesh || !items?.length) return undefined;
    // Rayon de la Terre dans la scène.
    const radius = engine.earth.def?.radius || 1;
    // Racine du calque, attachée au maillage de la Terre : elle tourne avec lui.
    const root = new THREE.Object3D();
    // Nom repérable dans l'inspecteur de scène.
    root.name = 'contributions';
    // Dessinée après la carte.
    root.renderOrder = 12;
    // Attachée à la Terre.
    engine.earth.mesh.add(root);
    // Les emprises et leur normale, pour masquer la face cachée.
    const drawn = [];
    // Une emprise par contribution plaçable.
    for (const item of items) {
      // Emprise et calage obligatoires.
      if (!item?.bounds || !Number.isFinite(item?.anchor?.lat)) continue;
      // Couleur de l'état du placement.
      const color = placementState(item.status).tint;
      // Groupe de cette contribution.
      const group = new THREE.Group();
      // Nom repérable.
      group.name = `contribution:${item.id}`;
      // Le rectangle au sol.
      const outline = new THREE.BufferGeometry();
      // Ses sommets.
      outline.setAttribute('position', new THREE.BufferAttribute(footprintPositions(item, radius), 3));
      // Les traits, visibles par-dessus la carte.
      const lines = new THREE.LineSegments(outline, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }));
      // Jamais écartée par le tronc de vision.
      lines.frustumCulled = false;
      // Dessinée après la carte.
      lines.renderOrder = 12;
      // Ajoutée au groupe.
      group.add(lines);
      // Centre de l'emprise, placé sur le globe.
      const centre = lidarToGlobe(lidarAnchorOrigin(item.bounds), item).map((v) => v * radius);
      // Le point du centre.
      const dot = new THREE.BufferGeometry();
      // Sa position.
      dot.setAttribute('position', new THREE.BufferAttribute(new Float32Array(centre), 3));
      // Le point, de taille fixe à l'écran.
      const marker = new THREE.Points(dot, new THREE.PointsMaterial({ color, size: 9, sizeAttenuation: false, depthTest: false }));
      // Jamais écarté par le tronc de vision.
      marker.frustumCulled = false;
      // Dessiné après les traits.
      marker.renderOrder = 13;
      // Ajouté au groupe.
      group.add(marker);
      // Groupe ajouté au calque.
      root.add(group);
      // Gardé avec la normale de son centre.
      drawn.push({ group, normal: new THREE.Vector3(...centre).normalize() });
    // Fin des contributions.
    }
    // Vecteurs réutilisés à chaque image, pour ne rien allouer dans la boucle.
    const camLocal = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    // Image en cours.
    let frame = 0;
    // À chaque image : masque les emprises de la face cachée de la Terre.
    const tick = () => {
      // Moteur arrêté : la boucle s'arrête aussi.
      if (engine.stopped) return;
      // Le maillage de la Terre.
      const mesh = engine.earth.mesh;
      // Sa matrice à jour.
      mesh.updateWorldMatrix(true, false);
      // Position de la caméra dans le repère du maillage, ramenée au rayon unité.
      const local = mesh.worldToLocal(camLocal.copy(engine.cam.position)).divideScalar(radius);
      // Chaque emprise est visible si la caméra est du même côté que sa normale.
      for (const { group, normal } of drawn) group.visible = toCam.copy(local).sub(normal).dot(normal) > -1e-6;
      // Image suivante.
      frame = requestAnimationFrame(tick);
    // Fin de tick.
    };
    // Lance la boucle.
    frame = requestAnimationFrame(tick);
    // Au démontage : arrête la boucle, détache le calque et libère la mémoire du GPU.
    return () => {
      // Boucle arrêtée.
      cancelAnimationFrame(frame);
      // Calque détaché.
      engine.earth.mesh.remove(root);
      // Géométries et matériaux libérés.
      root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    // Fin du nettoyage.
    };
  // Dépend du moteur et de la liste.
  }, [engine, items]);
  // Rien à rendre dans la page.
  return null;
// Fin de ContributionLayer.
}
