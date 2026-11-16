/**
 * Calque des rues de la Terre : règles de dessin, sans accès au navigateur (testées dans roadStyle.test.jsx).
 *
 * Données : tuiles vectorielles OpenFreeMap (OpenStreetMap, schéma OpenMapTiles), couches `transportation` (tracés)
 * et `transportation_name` (noms). Le fournisseur généralise déjà par niveau : seuls les grands axes existent dans
 * les tuiles vues de loin, toutes les rues à partir du niveau 14. Au-delà du niveau 14, la tuile de niveau 14 est
 * redessinée agrandie : les tracés restent nets.
 */

/** Niveau le plus fin des données, et niveaux affichés par le calque. */
// Déclare et exporte le niveau le plus fin des données : 14.
export const ROAD_DATA_MAX_ZOOM = 14;
// Déclare et exporte le premier niveau affiché par le calque : 6.
export const ROAD_MIN_ZOOM = 6;
// Déclare et exporte le dernier niveau affiché : 17.
export const ROAD_MAX_ZOOM = 17;

/**
 * Types de voie et d'infrastructure dessinés, du moins important au plus important (ordre de dessin : les grands
 * axes par-dessus). Feuille de route 3.2 : couleur et opacité sont séparées et suivent une seule échelle.
 *  width    largeur de base, en pixels d'une tuile de 256 px au niveau 14
 *  color    teinte opaque : blanc pour le réseau local, du jaune pâle à l'orange pour les grands axes, gris pour le rail
 *  alpha    opacité, montante avec l'importance de la voie (0,55 → 1)
 *  dash     tirets du tracé (en pixels de 256 px), pour les voies ferrées ; absent = trait plein
 *  minZoom  niveau à partir duquel le tracé est dessiné
 *  nameZoom niveau à partir duquel le nom est écrit
 */
// Déclare et exporte la table des types de voie (début).
export const ROAD_CLASSES = {
  // path, sentier : blanc à 55 %, tracé dès le niveau 15.
  path: { rank: 0, width: 0.8, color: '#ffffff', alpha: 0.55, minZoom: 15, nameZoom: 17 },
  // track, chemin : blanc à 55 %, tracé dès le niveau 15.
  track: { rank: 1, width: 0.8, color: '#ffffff', alpha: 0.55, minZoom: 15, nameZoom: 17 },
  // service, voie de service : blanc à 70 %, tracé dès le niveau 15.
  service: { rank: 2, width: 1.0, color: '#ffffff', alpha: 0.7, minZoom: 15, nameZoom: 16 },
  // minor, rue : blanc à 85 %, tracée dès le niveau 12.
  minor: { rank: 3, width: 1.5, color: '#ffffff', alpha: 0.85, minZoom: 12, nameZoom: 15 },
  // rail, voie ferrée, métro aérien et tram : gris clair en tirets à 90 %, sur la rue et sous les routes, dès le niveau 13.
  rail: { rank: 3.5, width: 1.2, color: '#cfcfcf', alpha: 0.9, dash: [4, 3], minZoom: 13, nameZoom: 16 },
  // tertiary, route tertiaire : blanc à 95 %, tracée dès le niveau 11.
  tertiary: { rank: 4, width: 1.9, color: '#ffffff', alpha: 0.95, minZoom: 11, nameZoom: 13 },
  // secondary, route secondaire : blanc crème opaque, tracée dès le niveau 9.
  secondary: { rank: 5, width: 2.2, color: '#fff4d6', alpha: 1, minZoom: 9, nameZoom: 13 },
  // primary, route principale : jaune pâle opaque, tracée dès le niveau 7.
  primary: { rank: 6, width: 2.6, color: '#fde68a', alpha: 1, minZoom: 7, nameZoom: 12 },
  // trunk, voie rapide : jaune orangé opaque, tracée dès le niveau 5.
  trunk: { rank: 7, width: 3.0, color: '#fbc85c', alpha: 1, minZoom: 5, nameZoom: 10 },
  // motorway, autoroute : orange opaque, tracée dès le niveau 4.
  motorway: { rank: 8, width: 3.4, color: '#f7a440', alpha: 1, minZoom: 4, nameZoom: 10 },
// Fin de la table.
};
// Déclare et exporte la couleur du liseré des routes : noir à 45 %.
export const ROAD_CASING = 'rgba(0,0,0,0.45)';
/** Tunnel : même tracé, plus discret. */
// Déclare et exporte l'opacité d'un tunnel : 0,45.
export const TUNNEL_ALPHA = 0.45;
/** Liseré supplémentaire d'un pont, en pixels de 256 px : le pont se détache de ce qu'il franchit. */
// Déclare et exporte l'épaisseur ajoutée au liseré d'un pont : 1,2 pixel.
export const BRIDGE_CASING = 1.2;

/**
 * Peinture d'un groupe de tracés : opacité du type, réduite pour un tunnel ; liseré élargi pour un pont ; tirets du
 * type (voies ferrées), à l'échelle du canevas `s` (taille / 256).
 */
// Déclare et exporte roadPaint : type de voie, tunnel ou pont, et échelle du canevas.
export function roadPaint(cls, { tunnel = false, bridge = false } = {}, s = 1) {
  // Réglages du type.
  const c = ROAD_CLASSES[cls];
  // Renvoie l'opacité, la largeur ajoutée au liseré et les tirets.
  return {
    // Opacité du type, multipliée par celle des tunnels.
    alpha: (c?.alpha ?? 1) * (tunnel ? TUNNEL_ALPHA : 1),
    // Liseré : 1,3 pixel, plus celui d'un pont.
    casing: (1.3 + (bridge ? BRIDGE_CASING : 0)) * s,
    // Tirets à l'échelle, ou trait plein.
    dash: c?.dash ? c.dash.map((d) => d * s) : [],
  // Fin de la peinture.
  };
// Fin de roadPaint.
}

/** Noms écrits par tuile, au plus. */
// Déclare et exporte le nombre maximal de noms par tuile : 14.
export const MAX_LABELS = 14;

/** Type de voie dessiné pour un objet de la couche `transportation`, ou null (ferry, chantier, piste de course…). */
// Déclare et exporte roadClass : les propriétés de l'objet.
export function roadClass(props) {
  // Sa classe.
  const c = props?.class;
  // Voie de bus : dessinée comme une rue.
  if (c === 'busway' || c === 'bus_guideway') return 'minor';
  // Transports guidés (tram, métro aérien) : dessinés comme une voie ferrée.
  if (c === 'transit') return 'rail';
  // Renvoie la classe si elle est dans la table, sinon null.
  return Object.prototype.hasOwnProperty.call(ROAD_CLASSES, c) ? c : null;
// Fin de roadClass.
}

/** Largeur d'un tracé au niveau affiché `z`, en pixels d'une tuile de 256 px. Fine de loin, élargie en zoomant. */
// Déclare et exporte roadWidth : le type de voie et le niveau affiché.
export function roadWidth(cls, z) {
  // Largeur de base du type, ou 0.
  const base = ROAD_CLASSES[cls]?.width ?? 0;
  // Facteur de finesse : de 0,45 au niveau 5 à 1,125 au niveau 14.
  const far = Math.min(1.125, Math.max(0.45, 0.45 + 0.075 * (Math.min(z, ROAD_DATA_MAX_ZOOM) - 5)));
  // Au-delà des données : la route s'élargit moins vite que la carte (× 1,45 par niveau au lieu de × 2).
  // Renvoie la largeur, multipliée par 1,45 pour chaque niveau au-delà des données.
  return base * far * 1.45 ** Math.max(0, z - ROAD_DATA_MAX_ZOOM);
// Fin de roadWidth.
}

/**
 * Tuile de données qui couvre la tuile affichée (z, x, y), et passage de son repère (0 à `extent`) aux pixels de la
 * tuile affichée (côté `size`) : pixel = coordonnée × scale + offset.
 */
// Déclare et exporte roadTileTransform : la tuile affichée, l'étendue du repère des données et la taille en pixels.
export function roadTileTransform({ z, x, y }, extent, size) {
  // Nombre de niveaux au-delà des données.
  const up = Math.max(0, z - ROAD_DATA_MAX_ZOOM);
  // Rapport de taille correspondant.
  const n = 2 ** up;
  // Tuile de données qui couvre la tuile affichée.
  const data = { z: z - up, x: Math.floor(x / n), y: Math.floor(y / n) };
  // Échelle : pixels par unité du repère des données.
  const scale = (size * n) / extent;
  // Renvoie la tuile de données, l'échelle et les deux décalages en pixels.
  return { data, scale, offsetX: (data.x * n - x) * size, offsetY: (data.y * n - y) * size };
// Fin de roadTileTransform.
}

/** La boîte d'une ligne (repère de la tuile de données) touche-t-elle la tuile affichée, marge comprise ? */
// Déclare et exporte boxVisible : la boîte, la transformation, la taille et la marge.
export function boxVisible(box, t, size, margin) {
  // Vrai si la boîte recouvre la tuile horizontalement, marge comprise,
  return box[2] * t.scale + t.offsetX >= -margin && box[0] * t.scale + t.offsetX <= size + margin
    // et verticalement.
    && box[3] * t.scale + t.offsetY >= -margin && box[1] * t.scale + t.offsetY <= size + margin;
// Fin de boxVisible.
}

/**
 * Portions d'une ligne (pixels, [x0, y0, x1, y1…]) situées dans le carré [min, max]² : liste de lignes.
 * Sert à écrire un nom entièrement dans la tuile (un nom coupé au bord serait tronqué à l'écran).
 */
// Déclare et exporte clipLine : les points de la ligne et les bornes du carré.
export function clipLine(points, min, max) {
  // Liste des portions.
  const runs = [];
  // Portion en cours : aucune.
  let run = null;
  // Pour chaque segment de la ligne (début).
  for (let i = 0; i + 3 < points.length; i += 2) {
    // Son point de départ et son déplacement.
    const x0 = points[i], y0 = points[i + 1], dx = points[i + 2] - x0, dy = points[i + 3] - y0;
    // Liang–Barsky : part [t0, t1] du segment à l'intérieur du carré.
    // Part du segment à garder, de 0 à 1, et indicateur d'intérieur.
    let t0 = 0, t1 = 1, inside = true;
    // Pour chacun des quatre bords du carré (début).
    for (const [p, q] of [[-dx, x0 - min], [dx, max - x0], [-dy, y0 - min], [dy, max - y0]]) {
      // Segment parallèle au bord : dehors s'il est du mauvais côté, sinon bord suivant.
      if (p === 0) { if (q < 0) { inside = false; break; } continue; }
      // Position du croisement avec le bord, le long du segment.
      const r = q / p;
      // Segment entrant : dehors si le croisement est après la fin ; sinon le début est avancé.
      if (p < 0) { if (r > t1) { inside = false; break; } if (r > t0) t0 = r; }
      // Segment sortant : dehors si le croisement est avant le début ; sinon la fin est reculée.
      else { if (r < t0) { inside = false; break; } if (r < t1) t1 = r; }
    // Fin de la boucle des bords.
    }
    // Segment dehors : la portion en cours se termine, segment suivant.
    if (!inside) { run = null; continue; }
    // Les deux bouts de la part gardée.
    const ax = x0 + dx * t0, ay = y0 + dy * t0, bx = x0 + dx * t1, by = y0 + dy * t1;
    // Si une portion est en cours et que le segment n'est pas coupé au début : elle est prolongée.
    if (run && t0 === 0) run.push(bx, by);
    // Sinon : une nouvelle portion commence.
    else { run = [ax, ay, bx, by]; runs.push(run); }
    // Segment coupé à la fin : la portion se termine.
    if (t1 < 1) run = null;
  // Fin de la boucle des segments.
  }
  // Renvoie les portions.
  return runs;
// Fin de clipLine.
}

/** Longueur d'une ligne (pixels). */
// Déclare et exporte lineLength : les points de la ligne.
export function lineLength(points) {
  // Longueur totale : 0 au départ.
  let total = 0;
  // Ajoute la longueur de chaque segment.
  for (let i = 0; i + 3 < points.length; i += 2) total += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
  // Renvoie le total.
  return total;
// Fin de lineLength.
}

/** Point à la distance `d` du début d'une ligne. */
// pointAt : le point d'une ligne à une distance de son début (début).
function pointAt(points, d) {
  // Pour chaque segment (début).
  for (let i = 0; i + 3 < points.length; i += 2) {
    // Sa longueur.
    const len = Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
    // Si la distance tombe dans ce segment, ou si c'est le dernier (début).
    if (d <= len || i + 5 >= points.length) {
      // Position le long du segment, entre 0 et 1.
      const t = len > 0 ? Math.min(1, Math.max(0, d / len)) : 0;
      // Renvoie le point interpolé.
      return [points[i] + (points[i + 2] - points[i]) * t, points[i + 1] + (points[i + 3] - points[i + 1]) * t];
    // Fin de ce cas.
    }
    // Sinon : retire la longueur du segment de la distance.
    d -= len;
  // Fin de la boucle.
  }
  // Ligne sans segment : son premier point.
  return [points[0], points[1]];
// Fin de pointAt.
}

/**
 * Place un nom de largeur `width` (pixels) au milieu d'une ligne : écrit droit, le long de la corde entre ses deux
 * extrémités sur la ligne. Renvoie { x, y, angle } (centre et angle en radians, toujours lisible de gauche à droite),
 * ou null si la ligne est trop courte ou trop courbe à cet endroit (écart à la corde supérieur à `bend` pixels).
 */
// Déclare et exporte placeLabel : les points de la ligne, la largeur du nom et l'écart toléré.
export function placeLabel(points, width, bend) {
  // Longueur de la ligne.
  const total = lineLength(points);
  // Ligne trop courte pour le nom, avec 15 % de marge : null.
  if (total < width * 1.15) return null;
  // Distances de début et de fin du nom, centré sur la ligne.
  const from = (total - width) / 2, to = from + width;
  // Les deux points de la ligne à ces distances.
  const [ax, ay] = pointAt(points, from), [bx, by] = pointAt(points, to);
  // Longueur de la corde entre eux.
  const chord = Math.hypot(bx - ax, by - ay);
  // Corde inférieure à 85 % de la largeur du nom : null.
  if (chord < width * 0.85) return null; // la route fait un coude sous le nom
  // Écart des sommets de la ligne à la corde, entre les deux extrémités du nom.
  // Distance parcourue : 0 au départ.
  let d = 0;
  // Pour chaque segment (début).
  for (let i = 0; i + 3 < points.length; i += 2) {
    // Sa longueur.
    const len = Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
    // Distance à la fin du segment.
    const end = d + len;
    // Si cette fin se trouve sous le nom (début).
    if (end > from && end < to) {
      // Le sommet de la ligne à cet endroit.
      const px = points[i + 2], py = points[i + 3];
      // Sa distance à la corde.
      const off = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / chord;
      // Trop loin de la corde : null.
      if (off > bend) return null;
    // Fin de ce cas.
    }
    // Avance la distance parcourue.
    d = end;
  // Fin de la boucle.
  }
  // Angle de la corde.
  let angle = Math.atan2(by - ay, bx - ax);
  // Ramené entre −90° et 90°, pour que le nom se lise de gauche à droite.
  if (angle > Math.PI / 2) angle -= Math.PI; else if (angle < -Math.PI / 2) angle += Math.PI;
  // Renvoie le milieu de la corde et l'angle.
  return { x: (ax + bx) / 2, y: (ay + by) / 2, angle };
// Fin de placeLabel.
}

/** Cercles qui couvrent un nom posé (pour éviter que deux noms se chevauchent). */
// Déclare et exporte labelCircles : la position du nom, sa largeur et la taille de la police.
export function labelCircles(place, width, font) {
  // Rayon des cercles et leur nombre.
  const r = font * 0.72, n = Math.max(1, Math.ceil(width / (font * 1.1)));
  // Cosinus et sinus de l'angle du nom.
  const cos = Math.cos(place.angle), sin = Math.sin(place.angle);
  // Liste des cercles.
  const out = [];
  // Pour chaque cercle (début).
  for (let i = 0; i < n; i++) {
    // Sa position le long du nom, de part et d'autre du centre.
    const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (width - font);
    // Ajoute le cercle : son centre et son rayon.
    out.push([place.x + cos * t, place.y + sin * t, r]);
  // Fin de la boucle.
  }
  // Renvoie les cercles.
  return out;
// Fin de labelCircles.
}

// Déclare et exporte circlesCollide : deux listes de cercles.
export function circlesCollide(a, b) {
  // Vrai dès qu'un cercle de la première chevauche un cercle de la seconde.
  for (const [ax, ay, ar] of a) for (const [bx, by, br] of b) if ((ax - bx) ** 2 + (ay - by) ** 2 < (ar + br) ** 2) return true;
  // Sinon faux.
  return false;
// Fin de circlesCollide.
}

/** Nom à écrire pour un objet de la couche `transportation_name` : son nom, sinon son numéro (A 6, N 7…). */
// Déclare et exporte roadLabel : les propriétés de l'objet.
export function roadLabel(props) {
  // Son nom, sans espaces autour, ou vide.
  const name = typeof props?.name === 'string' ? props.name.trim() : '';
  // Avec un nom : le nom, ou null s'il dépasse 40 caractères.
  if (name) return name.length > 40 ? null : name;
  // Son numéro, sans espaces autour, ou vide.
  const ref = typeof props?.ref === 'string' ? props.ref.trim() : '';
  // Renvoie le numéro s'il existe et ne dépasse pas 12 caractères, sinon null.
  return ref && ref.length <= 12 ? ref : null;
// Fin de roadLabel.
}

/**
 * Choisit les noms d'une tuile : les voies les plus importantes d'abord, puis les plus longues ; un nom n'est écrit
 * qu'entièrement dans la tuile, sans chevaucher un autre, et pas deux fois de suite pour la même voie.
 *
 * @param {{ label: string, rank: number, points: number[] }[]} candidates  lignes en pixels de la tuile
 * @param {{ size: number, font: number, measure: (text: string) => number, max?: number }} options
 * @returns {{ label: string, x: number, y: number, angle: number }[]}
 */
// Déclare et exporte planLabels : les lignes candidates et les options (taille, police, mesure du texte, nombre maximal).
export function planLabels(candidates, { size, font, measure, max = MAX_LABELS }) {
  // Marge au bord de la tuile : les trois quarts de la taille de la police.
  const pad = font * 0.75;
  // Liste des portions utilisables.
  const runs = [];
  // Pour chaque candidate (début).
  for (const c of candidates) {
    // Pour chacune de ses portions situées dans la tuile, marge déduite (début).
    for (const run of clipLine(c.points, pad, size - pad)) {
      // Sa longueur.
      const length = lineLength(run);
      // Gardée si elle mesure au moins deux fois la taille de la police.
      if (length >= font * 2) runs.push({ label: c.label, rank: c.rank, points: run, length });
    // Fin de la boucle des portions.
    }
  // Fin de la boucle des candidates.
  }
  // Trie les portions : rang le plus élevé d'abord, puis les plus longues.
  runs.sort((a, b) => b.rank - a.rank || b.length - a.length);
  // Noms posés, et largeurs de texte déjà mesurées.
  const placed = [], widths = new Map();
  // Pour chaque portion (début).
  for (const run of runs) {
    // Nombre maximal atteint : arrêt.
    if (placed.length >= max) break;
    // Largeur du nom, si elle est déjà connue.
    let width = widths.get(run.label);
    // Sinon : elle est mesurée et gardée.
    if (width === undefined) { width = measure(run.label); widths.set(run.label, width); }
    // Portion trop courte pour le nom : suivante.
    if (run.length < width * 1.15) continue;
    // Position du nom sur la portion, avec un écart toléré de 30 % de la police.
    const place = placeLabel(run.points, width, font * 0.3);
    // Aucune position : suivante.
    if (!place) continue;
    // Même nom déjà écrit tout près : inutile de le répéter.
    // Même nom déjà posé à moins de 60 % de la taille de la tuile : suivante.
    if (placed.some((p) => p.label === run.label && Math.hypot(p.x - place.x, p.y - place.y) < size * 0.6)) continue;
    // Cercles qui couvrent le nom.
    const circles = labelCircles(place, width, font);
    // Chevauche un nom déjà posé : suivante.
    if (placed.some((p) => circlesCollide(p.circles, circles))) continue;
    // Pose le nom, avec ses cercles.
    placed.push({ label: run.label, ...place, circles });
  // Fin de la boucle.
  }
  // Renvoie les noms posés, sans leurs cercles.
  return placed.map(({ label, x, y, angle }) => ({ label, x, y, angle }));
// Fin de planLabels.
}

// Couleur des littoraux tracés dans la tuile : la même teinte que les littoraux du globe (bordersGeometry.jsx).
export const COAST_COLOR = '#f2efe6';
// Opacité des littoraux tracés dans la tuile : plus discrète que les frontières, comme sur le globe.
export const COAST_ALPHA = 0.6;

/**
 * Vrai si le segment longe un bord de la tuile (même abscisse sur le bord gauche ou droit, même ordonnée sur le haut
 * ou le bas). Ces segments viennent du découpage de la tuile, pas du littoral : on ne les trace pas, sinon une ligne
 * apparaîtrait à chaque bord de tuile.
 */
// Déclare et exporte isEdgeRun : les deux extrémités du segment et l'étendue de la tuile en unités de données.
export function isEdgeRun(x1, y1, x2, y2, extent) {
  // Même abscisse sur un bord vertical, ou même ordonnée sur un bord horizontal.
  return (x1 === x2 && (x1 <= 0 || x1 >= extent)) || (y1 === y2 && (y1 <= 0 || y1 >= extent));
// Fin de isEdgeRun.
}
