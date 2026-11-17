// Modèle radial des anneaux de Saturne, d'après les rayons et épaisseurs optiques mesurés (Voyager, Cassini).
// ρ = distance au centre rapportée au rayon équatorial de Saturne (60 268 km).

// Rayon équatorial de Saturne en kilomètres.
const R_KM = 60268;
// rho : convertit des kilomètres en rayons de Saturne.
const rho = (km) => km / R_KM;

/** Limites du disque modélisé (anneau D → anneau F). */
// Déclare et exporte le bord intérieur du disque : 66 900 km.
export const RING_INNER = rho(66900);
// Déclare et exporte le bord extérieur du disque : 141 000 km.
export const RING_OUTER = rho(141000);

/** Lacunes : [centre km, largeur km]. */
// Table des lacunes (début).
const GAPS = [
  // Centre à 87 491 km, largeur de 270 km.
  [87491, 270],   // lacune de Maxwell (anneau C)
  // Centre à 117 680 km, largeur de 400 km.
  [117680, 400],  // lacune de Huygens (bord interne de la division de Cassini)
  // Centre à 133 589 km, largeur de 325 km.
  [133589, 325],  // lacune d'Encke (anneau A)
  // Centre à 136 505 km, largeur de 42 km.
  [136505, 42],   // lacune de Keeler (anneau A)
// Fin de la table.
];

/**
 * Régions, de l'intérieur vers l'extérieur : [début km, fin km, épaisseur optique τ, relief fin, couleur RVB].
 * τ ≈ 0,1 : anneau ténu et sombre (C, division de Cassini) ; τ > 1 : anneau opaque et brillant (B).
 */
// Table des régions (début).
const REGIONS = [
  // De 66 900 à 74 510 km : τ 0,004, relief 0,2, et sa couleur.
  [66900, 74510, 0.004, 0.2, [0.52, 0.47, 0.42]],   // D : presque invisible
  // De 74 658 à 92 000 km : τ 0,085, relief 0,45, et sa couleur.
  [74658, 92000, 0.085, 0.45, [0.50, 0.44, 0.38]],  // C : « anneau de crêpe », gris-brun
  // De 92 000 à 99 000 km : τ 1,1, relief 0,35, et sa couleur.
  [92000, 99000, 1.1, 0.35, [0.84, 0.75, 0.60]],    // B1
  // De 99 000 à 104 500 km : τ 2,0, relief 0,45, et sa couleur.
  [99000, 104500, 2.0, 0.45, [0.87, 0.78, 0.63]],   // B2
  // De 104 500 à 114 500 km : τ 3,6, relief 0,3, et sa couleur.
  [104500, 114500, 3.6, 0.3, [0.90, 0.82, 0.67]],   // B3 : cœur le plus dense
  // De 114 500 à 117 580 km : τ 2,2, relief 0,35, et sa couleur.
  [114500, 117580, 2.2, 0.35, [0.88, 0.80, 0.66]],  // B4
  // De 117 580 à 122 170 km : τ 0,10, relief 0,5, et sa couleur.
  [117580, 122170, 0.10, 0.5, [0.55, 0.49, 0.43]],  // division de Cassini : ténue, pas vide
  // De 122 170 à 133 400 km : τ 0,62, relief 0,22, et sa couleur.
  [122170, 133400, 0.62, 0.22, [0.82, 0.76, 0.66]], // A interne
  // De 133 400 à 136 775 km : τ 0,75, relief 0,3, et sa couleur.
  [133400, 136775, 0.75, 0.3, [0.80, 0.75, 0.66]],  // A externe (au-delà d'Encke)
  // De 136 775 à 139 900 km : τ 0,001, sans relief, gris.
  [136775, 139900, 0.001, 0, [0.7, 0.7, 0.7]],      // division de Roche
  // De 139 900 à 140 480 km : τ 0,12, relief 0,6, et sa couleur.
  [139900, 140480, 0.12, 0.6, [0.92, 0.90, 0.86]],  // F : fin liseré extérieur
// Fin de la table.
];

/** Bruit déterministe en fonction du rayon : annelets, ondes de densité (plusieurs échelles, de ~3 000 à ~60 km). */
// fineStructure : le relief fin à une distance en kilomètres (début).
function fineStructure(km) {
  // Distance en milliers de kilomètres.
  const x = km / 1000;
  // Renvoie une somme de cinq sinus (début).
  return (
    // Les trois premiers, aux plus grandes échelles, de poids 0,45, 0,3 et 0,25.
    0.45 * Math.sin(x * 2.1 + 1.3) + 0.3 * Math.sin(x * 7.7 + 0.4) + 0.25 * Math.sin(x * 23.9 + 2.2)
    // Les deux derniers, aux plus petites échelles, de poids 0,2 et 0,15.
    + 0.2 * Math.sin(x * 61.3 + 5.1) + 0.15 * Math.sin(x * 104.7 + 0.9)
  // La somme est divisée par 1,35, le total des poids : le résultat reste entre −1 et 1.
  ) / 1.35;
// Fin de fineStructure.
}

// regionAt : la région qui contient une distance en kilomètres.
function regionAt(km) {
  // Parcourt la table et renvoie la première région dont l'intervalle contient la distance.
  for (const r of REGIONS) if (km >= r[0] && km < r[1]) return r;
  // Aucune : null.
  return null;
// Fin de regionAt.
}

/** Épaisseur optique normale τ à la distance ρ (0 hors des anneaux et dans les lacunes). */
// Déclare et exporte ringTau : la distance en rayons de Saturne.
export function ringTau(p) {
  // Distance en kilomètres.
  const km = p * R_KM;
  // Région à cette distance.
  const region = regionAt(km);
  // Hors de toute région : 0.
  if (!region) return 0;
  // Dans une lacune, à moins d'une demi-largeur de son centre : 0.
  for (const [center, width] of GAPS) if (Math.abs(km - center) < width / 2) return 0;
  // Début, fin, épaisseur optique et relief de la région.
  const [start, end, tau, relief] = region;
  // Bords adoucis sur ~80 km : pas de marche nette entre deux régions.
  // Facteur de bord : monte de 0 à 1 sur 80 km depuis chaque limite de la région.
  const edge = Math.min(1, (km - start) / 80, (end - km) / 80);
  // Renvoie τ modulé par le relief fin et multiplié par le facteur de bord, jamais négatif.
  return Math.max(0, tau * (1 + relief * fineStructure(km)) * Math.max(0, edge));
// Fin de ringTau.
}

/** Couleur (albédo RVB, 0–1) des particules à la distance ρ. */
// Déclare et exporte ringAlbedo : la distance en rayons de Saturne.
export function ringAlbedo(p) {
  // Région à cette distance.
  const region = regionAt(p * R_KM);
  // Renvoie sa couleur, ou du noir hors des régions.
  return region ? region[4] : [0, 0, 0];
// Fin de ringAlbedo.
}

/** τ est rangé dans le canal alpha en racine carrée (plus de finesse pour les anneaux ténus) : τ = TAU_MAX · a². */
// Déclare et exporte la plus grande épaisseur optique codée : 4.
export const TAU_MAX = 4;

/**
 * Profil radial pour le shader : `n` texels RVBA de RING_INNER à RING_OUTER (RVB = couleur, A = τ encodé).
 * Chaque texel moyenne plusieurs échantillons, pour que les lacunes étroites (Keeler : 42 km) laissent une trace.
 */
// Déclare et exporte buildRingProfile : le nombre de texels (2048 par défaut) et le nombre d'échantillons par texel (6 par défaut).
export function buildRingProfile(n = 2048, samples = 6) {
  // Tableau de quatre octets par texel.
  const data = new Uint8Array(n * 4);
  // Pour chaque texel (début).
  for (let i = 0; i < n; i++) {
    // Somme des épaisseurs optiques : 0 au départ.
    let tau = 0;
    // Ajoute l'épaisseur optique de chaque échantillon, répartis dans la largeur du texel.
    for (let s = 0; s < samples; s++) tau += ringTau(RING_INNER + ((i + (s + 0.5) / samples) / n) * (RING_OUTER - RING_INNER));
    // Moyenne des échantillons.
    tau /= samples;
    // Couleur au milieu du texel.
    const [r, g, b] = ringAlbedo(RING_INNER + ((i + 0.5) / n) * (RING_OUTER - RING_INNER));
    // Rouge, sur un octet.
    data[i * 4] = Math.round(r * 255);
    // Vert, sur un octet.
    data[i * 4 + 1] = Math.round(g * 255);
    // Bleu, sur un octet.
    data[i * 4 + 2] = Math.round(b * 255);
    // Alpha : la racine carrée de τ / TAU_MAX, plafonnée à 1, sur un octet.
    data[i * 4 + 3] = Math.round(Math.sqrt(Math.min(1, tau / TAU_MAX)) * 255);
  // Fin de la boucle.
  }
  // Renvoie le tableau.
  return data;
// Fin de buildRingProfile.
}
