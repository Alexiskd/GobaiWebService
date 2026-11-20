import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bodiesPath = path.join(root, 'Car/Engine/SystemeEngine/data/astronomy/data/bodies.data.ts');
const keplerPath = path.join(root, 'Car/Engine/SystemeEngine/data/astronomy/data/kepler-elements.ts');
const bodies = fs.readFileSync(bodiesPath, 'utf8');
const kepler = fs.readFileSync(keplerPath, 'utf8');
const satRows = [...bodies.matchAll(/sat\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([\d_.]+),\s*'[^']+',\s*'([^']+)',\s*([\d_]+),\s*([\d.\-]+)\)/g)];
const satMap = new Map(satRows.map((m) => [m[1], { name: m[2], parent: m[3], radiusKm: Number(m[4].replaceAll('_', '')), aKm: Number(m[6].replaceAll('_', '')) }]));
const astresText = kepler.split('export const ASTRES: Astre[] = [')[1]?.split('// Fin de la table.')[0] || '';
const astreRows = [...astresText.matchAll(/\{ id: '([^']+)', nom: '([^']+)', type: '([^']+)', parent: '([^']*)'.*?kepler: \{ a: ([\d_.]+), e: ([\d.]+), i: ([-\d.]+), om: ([-\d.]+), w: ([-\d.]+), M0: ([-\d.]+)/g)];
const astreMap = new Map(astreRows.map((m) => [m[1], { name: m[2], type: m[3], parent: m[4], a: Number(m[5].replaceAll('_', '')), e: Number(m[6]), i: Number(m[7]), om: Number(m[8]), w: Number(m[9]), M0: Number(m[10]) }]));
const errors = [];
const jplExpected = { triton: [354800, 0], charon: [19600, 0], styx: [43200, 0.025], nix: [49300, 0.015], kerberos: [58300, 0.010], hydra: [65200, 0.009], puck: [86004, 0], proteus: [117700, 0.001], nereid: [5513900, 0.751] };
const duplicateIds = (items) => [...new Set(items.filter((id, index) => items.indexOf(id) !== index))];
const bodyDuplicates = duplicateIds(satRows.map((m) => m[1]));
const astreDuplicates = duplicateIds(astreRows.map((m) => m[1]));
if (bodyDuplicates.length) errors.push(`Doublons dans bodies.data.ts: ${bodyDuplicates.join(', ')}`);
if (astreDuplicates.length) errors.push(`Doublons dans kepler-elements.ts: ${astreDuplicates.join(', ')}`);
const missing = [...satMap.keys()].filter((id) => !astreMap.has(id));
if (missing.length) errors.push(`Satellites sans éléments orbitaux: ${missing.join(', ')}`);
const mismatches = [];
for (const [id, body] of satMap) {
  const orbital = astreMap.get(id);
  if (!orbital) continue;
  const delta = Math.abs(body.aKm - orbital.a) / body.aKm;
  if (delta > 0.03) mismatches.push({ id, bodiesKm: body.aKm, keplerKm: orbital.a, relativeDifference: delta });
}
if (mismatches.length) errors.push(`Demi-grands axes divergents (>3%): ${mismatches.map((x) => `${x.id} (${(x.relativeDifference * 100).toFixed(2)}%)`).join(', ')}`);
const jplReferenceMismatches = Object.entries(jplExpected).flatMap(([id, [a, e]]) => { const row = astreMap.get(id); return !row || row.a !== a || Math.abs(row.e - e) > 1e-9 ? [{ id, expected: { a, e }, actual: row ? { a: row.a, e: row.e } : null }] : []; });
if (jplReferenceMismatches.length) errors.push(`Valeurs JPL SSD divergentes: ${jplReferenceMismatches.map((x) => x.id).join(', ')}`);
const report = {
  status: errors.length ? 'failed' : 'passed',
  bodySatelliteDefinitions: satMap.size,
  keplerAstresDefinitions: astreMap.size,
  mirroredSatelliteDefinitions: [...satMap.keys()].filter((id) => astreMap.has(id)).length,
  missingKeplerEntries: missing,
  duplicateIds: { bodies: bodyDuplicates, kepler: astreDuplicates },
  semimajorAxisMismatchesOver3Percent: mismatches,
  jplReferenceChecks: { checked: Object.keys(jplExpected).length, mismatches: jplReferenceMismatches },
  note: 'Les deux tables sont des vues techniques distinctes du même corps ; ne pas concaténer leurs lignes pour créer des meshes. Les éléments moyens ne remplacent pas les éphémérides Horizons.',
  errors,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (errors.length) process.exitCode = 1;
