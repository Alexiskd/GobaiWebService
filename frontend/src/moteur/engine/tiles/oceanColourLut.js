// Fichier produit par scripts/couleur-ocean.py (ne pas modifier à la main) : couleur réelle de l'eau du large
// selon sa chlorophylle, calculée avec ocpy (https://github.com/ocean-colour/ocpy, BSD-3) — voir ce script.

/** Logarithme décimal de la chlorophylle (mg/m³) de la première et de la dernière couleur. */
// Bornes du logarithme de la chlorophylle : de −2 (0,01 mg/m³) à 1,5 (31,6 mg/m³).
export const OCEAN_LOG_CHL = [-2.0, 1.5];
/** Couleurs sRGB [r, g, b], à intervalles réguliers du logarithme de la chlorophylle. */
// Les 64 couleurs.
export const OCEAN_COLOURS = [
  [9, 9, 86], // chlorophylle 0,01 mg/m³
  [8, 10, 85], // chlorophylle 0,0114 mg/m³
  [8, 11, 85], // chlorophylle 0,0129 mg/m³
  [7, 12, 84], // chlorophylle 0,0147 mg/m³
  [7, 13, 83], // chlorophylle 0,0167 mg/m³
  [6, 13, 83], // chlorophylle 0,019 mg/m³
  [6, 14, 82], // chlorophylle 0,0215 mg/m³
  [5, 15, 81], // chlorophylle 0,0245 mg/m³
  [4, 16, 80], // chlorophylle 0,0278 mg/m³
  [4, 17, 80], // chlorophylle 0,0316 mg/m³
  [3, 18, 79], // chlorophylle 0,0359 mg/m³
  [3, 19, 78], // chlorophylle 0,0408 mg/m³
  [2, 20, 77], // chlorophylle 0,0464 mg/m³
  [1, 21, 76], // chlorophylle 0,0527 mg/m³
  [1, 22, 76], // chlorophylle 0,0599 mg/m³
  [0, 22, 75], // chlorophylle 0,0681 mg/m³
  [0, 23, 74], // chlorophylle 0,0774 mg/m³
  [0, 24, 73], // chlorophylle 0,088 mg/m³
  [0, 25, 72], // chlorophylle 0,1 mg/m³
  [0, 26, 71], // chlorophylle 0,114 mg/m³
  [0, 27, 70], // chlorophylle 0,129 mg/m³
  [0, 28, 70], // chlorophylle 0,147 mg/m³
  [0, 29, 69], // chlorophylle 0,167 mg/m³
  [0, 30, 68], // chlorophylle 0,19 mg/m³
  [0, 31, 67], // chlorophylle 0,215 mg/m³
  [0, 32, 66], // chlorophylle 0,245 mg/m³
  [0, 33, 65], // chlorophylle 0,278 mg/m³
  [0, 34, 65], // chlorophylle 0,316 mg/m³
  [0, 35, 64], // chlorophylle 0,359 mg/m³
  [0, 36, 63], // chlorophylle 0,408 mg/m³
  [0, 37, 62], // chlorophylle 0,464 mg/m³
  [0, 38, 61], // chlorophylle 0,527 mg/m³
  [0, 39, 61], // chlorophylle 0,599 mg/m³
  [0, 40, 60], // chlorophylle 0,681 mg/m³
  [0, 41, 59], // chlorophylle 0,774 mg/m³
  [0, 42, 58], // chlorophylle 0,88 mg/m³
  [0, 43, 58], // chlorophylle 1 mg/m³
  [0, 44, 57], // chlorophylle 1,14 mg/m³
  [1, 45, 56], // chlorophylle 1,29 mg/m³
  [2, 46, 56], // chlorophylle 1,47 mg/m³
  [4, 47, 55], // chlorophylle 1,67 mg/m³
  [5, 48, 54], // chlorophylle 1,9 mg/m³
  [7, 49, 54], // chlorophylle 2,15 mg/m³
  [9, 50, 53], // chlorophylle 2,45 mg/m³
  [11, 51, 53], // chlorophylle 2,78 mg/m³
  [13, 52, 52], // chlorophylle 3,16 mg/m³
  [15, 52, 52], // chlorophylle 3,59 mg/m³
  [17, 53, 51], // chlorophylle 4,08 mg/m³
  [19, 53, 51], // chlorophylle 4,64 mg/m³
  [21, 54, 50], // chlorophylle 5,27 mg/m³
  [23, 54, 50], // chlorophylle 5,99 mg/m³
  [25, 55, 49], // chlorophylle 6,81 mg/m³
  [26, 55, 48], // chlorophylle 7,74 mg/m³
  [28, 55, 48], // chlorophylle 8,8 mg/m³
  [30, 55, 47], // chlorophylle 10 mg/m³
  [31, 55, 47], // chlorophylle 11,4 mg/m³
  [33, 55, 46], // chlorophylle 12,9 mg/m³
  [34, 55, 46], // chlorophylle 14,7 mg/m³
  [35, 55, 45], // chlorophylle 16,7 mg/m³
  [36, 54, 45], // chlorophylle 19 mg/m³
  [37, 54, 44], // chlorophylle 21,5 mg/m³
  [38, 53, 44], // chlorophylle 24,5 mg/m³
  [39, 53, 43], // chlorophylle 27,8 mg/m³
  [40, 52, 42], // chlorophylle 31,6 mg/m³
// Fin des couleurs.
];
