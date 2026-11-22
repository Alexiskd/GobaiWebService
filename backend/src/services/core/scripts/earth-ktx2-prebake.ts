/**
 * Préconversion des tuiles de la Terre vue de loin en KTX2, enregistrées dans BP (table earth_ktx2).
 *   npm run earth:ktx2                      → couches sentinel2 et gibs, niveaux 0 à 6 (5 461 tuiles par couche)
 *   npm run earth:ktx2 -- gibs              → une seule couche
 *   npm run earth:ktx2 -- sentinel2 4       → une couche, niveaux 0 à 4
 * Pour chaque tuile : téléchargement du JPEG chez le fournisseur (comme le navigateur), décodage et passage en PNG
 * (sharp), conversion en KTX2 par l'outil `basisu` (Basis Universal, UASTC avec mipmaps), enregistrement dans BP.
 * Les tuiles déjà en base sont sautées : on peut l'interrompre (Ctrl+C) et le relancer.
 * Prérequis, à installer sur la machine qui lance le script (pas dans le dépôt) :
 *   - `basisu` dans le PATH (https://github.com/BinomialLLC/basis_universal) ;
 *   - DATABASE_URL de BP (fichier .env ou variable d'environnement : l'adresse externe de la base Render).
 * Sentinel-2 : seules les tuiles qui touchent l'emprise de la couche (latitudes −70° à 86°) sont converties.
 */
// Charge le fichier .env dans process.env.
import 'dotenv/config';
// Lancement de basisu, fichiers temporaires.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Connexions à PostgreSQL.
import { Pool } from 'pg';
// Couches acceptées, niveau maximal et schéma de la table.
import { EARTH_KTX2_LAYERS, EARTH_KTX2_MAX_ZOOM, EARTH_KTX2_SCHEMA, checkEarthKtx2 } from '../../map-tiles/earth/earth-ktx2.service';
// Les sources de la Terre : leurs adresses de tuiles.
import { EARTH_SOURCE_BY_ID } from '../../map-tiles/earth/earth-sources';

/** Tuiles converties en parallèle : basisu occupe déjà plusieurs cœurs, on reste modeste. */
// Nombre de tuiles traitées en même temps : 3.
const CONCURRENCY = 3;
/** Délai maximal d'un téléchargement (ms). */
// Délai d'un téléchargement : 30 secondes.
const FETCH_TIMEOUT_MS = 30_000;

// Chargeur de sharp (require, puis import pour la version en module ES).
async function loadSharp(): Promise<(input: Buffer) => { png(): { toBuffer(): Promise<Buffer> } }> {
  // Choisit la fonction exportée.
  const pick = (m: unknown) => ((m as { default?: unknown })?.default ?? m) as (input: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
  // Essai par require.
  try { return pick(require('sharp')); } catch { /* essai suivant */ }
  // Sinon par import dynamique.
  const load = new Function('name', 'return import(name)') as (name: string) => Promise<unknown>;
  return pick(await load('sharp'));
// Fin de loadSharp.
}

/** Latitude (degrés) du bord nord d'une tuile Web Mercator de niveau z, ligne y. */
// Déclare latOfRow : le niveau et la ligne (bord nord de la ligne y ; y = 2^z donne le bord sud de la dernière).
function latOfRow(z: number, y: number): number {
  // Formule de Web Mercator.
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  // Latitude en degrés.
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
// Fin de latOfRow.
}

/** La tuile touche-t-elle l'emprise en latitude de la source ? (Les emprises de ces couches couvrent toutes les longitudes.) */
// Déclare touchesLatitude : le niveau, la ligne et l'emprise [ouest, sud, est, nord].
function touchesLatitude(z: number, y: number, bbox: [number, number, number, number]): boolean {
  // Bords nord et sud de la tuile.
  const north = latOfRow(z, y), south = latOfRow(z, y + 1);
  // Vrai si les deux intervalles de latitude se recouvrent.
  return north > bbox[1] && south < bbox[3];
// Fin de touchesLatitude.
}

/** Télécharge le JPEG d'une tuile : essaie chaque adresse de la source, renvoie null si aucune ne répond. */
// Déclare download : les adresses à essayer.
async function download(urls: string[]): Promise<Buffer | null> {
  // Pour chaque adresse, dans l'ordre (début).
  for (const url of urls) {
    // Essai : la réponse, sous délai maximal.
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      // Réponse correcte : ses octets.
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    // Échec réseau : adresse suivante.
    } catch { /* adresse suivante */ }
  // Fin de la boucle.
  }
  // Aucune adresse n'a répondu.
  return null;
// Fin de download.
}

/** Lance basisu sur un PNG et lit le .ktx2 produit (UASTC, mipmaps). */
// Déclare toKtx2 : le dossier de travail et le PNG.
async function toKtx2(dir: string, png: Buffer): Promise<Buffer> {
  // Fichiers d'entrée et de sortie.
  const input = join(dir, 'tile.png'), output = join(dir, 'tile.ktx2');
  // Écrit le PNG.
  await writeFile(input, png);
  // Lance basisu et attend sa fin (début).
  await new Promise<void>((resolve, reject) => {
    // Le processus : sortie KTX2, UASTC, mipmaps.
    const child = spawn('basisu', ['-ktx2', '-uastc', '-mipmap', '-output_file', output, input], { stdio: ['ignore', 'ignore', 'pipe'] });
    // Message d'erreur éventuel.
    let err = '';
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    // basisu introuvable : message clair.
    child.on('error', (e: NodeJS.ErrnoException) => reject(e.code === 'ENOENT' ? new Error('basisu introuvable dans le PATH (https://github.com/BinomialLLC/basis_universal).') : e));
    // Fin : succès si code 0.
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`basisu a échoué (code ${code}) : ${err.slice(0, 200)}`))));
  // Fin de l'attente.
  });
  // Lit le fichier produit.
  return readFile(output);
// Fin de toKtx2.
}

// Fonction principale du script.
async function main() {
  // Arguments : couche (ou « all »), niveau maximal.
  const layerArg = process.argv[2] ?? 'all';
  const maxZoom = process.argv[3] !== undefined ? Math.min(EARTH_KTX2_MAX_ZOOM, Math.max(0, Number.parseInt(process.argv[3], 10) || 0)) : EARTH_KTX2_MAX_ZOOM;
  // Couches à traiter.
  const layers = layerArg === 'all' ? [...EARTH_KTX2_LAYERS] : [layerArg];
  // Vérifie les couches (erreur claire sinon).
  for (const l of layers) checkEarthKtx2(l, 0, 0, 0);
  // Adresse de la base.
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL absent : adresse externe de la base BP de Render.');
  // Connexion à BP, et table créée si besoin.
  const pool = new Pool({ connectionString: databaseUrl, max: CONCURRENCY + 1, ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined });
  await pool.query(EARTH_KTX2_SCHEMA);
  // Outil de décodage.
  const sharp = await loadSharp();
  // Liste des tuiles à faire : couche, niveau, colonne, ligne.
  const jobs: { layer: string; z: number; x: number; y: number }[] = [];
  for (const layer of layers) {
    // Emprise de la couche (latitudes), si elle en a une.
    const bbox = EARTH_SOURCE_BY_ID.get(layer as 'sentinel2' | 'gibs')?.bboxes?.[0] as [number, number, number, number] | undefined;
    for (let z = 0; z <= maxZoom; z++) for (let y = 0; y < 2 ** z; y++) for (let x = 0; x < 2 ** z; x++) {
      if (!bbox || touchesLatitude(z, y, bbox)) jobs.push({ layer, z, x, y });
    }
  }
  console.log(`Terre KTX2 : ${layers.join(', ')}, niveaux 0 à ${maxZoom}, ${jobs.length} tuiles → BP`);
  // Avancement.
  let done = 0, skipped = 0, failed = 0, bytes = 0, next = 0, last = 0;
  // Un ouvrier : prend la tuile suivante jusqu'à épuisement.
  const worker = async () => {
    // Dossier de travail propre à l'ouvrier.
    const dir = await mkdtemp(join(tmpdir(), 'ktx2-'));
    try {
      for (let i = next++; i < jobs.length; i = next++) {
        const { layer, z, x, y } = jobs[i];
        try {
          // Déjà en base : sautée.
          const has = await pool.query('SELECT 1 FROM earth_ktx2 WHERE layer = $1 AND z = $2 AND x = $3 AND y = $4', [layer, z, x, y]);
          if (has.rowCount) { skipped++; }
          else {
            // Téléchargement, décodage, conversion, enregistrement.
            const jpeg = await download(EARTH_SOURCE_BY_ID.get(layer as 'sentinel2' | 'gibs')!.urls(z, x, y, ''));
            if (!jpeg) throw new Error('téléchargement impossible');
            const ktx2 = await toKtx2(dir, await sharp(jpeg).png().toBuffer());
            await pool.query('INSERT INTO earth_ktx2 (layer, z, x, y, data, size) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING', [layer, z, x, y, ktx2, ktx2.length]);
            bytes += ktx2.length;
          }
        } catch (e) {
          // Échec : compté, la tuile sera reprise au prochain lancement ; basisu absent : arrêt immédiat.
          failed++;
          if (String((e as Error).message).startsWith('basisu introuvable')) throw e;
        }
        // Avancement : au plus un affichage par seconde, et toujours le dernier.
        done++;
        const now = Date.now();
        if (now - last > 1000 || done === jobs.length) {
          last = now;
          process.stdout.write(`\r  ${done}/${jobs.length} (${Math.floor((100 * done) / jobs.length)} %) · ${(bytes / 1e6).toFixed(1)} Mo ajoutés${failed ? ` · ${failed} échecs` : ''}   `);
        }
      }
    } finally {
      // Supprime le dossier de travail.
      await rm(dir, { recursive: true, force: true });
    }
  };
  // Lance les ouvriers en parallèle et attend leur fin.
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // Ferme la connexion.
  await pool.end();
  // Bilan.
  console.log(`\nTerminé : ${done - failed - skipped} converties, ${skipped} déjà en base${failed ? `, ${failed} échecs (relancer pour réessayer)` : ''}.`);
  // Code 1 s'il y a eu des échecs, 0 sinon.
  process.exit(failed ? 1 : 0);
// Fin de main.
}

// Lance le script ; toute erreur est affichée et donne le code 1.
main().catch((e: Error) => { console.error(`\n${e.message}`); process.exit(1); });
