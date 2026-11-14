// Importe les ponts nuageux, les intérieurs, les couleurs des couches et les rayons en kilomètres, depuis interiors.
import { CLOUD_DECKS, INTERIORS, LAYER_COLORS, RADIUS_KM } from './interiors';

/**
 * Intérieur d'une géante gazeuse traversé par la caméra (zoom jusqu'au noyau) : coquilles concentriques, du sommet
 * des nuages vers le centre. Les rayons sont en fraction du rayon de l'astre.
 *
 * Les ponts nuageux réels sont très minces (71 km sur 69 911 km pour Jupiter, soit 0,1 % du rayon) : dessinés à
 * l'échelle, ils passeraient en une image. Chaque pont occupe donc CLOUD_VISUAL du rayon dans la scène, et la
 * profondeur affichée est reconvertie en kilomètres réels (depthKmAt).
 */
// Déclare et exporte le rayon du sommet des nuages : 0,998 du rayon de l'astre.
export const CLOUD_TOP = 0.998;    // juste sous la surface cartographiée, pour ne pas se confondre avec elle
// Déclare et exporte l'épaisseur dessinée d'un pont nuageux : 0,03 du rayon.
export const CLOUD_VISUAL = 0.03;  // épaisseur dessinée d'un pont nuageux

/** Coquilles d'un astre, de l'extérieur vers le centre : { name, formula?, kind, color, outer, inner, cloud }. */
// Déclare et exporte gasShells : l'identifiant de l'astre.
export function gasShells(id) {
  // L'intérieur de cet astre.
  const interior = INTERIORS[id];
  // Ses ponts nuageux.
  const clouds = CLOUD_DECKS[id];
  // L'un des deux manque : aucune coquille.
  if (!interior || !clouds) return [];
  // Une coquille par pont nuageux (début).
  const shells = clouds.decks.map((d, i) => ({
    // Reprend les champs du pont, avec la couleur de son type, marquée comme nuage.
    ...d, color: LAYER_COLORS[d.kind], cloud: true,
    // Rayon extérieur et rayon intérieur : des tranches égales sous le sommet des nuages.
    outer: CLOUD_TOP - i * CLOUD_VISUAL, inner: CLOUD_TOP - (i + 1) * CLOUD_VISUAL,
  // Fin des coquilles de nuages.
  }));
  // Plancher des nuages : le rayon intérieur du dernier pont.
  const floor = shells[shells.length - 1].inner;
  // Couches profondes, dans l'ordre inverse de la table.
  const deep = [...interior.layers].reverse();
  // Pour chaque couche profonde (début).
  deep.forEach((l, i) => {
    // Ajoute sa coquille (début).
    shells.push({
      // Nom, type, couleur du type, marquée comme n'étant pas un nuage.
      name: l.name, kind: l.kind, color: LAYER_COLORS[l.kind], cloud: false,
      // Rayon extérieur : le plancher des nuages pour la première, sinon son propre rayon ; rayon intérieur : celui de la couche suivante, ou 0 au centre.
      outer: i ? l.r : floor, inner: deep[i + 1]?.r ?? 0,
    // Fin de la coquille.
    });
  // Fin de la boucle.
  });
  // Renvoie les coquilles.
  return shells;
// Fin de gasShells.
}

/** Coquille où se trouve un point à `frac` rayons du centre ; null au-dessus des nuages. */
// Déclare et exporte shellAt : l'identifiant et la distance au centre, en rayons.
export function shellAt(id, frac) {
  // Au-dessus du sommet des nuages, ou valeur non numérique : null.
  if (!(frac < CLOUD_TOP)) return null;
  // Première coquille dont le rayon intérieur ne dépasse pas ce point, ou null.
  return gasShells(id).find((s) => frac >= s.inner) || null;
// Fin de shellAt.
}

/** Profondeur réelle (km) sous le sommet des nuages pour un point à `frac` rayons du centre dans la scène. */
// Déclare et exporte depthKmAt : l'identifiant et la distance au centre dans la scène.
export function depthKmAt(id, frac) {
  // Les ponts nuageux de l'astre.
  const clouds = CLOUD_DECKS[id];
  // Son rayon en kilomètres.
  const R = RADIUS_KM[id];
  // L'un des deux manque : null.
  if (!clouds || !R) return null;
  // Au sommet des nuages ou au-dessus : profondeur 0.
  if (frac >= CLOUD_TOP) return 0;
  // Plancher des nuages dans la scène.
  const floor = CLOUD_TOP - clouds.decks.length * CLOUD_VISUAL;
  // Dans les nuages : l'épaisseur dessinée couvre les kilomètres réels des trois ponts.
  // Dans les nuages : part de l'épaisseur dessinée parcourue, appliquée à l'épaisseur réelle des ponts.
  if (frac >= floor) return ((CLOUD_TOP - frac) / (CLOUD_TOP - floor)) * clouds.totalKm;
  // Sous les nuages, jusqu'à la première limite profonde : raccord linéaire entre l'échelle dessinée et l'échelle réelle.
  // Les couches profondes de l'astre.
  const layers = INTERIORS[id].layers;
  // Rayon de raccord : celui de l'avant-dernière couche de la table, ou 0 s'il n'y a qu'une couche.
  const join = layers.length > 1 ? layers[layers.length - 2].r : 0;
  // Entre le plancher des nuages et ce rayon (début).
  if (frac >= join) {
    // Profondeur réelle du rayon de raccord, en kilomètres.
    const joinKm = (1 - join) * R;
    // Passe en ligne droite de l'épaisseur réelle des nuages à cette profondeur.
    return clouds.totalKm + ((floor - frac) / (floor - join)) * (joinKm - clouds.totalKm);
  // Fin du raccord.
  }
  // Plus bas : la profondeur réelle, (1 − frac) fois le rayon.
  return (1 - frac) * R;
// Fin de depthKmAt.
}

// Format des nombres en français, avec séparateur des milliers.
const fmt = new Intl.NumberFormat('fr-FR');

/** Texte du HUD à l'intérieur de l'astre (« Hydrogène métallique · ≈ 20 000 km sous le sommet des nuages »), ou null dehors. */
// Déclare et exporte interiorReadout : l'identifiant et la distance au centre.
export function interiorReadout(id, frac) {
  // La coquille où se trouve le point.
  const shell = shellAt(id, frac);
  // Aucune : null.
  if (!shell) return null;
  // La profondeur réelle en kilomètres.
  const km = depthKmAt(id, frac);
  // Arrondie au kilomètre sous 1000 km, à la centaine au-delà.
  const rounded = km < 1000 ? Math.round(km) : Math.round(km / 100) * 100;
  // Renvoie le texte : le nom de la couche, sa formule entre parenthèses s'il y en a une, et la profondeur.
  return `intérieur · ${shell.name}${shell.formula ? ` (${shell.formula})` : ''} · ≈ ${fmt.format(rounded)} km sous le sommet des nuages`;
// Fin de interiorReadout.
}

/**
 * Pas de zoom adouci dans la zone des nuages : un cran de molette y parcourt à peu près un pont au lieu de les
 * sauter tous. `ratio` = distance visée au centre, en rayons.
 */
// Déclare et exporte cloudZoomFactor : l'identifiant, la distance visée en rayons et le facteur de zoom.
export function cloudZoomFactor(id, ratio, f) {
  // Les ponts nuageux de l'astre.
  const clouds = CLOUD_DECKS[id];
  // Aucun : le facteur est rendu tel quel.
  if (!clouds) return f;
  // Plancher des nuages dans la scène.
  const floor = CLOUD_TOP - clouds.decks.length * CLOUD_VISUAL;
  // Entre 99 % du plancher et 1,03 rayon : le facteur est élevé à la puissance 0,35, donc adouci ; sinon inchangé.
  return ratio > floor * 0.99 && ratio < 1.03 ? Math.pow(f, 0.35) : f;
// Fin de cloudZoomFactor.
}
