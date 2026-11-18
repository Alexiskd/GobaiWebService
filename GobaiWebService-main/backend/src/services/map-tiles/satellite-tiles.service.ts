// Outils NestJS : erreur 502, service injectable, journal, erreur 404.
import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
// createRequire : fabrique un « require » pour charger un module CommonJS.
import { createRequire } from 'node:module';
// Fonction qui lit un fichier de capacités WMTS ou WMS.
import { parseCapabilities } from '../moon/capabilities.parser';
// Types (effacés à la compilation) d'une couche résolue, d'une description de couche et d'un fournisseur de tuiles.
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './providers/tile-provider';
// Ouvre l'import du module des sources des satellites :
import {
  // sa liste, sa table et ses fonctions ;
  SATELLITE_SOURCES, SATELLITE_SOURCE_BY_ID, isMapService, isSatTile, pickUsgsLayer, productLabel, productSlug,
  // la suite de ses fonctions ;
  satTileBounds, trekMatrixInfo, trekPortals, usgsGetMapQuery,
  // et trois types.
  type SatelliteId, type SatelliteSourceSpec, type TrekMatrixInfo,
// Fin de l'import.
} from './satellite-sources';

// Adresse des tuiles NASA Trek : SATELLITE_TREK_BASE_URL ou l'adresse officielle, sans barre finale.
const TREK_BASE = (process.env.SATELLITE_TREK_BASE_URL?.trim() || 'https://trek.nasa.gov/tiles').replace(/\/$/, '');
// Adresse du site NASA Trek : SATELLITE_TREK_SITE_URL ou l'adresse officielle.
const TREK_SITE = (process.env.SATELLITE_TREK_SITE_URL?.trim() || 'https://trek.nasa.gov').replace(/\/$/, '');
// Adresse du service WMS de l'USGS : SATELLITE_USGS_WMS_URL ou l'adresse officielle.
const USGS_WMS = (process.env.SATELLITE_USGS_WMS_URL?.trim() || 'https://planetarymaps.usgs.gov/cgi-bin/mapserv').replace(/\/$/, '');
// Délai maximal d'une vérification : 15 secondes.
const PROBE_TIMEOUT_MS = 15_000;
// Délai maximal d'une tuile : 20 secondes.
const TILE_TIMEOUT_MS = 20_000;
// Délai avant un nouvel essai : 30 minutes.
const RETRY_MS = 30 * 60_000;       // aucune source trouvée : nouvel essai après 30 min
// Nombre de tuiles gardées en mémoire : 600.
const MEMORY_TILES = 600;           // tuiles gardées en mémoire (≈ 15 à 40 Mo)
// Niveau maximal des cartes de l'USGS : 5.
const USGS_MAX_ZOOM = 5;            // WMS : 64 × 32 tuiles au plus fin, au-delà l'image est seulement agrandie
// Niveau maximal des exports ArcGIS : 6.
const ARCGIS_MAX_ZOOM = 6;          // export ArcGIS à la demande : au-delà, l'image est seulement agrandie
// Nombre maximal de produits examinés par astre : 60.
const MAX_PRODUCTS = 60;            // produits Trek examinés au plus par astre
// Nombre de vérifications menées en même temps : 4.
const PROBE_CONCURRENCY = 4;

// Type Source : une source de tuiles, de trois sortes :
type Source =
  // WMTS de NASA Trek : produit, mention, adresse de base, niveaux ;
  | { kind: 'trek'; product: string; label: string; base: string; info: TrekMatrixInfo }
  // export ArcGIS : produit, mention, adresse, type du service, projection, longitudes en 0..360 ;
  | { kind: 'arcgis'; product: string; label: string; url: string; image: boolean; sr: string; lon360: boolean }
  // WMS de l'USGS : mention, couche, projection, longitudes en 0..360.
  | { kind: 'usgs'; label: string; layer: string; srs: string; lon360: boolean };

/** Couche venue de NASA Solar System Treks (WMTS ou export ArcGIS) : pas USGS. */
// Type TrekSource : les deux premières sortes.
type TrekSource = Extract<Source, { kind: 'trek' | 'arcgis' }>;
// Fonction isTrek : la source vient-elle de NASA Trek ?
const isTrek = (s: Source): s is TrekSource => s.kind === 'trek' || s.kind === 'arcgis';

// Fonction maxZoomOf : le niveau maximal d'une source.
function maxZoomOf(s?: Source): number {
  // WMTS : celui de ses niveaux.
  if (s?.kind === 'trek') return s.info.maxZoom;
  // ArcGIS : 6.
  if (s?.kind === 'arcgis') return ARCGIS_MAX_ZOOM;
  // Sinon : 5.
  return USGS_MAX_ZOOM;
// Fin de maxZoomOf.
}

/** Couche découverte pour un astre ; la première sert de fond par défaut (`<astre>-surface`). */
// Forme d'une couche d'un astre : son identifiant court et sa source.
interface BodyLayer { slug: string; source: Source }

// Forme d'une tuile : ses octets et son type de contenu.
interface Tile { body: Buffer; contentType: string }

/** Qualité WebP des tuiles recompressées : la même que les tuiles de la Lune (moon-tile-cache.service.ts). */
// Qualité WebP : 84.
const WEBP_QUALITY = 84;
// Type d'un encodeur WebP : des octets vers des octets.
type WebpEncoder = (body: Buffer) => Promise<Buffer>;
// Encodeur par défaut :
const sharpWebp: WebpEncoder = (body) => {
  // Même chargement que earth-imagery.service.ts (module CommonJS natif).
  // charge sharp, sans typage (la ligne du dessous autorise ce « any » pour ESLint) ;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharp = createRequire(__filename)('sharp') as any;
  // encode en WebP, qualité 84, effort 2.
  return sharp(body).webp({ quality: WEBP_QUALITY, effort: 2 }).toBuffer();
// Fin de l'encodeur.
};

/**
 * Allège une tuile avant de la garder et de l'envoyer : une tuile PNG (les mosaïques NASA Trek en PNG pèsent souvent
 * plus de 100 ko) est recompressée en WebP, transparence comprise, comme le font les API de tuiles à grand trafic.
 * Faite une fois par tuile, puis gardée en mémoire. La tuile d'origine est rendue telle quelle si elle n'est pas en
 * PNG, si le WebP n'est pas plus léger, ou si la recompression échoue.
 */
// Fonction compactTile ; l'encodeur par défaut est celui de sharp.
export async function compactTile(tile: Tile, encode: WebpEncoder = sharpWebp): Promise<Tile> {
  // Pas un PNG : rendue telle quelle.
  if (!/^image\/png\b/i.test(tile.contentType)) return tile;
  // Essaie
  try {
    // d'encoder ;
    const body = await encode(tile.body);
    // rend le WebP s'il n'est ni vide ni plus lourd, sinon la tuile d'origine.
    return body.length > 0 && body.length < tile.body.length ? { body, contentType: 'image/webp' } : tile;
  // En cas d'échec :
  } catch {
    // la tuile d'origine.
    return tile;
  // Fin du cas.
  }
// Fin de compactTile.
}

// Identifiant court de la couche principale.
const PRIMARY = 'surface';
// Fonction layerId : « <astre>-surface » pour la couche principale, « <astre>--<produit> » pour les autres.
const layerId = (id: SatelliteId, slug = PRIMARY) => (slug === PRIMARY ? `${id}-surface` : `${id}--${slug}`);

/** `<astre>-surface` ou `<astre>--<produit>` → astre et produit. */
// Fonction parseLayerId.
function parseLayerId(id: string): { body: SatelliteId; slug: string } | null {
  // Lit l'identifiant avec une expression régulière.
  const m = /^([a-z]+)(?:-surface|--([a-z0-9-]+))$/.exec(id);
  // Forme inattendue ou astre inconnu : null.
  if (!m || !SATELLITE_SOURCE_BY_ID.has(m[1] as SatelliteId)) return null;
  // Renvoie l'astre, et le produit ou « surface ».
  return { body: m[1] as SatelliteId, slug: m[2] ?? PRIMARY };
// Fin de parseLayerId.
}

// Fonction mapLimit : applique une fonction à une liste, avec un nombre limité d'appels en même temps.
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  // Résultats, dans l'ordre de la liste.
  const out: R[] = new Array(items.length);
  // Rang du prochain élément.
  let i = 0;
  // Lance autant d'ouvriers que la limite (ou que d'éléments) ;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    // chacun prend l'élément suivant tant qu'il en reste.
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  // Attend la fin de tous.
  }));
  // Renvoie les résultats.
  return out;
// Fin de mapLimit.
}

/**
 * Cartes des satellites naturels et des géantes gazeuses (Jupiter, Saturne, Uranus, Neptune, Pluton), servies comme
 * celles de la Lune (plate carrée, {z}/{x}/{y}).
 *
 * Pour chaque astre, TOUTES les couches NASA Solar System Treks sont cherchées au démarrage :
 *  - produits connus (satellite-sources.ts) vérifiés sur leur WMTSCapabilities.xml ;
 *  - annuaire ArcGIS REST des portails Trek (titan, enceladus, europa, ganymede, icymoons…) : chaque service est
 *    servi en WMTS s'il existe dans trek.nasa.gov/tiles, sinon par l'export ArcGIS du service ;
 *  - en dernier recours, la carte WMS de l'USGS Astrogeology.
 * Tuiles relayées par GET /api/v1/tiles/satellite/{astre}/{z}/{x}/{y}?layer=<produit>, avec un cache mémoire.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des tuiles des satellites ; c'est un fournisseur de tuiles.
export class SatelliteTilesService implements TileProvider {
  // Identifiant du fournisseur.
  readonly id = 'satellite-trek' as const;
  // Journal préfixé par « Satellites ».
  private readonly logger = new Logger('Satellites');
  // Catalogue de chaque astre : la date de la recherche, sa promesse, et son résultat une fois connu.
  private readonly catalogs = new Map<SatelliteId, { at: number; layers: Promise<BodyLayer[]>; done?: BodyLayer[] }>();
  // Mémoire des tuiles.
  private readonly memory = new Map<string, Tile>();
  // Téléchargements en cours, par clé.
  private readonly pending = new Map<string, Promise<Tile>>();

  // Constructeur : la fonction de téléchargement, fetch par défaut.
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  // Méthode isAvailable : toujours disponible.
  isAvailable(): boolean { return true; }

  // Méthode has : vrai si l'identifiant se lit comme une couche de satellite.
  has(id: string): boolean { return parseLayerId(id) !== null; }

  /**
   * Couches connues à cet instant : le fond principal de chaque astre, plus les produits déjà découverts.
   * Un astre dont la recherche est terminée sans aucune carte (ni NASA Trek ni USGS) n'a pas d'entrée : le client
   * ne demande donc pas une couche qui répondrait 502, et l'astre garde sa sphère unie. Tant que la recherche n'est
   * pas terminée, le fond principal reste annoncé.
   */
  // Méthode layers.
  layers(): TileLayerInfo[] {
    // Pour chaque astre :
    return SATELLITE_SOURCES.flatMap((s) => {
      // résultat de la recherche, s'il est connu ;
      const done = this.catalogs.get(s.id)?.done;
      // recherche finie sans carte : aucune couche ;
      if (done && !done.length) return [];
      // couches trouvées, ou liste vide ;
      const found = done ?? [];
      // les couches autres que la principale ;
      const extra = found.filter((l) => l.slug !== PRIMARY).map((l) => this.info(s, l));
      // renvoie la principale puis les autres.
      return [this.info(s, found[0]), ...extra];
    // Fin de la boucle.
    });
  // Fin de layers.
  }

  /** Toutes les couches d'un astre (attend la découverte, bornée à `waitMs`). */
  // Méthode bodyLayers ; attente de 25 secondes par défaut.
  async bodyLayers(body: string, waitMs = 25_000): Promise<TileLayerInfo[]> {
    // Fiche de l'astre.
    const spec = SATELLITE_SOURCE_BY_ID.get(body as SatelliteId);
    // Inconnu : erreur 404.
    if (!spec) throw new NotFoundException(`Astre inconnu : « ${body} ».`);
    // Attend le premier des deux :
    const found = await Promise.race([
      // la fin de la recherche ;
      this.catalog(spec.id),
      // ou la fin du délai, avec ce qui est déjà connu.
      new Promise<BodyLayer[]>((r) => setTimeout(() => r(this.catalogs.get(spec.id)?.done ?? []), waitMs)),
    // Fin de l'attente.
    ]);
    // Renvoie la description de chaque couche.
    return found.map((l) => this.info(spec, l));
  // Fin de bodyLayers.
  }

  // Méthode resolve : une couche prête à charger.
  async resolve(id: string): Promise<ResolvedTileLayer> {
    // Lit l'identifiant.
    const parsed = parseLayerId(id);
    // Illisible : erreur 404.
    if (!parsed) throw new NotFoundException(`Couche de satellite inconnue : « ${id} ».`);
    // Fiche de l'astre.
    const spec = SATELLITE_SOURCE_BY_ID.get(parsed.body)!;
    // Couche demandée.
    const layer = await this.layer(spec, parsed.slug);
    // Sa source.
    const source = layer.source;
    // Son niveau maximal.
    const maxZoom = maxZoomOf(source);
    // Paramètre « ?layer= », sauf pour la couche principale.
    const q = parsed.slug === PRIMARY ? '' : `?layer=${parsed.slug}`;
    // Renvoie
    return {
      // la description de la couche ;
      ...this.info(spec, layer),
      // son niveau maximal ;
      maxZoom,
      // son format : png pour un WMTS en PNG, sinon jpeg ;
      format: source.kind === 'trek' && source.info.extension === 'png' ? 'png' : 'jpeg',
      // vérifiée ;
      experimental: false,
      // le modèle d'adresse, qui passe par ce serveur ;
      urlTemplate: `/api/v1/tiles/satellite/${spec.id}/{z}/{x}/{y}${q}`,
      // pas d'expiration ;
      expiresAt: null,
      // la mention de la source.
      attribution: { text: source.label },
    // Fin de l'objet.
    };
  // Fin de resolve.
  }

  // Méthode attribution.
  async attribution(id: string): Promise<string> {
    // Lit l'identifiant.
    const parsed = parseLayerId(id);
    // Illisible : texte vide.
    if (!parsed) return '';
    // Couche demandée, ou null en cas d'échec.
    const layer = await this.layer(SATELLITE_SOURCE_BY_ID.get(parsed.body)!, parsed.slug).catch(() => null);
    // Renvoie la mention de sa source, ou un texte vide.
    return layer?.source.label ?? '';
  // Fin de attribution.
  }

  /**
   * État des cartes de chaque astre : `trek` vrai quand au moins une couche vient de NASA Solar System Treks.
   * Le client n'affiche que ces satellites-là. Attente bornée à `waitMs` par astre.
   */
  // Méthode status ; attente de 3 secondes par défaut.
  async status(waitMs = 3_000): Promise<Array<{ id: SatelliteId; name: string; trek: boolean; source: 'trek' | 'usgs' | null; label: string | null; layers: number }>> {
    // Fonction timeout : le résultat d'une promesse, ou null si le délai passe.
    const timeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), waitMs))]);
    // Pour chaque astre, en même temps :
    return Promise.all(SATELLITE_SOURCES.map(async (s) => {
      // ses couches, ou une liste vide ;
      const found = (await timeout(this.catalog(s.id).catch(() => [] as BodyLayer[]))) ?? [];
      // la source de la première ;
      const first = found[0]?.source;
      // vrai si une couche vient de NASA Trek ;
      const trek = found.some((l) => isTrek(l.source));
      // renvoie son identifiant, son nom, cet indicateur, la sorte de sa première source, sa mention et le nombre de couches.
      return { id: s.id, name: s.name, trek, source: first ? (isTrek(first) ? 'trek' : 'usgs') : null, label: first?.label ?? null, layers: found.length };
    // Fin de la boucle.
    }));
  // Fin de status.
  }

  // État des portails des planètes : la date du test et sa promesse.
  private readonly portals = new Map<string, { at: number; ok: Promise<boolean> }>();

  /** Test « Trek » d'un satellite ou d'une géante : au moins une couche NASA Solar System Treks (attente bornée). */
  // Méthode hasTrek ; attente de 8 secondes par défaut.
  async hasTrek(id: string, waitMs = 8_000): Promise<boolean | null> {
    // Astre inconnu : faux.
    if (!SATELLITE_SOURCE_BY_ID.has(id)) return false;
    // Attend le premier des deux :
    const found = await Promise.race([
      // les couches de l'astre, ou une liste vide ;
      this.catalog(id).catch(() => [] as BodyLayer[]),
      // ou la fin du délai, avec null.
      new Promise<null>((r) => setTimeout(() => r(null), waitMs)),
    // Fin de l'attente.
    ]);
    // Délai passé : null.
    if (found === null) return null;
    // Vrai si une couche vient de NASA Trek.
    return found.some((l) => isTrek(l.source));
  // Fin de hasTrek.
  }

  /** Test « Trek » d'une planète : son portail Solar System Treks publie au moins un service (annuaire ArcGIS). */
  // Méthode planetHasTrek.
  async planetHasTrek(id: string): Promise<boolean> {
    // Astre de la liste des satellites : même test que hasTrek.
    if (SATELLITE_SOURCE_BY_ID.has(id)) return Boolean(await this.hasTrek(id));
    // Test déjà fait pour ce portail ?
    const c = this.portals.get(id);
    // Oui, et depuis moins de 30 minutes : son résultat.
    if (c && Date.now() - c.at < RETRY_MS) return c.ok;
    // Nouveau test :
    const ok = (async () => {
      // pour chacun des deux chemins possibles de l'annuaire :
      for (const path of ['trekarcgis', 'arcgis']) {
        // essaie
        try {
          // de lire l'annuaire ;
          const res = await this.fetchFn(`${TREK_SITE}/${id}/${path}/rest/services?f=json`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
          // réponse en erreur : chemin suivant ;
          if (!res.ok) continue;
          // lit le JSON ;
          const json = await res.json() as { services?: unknown[]; folders?: unknown[] };
          // au moins un service ou un dossier : vrai.
          if ((json.services?.length ?? 0) + (json.folders?.length ?? 0) > 0) return true;
        // En cas d'échec : rien.
        } catch { /* portail absent */ }
      // Fin de la boucle.
      }
      // Sinon : faux.
      return false;
    // Fin du test, lancé tout de suite.
    })();
    // Entrée : la date et la promesse.
    const entry = { at: Date.now(), ok };
    // La garde.
    this.portals.set(id, entry);
    // Si le résultat est vrai, il est gardé pour toujours.
    void ok.then((v) => { if (v) entry.at = Infinity; });
    // Renvoie la promesse.
    return ok;
  // Fin de planetHasTrek.
  }

  /** Cherche toutes les couches en arrière-plan et journalise le résultat (appelé au démarrage). */
  // Méthode warmUp.
  async warmUp(): Promise<void> {
    // Pour chaque astre, l'un après l'autre :
    for (const s of SATELLITE_SOURCES) {
      // ses couches, ou une liste vide ;
      const found = await this.catalog(s.id).catch(() => [] as BodyLayer[]);
      // écrit dans le journal le nombre de couches et leurs noms, ou « aucune carte ».
      this.logger.log(`${s.name} → ${found.length ? `${found.length} couche(s) : ${found.map((l) => l.source.label.split(' — ').pop()).join(', ')}` : 'aucune carte (sphère unie)'}`);
    // Fin de la boucle.
    }
  // Fin de warmUp.
  }

  /** Image d'une tuile, depuis la mémoire ou la source de la couche. */
  // Méthode tile.
  async tile(body: string, z: number, x: number, y: number, layer?: string): Promise<Tile> {
    // Fiche de l'astre.
    const spec = SATELLITE_SOURCE_BY_ID.get(body as SatelliteId);
    // Inconnu : erreur 404.
    if (!spec) throw new NotFoundException(`Satellite inconnu : « ${body} ».`);
    // Tuile hors de la grille : erreur 404.
    if (!isSatTile(z, x, y)) throw new NotFoundException(`Tuile ${z}/${x}/${y} inexistante.`);
    // Couche demandée si son nom est valide, sinon la principale.
    const slug = layer && /^[a-z0-9-]{1,80}$/.test(layer) ? layer : PRIMARY;
    // Clé de la tuile.
    const key = `${body}/${slug}/${z}/${x}/${y}`;
    // La cherche en mémoire.
    const hit = this.memory.get(key);
    // Trouvée :
    if (hit) {
      // la retire,
      this.memory.delete(key);
      // la remet,
      this.memory.set(key, hit); // le plus récemment utilisé passe en fin de liste
      // et la renvoie.
      return hit;
    // Fin du cas.
    }
    // Cherche un téléchargement en cours.
    const running = this.pending.get(key);
    // Trouvé : le renvoie.
    if (running) return running;
    // Sinon : trouve la couche, télécharge la tuile, l'allège, puis :
    const p = this.layer(spec, slug).then((l) => this.download(spec, l.source, z, x, y)).then((t) => compactTile(t)).then((t) => {
      // la garde en mémoire ;
      this.memory.set(key, t);
      // retire les plus anciennes au-delà de 600 ;
      while (this.memory.size > MEMORY_TILES) this.memory.delete(this.memory.keys().next().value!);
      // rend la tuile.
      return t;
    // Dans tous les cas, retire le téléchargement de la liste.
    }).finally(() => this.pending.delete(key));
    // L'inscrit dans la liste.
    this.pending.set(key, p);
    // Renvoie la promesse.
    return p;
  // Fin de tile.
  }

  // ------------------------------------------------------------------ catalogue

  // Méthode privée info : la description d'une couche.
  private info(s: SatelliteSourceSpec, l?: BodyLayer): TileLayerInfo {
    // Sa source, si elle est connue.
    const src = l?.source;
    // Nom lisible du produit, pour une source NASA Trek.
    const product = src && isTrek(src) ? productLabel(src.product) : null;
    // Est-ce la couche principale ?
    const primary = !l || l.slug === PRIMARY;
    // Nom : « <astre> (carte ou mosaïque globale) » pour la principale sans produit, sinon « <astre> · <produit ou USGS> ».
    const label = primary && !product ? `${s.name} (${s.planet ? 'carte globale' : 'mosaïque globale'})` : `${s.name} · ${product ?? 'USGS'}`;
    // Renvoie
    return {
      // son identifiant ;
      id: layerId(s.id, l?.slug ?? PRIMARY),
      // son nom ;
      label,
      // sa nature : imagerie ;
      kind: 'imagery' as const,
      // sa description : la mention de la source, sinon, pour une planète,
      description: src ? src.label : (s.planet
        // « Carte globale… (USGS) »,
        ? `Carte globale de ${s.name} (USGS Astrogeology).`
        // et pour un satellite « Mosaïque globale… ».
        : `Mosaïque globale de ${s.name} (NASA Solar System Treks, sinon USGS Astrogeology).`),
      // Fournisseur, astre, projection plate carrée.
      provider: 'satellite-trek' as const, body: s.id, projection: 'equirectangular' as const,
      // Niveaux minimal et maximal.
      minZoom: 0, maxZoom: maxZoomOf(src),
      // Tuiles de 256 pixels ; format png pour un WMTS en PNG, sinon jpeg.
      tileSize: 256, format: src?.kind === 'trek' && src.info.extension === 'png' ? 'png' as const : 'jpeg' as const,
      // Opaque, sans clé ; expérimentale tant que la source n'est pas connue.
      transparent: false, requiresKey: false, experimental: !src,
    // Fin de l'objet.
    };
  // Fin de info.
  }

  // Méthode privée layer : une couche d'un astre.
  private async layer(spec: SatelliteSourceSpec, slug: string): Promise<BodyLayer> {
    // Couches de l'astre.
    const found = await this.catalog(spec.id);
    // La première pour la principale, sinon celle qui porte cet identifiant court.
    const l = slug === PRIMARY ? found[0] : found.find((x) => x.slug === slug);
    // Introuvable :
    if (!l) {
      // aucune couche du tout : erreur 502 ;
      if (!found.length) throw new BadGatewayException(`Aucune carte de ${spec.name} disponible pour le moment (NASA Trek et USGS injoignables).`);
      // sinon : erreur 404.
      throw new NotFoundException(`Couche « ${slug} » inconnue pour ${spec.name}.`);
    // Fin du cas.
    }
    // Renvoie la couche.
    return l;
  // Fin de layer.
  }

  // Méthode privée catalog : les couches d'un astre.
  private catalog(id: SatelliteId): Promise<BodyLayer[]> {
    // Catalogue déjà connu ?
    const c = this.catalogs.get(id);
    // Oui, et depuis moins de 30 minutes : sa promesse.
    if (c && (Date.now() - c.at < RETRY_MS)) return c.layers;
    // Nouvelle entrée, datée de maintenant.
    const entry: { at: number; layers: Promise<BodyLayer[]>; done?: BodyLayer[] } = { at: Date.now(), layers: Promise.resolve([]) };
    // Lance la recherche (liste vide en cas d'échec) ; quand elle finit :
    entry.layers = this.discover(SATELLITE_SOURCE_BY_ID.get(id)!).catch(() => [] as BodyLayer[]).then((found) => {
      // garde le résultat ;
      entry.done = found;
      // Au moins une couche Trek : gardée ; sinon (USGS seul ou rien) nouvel essai après RETRY_MS.
      // s'il y a une couche NASA Trek, il est gardé pour toujours ;
      if (found.some((l) => isTrek(l.source))) entry.at = Infinity;
      // rend le résultat.
      return found;
    // Fin du traitement.
    });
    // En attendant, garde l'ancien résultat.
    if (c?.done) entry.done = c.done;
    // Garde l'entrée.
    this.catalogs.set(id, entry);
    // Renvoie la promesse.
    return entry.layers;
  // Fin de catalog.
  }

  // Méthode privée discover : cherche les couches d'un astre.
  private async discover(spec: SatelliteSourceSpec): Promise<BodyLayer[]> {
    // Adresse imposée par la variable SATELLITE_TILES_<ASTRE>, si elle existe.
    const override = process.env[`SATELLITE_TILES_${spec.id.toUpperCase()}`]?.trim();
    // Produits Trek : imposé, puis connus, puis découverts dans l'annuaire ArcGIS des portails.
    // Produits à vérifier.
    const products: Array<{ product: string; base: string; arcgis?: { url: string; image: boolean } }> = [];
    // Noms déjà vus.
    const seen = new Set<string>();
    // Fonction add : ajoute un produit.
    const add = (product: string, arcgis?: { url: string; image: boolean }) => {
      // Son nom en minuscules.
      const k = product.toLowerCase();
      // Déjà vu, ou liste pleine : rien.
      if (seen.has(k) || products.length >= MAX_PRODUCTS) return;
      // Le note comme vu.
      seen.add(k);
      // L'ajoute, avec son adresse chez NASA Trek.
      products.push({ product, base: `${TREK_BASE}/${spec.trekBody}/EQ/${product}`, arcgis });
    // Fin de add.
    };
    // Si une adresse est imposée :
    if (override) {
      // retire la fin « 1.0.0/WMTSCapabilities.xml » ;
      const base = override.replace(/\/(1\.0\.0\/)?(WMTSCapabilities\.xml)?$/, '');
      // son nom : le dernier morceau de l'adresse ;
      const product = base.split('/').pop() || 'override';
      // le note comme vu ;
      seen.add(product.toLowerCase());
      // l'ajoute en premier.
      products.push({ product, base });
    // Fin du cas.
    }
    // Ajoute les produits connus.
    for (const p of spec.trek) add(p);
    // Ajoute les services de l'annuaire ArcGIS.
    for (const svc of await this.listArcgis(spec)) add(svc.product, svc);

    // Vérifie les produits, 4 à la fois :
    const probed = await mapLimit(products, PROBE_CONCURRENCY, async (p): Promise<Source | null> => {
      // lit ses niveaux WMTS ;
      const info = await this.probeTrek(p.base);
      // s'ils existent : source WMTS ;
      if (info) return { kind: 'trek', product: p.product, base: p.base, info, label: `${spec.name} : NASA Solar System Treks — ${p.product}` };
      // sinon, s'il vient de l'annuaire : essaie l'export ArcGIS ;
      if (p.arcgis) return this.probeArcgis(spec, p.product, p.arcgis.url, p.arcgis.image);
      // sinon : null.
      return null;
    // Fin de la vérification.
    });
    // Couches retenues.
    const layers: BodyLayer[] = [];
    // Identifiants courts déjà pris.
    const slugs = new Set<string>();
    // Pour chaque source vérifiée :
    for (const src of probed) {
      // passe celles qui sont absentes ou qui ne viennent pas de NASA Trek ;
      if (!src || !isTrek(src)) continue;
      // son identifiant court ;
      let slug = productSlug(src.product) || 'trek';
      // s'il est déjà pris, ou vaut « surface », ajoute « -2 » ;
      while (slugs.has(slug) || slug === PRIMARY) slug = `${slug}-2`;
      // le note comme pris ;
      slugs.add(slug);
      // ajoute la couche.
      layers.push({ slug, source: src });
    // Fin de la boucle.
    }
    // WMTS d'abord (plus rapide, zoom plus fin), puis export ArcGIS.
    // Trie : les WMTS avant les exports ArcGIS.
    layers.sort((a, b) => Number(a.source.kind !== 'trek') - Number(b.source.kind !== 'trek'));
    // Vérifie la carte de l'USGS.
    const usgs = await this.probeUsgs(spec);
    // Si elle existe, l'ajoute en dernier.
    if (usgs) layers.push({ slug: 'usgs', source: usgs });
    // La première couche est le fond principal (`<astre>-surface`, URL de tuile sans paramètre).
    // La première couche devient la principale.
    if (layers.length) layers[0] = { ...layers[0], slug: PRIMARY };
    // Renvoie les couches.
    return layers;
  // Fin de discover.
  }

  /** Services ArcGIS (MapServer, ImageServer) publiés par les portails Trek pour cet astre. */
  // Méthode privée listArcgis.
  private async listArcgis(spec: SatelliteSourceSpec): Promise<Array<{ product: string; url: string; image: boolean }>> {
    // Services trouvés.
    const out: Array<{ product: string; url: string; image: boolean }> = [];
    // Pour chaque portail de l'astre :
    for (const { portal, folder } of trekPortals(spec)) {
      // adresse de son annuaire ;
      const root = `${TREK_SITE}/${portal}/trekarcgis/rest/services`;
      // essaie
      try {
        // de lire le dossier de l'astre ;
        const res = await this.fetchFn(`${root}/${folder}?f=json`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
        // réponse en erreur : portail suivant ;
        if (!res.ok) continue;
        // lit le JSON ;
        const json = await res.json() as { services?: Array<{ name?: string; type?: string }> };
        // pour chaque service :
        for (const s of json.services ?? []) {
          // passe ceux sans nom, ou qui ne sont ni MapServer ni ImageServer ;
          if (!s.name || (s.type !== 'MapServer' && s.type !== 'ImageServer')) continue;
          // son nom : le dernier morceau ;
          const product = s.name.split('/').pop()!;
          // passe ceux qui ne sont pas des cartes ;
          if (!isMapService(product)) continue;
          // l'ajoute, avec son adresse et son type.
          out.push({ product, url: `${root}/${s.name}/${s.type}`, image: s.type === 'ImageServer' });
        // Fin de la boucle.
        }
      // En cas d'échec :
      } catch {
        // portail absent ou injoignable : ignoré
      // rien.
      }
    // Fin de la boucle des portails.
    }
    // Renvoie les services.
    return out;
  // Fin de listArcgis.
  }

  // Méthode privée probeTrek.
  private async probeTrek(base: string): Promise<TrekMatrixInfo | null> {
    // Essaie
    try {
      // de lire le fichier de capacités du produit ;
      const res = await this.fetchFn(`${base}/1.0.0/WMTSCapabilities.xml`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      // réponse en erreur : null ;
      if (!res.ok) return null;
      // analyse le fichier ;
      const caps = parseCapabilities(await res.text());
      // renvoie les niveaux retenus.
      return trekMatrixInfo(caps.tileMatrixSets, caps.resourceUrlTemplate);
    // En cas d'échec :
    } catch {
      // null.
      return null;
    // Fin du cas.
    }
  // Fin de probeTrek.
  }

  /** Service ArcGIS servi par export : seulement s'il est en coordonnées géographiques (degrés). */
  // Méthode privée probeArcgis.
  private async probeArcgis(spec: SatelliteSourceSpec, product: string, url: string, image: boolean): Promise<Source | null> {
    // Essaie
    try {
      // de lire la fiche du service ;
      const res = await this.fetchFn(`${url}?f=json`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      // réponse en erreur : null ;
      if (!res.ok) return null;
      // lit le JSON, dont on attend :
      const json = await res.json() as {
        // une erreur éventuelle ;
        error?: unknown;
        // la projection ;
        spatialReference?: { wkid?: number; latestWkid?: number; wkt?: string };
        // l'emprise complète ;
        fullExtent?: { xmin?: number; xmax?: number; ymin?: number; ymax?: number; spatialReference?: { wkid?: number; latestWkid?: number; wkt?: string } };
        // ou l'emprise.
        extent?: { xmin?: number; xmax?: number; ymin?: number; ymax?: number; spatialReference?: { wkid?: number; latestWkid?: number; wkt?: string } };
      // Fin de la forme.
      };
      // Erreur : null.
      if (json.error) return null;
      // Emprise : la complète, sinon l'autre.
      const ext = json.fullExtent ?? json.extent;
      // Emprise absente ou incomplète : null.
      if (!ext || ext.xmin == null || ext.xmax == null || ext.ymin == null || ext.ymax == null) return null;
      // Degrés seulement (les projections polaires ou en mètres ne se découpent pas en plate carrée).
      // Hors des bornes des degrés : null.
      if (Math.abs(ext.ymin) > 90.5 || Math.abs(ext.ymax) > 90.5 || ext.xmin < -180.5 || ext.xmax > 360.5) return null;
      // Projection : celle du service, sinon celle de l'emprise.
      const srObj = json.spatialReference ?? ext.spatialReference ?? {};
      // Son code : le numéro, sinon le texte WKT, sinon rien.
      const sr = srObj.wkid != null ? String(srObj.latestWkid ?? srObj.wkid) : srObj.wkt ? JSON.stringify({ wkt: srObj.wkt }) : '';
      // Aucun : null.
      if (!sr) return null;
      // Renvoie
      return {
        // la source ArcGIS ; longitudes en 0..360 si l'emprise commence à 0 ou plus et dépasse 180 ;
        kind: 'arcgis', product, url, image, sr, lon360: ext.xmin >= 0 && ext.xmax > 180,
        // sa mention.
        label: `${spec.name} : NASA Solar System Treks — ${product}`,
      // Fin de l'objet.
      };
    // En cas d'échec :
    } catch {
      // null.
      return null;
    // Fin du cas.
    }
  // Fin de probeArcgis.
  }

  // Méthode privée probeUsgs.
  private async probeUsgs(spec: SatelliteSourceSpec): Promise<Source | null> {
    // Essaie :
    try {
      // paramètres de la requête GetCapabilities ;
      const q = new URLSearchParams({ map: spec.usgsMap, SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetCapabilities' });
      // lit les capacités de la carte ;
      const res = await this.fetchFn(`${USGS_WMS}?${q}`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      // réponse en erreur : null ;
      if (!res.ok) return null;
      // analyse le fichier ;
      const caps = parseCapabilities(await res.text());
      // choisit la couche ;
      const layer = pickUsgsLayer(caps.layers);
      // aucune : null ;
      if (!layer) return null;
      // projection : EPSG:4326 si elle est proposée, sinon la première, sinon EPSG:4326 ;
      const srs = caps.crs.find((c) => /EPSG:4326/i.test(c)) || caps.crs[0] || 'EPSG:4326';
      // longitudes en 0..360 si l'emprise commence à 0 ou plus et dépasse 180 ;
      const lon360 = Boolean(caps.bbox && caps.bbox.west >= 0 && caps.bbox.east > 180);
      // renvoie la source USGS et sa mention.
      return { kind: 'usgs', layer, srs, lon360, label: `${spec.name} : USGS Astrogeology — ${layer}` };
    // En cas d'échec :
    } catch {
      // null.
      return null;
    // Fin du cas.
    }
  // Fin de probeUsgs.
  }

  // Méthode privée arcgisUrl : l'adresse d'export d'une tuile.
  private arcgisUrl(source: Extract<Source, { kind: 'arcgis' }>, z: number, x: number, y: number): string {
    // Emprise de la tuile.
    const b = satTileBounds(z, x, y);
    // Décalage de 360° pour une tuile à l'ouest d'une carte en 0..360.
    const shift = source.lon360 && b.west < 0 ? 360 : 0;
    // Paramètres :
    const params = new URLSearchParams({
      // l'emprise décalée ;
      bbox: [b.west + shift, b.south, b.east + shift, b.north].join(','),
      // les projections, la taille de 256 pixels, la réponse en image ;
      bboxSR: source.sr, imageSR: source.sr, size: '256,256', f: 'image',
      // le format et l'opacité.
      format: source.image ? 'jpgpng' : 'jpg', transparent: 'false',
    // Fin des paramètres.
    });
    // Renvoie l'adresse : « exportImage » pour un ImageServer, « export » sinon.
    return `${source.url}/${source.image ? 'exportImage' : 'export'}?${params}`;
  // Fin de arcgisUrl.
  }

  // Méthode privée download.
  private async download(spec: SatelliteSourceSpec, source: Source, z: number, x: number, y: number): Promise<Tile> {
    // Adresse de la tuile.
    let url: string;
    // Source WMTS :
    if (source.kind === 'trek') {
      // matrice du niveau ;
      const matrix = source.info.levels.get(z);
      // absente : erreur 404 ;
      if (matrix === undefined) throw new NotFoundException(`Niveau ${z} absent pour ${spec.name}.`);
      // adresse : base, jeu de tuiles, matrice, ligne, colonne, extension.
      url = `${source.base}/1.0.0/default/${source.info.matrixSet}/${matrix}/${y}/${x}.${source.info.extension}`;
    // Source ArcGIS :
    } else if (source.kind === 'arcgis') {
      // au-delà du niveau 6 : erreur 404 ;
      if (z > ARCGIS_MAX_ZOOM) throw new NotFoundException(`Niveau ${z} absent pour ${spec.name}.`);
      // adresse d'export.
      url = this.arcgisUrl(source, z, x, y);
    // Source USGS :
    } else {
      // au-delà du niveau 5 : erreur 404 ;
      if (z > USGS_MAX_ZOOM) throw new NotFoundException(`Niveau ${z} absent pour ${spec.name}.`);
      // adresse de la requête WMS.
      url = `${USGS_WMS}?${usgsGetMapQuery(spec.usgsMap, source.layer, source.srs, z, x, y, source.lon360)}`;
    // Fin du choix.
    }
    // Réponse HTTP.
    let res: Response;
    // Essaie
    try {
      // de télécharger, avec un délai de 20 secondes.
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(TILE_TIMEOUT_MS) });
    // En cas d'échec :
    } catch (e) {
      // erreur 502 « source injoignable ».
      throw new BadGatewayException(`${spec.name} : source injoignable (${(e as Error).message}).`);
    // Fin du cas.
    }
    // Type de contenu.
    const contentType = res.headers.get('content-type') || '';
    // Réponse en erreur, ou qui n'est pas une image :
    if (!res.ok || !/^image\//i.test(contentType)) {
      // erreur 502 « tuile refusée ».
      throw new BadGatewayException(`${spec.name} : tuile ${z}/${x}/${y} refusée par la source (HTTP ${res.status}).`);
    // Fin du cas.
    }
    // Renvoie les octets et le type de contenu.
    return { body: Buffer.from(await res.arrayBuffer()), contentType };
  // Fin de download.
  }
// Fin du service.
}
