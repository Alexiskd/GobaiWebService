import * as THREE from 'three';
import { enuToScene } from '@/contributions/geodesy';

// Géométrie 3D d'une contribution : position et orientation sur la Terre, niveaux de détail des nuages
// de points, arêtes de chaque bloc teintées selon la fiabilité.
export function buildContributionGroup(entry, pointSize) {
  const lodPointGroups = [];
  const anchor = entry.manifest.anchor;
  const origin = enuToScene({ east: 0, north: 0, up: 0 }, anchor);
  const latitude = anchor.latitude * Math.PI / 180;
  const longitude = anchor.longitude * Math.PI / 180;
  const east = new THREE.Vector3(-Math.sin(longitude), 0, -Math.cos(longitude));
  const north = new THREE.Vector3(-Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude));
  const up = new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), -Math.cos(latitude) * Math.sin(longitude));
  const matrix = new THREE.Matrix4().makeBasis(east, north, up);
  const contribution = new THREE.Group();
  contribution.position.set(origin.x, origin.y, origin.z);
  contribution.quaternion.setFromRotationMatrix(matrix);
  const sourceDimensions = entry.manifest.sourceDimensionsMeters || entry.manifest.dimensionsMeters;
  contribution.scale.set(
    entry.manifest.dimensionsMeters[0] / sourceDimensions[0] / 6_371_000,
    entry.manifest.dimensionsMeters[1] / sourceDimensions[1] / 6_371_000,
    entry.manifest.dimensionsMeters[2] / sourceDimensions[2] / 6_371_000,
  );
  const tint = entry.reliability.status === 'validated' ? 0x49df8a
    : entry.reliability.status === 'contested' ? 0xff5b69 : 0xffc857;
  for (const chunk of entry.chunks) {
    if (!chunk) continue; // bloc manquant dans le stockage local
    const chunkGroup = new THREE.Group();
    contribution.add(chunkGroup);
    const lodPoints = [];
    chunk.levels.forEach((level, index) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(level.positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(level.colors, 4, true));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }));
      points.visible = index === 0;
      lodPoints.push(points);
      chunkGroup.add(points);
    });
    lodPointGroups.push(lodPoints);
    const box = new THREE.BoxGeometry(
      Math.max(chunk.bounds.maxX - chunk.bounds.minX, 0.001),
      Math.max(chunk.bounds.maxY - chunk.bounds.minY, 0.001),
      Math.max(chunk.bounds.maxZ - chunk.bounds.minZ, 0.001),
    );
    const edgeGeometry = new THREE.EdgesGeometry(box);
    box.dispose(); // la boîte ne sert qu'à calculer les arêtes : elle fuyait en mémoire GPU
    const edgeMaterial = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(tint) } },
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 0.95); }',
      transparent: true,
      depthWrite: false,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.set(
      (chunk.bounds.minX + chunk.bounds.maxX) / 2,
      (chunk.bounds.minY + chunk.bounds.maxY) / 2,
      (chunk.bounds.minZ + chunk.bounds.maxZ) / 2,
    );
    chunkGroup.add(edges);
  }
  return { contribution, lodPointGroups };
}

// Libère géométries et matériaux GPU d'un arbre de contributions.
export function disposeContributionTree(root) {
  root.traverse((object) => {
    if (object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    }
  });
}
