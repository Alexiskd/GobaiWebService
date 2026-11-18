// Fonds marins fondus dans l'imagerie satellite de la Terre (couche unique « earth-hd ») : là où les altitudes
// Terrarium sont sous la mer, l'image des fonds (GEBCO 2026, relayée par le serveur) remplace peu à peu l'image
// satellite. L'eau peu profonde des côtes garde l'image satellite, le large montre le relief des fonds, comme sur
// Google Earth. Fonctions pures, sans navigateur (testées dans seafloorFusion.test.jsx) ; le chargement est dans
// tileSource.jsx (withSeafloor).

// Importe l'altitude brute d'un pixel Terrarium, profondeurs comprises, depuis relief.
import { terrariumRaw } from '../ReliefEngine/relief.jsx';

/** Profondeur (m) jusqu'à laquelle l'image satellite reste seule : côtes, lagunes, polders sous le niveau de la mer. */
// Déclare et exporte la profondeur où commence la fusion : 10 m sous la mer.
export const SEA_SHALLOW_M = -10;
/** Profondeur (m) à partir de laquelle seule l'image des fonds est montrée. */
// Déclare et exporte la profondeur où la fusion est complète : 50 m sous la mer.
export const SEA_DEEP_M = -50;

/** Part de l'image des fonds à une altitude donnée (m) : 0 au-dessus de −10 m, 1 sous −50 m, linéaire entre les deux. */
// Déclare et exporte seaWeight : l'altitude en mètres.
export function seaWeight(m) {
  // Au-dessus de −10 m (ou valeur absente) : l'image satellite seule.
  if (!(m < SEA_SHALLOW_M)) return 0;
  // Sous −50 m : l'image des fonds seule.
  if (m <= SEA_DEEP_M) return 1;
  // Entre les deux : la part croît avec la profondeur.
  return (SEA_SHALLOW_M - m) / (SEA_SHALLOW_M - SEA_DEEP_M);
// Fin de seaWeight.
}

/** Altitudes (m, entières) d'une tuile Terrarium à partir de ses pixels RGBA ; un pixel sans donnée vaut 0. */
// Déclare et exporte decodeTerrarium : les pixels RGBA de la tuile.
export function decodeTerrarium(rgba) {
  // Une altitude par pixel, en entiers de 16 bits (de −32 768 à 32 767 m : la fosse des Mariannes y tient).
  const out = new Int16Array(rgba.length / 4);
  // Pour chaque pixel : son altitude décodée, arrondie et bornée.
  for (let k = 0; k < out.length; k++) out[k] = Math.max(-32768, Math.min(32767, Math.round(terrariumRaw(rgba[k * 4], rgba[k * 4 + 1], rgba[k * 4 + 2]))));
  // Renvoie les altitudes.
  return out;
// Fin de decodeTerrarium.
}

/**
 * Part de l'image des fonds pour chaque pixel d'une tuile de `size` px, à partir des altitudes de son ancêtre
 * `depth` niveaux plus haut (interpolation bilinéaire des altitudes, puis seaWeight). Renvoie null quand la tuile
 * n'a pas de mer : aucune image des fonds n'est alors demandée.
 */
// Déclare et exporte seaMask : les altitudes de l'ancêtre, l'écart de niveaux, la colonne et la ligne de la tuile, et la taille (256 px).
export function seaMask(elev, depth, x, y, size = 256) {
  // Nombre de tuiles par côté de l'ancêtre.
  const n = 2 ** depth;
  // Côté de la portion de l'ancêtre couverte par la tuile, en pixels.
  const side = size / n;
  // Coin de cette portion dans l'ancêtre.
  const ox = (x % n) * side, oy = (y % n) * side;
  // Part de l'image des fonds, par pixel.
  const mask = new Float32Array(size * size);
  // De la mer quelque part ? Non pour l'instant.
  let any = false;
  // Pour chaque ligne de la tuile (début).
  for (let j = 0; j < size; j++) {
    // Ordonnée du centre du pixel dans l'ancêtre, bornée à la grille.
    const v = Math.min(size - 1, Math.max(0, oy + ((j + 0.5) * side) / size - 0.5));
    // Ligne du dessus, ligne du dessous et poids de celle du dessous.
    const v0 = Math.floor(v), v1 = Math.min(size - 1, v0 + 1), fv = v - v0;
    // Pour chaque colonne (début).
    for (let i = 0; i < size; i++) {
      // Abscisse du centre du pixel dans l'ancêtre, bornée à la grille.
      const u = Math.min(size - 1, Math.max(0, ox + ((i + 0.5) * side) / size - 0.5));
      // Colonne de gauche, colonne de droite et poids de celle de droite.
      const u0 = Math.floor(u), u1 = Math.min(size - 1, u0 + 1), fu = u - u0;
      // Altitude interpolée entre les quatre pixels voisins.
      const h = (elev[v0 * size + u0] * (1 - fu) + elev[v0 * size + u1] * fu) * (1 - fv) + (elev[v1 * size + u0] * (1 - fu) + elev[v1 * size + u1] * fu) * fv;
      // Sa part d'image des fonds.
      const w = seaWeight(h);
      // Notée ; de la mer s'il y en a une part.
      if (w > 0) { mask[j * size + i] = w; any = true; }
    // Fin de la boucle des colonnes.
    }
  // Fin de la boucle des lignes.
  }
  // Renvoie les parts, ou null sans mer.
  return any ? mask : null;
// Fin de seaMask.
}

/** Mélange dans `out` (pixels RGBA de l'image satellite) l'image des fonds `sea`, pixel par pixel, selon `mask`. */
// Déclare et exporte blendSea : les pixels de sortie, ceux des fonds et les parts.
export function blendSea(out, sea, mask) {
  // Pour chaque pixel (début).
  for (let k = 0; k < mask.length; k++) {
    // Sa part d'image des fonds.
    const w = mask[k];
    // Aucune : pixel suivant.
    if (!w) continue;
    // Indice de sa composante rouge.
    const i = k * 4;
    // Rouge, vert et bleu : mélange des deux images.
    out[i] += (sea[i] - out[i]) * w; out[i + 1] += (sea[i + 1] - out[i + 1]) * w; out[i + 2] += (sea[i + 2] - out[i + 2]) * w;
    // Opaque.
    out[i + 3] = 255;
  // Fin de la boucle.
  }
  // Renvoie les pixels de sortie.
  return out;
// Fin de blendSea.
}
