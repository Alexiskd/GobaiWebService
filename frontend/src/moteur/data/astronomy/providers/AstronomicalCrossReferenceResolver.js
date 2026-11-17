const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const normalizeText = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');

/** Distance angulaire sur la sphère céleste, en secondes d'arc (coordonnées ICRS en degrés). */
export function angularSeparationArcsec(a, b) {
  const ra1 = finite(a?.raDeg); const dec1 = finite(a?.decDeg);
  const ra2 = finite(b?.raDeg); const dec2 = finite(b?.decDeg);
  if ([ra1, dec1, ra2, dec2].some((v) => v === null) || Math.abs(dec1) > 90 || Math.abs(dec2) > 90) return null;
  const toRad = Math.PI / 180;
  const dRa = (ra2 - ra1) * toRad;
  const dDec = (dec2 - dec1) * toRad;
  const hav = Math.sin(dDec / 2) ** 2 + Math.cos(dec1 * toRad) * Math.cos(dec2 * toRad) * Math.sin(dRa / 2) ** 2;
  const angle = 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, hav))));
  return angle * (180 / Math.PI) * 3600;
}

function gaiaIdentifier(record) {
  const explicit = record?.source === 'ESA Gaia DR3' ? record.sourceId : null;
  if (explicit !== null && explicit !== undefined) return String(explicit);
  const identifier = record?.identifiers?.find((item) => /gaia\s*dr3/i.test(item.catalog || ''));
  return identifier?.value === undefined ? null : String(identifier.value);
}

function sourceKey(record, index) {
  return record?.id || `${record?.source || 'unknown'}:${record?.name || record?.sourceId || index}`;
}

/**
 * Construit un graphe de références sans fusionner silencieusement des objets.
 * Seul un identifiant Gaia DR3 identique crée un lien vérifié. Les proximités
 * angulaires restent des candidats à examiner (époques/incertitudes à contrôler).
 */
export function resolveAstronomicalCrossReferences(records = [], { coordinateToleranceArcsec = 1, maxCoordinateCandidates = 5 } = {}) {
  if (!Array.isArray(records)) throw new TypeError('records doit être un tableau.');
  const tolerance = Number(coordinateToleranceArcsec);
  if (!Number.isFinite(tolerance) || tolerance <= 0 || tolerance > 60) throw new TypeError('coordinateToleranceArcsec doit être compris entre 0 et 60.');
  const limit = Math.max(1, Math.min(20, Math.floor(Number(maxCoordinateCandidates) || 5)));
  const valid = records.filter((record) => record && typeof record === 'object');
  const stars = valid.filter((record) => record.kind === 'star' || (record.kind === 'astronomical-object' && record.coordinates));
  const planets = valid.filter((record) => record.kind === 'exoplanet');
  const entities = [];
  const links = [];
  const assigned = new Set();

  // Gaia DR3 est l'ancre d'identité uniquement lorsque son source_id est explicite.
  const byGaiaId = new Map();
  for (const [index, record] of stars.entries()) {
    const gaiaId = gaiaIdentifier(record);
    if (!gaiaId) continue;
    if (!byGaiaId.has(gaiaId)) byGaiaId.set(gaiaId, []);
    byGaiaId.get(gaiaId).push({ record, index });
  }
  for (const [gaiaId, members] of byGaiaId) {
    const keys = members.map(({ record, index }) => sourceKey(record, index));
    entities.push({ id: `star:gaia-dr3:${gaiaId}`, kind: 'star', canonicalIdentifier: { catalog: 'Gaia DR3', value: gaiaId }, sourceRecords: keys });
    members.forEach(({ record, index }) => assigned.add(record));
    for (let i = 1; i < keys.length; i += 1) links.push({ from: keys[0], to: keys[i], relation: 'same-gaia-dr3-source', confidence: 'verified-identifier', automatic: true, evidence: { catalog: 'Gaia DR3', value: gaiaId } });
  }

  // Les autres catalogues sont comparés aux ancres Gaia. La proximité n'est jamais une fusion automatique.
  const gaiaAnchors = [...byGaiaId.entries()].map(([gaiaId, members]) => ({ gaiaId, record: members[0].record, key: sourceKey(members[0].record, members[0].index) }));
  for (const [index, record] of stars.entries()) {
    if (assigned.has(record)) continue;
    const key = sourceKey(record, index);
    const matches = gaiaAnchors.map((anchor) => ({ anchor, separationArcsec: angularSeparationArcsec(record.coordinates, anchor.record.coordinates) }))
      .filter((candidate) => candidate.separationArcsec !== null && candidate.separationArcsec <= tolerance)
      .sort((a, b) => a.separationArcsec - b.separationArcsec)
      .slice(0, limit);
    entities.push({ id: `star:unresolved:${encodeURIComponent(key)}`, kind: 'star', canonicalIdentifier: null, sourceRecords: [key] });
    for (const match of matches) links.push({ from: key, to: match.anchor.key, relation: 'coordinate-proximity-candidate', confidence: 'candidate-review-required', automatic: false, evidence: { separationArcsec: match.separationArcsec, toleranceArcsec: tolerance, gaiaDr3Id: match.anchor.gaiaId, coordinateFrame: 'ICRS' } });
  }

  const starByGaiaId = new Map(gaiaAnchors.map((anchor) => [anchor.gaiaId, anchor]));
  const planetHostLinks = planets.map((planet, index) => {
    const planetKey = sourceKey(planet, index);
    const gaiaId = planet.host?.gaiaDr3Id ? String(planet.host.gaiaDr3Id) : null;
    if (gaiaId && starByGaiaId.has(gaiaId)) {
      const anchor = starByGaiaId.get(gaiaId);
      links.push({ from: planetKey, to: anchor.key, relation: 'orbits-star', confidence: 'verified-identifier', automatic: true, evidence: { catalog: 'Gaia DR3', value: gaiaId, source: 'NASA Exoplanet Archive' } });
      return { planet: planetKey, host: anchor.key, status: 'linked-by-gaia-id' };
    }
    const hostName = normalizeText(planet.host?.name);
    const named = stars.filter((star) => normalizeText(star.name) === hostName && hostName);
    if (named.length === 1) {
      const host = sourceKey(named[0], stars.indexOf(named[0]));
      links.push({ from: planetKey, to: host, relation: 'possible-host-name-match', confidence: 'candidate-review-required', automatic: false, evidence: { hostName: planet.host?.name } });
      return { planet: planetKey, host, status: 'candidate-host-name' };
    }
    return { planet: planetKey, host: null, status: 'unresolved-host' };
  });

  return {
    schemaVersion: 1,
    policy: { automaticMerge: 'exact Gaia DR3 identifier only', coordinateMatchesRequireReview: true, coordinateToleranceArcsec: tolerance },
    entities,
    links,
    planetHostLinks,
    statistics: { inputRecords: valid.length, starRecords: stars.length, exoplanetRecords: planets.length, entities: entities.length, verifiedLinks: links.filter((link) => link.automatic).length, reviewCandidates: links.filter((link) => !link.automatic).length, unresolvedPlanetHosts: planetHostLinks.filter((item) => item.status === 'unresolved-host').length },
  };
}
