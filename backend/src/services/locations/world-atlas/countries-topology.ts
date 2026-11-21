// Types (effacés à la compilation) d'une géométrie et d'un document TopoJSON.
import type { TopoGeometry, Topology } from './topology';

/* -------------------------------------------------------------------------------------------------
 * Fabrique le TopoJSON des pays (objet `countries`) à partir du GeoJSON Natural Earth des pays au 1:50m.
 *
 * Même recette que le script `prepublish` du dépôt topojson/world-atlas 2.0.2 (copié dans
 * backend/data/vendor/world-atlas/) : identifiant = ISO_N3 (Norvège forcée à 578), propriété `name` = NAME,
 * coordonnées quantifiées sur 1e5 pas, arcs partagés entre pays voisins. Écrit sans dépendance (le paquet npm
 * world-atlas contient le fichier tout fait, mais le dépôt GitHub ne le contient pas : il est produit à la publication).
 * Différences avec le paquet npm : pas d'objet `land`, pas de recollage à l'antiméridien (geostitch) ; le service des
 * frontières retire lui-même les découpes à ±180° (borders.service.ts, isMapEdge).
 * ----------------------------------------------------------------------------------------------- */

/** Pas de quantification, comme `geo2topo -q 1e5`. */
// Nombre de pas de la grille de quantification : 100 000 sur chaque axe.
const Q = 100_000;

// Type Position : une longitude et une latitude.
type Position = [number, number];

// Forme d'un pays dans le GeoJSON.
export interface CountryFeature {
  // properties : ses propriétés (codes, nom), ou null.
  properties: Record<string, unknown> | null;
  // geometry : sa géométrie (type et coordonnées), ou null.
  geometry: { type: string; coordinates?: unknown } | null;
// Fin de CountryFeature.
}

// Forme de la topologie produite : un document TopoJSON où deux champs sont toujours présents.
export interface CountriesTopology extends Topology {
  // transform : l'échelle et le décalage.
  transform: { scale: [number, number]; translate: [number, number] };
  // bbox : l'emprise.
  bbox: [number, number, number, number];
// Fin de CountriesTopology.
}

// Forme du résultat de la fabrication.
export interface CountriesBuild {
  // topology : le document.
  topology: CountriesTopology;
  // stats : le nombre de pays, d'anneaux, d'arcs et de jonctions.
  stats: { countries: number; rings: number; arcs: number; junctions: number };
// Fin de CountriesBuild.
}

/** Polygones d'une géométrie GeoJSON (les autres types n'en ont pas). */
// Fonction polygons : rend les polygones d'une géométrie.
function polygons(geometry: CountryFeature['geometry']): Position[][][] {
  // Polygon : un seul polygone.
  if (geometry?.type === 'Polygon') return [geometry.coordinates as Position[][]];
  // MultiPolygon : la liste de ses polygones.
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates as Position[][][];
  // Autre type ou géométrie absente : aucun.
  return [];
// Fin de polygons.
}

/** Arrondi au plus proche, les demis vers l'entier pair (comme la recette d'origine). */
// Fonction roundHalfEven : arrondi au plus proche.
function roundHalfEven(v: number): number {
  // Entier juste en dessous.
  const floor = Math.floor(v);
  // Partie décimale.
  const diff = v - floor;
  // Sous 0,5 : on arrondit vers le bas.
  if (diff < 0.5) return floor;
  // Au-dessus de 0,5 : vers le haut.
  if (diff > 0.5) return floor + 1;
  // Exactement 0,5 : vers l'entier pair.
  return floor % 2 === 0 ? floor : floor + 1;
// Fin de roundHalfEven.
}

/** Sens inverse d'un arc déjà enregistré (`~i`, convention TopoJSON). */
// Fonction reversed : numéro d'un arc parcouru à l'envers, soit −n − 1 (opérateur ~).
const reversed = (i: number) => ~i;

/**
 * Topologie des pays. Un point quantifié (x, y) est représenté par l'entier `x * Q + y` : l'ordre des entiers est
 * l'ordre (x, y), et un point sert directement de clé.
 */
// Fonction buildCountriesTopology : reçoit les pays du GeoJSON.
export function buildCountriesTopology(features: CountryFeature[]): CountriesBuild {
  // Emprise de tous les points, vide au départ.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  // Pour chaque pays,
  for (const f of features) {
    // chacun de ses polygones,
    for (const poly of polygons(f.geometry)) {
      // chacun de leurs anneaux,
      for (const ring of poly) {
        // et chacun de leurs points :
        for (const [x, y] of ring) {
          // nouvelle longitude minimale ;
          if (x < x0) x0 = x;
          // nouvelle longitude maximale ;
          if (x > x1) x1 = x;
          // nouvelle latitude minimale ;
          if (y < y0) y0 = y;
          // nouvelle latitude maximale.
          if (y > y1) y1 = y;
        // Fin de la boucle des points.
        }
      // Fin de la boucle des anneaux.
      }
    // Fin de la boucle des polygones.
    }
  // Fin de la boucle des pays.
  }
  // Aucun point : erreur.
  if (x0 === Infinity) throw new Error('GeoJSON des pays : aucun polygone.');
  // Taille d'un pas de la grille, en degrés, sur chaque axe.
  const kx = (x1 - x0) / (Q - 1), ky = (y1 - y0) / (Q - 1);

  /** Anneau quantifié, ouvert (le dernier point ne répète pas le premier), sans points consécutifs identiques. */
  // Fonction quantize : place un anneau sur la grille.
  const quantize = (ring: Position[]): number[] => {
    // Points produits.
    const out: number[] = [];
    // Pour chaque point :
    for (const [x, y] of ring) {
      // sa colonne et sa ligne sur la grille, réunies en un seul entier (colonne × 100 000 + ligne) ;
      const p = roundHalfEven((x - x0) / kx) * Q + roundHalfEven((y - y0) / ky);
      // ajouté s'il diffère du précédent.
      if (out[out.length - 1] !== p) out.push(p);
    // Fin de la boucle.
    }
    // Si le dernier point répète le premier, on le retire : l'anneau est gardé ouvert.
    if (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
    // Renvoie l'anneau.
    return out;
  // Fin de quantize.
  };

  // 1. Anneaux quantifiés de chaque pays ; les anneaux réduits à moins de trois points sont abandonnés
  //    (un contour extérieur abandonné emporte tout son polygone).
  // Tous les anneaux, à la suite.
  const rings: number[][] = [];
  // Pour chaque pays : ses propriétés et ses polygones, chacun étant la liste des numéros de ses anneaux.
  const countries: { properties: Record<string, unknown>; polys: number[][] }[] = [];
  // Pour chaque pays :
  for (const f of features) {
    // ses polygones.
    const polys: number[][] = [];
    // Pour chaque polygone :
    for (const poly of polygons(f.geometry)) {
      // les numéros de ses anneaux.
      let ids: number[] = [];
      // Pour chaque anneau, l'extérieur d'abord (k = 0) :
      for (let k = 0; k < poly.length; k++) {
        // on le place sur la grille ;
        const q = quantize(poly[k]);
        // s'il lui reste moins de trois points :
        if (q.length < 3) {
          // si c'est l'anneau extérieur,
          if (k === 0) {
            // tout le polygone est abandonné,
            ids = [];
            // et on quitte la boucle ;
            break;
          // fin du cas ;
          }
          // si c'est un trou, on l'ignore seulement.
          continue;
        // Fin du cas.
        }
        // Sinon on note son numéro,
        ids.push(rings.length);
        // et on le range.
        rings.push(q);
      // Fin de la boucle des anneaux.
      }
      // Polygone gardé s'il a au moins un anneau.
      if (ids.length) polys.push(ids);
    // Fin de la boucle des polygones.
    }
    // Range le pays (propriétés vides si elles manquent).
    countries.push({ properties: f.properties ?? {}, polys });
  // Fin de la boucle des pays.
  }

  // 2. Jonctions : points dont les deux voisins ne sont pas les mêmes d'un anneau à l'autre.
  // Pour chaque point : ses deux voisins, tels que vus la première fois.
  const neighbours = new Map<number, string>();
  // Points de jonction.
  const junctions = new Set<number>();
  // Pour chaque anneau :
  for (const ring of rings) {
    // son nombre de points ;
    const n = ring.length;
    // pour chaque point :
    for (let i = 0; i < n; i++) {
      // son voisin d'avant et son voisin d'après (l'anneau boucle) ;
      const a = ring[(i + n - 1) % n], b = ring[(i + 1) % n];
      // les deux voisins écrits dans un ordre fixe, pour qu'un parcours à l'envers donne le même texte ;
      const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
      // voisins déjà notés pour ce point ;
      const seen = neighbours.get(ring[i]);
      // première visite : on les note ;
      if (seen === undefined) neighbours.set(ring[i], pair);
      // voisins différents : le point est une jonction, plusieurs frontières s'y rencontrent.
      else if (seen !== pair) junctions.add(ring[i]);
    // Fin de la boucle des points.
    }
  // Fin de la boucle des anneaux.
  }

  // 3. Découpe des anneaux aux jonctions, arcs identiques (dans un sens ou l'autre) enregistrés une seule fois.
  // Arcs enregistrés.
  const arcs: number[][] = [];
  // Index texte de l'arc → son numéro.
  const index = new Map<string, number>();

  // Fonction openArc : enregistre un arc qui va d'une jonction à la suivante.
  const openArc = (points: number[]): number => {
    // Sa clé : ses points joints par des virgules.
    const key = points.join(',');
    // Arc déjà connu dans ce sens ?
    const known = index.get(key);
    // Oui : son numéro.
    if (known !== undefined) return known;
    // Déjà connu dans l'autre sens ?
    const back = index.get([...points].reverse().join(','));
    // Oui : son numéro inversé.
    if (back !== undefined) return reversed(back);
    // Sinon on l'indexe,
    index.set(key, arcs.length);
    // on l'enregistre,
    arcs.push(points);
    // et on rend son numéro.
    return arcs.length - 1;
  // Fin de openArc.
  };

  /** Anneau sans jonction : comparé à une rotation et à un sens près (enclaves : Lesotho, Saint-Marin…). */
  // Fonction closedArc : enregistre un anneau sans jonction, en un seul arc fermé.
  const closedArc = (ring: number[]): number => {
    // Fonction canon : fait commencer l'anneau à son plus petit point.
    const canon = (points: number[]) => {
      // Position du plus petit point.
      let i = 0;
      // La cherche.
      for (let k = 1; k < points.length; k++) if (points[k] < points[i]) i = k;
      // Fait tourner l'anneau pour commencer là.
      return [...points.slice(i), ...points.slice(0, i)];
    // Fin de canon.
    };
    // Forme de référence de l'anneau.
    const forward = canon(ring);
    // Sa clé, préfixée par « ring: » pour ne pas la confondre avec un arc ouvert.
    const forwardKey = `ring:${forward.join(',')}`;
    // Déjà connu dans ce sens ?
    const known = index.get(forwardKey);
    // Oui : son numéro.
    if (known !== undefined) return known;
    // Déjà connu dans l'autre sens ?
    const back = index.get(`ring:${canon([...ring].reverse()).join(',')}`);
    // Oui : son numéro inversé.
    if (back !== undefined) return reversed(back);
    // Sinon on l'indexe,
    index.set(forwardKey, arcs.length);
    // on l'enregistre en répétant le premier point à la fin, pour le fermer,
    arcs.push([...forward, forward[0]]);
    // et on rend son numéro.
    return arcs.length - 1;
  // Fin de closedArc.
  };

  // Pour chaque anneau, la liste des numéros de ses arcs :
  const ringArcs = rings.map((ring) => {
    // position de sa première jonction ;
    const first = ring.findIndex((p) => junctions.has(p));
    // aucune : un seul arc fermé.
    if (first < 0) return [closedArc(ring)];
    // Sinon fait tourner l'anneau pour commencer à cette jonction,
    const rolled = [...ring.slice(first), ...ring.slice(0, first)];
    // et répète ce point à la fin.
    rolled.push(rolled[0]);
    // Numéros d'arcs produits.
    const out: number[] = [];
    // Début de l'arc en cours.
    let start = 0;
    // Pour chaque point suivant :
    for (let i = 1; i < rolled.length; i++) {
      // pas une jonction : on continue ;
      if (!junctions.has(rolled[i])) continue;
      // jonction : l'arc va du début jusqu'à ce point inclus ;
      out.push(openArc(rolled.slice(start, i + 1)));
      // et le suivant commence ici.
      start = i;
    // Fin de la boucle.
    }
    // Renvoie les numéros.
    return out;
  // Fin du traitement d'un anneau.
  });

  // 4. Géométries, comme `ndjson-map` dans prepublish.
  // Pour chaque pays, sa géométrie TopoJSON :
  const geometries: TopoGeometry[] = countries.map(({ properties, polys }) => {
    // son code ISO numérique ;
    const iso = properties.ISO_N3 as string | undefined;
    // identifiant : le code ISO, sauf « -99 » (code manquant), qui devient 578 pour la Norvège et rien pour les autres ;
    const id = iso === '-99' ? (properties.SOV_A3 === 'NOR' ? '578' : undefined) : iso;
    // géométrie : avec un seul polygone,
    const geometry: TopoGeometry = polys.length === 1
      // un Polygon, chaque anneau remplacé par ses arcs ;
      ? { type: 'Polygon', arcs: polys[0].map((r) => ringArcs[r]) }
      // sinon un MultiPolygon, de la même façon.
      : { type: 'MultiPolygon', arcs: polys.map((poly) => poly.map((r) => ringArcs[r])) };
    // Pose l'identifiant s'il existe.
    if (id !== undefined && id !== null) geometry.id = id;
    // Pose le nom (null s'il manque).
    geometry.properties = { name: properties.NAME ?? null };
    // Renvoie la géométrie.
    return geometry;
  // Fin du traitement d'un pays.
  });

  /** Arc en coordonnées quantifiées, chaque point codé en écart avec le précédent. */
  // Fonction delta : code un arc en écarts.
  const delta = (arc: number[]): number[][] => {
    // Point précédent, à zéro au départ.
    let px = 0, py = 0;
    // Pour chaque point :
    return arc.map((p) => {
      // retrouve sa colonne et sa ligne dans l'entier ;
      const x = Math.floor(p / Q), y = p % Q;
      // écart avec le point précédent ;
      const d = [x - px, y - py];
      // mémorise la colonne ;
      px = x;
      // mémorise la ligne ;
      py = y;
      // renvoie l'écart.
      return d;
    // Fin du point.
    });
  // Fin de delta.
  };

  // Résultat :
  return {
    // le document TopoJSON,
    topology: {
      // de type Topology,
      type: 'Topology',
      // avec un objet « countries » qui réunit les géométries,
      objects: { countries: { type: 'GeometryCollection', geometries } },
      // les arcs codés en écarts,
      arcs: arcs.map(delta),
      // l'emprise,
      bbox: [x0, y0, x1, y1],
      // et la transformation (taille d'un pas, coin de départ) ;
      transform: { scale: [kx, ky], translate: [x0, y0] },
    // fin du document.
    },
    // Les statistiques.
    stats: { countries: geometries.length, rings: rings.length, arcs: arcs.length, junctions: junctions.size },
  // Fin du résultat.
  };
// Fin de buildCountriesTopology.
}
