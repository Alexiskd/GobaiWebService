import { angularSeparationArcsec } from './AstronomicalCrossReferenceResolver.js';

const clean = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const hasValue = (value) => value !== null && value !== undefined && value !== '';
const scoreRecord = (record) => Object.values(record || {}).reduce((score, value) => score + (hasValue(value) ? 1 : 0), 0);
const gaiaCrossReference = (record) => {
  const identifier = record?.identifiers?.find((item) => /gaia\s*dr3/i.test(String(item?.catalog || '')))?.value;
  if (hasValue(identifier)) return String(identifier);
  return /gaia/i.test(String(record?.source || '')) && hasValue(record?.sourceId) ? String(record.sourceId) : null;
};

function catalogIdentity(record) {
  const source = clean(record?.source);
  const identifiers = Array.isArray(record?.identifiers) ? record.identifiers : [];
  const find = (pattern) => identifiers.find((item) => pattern.test(String(item?.catalog || '')))?.value;

  // Pour une exoplanète, l'identité du corps prime sur l'identifiant Gaia de son étoile hôte.
  if (record?.kind === 'exoplanet' && (source.includes('nasa') || identifiers.some((item) => /nasa exoplanet archive/i.test(item?.catalog || '')))) {
    const name = find(/nasa exoplanet archive/i) ?? record?.name ?? record?.id?.replace(/^nasa-exoplanet:/i, '');
    if (hasValue(name)) return { key: `nasa-exoplanet:${clean(name)}`, catalog: 'NASA Exoplanet Archive', value: String(name) };
  }
  // Un identifiant Gaia porté par une ligne SIMBAD est un lien vers l'étoile, pas l'identité du record SIMBAD.
  if (source.includes('simbad')) {
    const simbad = find(/simbad/i) ?? record?.name ?? record?.id?.replace(/^simbad:/i, '');
    if (hasValue(simbad)) return { key: `simbad:${clean(simbad)}`, catalog: 'SIMBAD', value: String(simbad) };
  }
  if (source.includes('gaia') || (record?.kind === 'star' && hasValue(find(/gaia\s*dr3/i)))) {
    const gaia = record?.sourceId ?? find(/gaia\s*dr3/i);
    if (hasValue(gaia)) return { key: `gaia-dr3:${String(gaia)}`, catalog: 'Gaia DR3', value: String(gaia) };
  }
  if (hasValue(record?.id) && hasValue(record?.source)) return { key: `${clean(record.source)}:${clean(record.id)}`, catalog: record.source, value: String(record.id) };
  return null;
}

function mergeGroup(group, identity) {
  const ranked = [...group].sort((a, b) => scoreRecord(b) - scoreRecord(a));
  const primary = ranked[0];
  const merged = { ...primary };
  for (const record of ranked.slice(1)) {
    for (const [key, value] of Object.entries(record)) {
      if (!hasValue(merged[key]) && hasValue(value)) merged[key] = value;
    }
  }
  merged.identifiers = [...new Map(ranked.flatMap((record) => record.identifiers || []).map((item) => [`${clean(item.catalog)}:${clean(item.value)}`, item])).values()];
  merged.catalogIdentity = identity;
  merged.duplicateRecordIds = ranked.map((record) => record.id).filter(Boolean);
  merged.duplicateCount = group.length - 1;
  merged.sourceRecords = ranked;
  return merged;
}

/**
 * Audite les identités du catalogue. Seuls les identifiants exacts d'un même catalogue
 * sont fusionnés. Les rapprochements par proximité angulaire restent des candidats.
 * « catalogued » signifie présent dans une source identifiée, pas preuve indépendante
 * de réalité physique ou de confirmation scientifique.
 */
export function auditAstronomicalCatalog(records = [], { coordinateToleranceArcsec = 1 } = {}) {
  if (!Array.isArray(records)) throw new TypeError('records doit être un tableau.');
  const tolerance = Number(coordinateToleranceArcsec);
  if (!Number.isFinite(tolerance) || tolerance <= 0 || tolerance > 60) throw new TypeError('coordinateToleranceArcsec doit être compris entre 0 et 60.');
  const valid = records.filter((record) => record && typeof record === 'object');
  const groups = new Map();
  const unkeyed = [];
  for (const record of valid) {
    const identity = catalogIdentity(record);
    if (!identity) { unkeyed.push(record); continue; }
    if (!groups.has(identity.key)) groups.set(identity.key, { identity, records: [] });
    groups.get(identity.key).records.push(record);
  }
  const canonicalRecords = [...[...groups.values()].map(({ identity, records: group }) => mergeGroup(group, identity)), ...unkeyed];
  const duplicateGroups = [...groups.values()].filter((group) => group.records.length > 1).map(({ identity, records: group }) => ({
    canonicalKey: identity.key, catalog: identity.catalog, identifier: identity.value,
    count: group.length, recordIds: group.map((record) => record.id).filter(Boolean),
    coordinateSpreadArcsec: maxCoordinateSpread(group),
  }));
  const identityConflicts = duplicateGroups.filter((group) => group.coordinateSpreadArcsec !== null && group.coordinateSpreadArcsec > tolerance);

  const stars = canonicalRecords.filter((record) => (record.kind === 'star' || record.kind === 'astronomical-object') && validCoordinates(record.coordinates));
  const duplicateCandidates = [];
  // Hachage spatial 3D sur sphère unitaire : O(n) attendu, au lieu d'une comparaison quadratique
  // qui bloquerait le navigateur sur les grands cônes Gaia.
  const angularToleranceRad = (tolerance / 3600) * Math.PI / 180;
  const cellSize = Math.max(1e-12, 2 * Math.sin(angularToleranceRad / 2));
  const buckets = new Map();
  const vectors = stars.map((record) => ({ record, vector: unitVector(record.coordinates) }));
  for (let i = 0; i < vectors.length; i += 1) {
    const { record: a, vector } = vectors[i];
    const cell = vector.map((value) => Math.floor(value / cellSize));
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dz = -1; dz <= 1; dz += 1) {
      const candidates = buckets.get(`${cell[0] + dx}:${cell[1] + dy}:${cell[2] + dz}`) || [];
      for (const j of candidates) {
        const b = vectors[j].record;
        if (a.catalogIdentity?.key && a.catalogIdentity.key === b.catalogIdentity?.key) continue;
        const gaiaA = gaiaCrossReference(a), gaiaB = gaiaCrossReference(b);
        if (gaiaA && gaiaB && gaiaA === gaiaB) continue;
        const separationArcsec = angularSeparationArcsec(a.coordinates, b.coordinates);
        if (separationArcsec !== null && separationArcsec <= tolerance) duplicateCandidates.push({
          recordIds: [a.id || a.name || `star-${i}`, b.id || b.name || `star-${j}`],
          separationArcsec, toleranceArcsec: tolerance,
          status: 'candidate-review-required', automaticMerge: false,
          reason: 'La proximité seule ne prouve pas une identité : contrôler époque, mouvement propre et incertitudes.',
        });
      }
    }
    const key = cell.join(':');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  }
  const catalogued = canonicalRecords.filter((record) => record.catalogIdentity || record.source || record.provenance?.provider).length;
  return {
    schemaVersion: 1,
    policy: { exactCatalogIdentifier: 'automatic-deduplication', coordinateProximity: 'candidate-only', toleranceArcsec: tolerance, existenceMeaning: 'catalogued-is-not-independent-proof' },
    canonicalRecords,
    duplicateGroups,
    duplicateCandidates,
    identityConflicts,
    statistics: {
      inputRecords: valid.length, canonicalRecords: canonicalRecords.length,
      exactDuplicateRecordsRemoved: valid.length - canonicalRecords.length,
      duplicateGroups: duplicateGroups.length, coordinateCandidates: duplicateCandidates.length,
      identityConflicts: identityConflicts.length,
      cataloguedRecords: catalogued, recordsWithoutSourceEvidence: canonicalRecords.length - catalogued,
    },
  };
}

function maxCoordinateSpread(records) {
  let maximum = null;
  for (let i = 0; i < records.length; i += 1) for (let j = i + 1; j < records.length; j += 1) {
    const separation = angularSeparationArcsec(records[i].coordinates, records[j].coordinates);
    if (separation !== null) maximum = maximum === null ? separation : Math.max(maximum, separation);
  }
  return maximum;
}

/** Décrit le niveau de preuve d'un objet sans confondre absence de donnée et inexistence. */
export function classifyAstronomicalExistence(record) {
  if (!record || typeof record !== 'object') return { status: 'unknown', label: 'Non vérifié', reason: 'Aucun enregistrement.' };
  const source = clean(record.source || record.provenance?.provider || record.kepler?.sourceReference);
  if (source.includes('jpl')) return { status: 'catalogued', label: 'Éléments JPL', reason: `Éléments orbitaux moyens référencés ${record.kepler?.sourceReference || 'JPL'} ; ils ne constituent pas une éphéméride instantanée.` };
  if (source.includes('nasa exoplanet archive')) return { status: 'catalogued', label: 'Catalogué NASA', reason: 'Présent dans le catalogue NASA Exoplanet Archive ; statut à interpréter selon la table et les flags de validation.' };
  if (source.includes('esa gaia')) return { status: 'catalogued', label: 'Mesuré par Gaia', reason: 'Entrée astrométrique Gaia ; ne prouve pas à elle seule la nature de l’objet.' };
  if (source.includes('simbad')) return { status: 'catalogued', label: 'Référencé SIMBAD', reason: 'Identifiant astronomique référencé ; la classification SIMBAD doit être examinée.' };
  if (record.provenance || record.catalogIdentity) return { status: 'sourced', label: 'Source renseignée', reason: 'Provenance présente, mais autorité et statut scientifique à contrôler.' };
  return { status: 'unverified', label: 'Non vérifié', reason: 'Aucune provenance exploitable dans cet enregistrement.' };
}

function validCoordinates(coordinates) {
  return hasValue(coordinates?.raDeg) && Number.isFinite(Number(coordinates.raDeg))
    && hasValue(coordinates?.decDeg) && Number.isFinite(Number(coordinates.decDeg))
    && Number(coordinates.decDeg) >= -90 && Number(coordinates.decDeg) <= 90;
}

function unitVector(coordinates) {
  const ra = ((Number(coordinates.raDeg) % 360) + 360) % 360 * Math.PI / 180;
  const dec = Number(coordinates.decDeg) * Math.PI / 180;
  const cosDec = Math.cos(dec);
  return [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec)];
}
