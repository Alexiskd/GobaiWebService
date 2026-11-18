// Conversion de l'attitude de la caméra du moteur (engine.navballAttitude) en cap / tangage / roulis pour la navball.

// Facteur de conversion des radians en degrés.
const R2D = 180 / Math.PI;

/**
 * Cap, tangage et roulis de la caméra dans le repère local du point survolé (nord de l'astre, ou du système sur le
 * Soleil), à partir de engine.navballAttitude() : lignes droite / haut / avant, colonnes est / haut local / sud.
 */
// Déclare et exporte attitudeFrom : reçoit la matrice d'attitude du moteur, à plat (9 nombres).
export function attitudeFrom(m) {
  // toNEU : relit une ligne de la matrice dans le repère (nord, est, haut).
  const toNEU = (row) => [-m[row * 3 + 2], m[row * 3], m[row * 3 + 1]]; // (est, haut, sud) → (nord, est, haut)
  // Les trois axes de la caméra dans ce repère : droite, haut et avant.
  const right = toNEU(0), up = toNEU(1), fwd = toNEU(2);
  // Tangage, en degrés : l'arc sinus de la composante verticale du regard, bornée entre -1 et 1.
  const p = Math.asin(Math.max(-1, Math.min(1, fwd[2]))) * R2D;
  // Regard presque vertical (vue de dessus) : le cap se lit sur le haut de l'image.
  // Cap, en degrés : la direction horizontale du regard, ou celle du haut de l'image si le regard est presque vertical.
  const h = Math.hypot(fwd[0], fwd[1]) > 0.05 ? Math.atan2(fwd[1], fwd[0]) * R2D : Math.atan2(up[1], up[0]) * R2D;
  // Cosinus et sinus du cap et du tangage.
  const ch = Math.cos(h / R2D), sh = Math.sin(h / R2D), cp = Math.cos(p / R2D), sp = Math.sin(p / R2D);
  // Axes de référence sans roulis : la droite r0 et le haut u0.
  const r0 = [-sh, ch, 0], u0 = [-sp * ch, -sp * sh, cp];
  // d : produit scalaire de deux vecteurs.
  const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Roulis, en degrés : l'angle entre la droite réelle et la droite de référence.
  const r = Math.atan2(-d(right, u0), d(right, r0)) * R2D;
  // Renvoie le cap, le tangage et le roulis.
  return { h, p, r };
// Fin de attitudeFrom.
}

/**
 * Cap / tangage / roulis de la navball à partir d'une base { f, r } en coordonnées [N, E, U] (f = face visible au
 * centre de la boule, r = droite de l'écran) : inverse exact de basis() du moteur de rendu de la Navball.
 */
// Déclare et exporte attitudeFromBasis : reçoit la face visible f et la droite de l'écran (renommée right).
export function attitudeFromBasis({ f, r: right }) {
  // Tangage, en degrés : l'arc sinus de la composante verticale de f, bornée entre -1 et 1.
  const p = Math.asin(Math.max(-1, Math.min(1, f[2]))) * R2D;
  // Cap, en degrés : la direction horizontale de f.
  const h = Math.atan2(f[1], f[0]) * R2D;
  // Cosinus et sinus du cap et du tangage.
  const ch = Math.cos(h / R2D), sh = Math.sin(h / R2D), cp = Math.cos(p / R2D), sp = Math.sin(p / R2D);
  // Axes de référence sans roulis : la droite r0 et le haut u0.
  const r0 = [-sh, ch, 0], u0 = [-sp * ch, -sp * sh, cp];
  // d : produit scalaire de deux vecteurs.
  const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Renvoie le cap, le tangage et le roulis (angle entre la droite réelle et la droite de référence).
  return { h, p, r: Math.atan2(-d(right, u0), d(right, r0)) * R2D };
// Fin de attitudeFromBasis.
}
