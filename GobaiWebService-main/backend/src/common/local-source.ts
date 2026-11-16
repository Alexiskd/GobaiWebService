// readFile : lit un fichier de façon asynchrone (version à promesses).
import { readFile } from 'node:fs/promises';
// join : assemble des morceaux de chemin.
import { join } from 'node:path';

/**
 * Fichiers de dépôts tiers importés dans le projet (backend/data/vendor) : World Atlas, Natural Earth, three.js.
 * Ils sont lus sur le disque du serveur, plus téléchargés en direct. Détail et provenance : backend/data/vendor/README.md.
 */
// Dossier backend/data/vendor, calculé depuis l'emplacement du fichier compilé (deux niveaux au-dessus).
export const VENDOR_DIR = join(__dirname, '..', '..', 'data', 'vendor');

/** `true` pour une adresse http(s), `false` pour un chemin de fichier local. */
// Fonction isRemote : vrai si le texte commence par http:// ou https://, sans tenir compte de la casse.
export const isRemote = (source: string): boolean => /^https?:\/\//i.test(source);

/** JSON lu dans un fichier local, ou téléchargé si `source` est une adresse http(s) (source personnalisée). */
// Fonction loadJson : charge du JSON depuis un fichier ou une adresse ; reçoit la source, la fonction de téléchargement et le délai maximal en millisecondes.
export async function loadJson<T>(source: string, fetchFn: typeof fetch, timeoutMs: number): Promise<T> {
  // Source locale : lit le fichier en UTF-8, l'analyse et le renvoie avec le type demandé.
  if (!isRemote(source)) return JSON.parse(await readFile(source, 'utf8')) as T;
  // Source distante : la télécharge, en abandonnant au bout du délai.
  const res = await fetchFn(source, { signal: AbortSignal.timeout(timeoutMs) });
  // Réponse en erreur (404, 500…) : lève une erreur avec le code HTTP.
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Analyse le corps en JSON et le renvoie avec le type demandé.
  return (await res.json()) as T;
// Fin de loadJson.
}
