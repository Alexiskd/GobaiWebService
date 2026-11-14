#!/usr/bin/env node
/**
 * Génère public/data/stars-bsc5.bin à partir du Yale Bright Star Catalogue (5e éd., J2000),
 * version JSON « bsc5-short.json » de https://github.com/brettonw/YaleBrightStarCatalog (MIT).
 *
 * Format : 8 octets par étoile, 4 × Uint16 little-endian
 *   AD    0..65535 → 0..2π
 *   Déc   0..65535 → −π/2..+π/2
 *   mag   (V + 2) × 1000
 *   temp  température de couleur (K) / 2
 * Lecture : decodeStarCatalog() dans src/moteur/engine/sky/skyMath.jsx (même encodage que encodeStar).
 *
 * Usage : node scripts/build-star-catalog.mjs chemin/vers/bsc5-short.json
 */
// Importe la lecture et l'écriture de fichiers et la création de dossiers, depuis Node.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// Importe dirname et resolve, les outils de chemins de Node.
import { dirname, resolve } from 'node:path';
// Importe fileURLToPath, la conversion d'une adresse de fichier en chemin.
import { fileURLToPath } from 'node:url';

// D : le nombre de radians dans un degré.
const D = Math.PI / 180;
// U16 : la plus grande valeur sur 16 bits, 65 535.
const U16 = 65535;

// Chemin du catalogue JSON, premier argument de la commande.
const src = process.argv[2];
// S'il manque (début).
if (!src) {
  // Affiche l'usage.
  console.error('Usage : node scripts/build-star-catalog.mjs bsc5-short.json');
  // Quitte avec le code d'erreur 1.
  process.exit(1);
// Fin de ce cas.
}

// parseRa : convertit une ascension droite « 00h 00m 00s » en radians (début).
const parseRa = (s) => {
  // Repère les heures, les minutes et les secondes.
  const m = /(\d+)h\s*(\d+)m\s*([\d.]+)s/.exec(s);
  // Heures décimales × 15°, en radians ; NaN si le texte est illisible.
  return m ? (Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600) * 15 * D : NaN;
// Fin de parseRa.
};
// parseDec : convertit une déclinaison « +00° 00′ 00″ » en radians (début).
const parseDec = (s) => {
  // Repère le signe, les degrés, les minutes et les secondes.
  const m = /([+-−])?(\d+)°\s*(\d+)′\s*([\d.]+)″/.exec(s);
  // Texte illisible : NaN.
  if (!m) return NaN;
  // Degrés décimaux.
  const v = Number(m[2]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
  // Négatifs avec un signe moins, puis en radians.
  return (m[1] === '-' || m[1] === '−' ? -v : v) * D;
// Fin de parseDec.
};

// Étoiles : lit le catalogue JSON,
const stars = JSON.parse(readFileSync(src, 'utf8'))
  // garde pour chacune l'ascension droite, la déclinaison, la magnitude et la température (5 800 K par défaut),
  .map((s) => ({ ra: parseRa(s.RA), dec: parseDec(s.Dec), mag: Number(s.V), kelvin: Number(s.K) || 5800 }))
  // écarte celles dont une valeur est illisible,
  .filter((s) => Number.isFinite(s.ra) && Number.isFinite(s.dec) && Number.isFinite(s.mag))
  // et les trie par magnitude croissante.
  .sort((a, b) => a.mag - b.mag); // les plus brillantes d'abord

// Tampon de 8 octets par étoile.
const buf = Buffer.alloc(stars.length * 8);
// Pour chaque étoile (début).
stars.forEach((s, i) => {
  // Position de l'étoile dans le tampon.
  const o = i * 8;
  // Écrit l'ascension droite, ramenée de 0..2π à 0..65 535.
  buf.writeUInt16LE(Math.round((s.ra / (2 * Math.PI)) * U16) % (U16 + 1), o);
  // Écrit la déclinaison, ramenée de −π/2..+π/2 à 0..65 535.
  buf.writeUInt16LE(Math.round(((s.dec + Math.PI / 2) / Math.PI) * U16), o + 2);
  // Écrit la magnitude : (V + 2) × 1 000, bornée.
  buf.writeUInt16LE(Math.round(Math.min(U16, Math.max(0, (s.mag + 2) * 1000))), o + 4);
  // Écrit la température divisée par 2, bornée.
  buf.writeUInt16LE(Math.round(Math.min(U16, Math.max(0, s.kelvin / 2))), o + 6);
// Fin de la boucle.
});

// Chemin du fichier produit : public/data/stars-bsc5.bin.
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/stars-bsc5.bin');
// Crée son dossier s'il manque.
mkdirSync(dirname(out), { recursive: true });
// Écrit le fichier.
writeFileSync(out, buf);
// Affiche le nombre d'étoiles, le chemin et la taille en kilo-octets.
console.log(`${stars.length} étoiles → ${out} (${(buf.length / 1024).toFixed(1)} Ko)`);
