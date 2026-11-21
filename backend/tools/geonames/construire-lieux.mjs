#!/usr/bin/env node
/**
 * Construit backend/data/vendor/geonames/places.tsv.gz, la base du moteur de recherche de lieux interne
 * (services/locations/places/place-index.ts), à partir de :
 *   - GeoNames cities1000 (toutes les localités de plus de 1 000 habitants et les chefs-lieux), au format du paquet
 *     npm « cities.json » (https://github.com/lutangar/cities.json) : cities.json, admin1.json, admin2.json ;
 *   - Natural Earth (déjà dans le projet) : population et noms (français, écritures locales) des ~7 300 grandes
 *     villes, rattachés à la localité GeoNames de même pays, de même nom et la plus proche (moins de 25 km).
 *
 *   - (facultatif) la population de chaque localité : GeoNames cities1000 publié par le paquet npm « all-the-cities »
 *     (https://github.com/zeke/all-the-cities, fichier cities.pbf), rattachée par pays, nom et distance (< 5 km).
 *
 * Usage : node backend/tools/geonames/construire-lieux.mjs <dossier de cities.json> [chemin de cities.pbf]
 *
 * Une ligne par localité, colonnes séparées par des tabulations :
 *   nom, latitude, longitude, pays (ISO A2), région (admin1), département/comté (admin2), population, nom français,
 *   autres noms (séparés par |)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
if (!src) { console.error('Usage : node construire-lieux.mjs <dossier de cities.json>'); process.exit(1); }

const read = (f) => JSON.parse(readFileSync(join(src, f), 'utf8'));
const cities = read('cities.json');
const admin1 = new Map(read('admin1.json').map((a) => [a.code, a.name]));
const admin2 = new Map(read('admin2.json').map((a) => [a.code, a.name]));

// Même pliage que le moteur : sans accents, en minuscules, ponctuation en espaces.
const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const clean = (s) => String(s || '').replace(/[\t\n|]/g, ' ').trim();

// Localités GeoNames.
const rows = cities.map((c) => ({
  name: clean(c.name),
  lat: Number(c.lat), lon: Number(c.lng),
  country: c.country,
  a1: clean(admin1.get(`${c.country}.${c.admin1}`) || ''),
  a2: clean(c.admin2 ? admin2.get(`${c.country}.${c.admin1}.${c.admin2}`) || '' : ''),
  pop: 0, aliases: new Set(),
})).filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lon));

// Index par pays et nom plié, pour le rattachement Natural Earth.
const byKey = new Map();
for (const r of rows) {
  const k = `${r.country}|${fold(r.name)}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(r);
}

// Distance approchée en km.
const km = (a, b) => {
  const dLat = (a.lat - b.lat) * 111.2;
  const dLon = (a.lon - b.lon) * 111.2 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLon);
};

// Natural Earth : population et autres noms.
const ne = JSON.parse(readFileSync(join(here, '..', '..', 'data', 'vendor', 'natural-earth', 'ne_10m_populated_places.geojson'), 'utf8'));
const LOCAL = ['NAME_AR', 'NAME_BN', 'NAME_EL', 'NAME_FA', 'NAME_HE', 'NAME_HI', 'NAME_JA', 'NAME_KO', 'NAME_RU', 'NAME_UK', 'NAME_UR', 'NAME_ZH', 'NAME_ZHT'];
let joined = 0;
for (const f of ne.features) {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  const here = { lat, lon };
  // Candidats : même pays, un des noms de la ville Natural Earth.
  const names = [p.NAME, p.NAMEASCII, p.NAME_FR].filter(Boolean);
  let best = null;
  for (const n of names) {
    for (const r of byKey.get(`${p.ISO_A2}|${fold(n)}`) || []) {
      const d = km(r, here);
      if (d < 25 && (!best || d < best.d)) best = { r, d };
    }
  }
  if (!best) continue;
  joined++;
  const r = best.r;
  r.pop = Math.max(r.pop, Number(p.POP_MAX) || 0);
  // Nom français, affiché à la place du nom GeoNames quand il diffère (Londres, Pékin, Moscou…).
  const fr = clean(p.NAME_FR);
  if (fr && fold(fr) !== fold(r.name)) r.fr = fr;
  for (const n of [p.NAME, ...LOCAL.map((k) => p[k])]) {
    const v = clean(n);
    if (v && fold(v) !== fold(r.name)) r.aliases.add(v);
  }
}

// Population de chaque localité (facultatif) : GeoNames cities1000 tel que publié par le paquet npm
// « all-the-cities » (cities.pbf), rattaché par pays, nom et distance (moins de 5 km).
const pbfPath = process.argv[3];
let popJoined = 0;
if (pbfPath) {
  const buf = readFileSync(pbfPath);
  let pos = 0;
  const varint = () => { let v = 0, s = 0, b; do { b = buf[pos++]; v += (b & 0x7f) * 2 ** s; s += 7; } while (b & 0x80); return v; };
  const svarint = () => { const v = varint(); return v % 2 ? -(v + 1) / 2 : v / 2; };
  let lastLat = 0, lastLon = 0;
  while (pos < buf.length) {
    const end = varint() + pos;
    const c = { name: '', country: '', population: 0, lat: 0, lon: 0 };
    while (pos < end) {
      const key = varint(), tag = key >> 3, type = key & 7;
      if (type === 2) { const len = varint(); const s = buf.toString('utf8', pos, pos + len); pos += len; if (tag === 2) c.name = s; else if (tag === 3) c.country = s; }
      else if (type === 0) {
        if (tag === 9) c.population = varint();
        else if (tag === 10) { lastLon += svarint(); c.lon = lastLon / 1e5; }
        else if (tag === 11) { lastLat += svarint(); c.lat = lastLat / 1e5; }
        else varint();
      } else throw new Error(`cities.pbf : type de champ ${type} inattendu`);
    }
    if (!c.population) continue;
    let best = null;
    for (const r of byKey.get(`${c.country}|${fold(c.name)}`) || []) {
      const d = km(r, c);
      if (d < 5 && (!best || d < best.d)) best = { r, d };
    }
    if (best) { popJoined++; best.r.pop = Math.max(best.r.pop, c.population); }
  }
}

const round = (v) => Math.round(v * 1e4) / 1e4;
const lines = rows.map((r) => [r.name, round(r.lat), round(r.lon), r.country, r.a1, r.a2, r.pop || '', r.fr || '', [...r.aliases].join('|')].join('\t'));
const out = join(here, '..', '..', 'data', 'vendor', 'geonames');
mkdirSync(out, { recursive: true });
const gz = gzipSync(lines.join('\n') + '\n', { level: 9 });
writeFileSync(join(out, 'places.tsv.gz'), gz);
console.log(`${rows.length} localités, ${joined} grandes villes rattachées à Natural Earth, ${popJoined} populations GeoNames → places.tsv.gz (${(gz.length / 1e6).toFixed(2)} Mo)`);
