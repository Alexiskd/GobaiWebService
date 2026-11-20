/**
 * Lecture d'une tuile vectorielle (format Mapbox Vector Tile, protobuf), sans dépendance : seules les couches et les
 * propriétés demandées sont décodées, le reste du fichier est sauté sans être lu.
 *
 * Une tuile contient des couches ; une couche, des objets (points, lignes, surfaces) décrits dans un repère entier de
 * 0 à `extent` (4096 en général) dont l'origine est le coin haut-gauche de la tuile. Les lignes peuvent dépasser un
 * peu de la tuile (marge prévue par le fournisseur).
 */

// Type de géométrie « ligne » dans le format des tuiles vectorielles : 2.
const TYPE_LINE = 2;
// Type de géométrie « polygone » (surfaces : mer, lacs), lu comme des anneaux fermés.
const TYPE_POLYGON = 3;

/** Lecteur d'octets protobuf (entiers à longueur variable, champs préfixés par leur longueur). */
// Classe Reader (début).
export class Reader {
  // Constructeur : les octets, la position de départ et la position de fin, qu'il garde.
  constructor(bytes, pos = 0, end = bytes.length) { this.b = bytes; this.pos = pos; this.end = end; }

  // varint : lit un entier à longueur variable (début).
  varint() {
    // Résultat, décalage en bits et octet lu.
    let result = 0, shift = 0, byte;
    // Répète (début).
    do {
      // Fin des données atteinte : erreur.
      if (this.pos >= this.end) throw new Error('tuile vectorielle tronquée');
      // Lit un octet et avance.
      byte = this.b[this.pos++];
      // Au-delà de 28 bits les opérateurs binaires débordent : on passe par une multiplication.
      // Ajoute ses sept bits utiles, par décalage sous 28 bits, par multiplication au-delà.
      result += shift < 28 ? (byte & 0x7f) << shift : (byte & 0x7f) * 2 ** shift;
      // Sept bits de plus pour l'octet suivant.
      shift += 7;
    // Tant que le bit de poids fort de l'octet indique une suite.
    } while (byte >= 0x80);
    // Renvoie l'entier.
    return result;
  // Fin de varint.
  }

  /** Saute un champ de type `wire` (0 entier, 1 64 bits, 2 longueur + contenu, 5 32 bits). */
  // skip : saute un champ selon son type (début).
  skip(wire) {
    // Type 0 : lit l'entier sans le garder.
    if (wire === 0) this.varint();
    // Type 1 : avance de 8 octets.
    else if (wire === 1) this.pos += 8;
    // Type 2 : avance de la longueur lue.
    else if (wire === 2) this.pos += this.varint();
    // Type 5 : avance de 4 octets.
    else if (wire === 5) this.pos += 4;
    // Autre type : erreur.
    else throw new Error('tuile vectorielle illisible');
    // Position au-delà de la fin : erreur.
    if (this.pos > this.end) throw new Error('tuile vectorielle tronquée');
  // Fin de skip.
  }

  /** Lecteur limité au champ à longueur préfixée qui commence ici ; ce lecteur-ci passe à la suite. */
  // sub : lecteur limité au champ qui commence ici (début).
  sub() {
    // Longueur du champ.
    const length = this.varint();
    // Lecteur sur cette partie des octets.
    const r = new Reader(this.b, this.pos, this.pos + length);
    // Ce lecteur-ci avance après le champ.
    this.pos += length;
    // Position au-delà de la fin : erreur.
    if (this.pos > this.end) throw new Error('tuile vectorielle tronquée');
    // Renvoie le lecteur du champ.
    return r;
  // Fin de sub.
  }
// Fin de la classe Reader.
}

// Décodeur de texte UTF-8, s'il existe dans l'environnement.
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
// text : le contenu d'un lecteur sous forme de texte, par le décodeur ou caractère par caractère.
const text = (r) => (decoder ? decoder.decode(r.b.subarray(r.pos, r.end)) : String.fromCharCode(...r.b.subarray(r.pos, r.end)));
// zigzag : décode un entier signé écrit en zigzag.
const zigzag = (n) => (n >>> 1) ^ -(n & 1);

/** Valeur d'une propriété (chaîne, nombre ou booléen). */
// readValue : lit la valeur d'une propriété (début).
function readValue(r) {
  // Valeur : null au départ.
  let value = null;
  // Tant qu'il reste des octets (début).
  while (r.pos < r.end) {
    // Étiquette du champ, son numéro et son type.
    const tag = r.varint(), field = tag >> 3, wire = tag & 7;
    // Champ 1 : une chaîne.
    if (field === 1 && wire === 2) value = text(r.sub());
    // Champ 2 : un nombre flottant sur 32 bits, puis avance de 4 octets.
    else if (field === 2 && wire === 5) { value = new DataView(r.b.buffer, r.b.byteOffset + r.pos, 4).getFloat32(0, true); r.pos += 4; }
    // Champ 3 : un nombre flottant sur 64 bits, puis avance de 8 octets.
    else if (field === 3 && wire === 1) { value = new DataView(r.b.buffer, r.b.byteOffset + r.pos, 8).getFloat64(0, true); r.pos += 8; }
    // Champs 4 et 5 : un entier.
    else if ((field === 4 || field === 5) && wire === 0) value = r.varint();
    // Champ 6 : un entier signé en zigzag.
    else if (field === 6 && wire === 0) value = zigzag(r.varint());
    // Champ 7 : un booléen.
    else if (field === 7 && wire === 0) value = r.varint() !== 0;
    // Autre champ : sauté.
    else r.skip(wire);
  // Fin de la boucle.
  }
  // Renvoie la valeur.
  return value;
// Fin de readValue.
}

/**
 * Lignes d'une géométrie (suite de commandes : 1 = aller à, 2 = tracer jusqu'à, 7 = fermer), en coordonnées de la tuile.
 * Renvoie une liste de lignes : { points: Int32Array [x0, y0, x1, y1…], box: [minX, minY, maxX, maxY] }.
 */
// readLines : lit les lignes d'une géométrie (début).
export function readLines(r, closed = false) {
  // Liste des lignes.
  const lines = [];
  // Position courante et ligne en cours.
  let x = 0, y = 0, current = null;
  // close : termine la ligne en cours (début).
  const close = () => {
    // Si elle a au moins deux points (début).
    if (current && current.length >= 4) {
      // Ses points dans un tableau d'entiers.
      const points = Int32Array.from(current);
      // Limites de sa boîte englobante, à calculer.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      // Pour chaque point (début).
      for (let i = 0; i < points.length; i += 2) {
        // Plus petit x.
        if (points[i] < minX) minX = points[i];
        // Plus grand x.
        if (points[i] > maxX) maxX = points[i];
        // Plus petit y.
        if (points[i + 1] < minY) minY = points[i + 1];
        // Plus grand y.
        if (points[i + 1] > maxY) maxY = points[i + 1];
      // Fin de la boucle.
      }
      // Ajoute la ligne et sa boîte.
      lines.push({ points, box: [minX, minY, maxX, maxY] });
    // Fin de ce cas.
    }
    // Plus de ligne en cours.
    current = null;
  // Fin de close.
  };
  // Tant qu'il reste des octets (début).
  while (r.pos < r.end) {
    // Commande et son numéro.
    const command = r.varint(), id = command & 7;
    // Nombre de répétitions de la commande.
    let count = command >> 3;
    // Commande 1, aller à (début).
    if (id === 1) {
      // Pour chaque répétition : termine la ligne en cours, avance la position et commence une nouvelle ligne.
      for (; count > 0; count--) { close(); x += zigzag(r.varint()); y += zigzag(r.varint()); current = [x, y]; }
    // Commande 2, tracer jusqu'à (début).
    } else if (id === 2) {
      // Pour chaque répétition : avance la position et ajoute le point à la ligne en cours.
      for (; count > 0; count--) { x += zigzag(r.varint()); y += zigzag(r.varint()); current?.push(x, y); }
    // Commande 7, fermer (début).
    } else if (id === 7) {
      // Fermeture d'un anneau (polygone) : le contour revient à son premier point.
      if (closed && current && current.length >= 4) current.push(current[0], current[1]);
    // Toute autre commande (début).
    } else {
      // Erreur.
      throw new Error('géométrie de tuile vectorielle illisible');
    // Fin du choix de la commande.
    }
  // Fin de la boucle.
  }
  // Termine la dernière ligne.
  close();
  // Renvoie les lignes.
  return lines;
// Fin de readLines.
}

// readLayer : lit une couche, avec la liste des propriétés à garder (début).
function readLayer(r, keysWanted) {
  // Clés, valeurs et objets bruts de la couche.
  const keys = [], values = [], raw = [];
  // Nom de la couche et étendue de son repère, 4096 par défaut.
  let name = '', extent = 4096;
  // Premier passage : nom, clés et valeurs (les objets, placés avant dans le fichier, en ont besoin pour être lus).
  // Tant qu'il reste des octets (début).
  while (r.pos < r.end) {
    // Étiquette du champ, son numéro et son type.
    const tag = r.varint(), field = tag >> 3, wire = tag & 7;
    // Champ 1 : le nom.
    if (field === 1 && wire === 2) name = text(r.sub());
    // Champ 2 : un objet, gardé brut.
    else if (field === 2 && wire === 2) raw.push(r.sub());
    // Champ 3 : une clé.
    else if (field === 3 && wire === 2) keys.push(text(r.sub()));
    // Champ 4 : une valeur, gardée brute.
    else if (field === 4 && wire === 2) values.push(r.sub()); // décodée seulement si un objet gardé s'en sert
    // Champ 5 : l'étendue.
    else if (field === 5 && wire === 0) extent = r.varint();
    // Autre champ : sauté.
    else r.skip(wire);
  // Fin de la boucle.
  }
  // Pour chaque clé : vrai si elle est demandée, ou si toutes le sont.
  const wanted = keys.map((k) => !keysWanted || keysWanted.includes(k));
  // Tableau des valeurs déjà décodées.
  const decoded = new Array(values.length);
  // valueAt : valeur d'un indice, décodée à la première demande puis gardée.
  const valueAt = (i) => (i in decoded ? decoded[i] : (decoded[i] = values[i] ? readValue(values[i]) : null));
  // Liste des objets retenus.
  const features = [];
  // Pour chaque objet brut (début).
  for (const f of raw) {
    // Son type, ses propriétés et sa géométrie.
    let type = 0, tags = null, geometry = null;
    // Tant qu'il reste des octets dans l'objet (début).
    while (f.pos < f.end) {
      // Étiquette du champ, son numéro et son type.
      const tag = f.varint(), field = tag >> 3, wire = tag & 7;
      // Champ 2 : les propriétés.
      if (field === 2 && wire === 2) tags = f.sub();
      // Champ 3 : le type.
      else if (field === 3 && wire === 0) type = f.varint();
      // Champ 4 : la géométrie.
      else if (field === 4 && wire === 2) geometry = f.sub();
      // Autre champ : sauté.
      else f.skip(wire);
    // Fin de la boucle.
    }
    // Ni ligne ni polygone, ou pas de géométrie : objet ignoré.
    if ((type !== TYPE_LINE && type !== TYPE_POLYGON) || !geometry) continue; // lignes (routes, cours d'eau) et contours des surfaces (littoraux) ; points ignorés
    // Propriétés gardées.
    const props = {};
    // S'il a des propriétés (début).
    if (tags) {
      // Tant qu'il en reste (début).
      while (tags.pos < tags.end) {
        // Indice de la clé et indice de la valeur.
        const k = tags.varint(), v = tags.varint();
        // Si la clé est demandée : garde la propriété.
        if (wanted[k]) props[keys[k]] = valueAt(v);
      // Fin de la boucle.
      }
    // Fin de ce cas.
    }
    // Lignes de la géométrie.
    const lines = readLines(geometry, type === TYPE_POLYGON);
    // S'il y en a : garde l'objet.
    if (lines.length) features.push({ props, lines });
  // Fin de la boucle des objets.
  }
  // Renvoie le nom, l'étendue et les objets.
  return { name, extent, features };
// Fin de readLayer.
}

/**
 * Décode les lignes d'une tuile vectorielle.
 * @param {Uint8Array} bytes  fichier de la tuile (non compressé)
 * @param {Record<string, string[] | null>} layers  couches à lire → propriétés à garder (null = toutes)
 * @returns {Record<string, { extent: number, features: { props: object, lines: { points: Int32Array, box: number[] }[] }[] }>}
 */
// Déclare et exporte decodeLines : les octets de la tuile et les couches à lire.
export function decodeLines(bytes, layers) {
  // Résultat.
  const out = {};
  // Lecteur de la tuile.
  const r = new Reader(bytes);
  // Tant qu'il reste des octets (début).
  while (r.pos < r.end) {
    // Étiquette du champ, son numéro et son type.
    const tag = r.varint(), field = tag >> 3, wire = tag & 7;
    // Ce n'est pas une couche : champ sauté.
    if (field !== 3 || wire !== 2) { r.skip(wire); continue; }
    // Lecteur de la couche.
    const layer = r.sub();
    // Nom de la couche lu d'abord : une couche non demandée est sautée sans décoder ses objets.
    // Second lecteur sur la même couche, pour lire son nom d'abord.
    const peek = new Reader(layer.b, layer.pos, layer.end);
    // Nom : inconnu au départ.
    let name = null;
    // Tant qu'il reste des octets et que le nom n'est pas trouvé (début).
    while (peek.pos < peek.end && name === null) {
      // Étiquette du champ, son numéro et son type.
      const t = peek.varint(), f = t >> 3, w = t & 7;
      // Champ 1 : le nom ; autre champ : sauté.
      if (f === 1 && w === 2) name = text(peek.sub()); else peek.skip(w);
    // Fin de la boucle.
    }
    // Couche sans nom ou non demandée : ignorée.
    if (name === null || !(name in layers)) continue;
    // Lit la couche avec les propriétés demandées.
    const read = readLayer(layer, layers[name]);
    // Range son étendue et ses objets sous son nom.
    out[name] = { extent: read.extent, features: read.features };
  // Fin de la boucle.
  }
  // Renvoie le résultat.
  return out;
// Fin de decodeLines.
}

/** Le fichier est-il compressé en gzip (le navigateur le décompresse d'ordinaire lui-même) ? */
// Déclare et exporte isGzip : vrai si le fichier commence par les deux octets de la signature gzip.
export const isGzip = (bytes) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
