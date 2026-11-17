/** LOD écran-space et admission progressive des systèmes extrasolaires. */
const finite = (value) => Number.isFinite(value) && value >= 0;
const TIER_RANK = Object.freeze({ STAR: 0, PLANETS: 1, DETAILED: 2 });

export class InterstellarLODManager {
  constructor({ maxPlanetSystems = 8, maxDetailedSystems = 2, enterDetailedPx = 150, exitDetailedPx = 115, enterPlanetsPx = 24, exitPlanetsPx = 17 } = {}) {
    for (const [name, value] of Object.entries({ maxPlanetSystems, maxDetailedSystems })) {
      if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} doit être un entier positif.`);
    }
    if (maxDetailedSystems > maxPlanetSystems) throw new RangeError('maxDetailedSystems ne peut pas dépasser maxPlanetSystems.');
    if (![enterDetailedPx, exitDetailedPx, enterPlanetsPx, exitPlanetsPx].every(finite)
      || exitDetailedPx >= enterDetailedPx || exitPlanetsPx >= enterPlanetsPx) throw new RangeError('Seuils LOD invalides.');
    this.maxPlanetSystems = maxPlanetSystems;
    this.maxDetailedSystems = maxDetailedSystems;
    this.thresholds = { enterDetailedPx, exitDetailedPx, enterPlanetsPx, exitPlanetsPx };
    this.previous = new Map();
  }

  evaluate(systems, { cameraPosition, viewportHeight, fovDeg = 50, focusedId = null } = {}) {
    if (!Array.isArray(systems)) throw new TypeError('systems doit être un tableau.');
    if (!cameraPosition || ![cameraPosition.x, cameraPosition.y, cameraPosition.z].every(Number.isFinite)) throw new TypeError('cameraPosition invalide.');
    if (!finite(viewportHeight) || viewportHeight <= 0 || !Number.isFinite(fovDeg) || fovDeg <= 0 || fovDeg >= 180) throw new RangeError('Viewport ou champ de vue invalide.');
    const focalPixels = viewportHeight / (2 * Math.tan(fovDeg * Math.PI / 360));
    const candidates = systems.map((entry) => {
      const position = entry?.group?.position;
      if (!entry?.coreId || !position || ![position.x, position.y, position.z].every(Number.isFinite)) throw new TypeError('Entrée système interstellaire invalide.');
      const distance = Math.max(1e-9, Math.hypot(position.x - cameraPosition.x, position.y - cameraPosition.y, position.z - cameraPosition.z));
      const extent = Math.max(1, Number(entry.model?.localScene?.planets?.reduce((max, planet) => Math.max(max, Number(planet.orbit?.semiMajorAxisAu) || 0), 0) || 0) * Number(entry.model?.localScene?.units?.auToSceneUnits || 1));
      const projectedDiameterPx = (2 * extent * focalPixels) / distance;
      const previous = this.previous.get(entry.coreId) || 'STAR';
      let desired = projectedDiameterPx >= (previous === 'DETAILED' ? this.thresholds.exitDetailedPx : this.thresholds.enterDetailedPx)
        ? 'DETAILED'
        : projectedDiameterPx >= (previous === 'PLANETS' || previous === 'DETAILED' ? this.thresholds.exitPlanetsPx : this.thresholds.enterPlanetsPx) ? 'PLANETS' : 'STAR';
      return { id: entry.coreId, entry, distance, projectedDiameterPx, desired, focused: entry.coreId === focusedId };
    });
    const visibleCandidates = candidates.filter((item) => item.entry.group.visible !== false);
    const detailed = visibleCandidates.filter((item) => item.desired === 'DETAILED').sort((a, b) => Number(b.focused) - Number(a.focused) || b.projectedDiameterPx - a.projectedDiameterPx);
    const planetTier = visibleCandidates.filter((item) => item.desired !== 'STAR').sort((a, b) => Number(b.focused) - Number(a.focused) || b.projectedDiameterPx - a.projectedDiameterPx);
    const detailedIds = new Set(detailed.slice(0, this.maxDetailedSystems).map((item) => item.id));
    const planetIds = new Set(planetTier.slice(0, this.maxPlanetSystems).map((item) => item.id));
    const decisions = candidates.map((item) => {
      const tier = detailedIds.has(item.id) ? 'DETAILED' : planetIds.has(item.id) ? 'PLANETS' : 'STAR';
      this.previous.set(item.id, tier);
      return { id: item.id, tier, desired: item.desired, distance: item.distance, projectedDiameterPx: item.projectedDiameterPx, focused: item.focused };
    });
    const activeIds = new Set(candidates.map((item) => item.id));
    for (const id of this.previous.keys()) if (!activeIds.has(id)) this.previous.delete(id);
    return { decisions, byId: new Map(decisions.map((item) => [item.id, item.tier])), stats: {
      systems: decisions.length,
      detailed: decisions.filter((item) => item.tier === 'DETAILED').length,
      planets: decisions.filter((item) => item.tier === 'PLANETS').length,
      starsOnly: decisions.filter((item) => item.tier === 'STAR').length,
    } };
  }

  forget(id) { return this.previous.delete(id); }
  clear() { this.previous.clear(); }
}

export function createInterstellarLODManager(options) { return new InterstellarLODManager(options); }
