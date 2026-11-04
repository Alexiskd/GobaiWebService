// Calage d'un modèle 3D de la Lune sur le repère sélénographique du moteur, à partir de ses seules coordonnées de
// texture : sur une carte 2:1 équirectangulaire centrée sur 0°, u donne la longitude et v la latitude. Fonctions pures.
import { lonLatToXYZ } from './tiles/mercator.js';

/** uv glTF (origine en haut à gauche) → [longitude, latitude] en degrés, carte centrée sur 0°. */
export const uvToLonLat = (u, v) => [(u - 0.5) * 360, (0.5 - v) * 180];

const det3 = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
function inv3T(m) { // (m⁻¹)ᵀ
  const d = det3(m);
  return [
    (m[4] * m[8] - m[5] * m[7]) / d, -(m[3] * m[8] - m[5] * m[6]) / d, (m[3] * m[7] - m[4] * m[6]) / d,
    -(m[1] * m[8] - m[2] * m[7]) / d, (m[0] * m[8] - m[2] * m[6]) / d, -(m[0] * m[7] - m[1] * m[6]) / d,
    (m[1] * m[5] - m[2] * m[4]) / d, -(m[0] * m[5] - m[2] * m[3]) / d, (m[0] * m[4] - m[1] * m[3]) / d,
  ];
}

/**
 * Matrice orthogonale (3×3, lignes) qui envoie les directions du modèle sur celles du moteur, au sens des moindres
 * carrés (problème de Wahba : décomposition polaire de la covariance, itération de Newton). Si les uv sont en miroir,
 * le déterminant vaut −1 (la matrice contient une symétrie) : l'appelant affiche alors les deux faces.
 * @param samples [{ p: [x,y,z] (centré), u, v }]  points pris loin des pôles et de la couture de la texture
 * @returns {{ m: number[], det: number, rms: number }}  rms = écart moyen (rad) après calage
 */
export function uvAlignment(samples) {
  const H = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // Σ t·sᵀ
  const pairs = [];
  for (const { p, u, v } of samples) {
    const l = Math.hypot(p[0], p[1], p[2]);
    if (!(l > 0)) continue;
    const s = [p[0] / l, p[1] / l, p[2] / l];
    const t = lonLatToXYZ(...uvToLonLat(u, v));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) H[i * 3 + j] += t[i] * s[j];
    pairs.push([s, t]);
  }
  let m = H.slice();
  for (let k = 0; k < 60; k++) {
    const it = inv3T(m);
    const next = m.map((x, i) => (x + it[i]) / 2);
    const diff = next.reduce((a, x, i) => a + Math.abs(x - m[i]), 0);
    m = next;
    if (diff < 1e-12) break;
  }
  let err = 0;
  for (const [s, t] of pairs) {
    const r = [0, 1, 2].map((i) => m[i * 3] * s[0] + m[i * 3 + 1] * s[1] + m[i * 3 + 2] * s[2]);
    err += Math.acos(Math.max(-1, Math.min(1, r[0] * t[0] + r[1] * t[1] + r[2] * t[2]))) ** 2;
  }
  return { m, det: det3(m), rms: Math.sqrt(err / Math.max(1, pairs.length)) };
}

/** Un échantillon est utilisable s'il est loin des pôles (pincés) et de la couture (u ≈ 0 ou 1). */
export const usableUv = (u, v) => u > 0.03 && u < 0.97 && v > 0.15 && v < 0.85;
