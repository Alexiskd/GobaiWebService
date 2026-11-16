import { calculateExoplanetPosition } from '../../data/astronomy/orbits/ExoplanetOrbitalEngine.js';

const finite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const rad = Math.PI / 180;

/** Convertit le repère cartésien orbital (x,y,z) vers le repère Three.js du projet (x,z,-y).
 * Ce changement d'axes ne transforme PAS le repère orbital en ICRS.
 */
export function orbitalReferenceToScene(position = {}) {
  return { x: Number(position.x) || 0, y: Number(position.z) || 0, z: -(Number(position.y) || 0) };
}

function orbitParameters(planet) {
  const orbit = planet?.orbit || {};
  const state = planet?.orbitalState?.position;
  const orbital = state?.orbitalState || {};
  return {
    periodDays: orbit.periodDays ?? orbital.periodDays,
    semiMajorAxisAu: orbit.semiMajorAxisAu ?? orbital.semiMajorAxisAu,
    eccentricity: orbit.eccentricity ?? orbital.eccentricity,
    inclinationDeg: orbit.inclinationDeg ?? orbital.inclinationDeg ?? 0,
    longitudeAscendingNodeDeg: orbit.longitudeAscendingNodeDeg ?? orbital.longitudeAscendingNodeDeg ?? 0,
    argumentOfPeriastronDeg: orbit.argumentOfPeriastronDeg ?? orbital.argumentOfPeriastronDeg ?? 0,
    meanAnomalyAtEpochDeg: orbit.meanAnomalyAtEpochDeg,
    epochJulianDate: orbit.epochJulianDate,
    periastronEpochJulianDate: orbit.periastronEpochJulianDate,
  };
}

/** Retourne un modèle d'affichage sans dépendance Three.js, utilisable aussi pour l'UI et les tests. */
export function buildExoplanetSceneModel(starSystem, options = {}) {
  if (!starSystem || starSystem.kind !== 'star-system' || !starSystem.star) {
    throw new TypeError('Un système stellaire normalisé est requis.');
  }
  const auToSceneUnits = finite(options.auToSceneUnits) && Number(options.auToSceneUnits) > 0 ? Number(options.auToSceneUnits) : 100;
  const orbitSegments = Number.isInteger(options.orbitSegments) && options.orbitSegments >= 32 ? Math.min(options.orbitSegments, 4096) : 256;
  const targetJulianDate = finite(options.targetJulianDate) ? Number(options.targetJulianDate) : starSystem.targetJulianDate;
  const planets = (starSystem.planets || []).map((planet) => {
    const state = planet.orbitalState?.position;
    const position = state?.position ? orbitalReferenceToScene(state.position) : null;
    const params = orbitParameters(planet);
    const orbitValid = finite(params.semiMajorAxisAu) && Number(params.semiMajorAxisAu) > 0
      && finite(params.eccentricity) && Number(params.eccentricity) >= 0 && Number(params.eccentricity) < 1;
    let currentPosition = position;
    let calculationWarning = null;
    // Recalculer depuis les éléments et leur époque de référence à chaque date demandée.
    // La position précalculée reste le fallback si phase/époque ne sont pas disponibles.
    if (finite(targetJulianDate) && orbitValid && finite(params.periodDays)
      && (finite(params.periastronEpochJulianDate) || (finite(params.meanAnomalyAtEpochDeg) && finite(params.epochJulianDate)))) {
      try {
        const computed = calculateExoplanetPosition(params, Number(targetJulianDate));
        currentPosition = orbitalReferenceToScene(computed.position);
      } catch (error) { calculationWarning = error.message; }
    }
    return {
      id: planet.id,
      name: planet.name || planet.id,
      position: currentPosition ? {
        x: currentPosition.x * auToSceneUnits,
        y: currentPosition.y * auToSceneUnits,
        z: currentPosition.z * auToSceneUnits,
      } : null,
      positionStatus: currentPosition ? 'available' : 'unavailable',
      orbit: orbitValid ? {
        ...params,
        semiMajorAxisAu: Number(params.semiMajorAxisAu),
        eccentricity: Number(params.eccentricity),
        inclinationDeg: Number(params.inclinationDeg) || 0,
        longitudeAscendingNodeDeg: Number(params.longitudeAscendingNodeDeg) || 0,
        argumentOfPeriastronDeg: Number(params.argumentOfPeriastronDeg) || 0,
        segments: orbitSegments,
        points: sampleOrbit(params, orbitSegments, auToSceneUnits),
      } : null,
      physical: planet.physical || null,
      warnings: [...(planet.orbitalState?.warnings || []), ...(calculationWarning ? [calculationWarning] : [])],
    };
  });
  return {
    schemaVersion: 1,
    kind: 'exoplanet-scene-model',
    sourceSystemId: starSystem.id,
    star: { id: starSystem.star.id, name: starSystem.star.name, identityStatus: starSystem.identityStatus },
    frame: 'ORBITAL-REFERENCE mapped to Gobai scene axes (x,z,-y); not ICRS',
    units: { sourcePosition: 'AU', scenePosition: 'scene units', auToSceneUnits },
    targetJulianDate: finite(targetJulianDate) ? Number(targetJulianDate) : null,
    planets,
    statistics: {
      planetCount: planets.length,
      positionedPlanets: planets.filter((planet) => planet.positionStatus === 'available').length,
      drawableOrbits: planets.filter((planet) => planet.orbit?.points).length,
      unavailablePositions: planets.filter((planet) => planet.positionStatus !== 'available').length,
    },
  };
}

/** Echantillonne l'ellipse képlérienne dans le repère orbital de référence, puis la projette vers les axes scène. */
export function sampleOrbit(orbit, segments = 256, scale = 1) {
  if (!Number.isInteger(segments) || segments < 3) throw new RangeError('segments doit être un entier >= 3.');
  const a = Number(orbit.semiMajorAxisAu); const e = Number(orbit.eccentricity);
  if (!(a > 0) || !(e >= 0 && e < 1)) throw new RangeError('Paramètres d’ellipse invalides.');
  const i = (Number(orbit.inclinationDeg) || 0) * rad;
  const O = (Number(orbit.longitudeAscendingNodeDeg) || 0) * rad;
  const w = (Number(orbit.argumentOfPeriastronDeg) || 0) * rad;
  const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i), cw = Math.cos(w), sw = Math.sin(w);
  const points = new Float32Array((segments + 1) * 3);
  for (let index = 0; index <= segments; index += 1) {
    const E = index / segments * Math.PI * 2;
    const x = a * (Math.cos(E) - e); const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const xr = (cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y;
    const yr = (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y;
    const zr = sw * si * x + cw * si * y;
    const offset = index * 3;
    points[offset] = xr * scale;
    points[offset + 1] = zr * scale;
    points[offset + 2] = -yr * scale;
  }
  return points;
}

/** Construit un groupe Three.js. THREE est injecté pour conserver un module testable sans WebGL. */
export function createExoplanetSystemGroup(THREE, sceneModel, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.SphereGeometry || !THREE?.MeshBasicMaterial || !THREE?.BufferGeometry || !THREE?.Line) {
    throw new TypeError('THREE doit fournir Group, Mesh, SphereGeometry, MeshBasicMaterial, BufferGeometry et Line.');
  }
  const root = new THREE.Group();
  root.name = `exoplanet-system:${sceneModel.sourceSystemId}`;
  root.userData = { ...(root.userData || {}), gobaiKind: 'exoplanet-system', sourceSystemId: sceneModel.sourceSystemId, frame: sceneModel.frame };
  const starRadius = finite(options.starVisualRadius) ? Math.max(0.01, Number(options.starVisualRadius)) : 2.5;
  const star = new THREE.Mesh(new THREE.SphereGeometry(starRadius, 24, 16), new THREE.MeshBasicMaterial({ color: options.starColor ?? 0xffd27a }));
  star.name = sceneModel.star.name || 'Host star';
  star.userData = { gobaiKind: 'host-star', astronomicalId: sceneModel.star.id };
  root.add(star);
  const planetObjects = new Map();
  sceneModel.planets.forEach((planet) => {
    if (planet.orbit?.points) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(planet.orbit.points, 3));
      const material = new THREE.LineBasicMaterial({ color: options.orbitColor ?? 0x6688aa, transparent: true, opacity: 0.65 });
      const line = new THREE.Line(geometry, material);
      line.name = `${planet.name} orbit`;
      line.userData = { gobaiKind: 'exoplanet-orbit', astronomicalId: planet.id };
      root.add(line);
    }
    const radiusEarth = Number(planet.physical?.radiusEarth);
    const radius = finite(radiusEarth) && radiusEarth > 0
      ? Math.max(options.minPlanetVisualRadius ?? 0.12, Math.min(options.maxPlanetVisualRadius ?? 0.65, radiusEarth * (options.earthRadiusVisualScale ?? 0.18)))
      : (options.defaultPlanetVisualRadius ?? 0.2);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color: options.planetColor ?? 0x8fb7d8 }));
    mesh.name = planet.name;
    mesh.userData = { gobaiKind: 'exoplanet', astronomicalId: planet.id, physicalRadiusEarth: finite(radiusEarth) ? radiusEarth : null, positionAvailable: Boolean(planet.position) };
    if (planet.position) mesh.position.set(planet.position.x, planet.position.y, planet.position.z);
    mesh.visible = Boolean(planet.position);
    root.add(mesh); planetObjects.set(planet.id, mesh);
  });
  root.userData.dispose = () => {
    root.traverse?.((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
      else object.material?.dispose?.();
    });
  };
  root.userData.updateFromModel = (nextModel) => {
    if (nextModel.sourceSystemId !== sceneModel.sourceSystemId) throw new Error('Le système source ne correspond pas au groupe Three.js.');
    nextModel.planets.forEach((planet) => {
      const mesh = planetObjects.get(planet.id);
      if (!mesh) return;
      mesh.userData.positionAvailable = Boolean(planet.position);
      mesh.visible = Boolean(planet.position);
      if (planet.position) mesh.position.set(planet.position.x, planet.position.y, planet.position.z);
    });
  };
  return root;
}
