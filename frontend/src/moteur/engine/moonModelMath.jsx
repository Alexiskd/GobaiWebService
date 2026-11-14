// Calage d'un modèle 3D de la Lune sur le repère sélénographique du moteur, à partir de ses seules coordonnées de
// texture : sur une carte 2:1 équirectangulaire centrée sur 0°, u donne la longitude et v la latitude. Fonctions pures.
// Importe la conversion d'une longitude et d'une latitude en point 3D.
import { lonLatToXYZ } from './tiles/mercator';

/** uv glTF (origine en haut à gauche) → [longitude, latitude] en degrés, carte centrée sur 0°. */
// uvToLonLat : u donne la longitude (de -180 à 180), v la latitude (de 90 à -90).
export const uvToLonLat = (u, v) => [(u - 0.5) * 360, (0.5 - v) * 180];

// det3 : déterminant d'une matrice 3 × 3 écrite à plat.
const det3 = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
// Déclare inv3T : la transposée de l'inverse d'une matrice 3 × 3.
function inv3T(m) { // (m⁻¹)ᵀ
  // Son déterminant.
  const d = det3(m);
  // Renvoie les neuf cofacteurs divisés par le déterminant (début).
  return [
    // Première ligne.
    (m[4] * m[8] - m[5] * m[7]) / d, -(m[3] * m[8] - m[5] * m[6]) / d, (m[3] * m[7] - m[4] * m[6]) / d,
    // Deuxième ligne.
    -(m[1] * m[8] - m[2] * m[7]) / d, (m[0] * m[8] - m[2] * m[6]) / d, -(m[0] * m[7] - m[1] * m[6]) / d,
    // Troisième ligne.
    (m[1] * m[5] - m[2] * m[4]) / d, -(m[0] * m[5] - m[2] * m[3]) / d, (m[0] * m[4] - m[1] * m[3]) / d,
  // Fin de la matrice.
  ];
// Fin de inv3T.
}

/**
 * Matrice orthogonale (3×3, lignes) qui envoie les directions du modèle sur celles du moteur, au sens des moindres
 * carrés (problème de Wahba : décomposition polaire de la covariance, itération de Newton). Si les uv sont en miroir,
 * le déterminant vaut −1 (la matrice contient une symétrie) : l'appelant affiche alors les deux faces.
 * @param samples [{ p: [x,y,z] (centré), u, v }]  points pris loin des pôles et de la couture de la texture
 * @returns {{ m: number[], det: number, rms: number }}  rms = écart moyen (rad) après calage
 */
// Déclare et exporte uvAlignment : reçoit les échantillons.
export function uvAlignment(samples) {
  // Matrice de covariance, à zéro au départ.
  const H = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // Σ t·sᵀ
  // Couples de directions (modèle, moteur).
  const pairs = [];
  // Pour chaque échantillon.
  for (const { p, u, v } of samples) {
    // Longueur du point.
    const l = Math.hypot(p[0], p[1], p[2]);
    // Point nul ou illisible : ignoré.
    if (!(l > 0)) continue;
    // Direction du point dans le modèle.
    const s = [p[0] / l, p[1] / l, p[2] / l];
    // Direction attendue dans le moteur, d'après les coordonnées de texture.
    const t = lonLatToXYZ(...uvToLonLat(u, v));
    // Ajoute le produit des deux directions à la covariance.
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) H[i * 3 + j] += t[i] * s[j];
    // Garde le couple.
    pairs.push([s, t]);
  // Fin du parcours.
  }
  // Part de la covariance.
  let m = H.slice();
  // Itération de Newton, 60 tours au plus.
  for (let k = 0; k < 60; k++) {
    // La transposée de l'inverse.
    const it = inv3T(m);
    // Moyenne de la matrice et de cette transposée.
    const next = m.map((x, i) => (x + it[i]) / 2);
    // Écart avec le tour précédent.
    const diff = next.reduce((a, x, i) => a + Math.abs(x - m[i]), 0);
    // Garde la nouvelle matrice.
    m = next;
    // Écart négligeable : terminé.
    if (diff < 1e-12) break;
  // Fin de l'itération.
  }
  // Somme des carrés des écarts.
  let err = 0;
  // Pour chaque couple.
  for (const [s, t] of pairs) {
    // Direction du modèle, tournée par la matrice.
    const r = [0, 1, 2].map((i) => m[i * 3] * s[0] + m[i * 3 + 1] * s[1] + m[i * 3 + 2] * s[2]);
    // Ajoute le carré de l'angle avec la direction attendue.
    err += Math.acos(Math.max(-1, Math.min(1, r[0] * t[0] + r[1] * t[1] + r[2] * t[2]))) ** 2;
  // Fin du parcours.
  }
  // Renvoie la matrice, son déterminant et l'écart moyen.
  return { m, det: det3(m), rms: Math.sqrt(err / Math.max(1, pairs.length)) };
// Fin de uvAlignment.
}

/** Un échantillon est utilisable s'il est loin des pôles (pincés) et de la couture (u ≈ 0 ou 1). */
// usableUv : vrai loin de la couture (u entre 0,03 et 0,97) et des pôles (v entre 0,15 et 0,85).
export const usableUv = (u, v) => u > 0.03 && u < 0.97 && v > 0.15 && v < 0.85;
