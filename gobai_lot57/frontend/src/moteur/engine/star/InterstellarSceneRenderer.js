import { buildExoplanetSceneModel, createExoplanetSystemGroup } from '../exoplanets/ExoplanetSceneEngine.js';
import { propagateAstrometricCoordinates } from '../../data/astronomy/astrometry/AstrometricEngine.js';

const finite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const DEG = Math.PI / 180;

function resolveDistancePc(star) {
  const direct = star?.propagation?.distancePc ?? star?.coordinates?.distancePc;
  if (finite(direct) && Number(direct) > 0) return Number(direct);
  const parallax = star?.astrometry?.parallaxMas;
  if (finite(parallax) && Number(parallax) > 0) return 1000 / Number(parallax);
  return null;
}

/** ICRS direction and distance -> heliocentric cartesian parsecs. */
export function icrsToHeliocentricParsecs({ raDeg, decDeg, distancePc } = {}) {
  if (![raDeg, decDeg, distancePc].every(finite)) throw new TypeError('raDeg, decDeg et distancePc sont requis.');
  const ra = Number(raDeg) * DEG;
  const dec = Number(decDeg) * DEG;
  const distance = Number(distancePc);
  if (Number(raDeg) < 0 || Number(raDeg) > 360 || Number(decDeg) < -90 || Number(decDeg) > 90 || distance <= 0) {
    throw new RangeError('Coordonnées ICRS ou distance hors limites.');
  }
  const cosDec = Math.cos(dec);
  return {
    x: distance * cosDec * Math.cos(ra),
    y: distance * cosDec * Math.sin(ra),
    z: distance * Math.sin(dec),
  };
}

/** Convertit un vecteur ICRS vers les axes Three.js Gobai (x,z,-y), avec échelle et origine configurables. */
export function icrsParsecsToScene(position, { parsecToSceneUnits = 100, origin = { x: 0, y: 0, z: 0 } } = {}) {
  if (!position || ![position.x, position.y, position.z, parsecToSceneUnits, origin?.x, origin?.y, origin?.z].every(finite)
    || Number(parsecToSceneUnits) <= 0) throw new TypeError('Vecteur, origine et échelle de scène invalides.');
  const scale = Number(parsecToSceneUnits);
  return {
    x: Number(origin.x) + Number(position.x) * scale,
    y: Number(origin.y) + Number(position.z) * scale,
    z: Number(origin.z) - Number(position.y) * scale,
  };
}

/** Construit le descripteur global d'un système à partir d'une astrométrie avec distance exploitable. */
export function buildInterstellarSystemModel(starSystem, options = {}) {
  if (!starSystem || starSystem.kind !== 'star-system' || !starSystem.star) throw new TypeError('Un star-system normalisé est requis.');
  const sourceCoordinates = starSystem.star.coordinates || {};
  let astrometricState = null;
  let effectiveStar = starSystem.star;
  if (finite(options.targetEpoch) && finite(sourceCoordinates.epoch)
    && finite(starSystem.star.astrometry?.parallaxMas) && Number(starSystem.star.astrometry.parallaxMas) > 0) {
    astrometricState = propagateAstrometricCoordinates(starSystem.star, Number(options.targetEpoch));
    effectiveStar = {
      ...starSystem.star,
      coordinates: { ...sourceCoordinates, raDeg: astrometricState.raDeg, decDeg: astrometricState.decDeg, epoch: astrometricState.epoch, frame: astrometricState.frame },
      propagation: { ...astrometricState, warnings: astrometricState.warnings },
    };
  }
  const effectiveSystem = { ...starSystem, star: effectiveStar };
  const coordinates = effectiveStar.coordinates || {};
  const distancePc = resolveDistancePc(effectiveStar);
  if (!finite(coordinates.raDeg) || !finite(coordinates.decDeg) || !finite(distancePc)) {
    return {
      schemaVersion: 1, kind: 'interstellar-system-model', sourceSystemId: starSystem.id,
      name: starSystem.star.name || starSystem.id, frame: 'ICRS', positionStatus: 'unavailable',
      position: null, distancePc: null, warnings: ['Position globale impossible : coordonnées ICRS ou parallaxe positive manquantes.'],
      localScene: buildExoplanetSceneModel(effectiveSystem, options),
    };
  }
  const heliocentricParsecs = icrsToHeliocentricParsecs({ ...coordinates, distancePc });
  const position = icrsParsecsToScene(heliocentricParsecs, options);
  return {
    schemaVersion: 1, kind: 'interstellar-system-model', sourceSystemId: starSystem.id,
    name: starSystem.star.name || starSystem.id, frame: 'ICRS heliocentric, mapped to Gobai scene axes',
    positionStatus: 'available', position, heliocentricParsecs, distancePc,
    distanceLightYears: distancePc * 3.261563777,
    localScene: buildExoplanetSceneModel(effectiveSystem, options),
    representation: starSystem.representation || null,
    starVisualColor: effectiveStar.visualColor ?? 0xffd27a,
    astrometricState,
    targetEpoch: astrometricState?.epoch ?? coordinates.epoch ?? null,
    warnings: [...(effectiveStar.propagation?.warnings || [])],
  };
}

/** Crée un groupe Three.js global ; le sous-groupe planétaire conserve son repère orbital local. */
export function createInterstellarSystemGroup(THREE, model, options = {}) {
  if (!THREE?.Group || !THREE?.Vector3) throw new TypeError('THREE.Group et THREE.Vector3 sont requis.');
  const root = new THREE.Group();
  root.name = `interstellar-system:${model.sourceSystemId}`;
  root.userData = { ...(root.userData || {}), gobaiKind: 'interstellar-system', sourceSystemId: model.sourceSystemId, frame: model.frame, positionStatus: model.positionStatus };
  if (model.positionStatus !== 'available') {
    root.visible = false;
    root.userData.warnings = model.warnings;
    return root;
  }
  root.position.set(model.position.x, model.position.y, model.position.z);
  // Marqueur stellaire global indépendant du détail du système planétaire.
  // Sa taille sera ajustée en pixels écran pour rester repérable au dézoom.
  const markerGeometry = new THREE.SphereGeometry(1, 16, 12);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: model.starVisualColor ?? 0xffd27a, depthWrite: false });
  const globalMarker = new THREE.Mesh(markerGeometry, markerMaterial);
  globalMarker.name = `${model.name} — marqueur global`;
  globalMarker.visible = true;
  globalMarker.userData = { gobaiKind: 'interstellar-star-marker', sourceSystemId: model.sourceSystemId };
  globalMarker.renderOrder = 20;
  root.add(globalMarker);
  let localGroup = createExoplanetSystemGroup(THREE, model.localScene, options);
  localGroup.name = `local-planetary-system:${model.sourceSystemId}`;
  root.add(localGroup);
  root.userData.distancePc = model.distancePc;
  root.userData.distanceLightYears = model.distanceLightYears;
  root.userData.localGroup = localGroup;
  root.userData.globalMarker = globalMarker;
  root.userData.representation = model.representation;
  root.userData.loaded = true;
  root.userData.releaseResources = () => {
    if (!localGroup) return false;
    root.remove(localGroup);
    localGroup.userData.dispose?.();
    localGroup = null;
    root.userData.localGroup = null;
    root.userData.loaded = false;
    return true;
  };
  root.userData.restoreResources = () => {
    if (localGroup) return false;
    localGroup = createExoplanetSystemGroup(THREE, model.localScene, options);
    localGroup.name = `local-planetary-system:${model.sourceSystemId}`;
    root.add(localGroup);
    root.userData.localGroup = localGroup;
    root.userData.loaded = true;
    return true;
  };
  root.userData.updateLocalScene = (nextStarSystem, nextOptions = {}) => {
    const nextModel = buildExoplanetSceneModel(nextStarSystem, { ...options, ...nextOptions });
    if (localGroup) localGroup.userData.updateFromModel(nextModel);
    return nextModel;
  };
  root.userData.dispose = () => {
    root.userData.releaseResources();
    markerGeometry.dispose?.();
    markerMaterial.dispose?.();
  };
  return root;
}

/** Registre de systèmes distants et navigation caméra sans dépendance à la scène principale. */
export class InterstellarSceneRenderer {
  constructor({ THREE, scene, camera, controls, origin, parsecToSceneUnits = 100, focusDistance = 30 } = {}) {
    if (!THREE || !scene?.add) throw new TypeError('THREE et scene.add() sont requis.');
    this.THREE = THREE; this.scene = scene; this.camera = camera || null; this.controls = controls || null;
    this.transform = { origin: origin || { x: 0, y: 0, z: 0 }, parsecToSceneUnits };
    this.focusDistance = Number.isFinite(focusDistance) && focusDistance > 0 ? focusDistance : 30;
    this.systems = new Map();
  }
  addSystem(starSystem, options = {}) {
    const model = buildInterstellarSystemModel(starSystem, { ...this.transform, ...options });
    const existing = this.systems.get(model.sourceSystemId);
    if (existing) { this.scene.remove(existing.group); existing.group.userData.dispose?.(); }
    const group = createInterstellarSystemGroup(this.THREE, model, options);
    this.scene.add(group);
    const entry = { model, group, starSystem };
    this.systems.set(model.sourceSystemId, entry);
    return entry;
  }
  updateSystemEpoch(id, targetEpoch, options = {}) {
    const entry = this.systems.get(id);
    if (!entry || !finite(targetEpoch)) return { ok: false, reason: 'system-or-epoch-invalid', id };
    const nextOptions = { ...this.transform, ...options, targetEpoch: Number(targetEpoch) };
    const nextModel = buildInterstellarSystemModel(entry.starSystem, nextOptions);
    entry.model = nextModel;
    entry.options = nextOptions;
    entry.group.userData.positionStatus = nextModel.positionStatus;
    entry.group.userData.targetEpoch = nextModel.targetEpoch;
    entry.group.userData.astrometricState = nextModel.astrometricState;
    if (nextModel.positionStatus === 'available') {
      entry.group.position.set(nextModel.position.x, nextModel.position.y, nextModel.position.z);
      entry.group.visible = true;
      return { ok: true, id, targetEpoch: nextModel.targetEpoch, position: nextModel.position, distancePc: nextModel.distancePc };
    }
    entry.group.visible = false;
    return { ok: false, reason: 'position-unavailable', id, warnings: nextModel.warnings };
  }
  removeSystem(id) {
    const entry = this.systems.get(id); if (!entry) return false;
    this.scene.remove(entry.group); entry.group.userData.dispose?.(); this.systems.delete(id); return true;
  }
  getSystem(id) { return this.systems.get(id) || null; }
  focusSystem(id, { distance = this.focusDistance } = {}) {
    const entry = this.systems.get(id);
    if (!entry || entry.model.positionStatus !== 'available') return { ok: false, reason: 'position-unavailable', id };
    // Le focus doit utiliser la position globale, pas la position locale
    // recentrée autour de l'origine flottante de la scène.
    const p = entry.model.position;
    const target = new this.THREE.Vector3(p.x, p.y, p.z);
    if (this.controls?.target?.copy) this.controls.target.copy(target);
    if (this.camera?.position?.copy) {
      const direction = this.camera.position.clone?.().sub(target);
      if (direction?.lengthSq?.() > 0) direction.normalize().multiplyScalar(distance);
      else direction?.set?.(0, 0, distance);
      if (direction) this.camera.position.copy(target.clone().add(direction));
    }
    this.controls?.update?.();
    return { ok: true, id, target: { x: p.x, y: p.y, z: p.z } };
  }
  setSystemVisible(id, visible) { const entry = this.systems.get(id); if (!entry) return false; entry.group.visible = Boolean(visible); return true; }
  setSystemLOD(id, tier) {
    const entry = this.systems.get(id);
    const normalized = String(tier || '').toUpperCase();
    if (!entry || !['STAR', 'PLANETS', 'DETAILED'].includes(normalized)) return false;
    entry.group.userData.lodTier = normalized;
    const marker = entry.group.userData.globalMarker;
    if (marker) marker.visible = normalized === 'STAR';
    const localGroup = entry.group.userData.localGroup;
    if (!localGroup) return true;
    localGroup.traverse?.((object) => {
      const kind = object.userData?.gobaiKind;
      if (kind === 'host-star') object.visible = normalized !== 'STAR';
      else if (kind === 'exoplanet') object.visible = normalized !== 'STAR' && Boolean(object.userData.positionAvailable ?? object.visible);
      else if (kind === 'exoplanet-orbit') object.visible = normalized === 'DETAILED';
    });
    return true;
  }
  /** Maintient les marqueurs stellaires à une taille lisible en pixels pendant le dézoom. */
  updateGlobalMarkers(camera, viewportHeight, { markerDiameterPx = 9 } = {}) {
    if (!camera?.position || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
    const fov = Number(camera.fov) || 50;
    const tangent = Math.tan(fov * Math.PI / 360);
    let updated = 0;
    for (const { group } of this.systems.values()) {
      const marker = group.userData?.globalMarker;
      if (!marker?.scale?.setScalar) continue;
      const distance = camera.position.distanceTo
        ? camera.position.distanceTo(group.position)
        : Math.hypot(camera.position.x - group.position.x, camera.position.y - group.position.y, camera.position.z - group.position.z);
      const radius = Math.max(1, distance * tangent * (markerDiameterPx / 2) / viewportHeight);
      marker.scale.setScalar(radius);
      updated += 1;
    }
    return updated;
  }

  setSystemLoaded(id, loaded) {
    const entry = this.systems.get(id);
    if (!entry || entry.model.positionStatus !== 'available') return false;
    const changed = loaded ? entry.group.userData.restoreResources?.() : entry.group.userData.releaseResources?.();
    entry.group.userData.loaded = Boolean(loaded);
    if (loaded) this.setSystemLOD(id, entry.group.userData.lodTier || 'DETAILED');
    return Boolean(changed);
  }
  dispose() { for (const id of [...this.systems.keys()]) this.removeSystem(id); }
}

export function createInterstellarSceneRenderer(options) { return new InterstellarSceneRenderer(options); }
