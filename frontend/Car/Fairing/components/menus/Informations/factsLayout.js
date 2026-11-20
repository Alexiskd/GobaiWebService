// Mise en page des tuiles de caractéristiques : calcul pur, sans React, pour être testé sous Node.

/** Au-delà de ces longueurs, une caractéristique prend toute la largeur : sa valeur ou sa note ne tiendrait pas dans une demi-colonne. */
const VALEUR_LONGUE = 20;
const NOTE_LONGUE = 34;

/** Vrai si la caractéristique doit occuper la ligne entière. */
const estLarge = ({ value, note }) => String(value ?? '').length > VALEUR_LONGUE || String(note ?? '').length > NOTE_LONGUE;

/**
 * Pour chaque caractéristique, vrai si sa tuile prend les deux colonnes : parce qu'elle est longue, ou parce
 * qu'elle resterait seule sur sa ligne (suivie d'une tuile longue, ou dernière de la liste).
 */
export function largeurs(items) {
  const out = [];
  // Vrai quand la colonne de gauche de la ligne en cours est déjà prise par une tuile courte.
  let gaucheOccupee = false;
  items.forEach((item, i) => {
    if (estLarge(item)) { out.push(true); gaucheOccupee = false; return; }
    // Tuile courte à droite : elle complète la ligne.
    if (gaucheOccupee) { out.push(false); gaucheOccupee = false; return; }
    // Tuile courte à gauche : seule sur sa ligne si rien de court ne la suit.
    const suivante = items[i + 1];
    const seule = !suivante || estLarge(suivante);
    out.push(seule);
    gaucheOccupee = !seule;
  });
  return out;
}
