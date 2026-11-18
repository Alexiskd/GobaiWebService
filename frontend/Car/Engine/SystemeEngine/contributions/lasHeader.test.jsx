// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la lecture d'en-tête LAS/LAZ.
import { LasError, headerPayload, inspectLasFile, parseGeoKeys, parseLasHeader } from './lasHeader.jsx';

/** Emprise de la dalle LiDAR HD de Beaubourg, celle que le dépôt contient déjà. */
const PARIS = { minX: 652000, minY: 6862000, minZ: 25.52, maxX: 653000, maxY: 6863000, maxZ: 98.05 };

/** Écrit un texte dans un bloc d'octets, à une position donnée. */
function writeText(bytes, at, text) {
  // Chaque caractère, en ASCII.
  for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
// Fin de writeText.
}

/** Enregistrement VLR : son en-tête de 54 octets suivi de ses données. */
function vlr(recordId, data, userId = 'LASF_Projection') {
  // En-tête et données réunis.
  const out = new Uint8Array(54 + data.length);
  // Vue pour les entiers.
  const view = new DataView(out.buffer);
  // Identifiant du producteur.
  writeText(out, 2, userId);
  // Numéro de l'enregistrement et longueur de ses données.
  view.setUint16(18, recordId, true);
  view.setUint16(20, data.length, true);
  // Les données.
  out.set(data, 54);
  // L'enregistrement complet.
  return out;
// Fin de vlr.
}

/** Bloc de clés GeoTIFF déclarant un code EPSG projeté. */
function geoKeys(epsg) {
  // En-tête de quatre entiers, puis une clé de quatre entiers.
  const out = new Uint8Array(16);
  // Vue pour les entiers.
  const view = new DataView(out.buffer);
  // Version 1.1.0 du répertoire, une seule clé.
  view.setUint16(0, 1, true); view.setUint16(2, 1, true); view.setUint16(4, 0, true); view.setUint16(6, 1, true);
  // Clé 3072 (système projeté), valeur rangée dans la clé même, une valeur : le code EPSG.
  view.setUint16(8, 3072, true); view.setUint16(10, 0, true); view.setUint16(12, 1, true); view.setUint16(14, epsg, true);
  // Le bloc.
  return out;
// Fin de geoKeys.
}

/** Fichier LAS de test : en-tête complet, les enregistrements donnés, et pas un seul point. */
function lasFile({ minor = 4, points = 16618577, bounds = PARIS, records = [], name = 'releve.laz', compressed = true } = {}) {
  // Taille de l'en-tête : 375 octets pour LAS 1.4, 227 pour les versions précédentes.
  const headerSize = minor === 4 ? 375 : 227;
  // Les enregistrements mis bout à bout.
  const vlrs = records.length ? records.reduce((a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }, new Uint8Array(0)) : new Uint8Array(0);
  // Le fichier : en-tête, enregistrements, aucun point.
  const bytes = new Uint8Array(headerSize + vlrs.length);
  // Vue pour les entiers et les flottants.
  const view = new DataView(bytes.buffer);
  // Signature et version.
  writeText(bytes, 0, 'LASF');
  bytes[24] = 1; bytes[25] = minor;
  // Taille de l'en-tête, début des points, nombre d'enregistrements.
  view.setUint16(94, headerSize, true);
  view.setUint32(96, headerSize + vlrs.length, true);
  view.setUint32(100, records.length, true);
  // Format de point 6, compressé ou non (bit haut du même octet).
  bytes[104] = compressed ? 6 | 0x80 : 6;
  // Nombre de points : champ historique, et champ étendu pour LAS 1.4.
  view.setUint32(107, minor === 4 ? 0 : points, true);
  if (minor === 4) view.setBigUint64(247, BigInt(points), true);
  // Emprise : les maximums avant les minimums.
  view.setFloat64(179, bounds.maxX, true); view.setFloat64(187, bounds.minX, true);
  view.setFloat64(195, bounds.maxY, true); view.setFloat64(203, bounds.minY, true);
  view.setFloat64(211, bounds.maxZ, true); view.setFloat64(219, bounds.minZ, true);
  // Les enregistrements, après l'en-tête.
  bytes.set(vlrs, headerSize);
  // Le fichier.
  return new File([bytes], name);
// Fin de lasFile.
}

// Test : l'en-tête fixe.
test('lit l’en-tête d’un LAS 1.4 : version, points compressés et emprise', async () => {
  // Un fichier de test.
  const file = lasFile();
  // Son en-tête.
  const header = parseLasHeader(await file.slice(0, 375).arrayBuffer());
  // Version, format et compression.
  assert.equal(header.version, '1.4');
  assert.equal(header.pointFormat, 6);
  assert.equal(header.compressed, true);
  // Nombre de points : lu dans le champ étendu de LAS 1.4.
  assert.equal(header.pointCount, 16618577);
  // Emprise.
  assert.deepEqual(header.bounds, PARIS);
// Fin du test.
});

// Test : le nombre de points historique.
test('lit le nombre de points d’un LAS 1.2 dans le champ historique', async () => {
  // Fichier en version 1.2, non compressé.
  const file = lasFile({ minor: 2, points: 1234, compressed: false, name: 'releve.las' });
  // En-tête.
  const header = parseLasHeader(await file.slice(0, 375).arrayBuffer());
  // Version, compression et nombre de points.
  assert.equal(header.version, '1.2');
  assert.equal(header.compressed, false);
  assert.equal(header.pointCount, 1234);
// Fin du test.
});

// Test : les clés GeoTIFF.
test('lit le code EPSG des clés GeoTIFF', () => {
  // Le bloc de clés de la dalle IGN.
  assert.equal(parseGeoKeys(geoKeys(2154).buffer), 2154);
  // Un bloc vide ou un code « défini par l'utilisateur » ne déclarent rien.
  assert.equal(parseGeoKeys(new ArrayBuffer(4)), null);
  assert.equal(parseGeoKeys(geoKeys(32767).buffer), null);
// Fin du test.
});

// Test : le système déclaré par un VLR de clés GeoTIFF.
test('reconnaît le Lambert-93 déclaré par les clés GeoTIFF', async () => {
  // Fichier avec son enregistrement de projection.
  const info = await inspectLasFile(lasFile({ records: [vlr(34735, geoKeys(2154))] }));
  // Code EPSG lu, pas de WKT.
  assert.equal(info.epsg, 2154);
  assert.equal(info.crsWkt, null);
// Fin du test.
});

// Test : le système déclaré par une description WKT.
test('lit la description WKT du système de coordonnées', async () => {
  // Description telle qu'en portent les dalles LiDAR HD.
  const wkt = 'PROJCRS["RGF93 v1 / Lambert-93",BASEGEOGCRS["RGF93 v1"],ID["EPSG",2154]]';
  // Fichier avec les deux enregistrements.
  const info = await inspectLasFile(lasFile({ records: [vlr(34735, geoKeys(2154)), vlr(2112, new TextEncoder().encode(wkt))] }));
  // Les deux déclarations sont lues.
  assert.equal(info.epsg, 2154);
  assert.equal(info.crsWkt, wkt);
// Fin du test.
});

// Test : le relevé décrit.
test('décrit le relevé sans lire un seul point', async () => {
  // Fichier complet.
  const info = await inspectLasFile(lasFile({ records: [vlr(34735, geoKeys(2154))], name: 'LHD_FXX_0652_6863_PTS_C_LAMB93_IGN69.copc.laz' }));
  // Nom, emprise et nombre de points.
  assert.equal(info.filename, 'LHD_FXX_0652_6863_PTS_C_LAMB93_IGN69.copc.laz');
  assert.deepEqual(info.bounds, PARIS);
  assert.equal(info.pointCount, 16618577);
  // La charge envoyée au serveur ne porte que ce qui sert à placer le relevé.
  assert.deepEqual(headerPayload(info), { bounds: PARIS, pointCount: 16618577, epsg: 2154 });
// Fin du test.
});

// Test : les refus.
test('refuse un fichier qui n’est pas un relevé lisible', async () => {
  // Mauvaise extension.
  await assert.rejects(() => inspectLasFile(new File([new Uint8Array(400)], 'photo.png')), LasError);
  // Fichier vide.
  await assert.rejects(() => inspectLasFile(new File([], 'vide.laz')), LasError);
  // Signature absente.
  await assert.rejects(() => inspectLasFile(new File([new Uint8Array(400)], 'faux.laz')), /signature/);
  // Version inconnue.
  const future = lasFile();
  const bytes = new Uint8Array(await future.arrayBuffer());
  bytes[25] = 9;
  await assert.rejects(() => inspectLasFile(new File([bytes], 'futur.laz')), /Version LAS/);
  // Nombre de points nul.
  await assert.rejects(() => inspectLasFile(lasFile({ points: 0 })), /nombre de points/i);
// Fin du test.
});
