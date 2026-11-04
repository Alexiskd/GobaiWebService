import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';
import type { BordersDto } from '../../dto/borders.dto';
 
/* -------------------------------------------------------------------------------------------------
 * Décodage minimal de TopoJSON (https://github.com/topojson/topojson-specification), sans dépendance.
 * Sert à extraire les frontières entre pays (arcs partagés par deux géométries distinctes) et les littoraux
 * (arcs utilisés par une seule géométrie, moins les découpes artificielles de la carte).
 * ----------------------------------------------------------------------------------------------- */
 
type Point = [number, number];
 
export interface Topology {
  type: 'Topology';
  /** Présent si les coordonnées sont quantifiées (entiers codés en delta). */
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: Record<string, { type: string; geometries?: TopoGeometry[] }>;
}
 
export interface TopoGeometry {
  type: string;
  id?: string | number;
  arcs?: unknown;
  properties?: Record<string, unknown>;
}
 
/** Arcs en coordonnées réelles [lon, lat] (dé-quantifiés si besoin). */
function decodeArcs(topo: Topology): Point[][] {
  const t = topo.transform;
  return topo.arcs.map((arc) => {
    if (!t) return arc.map(([x, y]) => [x, y] as Point);
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]] as Point;
    });
  });
}
 
/** Indices d'arcs (≥ 0) utilisés par une géométrie, quelle que soit sa profondeur (Polygon, MultiPolygon…). */
function arcIndices(arcs: unknown, out: Set<number>): Set<number> {
  if (typeof arcs === 'number') out.add(arcs < 0 ? ~arcs : arcs);
  else if (Array.isArray(arcs)) arcs.forEach((a) => arcIndices(a, out));
  return out;
}
 
/** Nombre de géométries distinctes de l'objet qui utilisent chaque arc. */
function arcOwners(topo: Topology, objectName: string): Map<number, number> {
  const geometries = topo.objects[objectName]?.geometries;
  if (!geometries) throw new Error(`Objet TopoJSON « ${objectName} » introuvable`);
  const owners = new Map<number, number>();
  for (const g of geometries) {
    for (const i of arcIndices(g.arcs, new Set())) owners.set(i, (owners.get(i) ?? 0) + 1);
  }
  return owners;
}
 
/**
 * Frontières terrestres : arcs utilisés par au moins deux géométries différentes
 * (un arc utilisé par une seule est un littoral, ou une découpe à ±180°).
 */
function sharedBorders(topo: Topology, objectName = 'countries'): Point[][] {
  const owners = arcOwners(topo, objectName);
  const arcs = decodeArcs(topo);
  return [...owners.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => a[0] - b[0])
    .map(([i]) => arcs[i])
    .filter(Boolean);
}
 
const EDGE = 1e-4; // ≈ 10 m : tolérance d'arrondi de la quantification
 
/** Segment le long d'un bord de la carte (méridien ±180° ou pôle Sud) : découpe des polygones, pas un vrai rivage. */
const isMapEdge = ([lon0, lat0]: Point, [lon1, lat1]: Point) =>
  (Math.abs(lon0) >= 180 - EDGE && Math.abs(lon1) >= 180 - EDGE && Math.sign(lon0) === Math.sign(lon1))
  || (lat0 <= -90 + EDGE && lat1 <= -90 + EDGE);
 
/**
 * Littoraux (mers, océans, grands lacs fermés comme la Caspienne) : arcs utilisés par une seule géométrie.
 * Les segments qui longent les bords de la carte (±180°, pôle Sud de l'Antarctique) sont retirés : la polyligne est
 * coupée à cet endroit.
 */
function coastlines(topo: Topology, objectName = 'countries'): Point[][] {
  const owners = arcOwners(topo, objectName);
  const arcs = decodeArcs(topo);
  const out: Point[][] = [];
  for (const [i] of [...owners.entries()].filter(([, n]) => n === 1).sort((a, b) => a[0] - b[0])) {
    const arc = arcs[i];
    if (!arc) continue;
    let current: Point[] = [arc[0]];
    for (let k = 1; k < arc.length; k++) {
      if (isMapEdge(arc[k - 1], arc[k])) {
        if (current.length > 1) out.push(current);
        current = [arc[k]];
      } else current.push(arc[k]);
    }
    if (current.length > 1) out.push(current);
  }
  return out;
}
 
/* -------------------------------------------------------------------------------------------------
 * Service
 * ----------------------------------------------------------------------------------------------- */
 
const TIMEOUT_MS = 15_000;
const round = (v: number) => Math.round(v * 1000) / 1000;
 
/** Polyligne → liste plate arrondie, sans les points répétés que l'arrondi peut créer. */
function flatten(line: Point[]): number[] {
  const out: number[] = [];
  for (const [lon, lat] of line) {
    const x = round(lon), y = round(lat);
    if (out.length && out[out.length - 2] === x && out[out.length - 1] === y) continue;
    out.push(x, y);
  }
  return out;
}
 
/**
 * Frontières des pays (Natural Earth, via le paquet world-atlas en TopoJSON). Le fichier est téléchargé une fois
 * au premier appel puis gardé en mémoire ; en cas d'échec, l'appel suivant réessaie.
 */
@Injectable()
export class BordersService {
  private cache: Promise<BordersDto> | null = null;
 
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}
 
  get(): Promise<BordersDto> {
    if (!this.cache) {
      this.cache = this.load().catch((e) => {
        this.cache = null;
        throw e;
      });
    }
    return this.cache;
  }
 
  private async load(): Promise<BordersDto> {
    const url = this.config.borders.sourceUrl;
    let topo: Topology;
    try {
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      topo = (await res.json()) as Topology;
    } catch (e) {
      throw new BadGatewayException(`Frontières indisponibles (${url}) : ${(e as Error).message}`);
    }
    if (topo?.type !== 'Topology') throw new BadGatewayException('Frontières : le fichier reçu n’est pas du TopoJSON.');
 
    const keep = (l: number[]) => l.length >= 4;
    const lines = sharedBorders(topo, 'countries').map(flatten).filter(keep);
    const coasts = coastlines(topo, 'countries').map(flatten).filter(keep);
    return {
      source: this.config.borders.label,
      attribution: 'Frontières : Natural Earth',
      count: lines.length,
      lines,
      coastlines: coasts,
    };
  }
}