/* -------------------------------------------------------------------------------------------------
 * Types TopoJSON (https://github.com/topojson/topojson-specification) partagés par World Atlas et les frontières.
 * ----------------------------------------------------------------------------------------------- */

// Forme d'un document TopoJSON.
export interface Topology {
  // type : toujours « Topology ».
  type: 'Topology';
  /** Présent si les coordonnées sont quantifiées (entiers codés en delta). */
  // transform : l'échelle et le décalage qui ramènent les entiers en degrés.
  transform?: { scale: [number, number]; translate: [number, number] };
  // arcs : les arcs, chacun une liste de points, chaque point une liste de nombres.
  arcs: number[][][];
  // objects : les objets nommés, chacun avec son type et ses géométries.
  objects: Record<string, { type: string; geometries?: TopoGeometry[] }>;
  // bbox : l'emprise [ouest, sud, est, nord], facultative.
  bbox?: [number, number, number, number];
// Fin de Topology.
}

// Forme d'une géométrie TopoJSON.
export interface TopoGeometry {
  // type : Polygon, MultiPolygon…
  type: string;
  // id : son identifiant.
  id?: string | number;
  // arcs : les numéros de ses arcs, en listes plus ou moins imbriquées selon le type.
  arcs?: unknown;
  // properties : ses propriétés (ici le nom du pays).
  properties?: Record<string, unknown>;
// Fin de TopoGeometry.
}
