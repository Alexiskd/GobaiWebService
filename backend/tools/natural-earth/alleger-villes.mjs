// Allège le fichier des villes Natural Earth importé dans le projet (ne_10m_populated_places.geojson).
// Le fichier d'origine porte 137 propriétés par ville ; le backend (city-labels.service.ts) n'en lit que 23.
// Ce script ne garde que celles-là : mêmes villes, mêmes positions, mêmes valeurs, dans le même ordre.
//
// Usage, depuis la racine du dépôt :
//   node backend/tools/natural-earth/alleger-villes.mjs <fichier d'origine> [fichier de sortie]
// Le fichier d'origine vient de https://github.com/nvkelso/natural-earth-vector (dossier geojson, version dans VERSION).

// Importe la lecture et l'écriture de fichiers de Node.
import { readFileSync, writeFileSync } from 'node:fs';

// Sortie par défaut : le fichier lu par le backend.
const DEFAULT_OUT = 'backend/data/vendor/natural-earth/ne_10m_populated_places.geojson';
// Propriétés lues par city-labels.service.ts (début de la liste) :
const KEPT = [
  // le nom et sa forme sans accent, le nom français ;
  'NAME', 'NAMEASCII', 'NAME_FR',
  // le code et le nom du pays, la région, le fuseau horaire ;
  'ISO_A2', 'ADM0NAME', 'ADM1NAME', 'TIMEZONE',
  // la population, la surface et l'indicateur de capitale ;
  'POP_MAX', 'MAX_AREAKM', 'ADM0CAP',
  // le nom dans l'écriture du pays (table SCRIPT_BY_COUNTRY du service).
  'NAME_AR', 'NAME_BN', 'NAME_EL', 'NAME_FA', 'NAME_HE', 'NAME_HI', 'NAME_JA', 'NAME_KO', 'NAME_RU', 'NAME_UK', 'NAME_UR', 'NAME_ZH', 'NAME_ZHT',
// Fin de la liste.
];

// Lit les deux arguments : le fichier d'origine et le fichier de sortie.
const [source, out = DEFAULT_OUT] = process.argv.slice(2);
// Sans fichier d'origine : rappelle l'usage et s'arrête en erreur.
if (!source) { console.error('Usage : node alleger-villes.mjs <fichier d\'origine> [fichier de sortie]'); process.exit(1); }
// Lit le texte du fichier d'origine.
const text = readFileSync(source, 'utf8');
// Le décode.
const geojson = JSON.parse(text);
// Sans liste de villes : s'arrête en erreur.
if (!Array.isArray(geojson.features)) { console.error(`${source} : GeoJSON sans liste « features ».`); process.exit(1); }

// Pour chaque ville : garde son type et sa géométrie, et ne recopie que les propriétés lues (début).
geojson.features = geojson.features.map((f) => ({
  // Le type de l'entrée.
  type: f.type,
  // Les propriétés gardées, sans celles qui sont absentes, nulles ou vides (le backend les lit comme vides).
  properties: Object.fromEntries(KEPT.map((k) => [k, f.properties?.[k]]).filter(([, v]) => v !== undefined && v !== null && v !== '')),
  // La géométrie, inchangée.
  geometry: f.geometry,
// Fin de la recopie.
}));

// Réécrit le fichier, sans mise en forme.
const slim = JSON.stringify(geojson);
// L'enregistre.
writeFileSync(out, slim);
// mo : taille d'un texte en mégaoctets, avec une décimale.
const mo = (s) => (Buffer.byteLength(s) / 1e6).toFixed(1);
// Affiche le bilan.
console.log(`${geojson.features.length} villes, ${KEPT.length} propriétés gardées : ${mo(text)} Mo → ${mo(slim)} Mo (${out})`);
