// Lecture des pixels des tuiles hors du fil principal (voir tilePixels.worker.js).
//
// loadImage garde, pour chaque image téléchargée, le fichier dont elle vient (rememberBlob). Les lectures de pixels
// (tuile vide ?, accord des couleurs, composition des frontières) passent par le Worker, qui décode et réduit le
// fichier lui-même. Sans Worker ou sans canevas hors écran (anciens navigateurs), ou pour une image sans fichier
// (canevas composé), la lecture se fait comme avant sur le fil principal : `pixelsOffThread` renvoie alors undefined.

/** Fichier d'origine de chaque image téléchargée (libéré avec l'image). */
// Table image → fichier.
const BLOBS = new WeakMap();
/** Garde le fichier d'où vient une image. */
// Déclare et exporte rememberBlob : l'image et son fichier.
export const rememberBlob = (img, blob) => { if (img && blob) BLOBS.set(img, blob); };

// Worker : pas encore créé (undefined), indisponible (null), ou l'objet Worker.
let worker;
// Demandes en attente, par numéro.
const pending = new Map();
// Numéro de la prochaine demande.
let seq = 0;

/** Le Worker, créé au premier besoin ; null s'il est indisponible. */
// workerOf : le Worker (début).
function workerOf() {
  // Déjà décidé : le renvoie.
  if (worker !== undefined) return worker;
  // Essai (début).
  try {
    // Sans Worker ou sans canevas hors écran : indisponible.
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') { worker = null; return worker; }
    // Crée le Worker (module, regroupé par Vite).
    worker = new Worker(new URL('./tilePixels.worker.js', import.meta.url), { type: 'module' });
    // Réponse : résout la demande correspondante.
    worker.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p(e.data.data); } };
    // Panne du Worker : toutes les demandes repassent par le fil principal, et le Worker n'est plus utilisé.
    worker.onerror = () => { for (const p of pending.values()) p(undefined); pending.clear(); worker = null; };
  // Échec de création : indisponible.
  } catch { worker = null; }
  // Le renvoie.
  return worker;
// Fin de workerOf.
}

/**
 * Pixels RGBA d'une image réduite à `size` px (ou de sa portion `crop`), lus dans le Worker. Promesse de
 * Uint8ClampedArray, de null (fichier illisible) ou d'undefined (Worker indisponible ou image sans fichier : lire sur
 * le fil principal).
 */
// Déclare et exporte pixelsOffThread : l'image, la taille et la portion (début).
export function pixelsOffThread(img, size, crop = null) {
  // Fichier de l'image.
  const blob = BLOBS.get(img);
  // Le Worker.
  const w = blob ? workerOf() : null;
  // Sans fichier ou sans Worker : lecture sur le fil principal.
  if (!w) return Promise.resolve(undefined);
  // Numéro de la demande.
  const id = ++seq;
  // Promesse de la réponse.
  return new Promise((resolve) => {
    // Note la demande.
    pending.set(id, resolve);
    // L'envoie (le fichier est partagé, pas copié).
    w.postMessage({ id, blob, size, crop: crop ? { sx: crop.sx, sy: crop.sy, sw: crop.sw, sh: crop.sh } : null });
  });
// Fin de pixelsOffThread.
}
