import { useEffect } from 'react';
import * as THREE from 'three';
import { buildContributionGroup, disposeContributionTree } from './contributionGeometry';

// Couche 3D des contributions, posée sur la Terre ; le niveau de détail suit l'altitude de la caméra.
export function ContributionLayer({ engine, entries }) {
  // Taille des points adaptée à la densité de pixels de l'écran (Retina, mobiles).
  const pointSize = typeof window === 'undefined' ? 2.5 : 2.5 * Math.min(window.devicePixelRatio || 1, 2);

  useEffect(() => {
    if (!engine?.earth?.group) return undefined;
    const root = new THREE.Group();
    root.name = 'anonymous-contributions';
    engine.earth.group.add(root);
    const lodPointGroups = [];
    for (const entry of entries) {
      const { contribution, lodPointGroups: entryLodPointGroups } = buildContributionGroup(entry, pointSize);
      root.add(contribution);
      lodPointGroups.push(...entryLodPointGroups);
    }
    let frame = 0;
    let activeLod = -1;
    const updateLod = () => {
      if (engine.stopped) return;
      const altitude = Math.max(0, engine.cam.position.distanceTo(engine.earth.group.position) - 1);
      const selected = altitude > 0.12 ? 2 : altitude > 0.025 ? 1 : 0;
      if (selected !== activeLod) {
        activeLod = selected;
        for (const lodPoints of lodPointGroups) {
          // Si un bloc a moins de niveaux, on garde le plus grossier disponible.
          const level = Math.min(selected, lodPoints.length - 1);
          lodPoints.forEach((points, index) => { points.visible = index === level; });
        }
      }
      frame = requestAnimationFrame(updateLod);
    };
    frame = requestAnimationFrame(updateLod);
    return () => {
      cancelAnimationFrame(frame);
      engine.earth.group.remove(root);
      disposeContributionTree(root);
    };
  }, [engine, entries, pointSize]);
  return null;
}
