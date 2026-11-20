// Worker des pixels de tuiles : lit les pixels d'une tuile hors du fil principal.
//
// Il reçoit le fichier téléchargé (blob), le décode lui-même (createImageBitmap), le réduit sur un canevas hors écran
// à la taille demandée (vignette de 16 ou 32 px, ou 256 px pour une composition), éventuellement dans une portion de
// l'image (crop), et renvoie les pixels RGBA. Le fil principal ne fait plus ni décodage, ni dessin, ni lecture.

// Contextes de dessin hors écran, par taille.
const contexts = new Map();

/** Contexte hors écran d'une taille donnée, créé au premier besoin, réduction soignée comme sur le fil principal. */
// contextOf : le contexte d'une taille (début).
function contextOf(size) {
  // S'il n'existe pas (début).
  if (!contexts.has(size)) {
    // Canevas hors écran, carré.
    const ctx = new OffscreenCanvas(size, size).getContext('2d', { willReadFrequently: true });
    // Réduction soignée : un pixel de vignette représente la moyenne de son bloc.
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // Le garde.
    contexts.set(size, ctx);
  // Fin de ce cas.
  }
  // Le renvoie.
  return contexts.get(size);
// Fin de contextOf.
}

// À chaque demande : { id, blob, size, crop } (début).
self.onmessage = async (e) => {
  // Les champs de la demande.
  const { id, blob, size, crop } = e.data;
  // Essai (début).
  try {
    // Décode le fichier.
    const bmp = await createImageBitmap(blob);
    // Contexte de la taille demandée.
    const ctx = contextOf(size);
    // Efface.
    ctx.clearRect(0, 0, size, size);
    // Dessine la portion demandée, ou l'image entière, à la taille demandée.
    if (crop) ctx.drawImage(bmp, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size, size);
    // Sinon l'image entière.
    else ctx.drawImage(bmp, 0, 0, size, size);
    // Libère l'image décodée.
    bmp.close();
    // Lit les pixels.
    const data = ctx.getImageData(0, 0, size, size).data;
    // Les renvoie sans copie.
    self.postMessage({ id, data }, [data.buffer]);
  // Échec : null (le fil principal fera la lecture lui-même).
  } catch { self.postMessage({ id, data: null }); }
// Fin de l'écoute.
};
