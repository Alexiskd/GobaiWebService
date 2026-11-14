// Importe lonLatToXYZ, la conversion d'une longitude et d'une latitude en point de la sphère, depuis mercator.
import { lonLatToXYZ } from './mercator';
// Importe MERCATOR, la projection par défaut, depuis projection.
import { MERCATOR } from './projection';

/**
 * Écart entre deux niveaux de tuiles (rayons), selon l'altitude de la caméra : les niveaux fins sont posés légèrement
 * au-dessus des grossiers (quand un ancêtre remplace une tuile pas encore chargée), sans jamais dépasser ≈ 9 % de
 * l'altitude au niveau 22. De loin : 1e-6 (≈ 6 m) comme avant ; à 15 m d'altitude : ≈ 4 cm.
 */
// Déclare et exporte levelGap : 0,4 % de l'altitude, borné entre 1e-10 et 1e-6 rayon.
export const levelGap = (altitude) => Math.min(1e-6, Math.max(1e-10, altitude * 0.004));
/** Rayon d'une tuile de niveau z pour un écart donné (voir `levelGap`). */
// Déclare et exporte tileRadius : 1 plus l'écart multiplié par (1 + niveau).
export const tileRadius = (z, gap = 1e-6) => 1 + gap * (1 + z);

// Nombre maximal de segments par côté d'une tuile : 64.
const MAX_SEGMENTS = 64;
// Taille visée d'un segment : 1 degré.
const SEGMENT_DEG = 1; // un sommet tous les ~1° : les arêtes de tuiles voisines de niveaux différents restent quasi confondues

/**
 * Maillage d'une tuile sur la sphère, en tableaux bruts (convertis en BufferGeometry par l'appelant).
 * Les rangées sont réparties régulièrement dans l'espace de la projection (Mercator ou plate carrée), comme
 * l'image : un pixel de la texture tombe donc à la bonne latitude. uv.v = 1 en haut (Nord), pour une texture avec flipY.
 *
 * Précision : les sommets sont donnés RELATIVEMENT au centre de la tuile (`center`, sur la sphère unité) et à rayon 1.
 * Le maillage est placé par sa matrice (translation = center·r, échelle = r), calculée en double précision côté JS :
 * le GPU ne voit que de petites coordonnées, ce qui permet de descendre au zoom 22 (≈ 4 cm par pixel) sans tremblement.
 *
 * Jupes (`skirt` > 0, profondeur en rayons) : chaque bord reçoit une bande verticale qui descend vers le centre de
 * l'astre, avec les uv et la normale du bord. Entre deux tuiles voisines de niveaux différents, dont les arêtes ne
 * tombent pas exactement sur les mêmes points, la jupe bouche la fissure : on ne voit jamais l'espace à travers le sol.
 */
// Déclare et exporte buildTileGrid : le niveau, la colonne, la ligne, la projection, la profondeur de la jupe et le nombre minimal de segments.
export function buildTileGrid(z, x, y, proj = MERCATOR, { skirt = 0, minSegments = 1 } = {}) {
  // Longitudes des bords ouest et est de la tuile.
  const west = proj.lon(x, z), east = proj.lon(x + 1, z);
  // Latitudes des bords nord et sud.
  const north = proj.lat(y, z), south = proj.lat(y + 1, z);
  // `minSegments` : finesse minimale d'une tuile soulevée par le relief (une petite tuile n'a sinon que 4 sommets).
  // Nombre minimal de segments, ramené à un entier entre 1 et 64.
  const least = Math.max(1, Math.min(MAX_SEGMENTS, Math.floor(minSegments)));
  // Segments en largeur : un par degré de longitude, entre le minimum et 64.
  const nu = Math.max(least, Math.min(MAX_SEGMENTS, Math.ceil((east - west) / SEGMENT_DEG)));
  // Segments en hauteur : un par degré de latitude, entre le minimum et 64.
  const nv = Math.max(least, Math.min(MAX_SEGMENTS, Math.ceil((north - south) / SEGMENT_DEG)));

  // Centre de la tuile sur la sphère : la longitude moyenne et la latitude du milieu dans la projection.
  const center = lonLatToXYZ((west + east) / 2, proj.lat(y + 0.5, z));
  // Nombre de sommets de la grille.
  const gridCount = (nu + 1) * (nv + 1);
  // Nombre de sommets de la jupe : un par sommet du pourtour, ou aucun sans jupe.
  const ring = skirt > 0 ? 2 * (nu + nv) : 0; // sommets du pourtour (un par sommet de bord)
  // Tableau des positions : trois nombres par sommet.
  const positions = new Float32Array((gridCount + ring) * 3);
  // Tableau des normales, de la même taille.
  const normals = new Float32Array(positions.length);
  // Tableau des coordonnées de texture : deux nombres par sommet.
  const uvs = new Float32Array((gridCount + ring) * 2);
  // Indices d'écriture dans les positions et dans les coordonnées de texture.
  let p = 0, t = 0;
  // Pour chaque rangée, du nord au sud (début).
  for (let j = 0; j <= nv; j++) {
    // Avancement vertical, de 0 à 1.
    const v = j / nv;
    // Latitude de la rangée, répartie régulièrement dans la projection.
    const lat = proj.lat(y + v, z);
    // Pour chaque sommet de la rangée, d'ouest en est (début).
    for (let i = 0; i <= nu; i++) {
      // Avancement horizontal, de 0 à 1.
      const u = i / nu;
      // Point de la sphère à cette longitude et à cette latitude.
      const [nx, ny, nz] = lonLatToXYZ(west + u * (east - west), lat);
      // Position du sommet, relative au centre de la tuile.
      positions[p] = nx - center[0]; positions[p + 1] = ny - center[1]; positions[p + 2] = nz - center[2];
      // Normale du sommet : le point de la sphère lui-même.
      normals[p] = nx; normals[p + 1] = ny; normals[p + 2] = nz;
      // Passe au sommet suivant.
      p += 3;
      // Coordonnée u de la texture.
      uvs[t++] = u;
      // Coordonnée v de la texture : 1 en haut.
      uvs[t++] = 1 - v;
    // Fin de la boucle des sommets.
    }
  // Fin de la boucle des rangées.
  }

  // Nombre de sommets par rangée.
  const row = nu + 1;
  // Pourtour dans l'ordre (haut → droite → bas → gauche) : indices des sommets de bord.
  // Liste des indices des sommets du pourtour.
  const border = [];
  // Avec une jupe (début).
  if (ring) {
    // Bord du haut, d'ouest en est.
    for (let i = 0; i < nu; i++) border.push(i);
    // Bord de droite, de haut en bas.
    for (let j = 0; j < nv; j++) border.push(j * row + nu);
    // Bord du bas, d'est en ouest.
    for (let i = nu; i > 0; i--) border.push(nv * row + i);
    // Bord de gauche, de bas en haut.
    for (let j = nv; j > 0; j--) border.push(j * row);
    // Rayon du bas de la jupe : 1 moins sa profondeur.
    const down = 1 - skirt;
    // Pour chaque sommet du pourtour (début).
    border.forEach((src, n) => {
      // Indice de sa copie enfoncée.
      const dst = gridCount + n;
      // Normale du sommet d'origine.
      const nx = normals[src * 3], ny = normals[src * 3 + 1], nz = normals[src * 3 + 2];
      // Position x de la copie : le point ramené au rayon de la jupe, relatif au centre.
      positions[dst * 3] = nx * down - center[0];
      // Position y de la copie.
      positions[dst * 3 + 1] = ny * down - center[1];
      // Position z de la copie.
      positions[dst * 3 + 2] = nz * down - center[2];
      // Même normale que le sommet d'origine.
      normals.set([nx, ny, nz], dst * 3);
      // Mêmes coordonnées de texture que le sommet d'origine.
      uvs[dst * 2] = uvs[src * 2]; uvs[dst * 2 + 1] = uvs[src * 2 + 1];
    // Fin de la boucle du pourtour.
    });
  // Fin du cas avec jupe.
  }

  // Tableau des indices : six par case de la grille, plus six par arête de la jupe.
  const indices = new Uint16Array(nu * nv * 6 + ring * 6);
  // Indice d'écriture dans ce tableau.
  let k = 0;
  // Pour chaque rangée de cases (début).
  for (let j = 0; j < nv; j++) {
    // Pour chaque case de la rangée (début).
    for (let i = 0; i < nu; i++) {
      // Les quatre sommets de la case : haut gauche, haut droit, bas gauche et bas droit.
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      // Sens antihoraire vu de l'extérieur de la sphère (face avant visible).
      // Premier triangle de la case.
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      // Second triangle de la case.
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    // Fin de la boucle des cases.
    }
  // Fin de la boucle des rangées.
  }
  // Jupes : un quadrilatère entre chaque arête du bord et sa copie enfoncée (vu de l'extérieur de la tuile).
  // Pour chaque arête du pourtour (début).
  for (let n = 0; n < ring; n++) {
    // Les deux sommets de l'arête ; la dernière arête revient au premier sommet.
    const a = border[n], b = border[(n + 1) % ring];
    // Leurs copies enfoncées.
    const a2 = gridCount + n, b2 = gridCount + ((n + 1) % ring);
    // Premier triangle de la jupe.
    indices[k++] = a; indices[k++] = b; indices[k++] = a2;
    // Second triangle de la jupe.
    indices[k++] = b; indices[k++] = b2; indices[k++] = a2;
  // Fin de la boucle de la jupe.
  }
  // Renvoie les tableaux, le centre, les nombres de segments et le nombre de sommets de la jupe.
  return { positions, center, normals, uvs, indices, nu, nv, skirtVertices: ring };
// Fin de buildTileGrid.
}
