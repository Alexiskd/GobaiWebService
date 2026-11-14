// Outils NestJS : erreur 502, service injectable, journal, erreur 404.
import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
// createRequire : fabrique un « require » pour charger un module CommonJS.
import { createRequire } from 'node:module';
// Types (effacés à la compilation) d'une couche résolue, d'une description de couche et d'un fournisseur de tuiles.
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './providers/tile-provider';
// Ouvre l'import du module des sources de la Terre :
import {
  // ses classes, sa table des sources et ses fonctions ;
  CoverageMemo, EARTH_SOURCE_BY_ID, NoCoverageError, SourceHealth, TileAbsentError, candidates, directPlan, enabledSources, hedged, isAbsentStatus, isBlank, isOff,
  // et deux types : une source et son identifiant.
  type EarthSource, type EarthSourceId,
// Fin de l'import.
} from './earth-sources';
// Ouvre l'import du module « Terre à l'instant T » :
import {
  // ses constantes, ses sources et ses fonctions ;
  LIVE_LAYER_ID, LIVE_MAX_ZOOM, LIVE_SOURCES, isLiveTile, liveCandidates, liveExpiry, liveSlot, liveTemplate, liveTime,
  // et le type d'une source en direct.
  type LiveSource,
// Fin de l'import.
} from './earth-live';

// Même chargement que mars-fusion.service.ts (module CommonJS natif).
// Charge la bibliothèque d'images sharp, sans typage (la ligne du dessous autorise ce « any » pour ESLint).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharp = createRequire(__filename)('sharp') as any;

/**
 * Imagerie satellite de la Terre : une seule couche, « earth-hd », zoomable jusqu'au niveau 19 partout.
 *
 * Le serveur réunit toutes les sources d'imagerie disponibles (earth-sources.ts : orthophotos nationales de quatorze pays,
 * Sentinel-2, NASA GIBS) et choisit tuile par tuile :
 *  1. les sources capables de servir la tuile à son niveau et à son emplacement, la plus détaillée d'abord ;
 *  2. interrogation en cascade rapprochée : la source préférée part seule ; si elle échoue, ou n'a pas répondu après
 *     EARTH_HEDGE_MS (450 ms), la suivante part aussi et la première réponse gagne ;
 *  3. une source en panne (3 échecs d'affilée) est écartée une minute : plus d'attente de son délai d'expiration ;
 *  4. une source nationale qui renvoie une tuile vide (hors de son territoire) passe la main à la suivante, sans
 *     compter comme une panne ; elle n'est plus interrogée pour les tuiles plus fines du même endroit ;
 *  5. au-delà du niveau natif de toutes les sources, la tuile est découpée dans son ancêtre le plus proche puis
 *     agrandie (sharp, Lanczos). L'ancêtre est gardé en mémoire : ses 4^d descendants ne le retéléchargent pas.
 * Une tuile servie par une autre source que la préférée (cascade, panne) n'est gardée que brièvement, en mémoire comme
 * dans le navigateur : la meilleure image revient dès que sa source répond de nouveau.
 *
 * « sentinel2 » et « ign-ortho » (une source seule) restent servies pour les anciens clients, sans être listées.
 *
 * Seconde couche, « earth-live » (voir earth-live.ts) : la Terre à l'instant T. Pour chaque tuile, l'image du ou des
 * satellites géostationnaires qui la voient (GOES-West, GOES-East, Meteosat, Himawari), prise il y a moins d'une heure
 * et renouvelée toutes les dix minutes, est posée par-dessus le fond « earth-hd » : les pôles, et tout endroit dont le
 * satellite ne répond pas, gardent ce fond. Niveaux 0 à 7 (≈ 1 km par pixel), agrandis au-delà par le navigateur.
 */

// Niveau de zoom maximal de la couche unique : 19.
export const EARTH_HD_MAX_ZOOM = 19;
// Nombre maximal de niveaux qu'on remonte pour découper une tuile : 6.
const MAX_CROP_LEVELS = 6; // 256 px / 2^6 = 4 px : en dessous, l'agrandissement n'a plus de sens
// Délai maximal d'un téléchargement : 8 secondes.
const TIMEOUT_MS = 8_000;
// Délai de la cascade rapprochée : EARTH_HEDGE_MS, ou 450 ms, jamais moins de 50 ms.
const HEDGE_MS = Math.max(50, Number(process.env.EARTH_HEDGE_MS) || 450);
// Nombre de tuiles gardées en mémoire : 3 000.
const MEMORY_TILES = 3000;
// Nombre de tuiles ancêtres gardées en mémoire : 600.
const MEMORY_ANCESTORS = 600;
// Durée de garde d'une tuile de repli : 10 minutes.
const FALLBACK_TTL_MS = 10 * 60_000; // tuile d'une source de repli : gardée 10 min en mémoire
// Taille maximale d'une tuile : 2 Mo.
const MAX_BYTES = 2 * 1024 * 1024;
// Nombre de tuiles en direct gardées en mémoire : 1 500.
const LIVE_MEMORY_TILES = 1500;
// Délai maximal d'un téléchargement en direct : 6 secondes.
const LIVE_TIMEOUT_MS = 6_000;
/** Part d'opacité moyenne (0 à 255) sous laquelle l'image d'un satellite est tenue pour vide (tuile hors de son disque). */
// Seuil d'opacité d'une image vide : 8.
const LIVE_EMPTY_ALPHA = 8;

// Valeurs communes aux descriptions de couche :
const base = {
  // fournisseur « earth-hd », astre Terre, projection Web Mercator, zoom minimal 0, tuiles de 256 pixels ;
  provider: 'earth-hd' as const, body: 'earth' as const, projection: 'mercator' as const, minZoom: 0, tileSize: 256,
  // format JPEG, opaque, sans clé, vérifié.
  format: 'jpeg' as const, transparent: false, requiresKey: false, experimental: false,
// Fin de base.
};

/** Anciennes couches à source unique : la source y sert tous les niveaux et toute emprise. */
// Anciennes couches, avec leur source et leur zoom maximal :
const LEGACY: Record<string, { source: EarthSourceId; maxZoom: number }> = {
  // « sentinel2 » : Sentinel-2, jusqu'au niveau 14 ;
  sentinel2: { source: 'sentinel2', maxZoom: 14 },
  // « ign-ortho » : l'IGN, jusqu'au niveau 19.
  'ign-ortho': { source: 'ign', maxZoom: 19 },
// Fin de LEGACY.
};

// Fonction describeSources : les noms des sources, séparés par des virgules.
const describeSources = (list: EarthSource[]) => list.map((s) => s.label).join(', ');

// Fonction isTile : la tuile existe-t-elle ?
export const isTile = (z: number, x: number, y: number) =>
  // Oui si les trois valeurs sont entières, le niveau entre 0 et 19,
  Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y) && z >= 0 && z <= EARTH_HD_MAX_ZOOM
  // et la colonne et la ligne dans la grille.
  && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;

/** `preferred` : vrai si la tuile vient de la source la plus détaillée prévue pour cet endroit. */
// Forme d'une tuile rendue : ses octets, son type de contenu, sa source, et si c'est la source préférée.
export interface EarthTile { body: Buffer; contentType: string; source: EarthSourceId; preferred: boolean }

// Forme d'une tuile en mémoire : la tuile et sa date limite.
type Cached = { tile: EarthTile; until: number };

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service d'imagerie de la Terre ; c'est un fournisseur de tuiles.
export class EarthImageryService implements TileProvider {
  // Identifiant du fournisseur.
  readonly id = 'earth-hd' as const;
  // Méthode isAvailable : toujours disponible.
  isAvailable(): boolean { return true; }
  // Journal préfixé par « Terre HD ».
  private readonly log = new Logger('Terre HD');
  // Mémoire des tuiles.
  private readonly memory = new Map<string, Cached>();
  // Mémoire des tuiles ancêtres.
  private readonly ancestors = new Map<string, Cached>();
  // Téléchargements en cours, par clé.
  private readonly pending = new Map<string, Promise<EarthTile>>();
  // Santé des sources.
  private readonly health = new SourceHealth();
  // Mémoire des tuiles vides.
  private readonly coverage = new CoverageMemo();
  /** Variante d'adresse qui a répondu en dernier, par source (évite de réessayer celle qui échoue à chaque tuile). */
  // Numéro de la variante d'adresse à essayer d'abord, par source.
  private readonly variant = new Map<EarthSourceId, number>();
  // Sources actives.
  private readonly sources: EarthSource[];
  /** Tuiles de la couche « earth-live », par créneau de dix minutes (les anciens créneaux sortent par ancienneté). */
  // Mémoire des tuiles en direct.
  private readonly liveMemory = new Map<string, EarthTile>();
  // Heure du dernier avertissement écrit au journal.
  private lastWarn = 0;

  // Constructeur ; ses paramètres :
  constructor(
    // la fonction de téléchargement, fetch par défaut ;
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    // l'horloge, Date.now par défaut.
    private readonly now: () => number = Date.now,
  // Corps du constructeur :
  ) {
    // retient les sources actives ;
    this.sources = enabledSources();
    // écrit leur liste dans le journal.
    this.log.log(`Couche unique : ${describeSources(this.sources)}`);
  // Fin du constructeur.
  }

  // Méthode layers : les deux couches proposées.
  layers(): TileLayerInfo[] {
    // Première couche :
    return [{
      // les valeurs communes, l'identifiant « earth-hd », son nom, sa nature et son zoom maximal ;
      ...base, id: 'earth-hd', label: 'Satellite HD (couche unique)', kind: 'imagery', maxZoom: EARTH_HD_MAX_ZOOM,
      // sa description, avec la liste des sources.
      description: `Une seule couche, la meilleure source pour chaque tuile : ${describeSources(this.sources)}. Zoom jusqu’au niveau 19.`,
    // Seconde couche :
    }, {
      // les valeurs communes, l'identifiant de la couche en direct, son nom, sa nature et son zoom maximal ;
      ...base, id: LIVE_LAYER_ID, label: 'Terre à l’instant T (satellites géostationnaires)', kind: 'imagery', maxZoom: LIVE_MAX_ZOOM,
      // Adresses des satellites non essayées depuis le développement : voir earth-live.ts.
      // marquée expérimentale ;
      experimental: true,
      // sa description, avec la liste des satellites.
      description: `Le monde vu il y a moins d’une heure, renouvelé toutes les 10 minutes : ${LIVE_SOURCES.map((s) => s.label).join(', ')}, posés sur le fond habituel (pôles et zones sans image). Zoom jusqu’au niveau ${LIVE_MAX_ZOOM}.`,
    // Fin de la liste.
    }];
  // Fin de layers.
  }

  // Méthode has : vrai pour « earth-hd », la couche en direct et les anciennes couches.
  has(id: string): boolean { return id === 'earth-hd' || id === LIVE_LAYER_ID || id in LEGACY; }

  // Méthode resolve : la version asynchrone de resolveSync.
  async resolve(id: string): Promise<ResolvedTileLayer> { return this.resolveSync(id); }

  // Méthode resolveSync : une couche prête à charger.
  resolveSync(id: string): ResolvedTileLayer {
    // Couche inconnue : erreur 404.
    if (!this.has(id)) throw new NotFoundException(`Couche terrestre inconnue : « ${id} ».`);
    // Si c'est la couche en direct :
    if (id === LIVE_LAYER_ID) {
      // L'instant fait partie de l'adresse des tuiles : le navigateur relit cette fiche à chaque nouveau créneau.
      // créneau en cours ;
      const slot = liveSlot(this.now());
      // renvoie
      return {
        // la description de la seconde couche ;
        ...this.layers()[1],
        // le modèle d'adresse du créneau ;
        urlTemplate: liveTemplate(slot),
        // sa date d'expiration ;
        expiresAt: liveExpiry(slot),
        // pas d'accord de couleur ;
        colorMatch: false,
        // la mention : celles des satellites et l'instant de l'image.
        attribution: { text: `${LIVE_SOURCES.map((s) => s.attribution).join(' · ')} · image du ${liveTime(slot)}` },
      // Fin de l'objet.
      };
    // Fin du cas.
    }
    // Ancienne couche, s'il y en a une sous cet identifiant.
    const legacy = LEGACY[id];
    // Description :
    const info: TileLayerInfo = legacy
      // celle de l'ancienne couche, avec le nom de sa source ;
      ? { ...base, id, label: EARTH_SOURCE_BY_ID.get(legacy.source)!.label, kind: 'imagery', maxZoom: legacy.maxZoom, description: 'Source seule (ancienne couche).' }
      // sinon celle de la couche unique.
      : this.layers()[0];
    // Renvoie
    return {
      // la description ;
      ...info,
      // Tout passe par le serveur : cache, choix de la source, découpage au-delà du niveau natif.
      // le modèle d'adresse, qui passe par ce serveur ;
      urlTemplate: `/api/v1/tiles/earth/${id}/{z}/{x}/{y}`,
      // pas d'expiration ;
      expiresAt: null,
      // Couche unique : le navigateur charge lui-même les tuiles des sources qui le permettent (plus de détour par
      // ce serveur) et ne demande au relais que le reste. Les anciennes couches restent entièrement relayées.
      // le plan de chargement direct, sauf pour une ancienne couche ;
      ...(legacy ? {} : { direct: directPlan(this.sources) ?? undefined }),
      // Même colorimétrie pour toutes les couches : le navigateur accorde chaque source nationale sur la mosaïque
      // mondiale. `EARTH_COLOR_MATCH=0` coupe cet accord.
      // l'accord de couleur (faux si EARTH_COLOR_MATCH est coupé), absent pour une ancienne couche ;
      ...(legacy ? {} : { colorMatch: !isOff(process.env.EARTH_COLOR_MATCH) }),
      // la mention : celles des sources de la couche.
      attribution: { text: this.sourcesOf(id).map((s) => s.attribution).join(' · ') },
    // Fin de l'objet.
    };
  // Fin de resolveSync.
  }

  // Méthode attribution : le texte de la mention d'une couche.
  async attribution(id: string): Promise<string> { return this.resolveSync(id).attribution.text; }

  /** État des sources de la couche unique : actives, écartées, latence moyenne. Les clés ne sont jamais renvoyées. */
  // Méthode status : le délai de la cascade et l'état de chaque source.
  status(): { hedgeMs: number; sources: Array<{ id: EarthSourceId; label: string; minZoom: number; maxZoom: number; worldwide: boolean; requiresKey: boolean; usable: boolean; ok: number; failed: number; averageMs: number }> } {
    // Table des statistiques de santé par source.
    const stats = new Map(this.health.snapshot().map((s) => [s.id, s]));
    // Renvoie
    return {
      // le délai de la cascade ;
      hedgeMs: HEDGE_MS,
      // et, pour chaque source,
      sources: this.sources.map((s) => ({
        // son identifiant, son nom, ses niveaux, si elle est mondiale, si elle demande une clé ;
        id: s.id, label: s.label, minZoom: s.minZoom, maxZoom: s.maxZoom, worldwide: !s.bboxes, requiresKey: Boolean(s.keyEnv),
        // si elle est utilisable, ses réussites, ses échecs et sa latence moyenne (0 par défaut).
        usable: this.health.usable(s.id), ok: stats.get(s.id)?.ok ?? 0, failed: stats.get(s.id)?.failed ?? 0, averageMs: stats.get(s.id)?.averageMs ?? 0,
      // Fin de la liste.
      })),
    // Fin de l'objet.
    };
  // Fin de status.
  }

  /** Sources d'une couche : toutes pour « earth-hd », une seule (tous niveaux, toute emprise) pour une ancienne couche. */
  // Méthode privée sourcesOf.
  private sourcesOf(id: string): EarthSource[] {
    // Ancienne couche, s'il y en a une.
    const legacy = LEGACY[id];
    // Sinon : toutes les sources.
    if (!legacy) return this.sources;
    // Source de l'ancienne couche.
    const s = EARTH_SOURCE_BY_ID.get(legacy.source)!;
    // La renvoie seule, dès le niveau 0, jusqu'au zoom de la couche, sans emprise.
    return [{ ...s, minZoom: 0, maxZoom: legacy.maxZoom, bboxes: undefined }];
  // Fin de sourcesOf.
  }

  /** Tuile (z, x, y) de la couche `id`, depuis la mémoire ou les sources. */
  // Méthode tile.
  tile(id: string, z: number, x: number, y: number): Promise<EarthTile> {
    // Couche inconnue : erreur 404.
    if (!this.has(id)) throw new NotFoundException(`Couche terrestre inconnue : « ${id} ».`);
    // Couche en direct : passe la main à liveTile.
    if (id === LIVE_LAYER_ID) return this.liveTile(z, x, y);
    // Tuile hors de la grille : erreur 404.
    if (!isTile(z, x, y)) throw new NotFoundException(`Tuile ${z}/${x}/${y} inexistante.`);
    // Renvoie la tuile de la mémoire, ou la fabrique.
    return this.cached(this.memory, MEMORY_TILES, `${id}/${z}/${x}/${y}`, () => this.build(id, z, x, y));
  // Fin de tile.
  }

  // ------------------------------------------------------------------ Terre à l'instant T (earth-live)

  /**
   * Tuile de la couche « earth-live » pour le créneau en cours : images des satellites qui voient la tuile, posées
   * sur le fond « earth-hd ». Gardée en mémoire par créneau ; les demandes simultanées sont regroupées.
   */
  // Méthode privée liveTile.
  private liveTile(z: number, x: number, y: number): Promise<EarthTile> {
    // Tuile hors de la couche : erreur 404.
    if (!isLiveTile(z, x, y)) throw new NotFoundException(`Tuile ${z}/${x}/${y} inexistante.`);
    // Créneau en cours.
    const slot = liveSlot(this.now());
    // Clé de la tuile : créneau, niveau, colonne, ligne.
    const key = `${slot}/${z}/${x}/${y}`;
    // La cherche en mémoire.
    const hit = this.liveMemory.get(key);
    // Trouvée : la renvoie.
    if (hit) return Promise.resolve(hit);
    // Cherche une fabrication en cours.
    let p = this.pending.get(`l/${key}`);
    // Aucune :
    if (!p) {
      // lance la fabrication ; quand elle finit :
      p = this.buildLive(z, x, y, liveTime(slot)).then((tile) => {
        // Une tuile sans aucune image de satellite (fond seul) n'est pas gardée : elle sera retentée.
        // si la tuile porte une image de satellite,
        if (tile.preferred) {
          // la garde en mémoire,
          this.liveMemory.set(key, tile);
          // et retire les plus anciennes au-delà de 1 500.
          while (this.liveMemory.size > LIVE_MEMORY_TILES) this.liveMemory.delete(this.liveMemory.keys().next().value!);
        // Fin du cas.
        }
        // Rend la tuile.
        return tile;
      // Dans tous les cas, retire la fabrication de la liste des fabrications en cours.
      }).finally(() => this.pending.delete(`l/${key}`));
      // L'inscrit dans cette liste.
      this.pending.set(`l/${key}`, p);
    // Fin du cas.
    }
    // Renvoie la promesse.
    return p;
  // Fin de liveTile.
  }

  // Méthode privée buildLive.
  private async buildLive(z: number, x: number, y: number, time: string): Promise<EarthTile> {
    // Satellites qui voient la tuile.
    const sats = liveCandidates(z, x, y);
    // Fond et satellites demandés en même temps ; un satellite absent ne bloque ni le fond ni les autres.
    // Demande en même temps :
    const [ground, ...shots] = await Promise.all([
      // le fond, ou null s'il échoue ;
      this.tile('earth-hd', z, x, y).catch(() => null),
      // l'image de chaque satellite, ou null si elle échoue.
      ...sats.map((s) => this.liveShot(s, z, x, y, time).catch(() => null)),
    // Fin des demandes.
    ]);
    // Le satellite qui couvre le plus la tuile est posé en dernier : il reste au-dessus.
    // Images obtenues, dans l'ordre inverse.
    const layers = shots.filter((b): b is Buffer => Boolean(b)).reverse();
    // Aucune image :
    if (!layers.length) {
      // sans fond non plus : erreur 502 ;
      if (!ground) throw new BadGatewayException(`Image en direct indisponible pour ${z}/${x}/${y}.`);
      // sinon renvoie le fond, marqué « non préféré ».
      return { ...ground, preferred: false };
    // Fin du cas.
    }
    // Toile de départ :
    const canvas = ground
      // le fond, ramené à 256 pixels ;
      ? sharp(ground.body).resize(256, 256)
      // ou, sans fond, un carré bleu nuit.
      : sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 6, g: 12, b: 28 } } });
    // Y pose les images et encode en JPEG, qualité 85.
    const body: Buffer = await canvas.composite(layers.map((input) => ({ input }))).jpeg({ quality: 85 }).toBuffer();
    // Renvoie la tuile, marquée « préférée ».
    return { body, contentType: 'image/jpeg', source: ground?.source ?? 'gibs', preferred: true };
  // Fin de buildLive.
  }

  /** Image d'un satellite pour une tuile (PNG 256 px avec transparence), ou erreur si elle est absente ou vide. */
  // Méthode privée liveShot.
  private async liveShot(s: LiveSource, z: number, x: number, y: number, time: string): Promise<Buffer> {
    // Dernière erreur.
    let lastError: unknown = new Error('aucune adresse');
    // Pour chaque adresse du satellite :
    for (const url of s.urls(z, x, y, time)) {
      // essaie
      try {
        // de télécharger l'image, avec un délai de 6 secondes ;
        const img = await this.fetchImage(url, AbortSignal.timeout(LIVE_TIMEOUT_MS));
        // de la ramener à 256 pixels, avec un canal alpha, en PNG ;
        const png: Buffer = await sharp(img.body).resize(256, 256).ensureAlpha().png().toBuffer();
        // de lire ses statistiques.
        const { channels } = await sharp(png).stats();
        // Hors du disque du satellite (ou image pas encore produite) : entièrement transparente ou noire.
        // Si elle est presque transparente, ou noire et unie :
        if (channels[3].mean < LIVE_EMPTY_ALPHA || channels.slice(0, 3).every((c: { mean: number; stdev: number }) => c.mean < 4 && c.stdev < 2)) {
          // erreur « hors couverture ».
          throw new NoCoverageError(s.label);
        // Fin du cas.
        }
        // Renvoie l'image.
        return png;
      // En cas d'échec,
      } catch (e) {
        // garde l'erreur et passe à l'adresse suivante.
        lastError = e;
      // Fin du cas.
      }
    // Fin de la boucle.
    }
    // Si ce n'est pas un « hors couverture », l'écrit dans le journal.
    if (!(lastError instanceof NoCoverageError)) this.warn(s.label, z, x, y, lastError);
    // Relance la dernière erreur.
    throw lastError;
  // Fin de liveShot.
  }

  /** Mémoire LRU + regroupement des demandes simultanées de la même tuile. */
  // Méthode privée cached.
  private cached(store: Map<string, Cached>, capacity: number, key: string, make: () => Promise<EarthTile>): Promise<EarthTile> {
    // Cherche la tuile en mémoire.
    const hit = store.get(key);
    // Trouvée :
    if (hit) {
      // la retire ;
      store.delete(key);
      // encore valable : la remet en fin de liste et la renvoie.
      if (hit.until > Date.now()) { store.set(key, hit); return Promise.resolve(hit.tile); }
    // Fin du cas.
    }
    // Clé de la fabrication en cours : « t » pour une tuile, « a » pour un ancêtre.
    const pendingKey = `${store === this.memory ? 't' : 'a'}/${key}`;
    // Cherche une fabrication en cours.
    let p = this.pending.get(pendingKey);
    // Aucune :
    if (!p) {
      // lance la fabrication ; quand elle finit :
      p = make().then((tile) => {
        // garde la tuile, sans limite si elle vient de la source préférée, sinon 10 minutes ;
        store.set(key, { tile, until: tile.preferred ? Infinity : Date.now() + FALLBACK_TTL_MS });
        // retire les plus anciennes au-delà de la capacité ;
        while (store.size > capacity) store.delete(store.keys().next().value!);
        // rend la tuile.
        return tile;
      // Dans tous les cas, retire la fabrication de la liste.
      }).finally(() => this.pending.delete(pendingKey));
      // L'inscrit dans la liste.
      this.pending.set(pendingKey, p);
    // Fin du cas.
    }
    // Renvoie la promesse.
    return p;
  // Fin de cached.
  }

  /** Tuile native si une source la sert à ce niveau, sinon découpée dans l'ancêtre natif le plus proche. */
  // Méthode privée build.
  private async build(id: string, z: number, x: number, y: number): Promise<EarthTile> {
    // Sources de la couche.
    const sources = this.sourcesOf(id);
    // Dernière erreur.
    let lastError: unknown = null;
    // Remonte d'un niveau à la fois, de 0 à 6 :
    for (let d = 0; d <= MAX_CROP_LEVELS && z - d >= 0; d++) {
      // niveau, colonne et ligne de l'ancêtre.
      const az = z - d, ax = x >> d, ay = y >> d;
      // Aucune source ne le sert : niveau suivant.
      if (!candidates(az, ax, ay, sources).length) continue;
      // Essaie :
      try {
        // au niveau de la tuile : la tuile native.
        if (d === 0) return await this.native(sources, z, x, y);
        // Ancêtre partagé par tous ses descendants : téléchargé une fois, gardé en mémoire.
        // Sinon l'ancêtre, de la mémoire ou téléchargé.
        const parent = await this.cached(this.ancestors, MEMORY_ANCESTORS, `${id}/${az}/${ax}/${ay}`, () => this.native(sources, az, ax, ay));
        // Renvoie la part de l'ancêtre agrandie, avec sa source.
        return { body: await cropUp(parent.body, d, x - (ax << d), y - (ay << d)), contentType: 'image/jpeg', source: parent.source, preferred: parent.preferred };
      // En cas d'échec,
      } catch (e) {
        // garde l'erreur.
        lastError = e;
      // Fin du cas.
      }
    // Fin de la boucle.
    }
    // Écrit l'échec dans le journal.
    this.warn('Toutes les sources', z, x, y, lastError ?? new Error('aucune source pour cette tuile'));
    // Erreur 502.
    throw new BadGatewayException(`Imagerie satellite indisponible pour ${z}/${x}/${y}.`);
  // Fin de build.
  }

  /** Tuile native : cascade rapprochée sur les sources candidates, écartées celles en panne. */
  // Méthode privée native.
  private async native(sources: EarthSource[], z: number, x: number, y: number): Promise<EarthTile> {
    // Sources qui couvrent vraiment l'endroit : sans celles déjà vues vides ici (ou sur un ancêtre de la tuile).
    // Fonction covers : la source n'a pas été vue vide ici.
    const covers = (s: EarthSource) => !this.coverage.isEmpty(s.id, z, x, y, s.minZoom);
    // Toutes les sources candidates qui couvrent l'endroit.
    const all = candidates(z, x, y, sources).filter(covers);
    // Les mêmes, sans celles en panne.
    const list = candidates(z, x, y, sources, (sid) => this.health.usable(sid)).filter(covers);
    // Aucune : erreur « hors couverture ».
    if (!list.length) throw new NoCoverageError(`${z}/${x}/${y}`);
    // Les interroge en cascade rapprochée.
    const { value, index } = await hedged(list.map((s) => (signal: AbortSignal) => this.fromSource(s, z, x, y, signal)), HEDGE_MS);
    // Préférée = la première source qui couvre l'endroit, une fois écartées celles qui viennent de répondre « vide ».
    // Source préférée : la première qui couvre encore l'endroit, sinon la gagnante.
    const best = all.find(covers) ?? list[index];
    // Renvoie la tuile, sa source, et si c'est la préférée.
    return { ...value, source: list[index].id, preferred: list[index].id === best.id };
  // Fin de native.
  }

  /** Tuile vide d'une source nationale (hors de son territoire) ? Les sources mondiales ne sont pas contrôlées. */
  // Méthode privée blank.
  private async blank(s: EarthSource, body: Buffer): Promise<boolean> {
    // Source mondiale : jamais vide.
    if (!s.bboxes) return false;
    // Essaie
    try {
      // de lire les statistiques de l'image et de dire si elle est vide.
      return isBlank((await sharp(body).stats()).channels);
    // En cas d'échec :
    } catch {
      // pas vide.
      return false; // image illisible par sharp : on la sert telle quelle, comme avant
    // Fin du cas.
    }
  // Fin de blank.
  }

  /** Une source : essaie la variante d'adresse qui a marché en dernier, puis les autres. */
  // Méthode privée fromSource.
  private async fromSource(s: EarthSource, z: number, x: number, y: number, signal: AbortSignal): Promise<{ body: Buffer; contentType: string }> {
    // Adresses de la tuile, avec la clé de la source si elle en a une.
    const urls = s.urls(z, x, y, s.keyEnv ? process.env[s.keyEnv]?.trim() || '' : '');
    // Variante à essayer d'abord.
    const first = this.variant.get(s.id) ?? 0;
    // Heure de départ.
    const started = Date.now();
    // Dernière erreur.
    let lastError: unknown = new Error('aucune adresse');
    // Nombre de réponses « pas de tuile ici ».
    let absent = 0;
    // Pour chaque adresse :
    for (let i = 0; i < urls.length; i++) {
      // son numéro, en partant de la variante retenue ;
      const k = (first + i) % urls.length;
      // essaie
      try {
        // de télécharger l'image ;
        const img = await this.fetchImage(urls[k], signal);
        // retient cette variante ;
        this.variant.set(s.id, k);
        // note la réussite et sa durée ;
        this.health.success(s.id, Date.now() - started);
        // si l'image est vide :
        if (await this.blank(s, img.body)) {
          // le note pour cet endroit,
          this.coverage.mark(s.id, z, x, y);
          // erreur « hors couverture ».
          throw new NoCoverageError(s.label);
        // Fin du cas.
        }
        // Renvoie l'image.
        return img;
      // En cas d'échec :
      } catch (e) {
        // annulation ou « hors couverture » : relance l'erreur ;
        if (signal.aborted || e instanceof NoCoverageError) throw e; // autre source gagnante ou hors couverture : ni panne ni journal
        // tuile absente : la compte ;
        if (e instanceof TileAbsentError) absent++;
        // garde l'erreur.
        lastError = e;
      // Fin du cas.
      }
    // Fin de la boucle.
    }
    // Toutes les adresses répondent « pas de tuile ici » (404) : la source fonctionne, elle n'a rien à cet endroit
    // (mer ou pays voisin dans l'emprise d'une source nationale, dalle absente d'un millésime). Ni panne ni journal :
    // la source suivante sert la tuile, et celle-ci n'est pas écartée pour les tuiles voisines.
    // Si toutes les adresses ont répondu « pas de tuile ici » :
    if (urls.length && absent === urls.length) {
      // pour une source nationale, le note pour cet endroit ;
      if (s.bboxes) this.coverage.mark(s.id, z, x, y);
      // erreur « hors couverture ».
      throw new NoCoverageError(s.label);
    // Fin du cas.
    }
    // Note l'échec ; s'il écarte la source, l'écrit dans le journal.
    if (this.health.failure(s.id)) this.log.warn(`${s.label} écartée pendant une minute (3 échecs d'affilée).`);
    // Écrit l'échec dans le journal.
    this.warn(s.label, z, x, y, lastError);
    // Relance la dernière erreur.
    throw lastError;
  // Fin de fromSource.
  }

  /** Échec d'une source : une ligne de journal par minute au plus (sans adresse : elle peut contenir une clé). */
  // Méthode privée warn.
  private warn(source: string, z: number, x: number, y: number, e: unknown): void {
    // Heure courante.
    const now = Date.now();
    // Moins d'une minute depuis le dernier avertissement : rien.
    if (now - this.lastWarn < 60_000) return;
    // Retient l'heure.
    this.lastWarn = now;
    // Écrit l'avertissement : la source, la tuile et le message de l'erreur.
    this.log.warn(`${source} indisponible pour ${z}/${x}/${y} : ${e instanceof Error ? e.message : String(e)}`);
  // Fin de warn.
  }

  // Méthode privée fetchImage.
  private async fetchImage(url: string, signal: AbortSignal): Promise<{ body: Buffer; contentType: string }> {
    // Annulation : par la cascade (une autre source a gagné) ou au bout de TIMEOUT_MS.
    // Contrôleur d'annulation.
    const ctrl = new AbortController();
    // Fonction abort : annule.
    const abort = () => ctrl.abort();
    // Signal déjà annulé : annule tout de suite ; sinon annule quand il le sera.
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    // Annule aussi au bout de 8 secondes.
    const timer = setTimeout(abort, TIMEOUT_MS);
    // Essaie
    try {
      // de télécharger, avec le signal et un en-tête User-Agent ;
      const res = await this.fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': 'GobaiWebService' } });
      // type de contenu de la réponse ;
      const type = res.headers.get('content-type') || '';
      // code « pas de tuile ici » : erreur « tuile absente » ;
      if (isAbsentStatus(res.status)) throw new TileAbsentError(res.status, type);
      // réponse en erreur, ou qui n'est pas une image : erreur ;
      if (!res.ok || !type.startsWith('image/')) throw new Error(`HTTP ${res.status} ${type}`);
      // lit les octets ;
      const body = Buffer.from(await res.arrayBuffer());
      // vide ou trop lourd : erreur ;
      if (body.length === 0 || body.length > MAX_BYTES) throw new Error('Tuile vide ou trop lourde');
      // renvoie les octets et le type de contenu, sans ses paramètres.
      return { body, contentType: type.split(';')[0].trim() };
    // Dans tous les cas :
    } finally {
      // arrête la minuterie ;
      clearTimeout(timer);
      // cesse d'écouter le signal.
      signal.removeEventListener('abort', abort);
    // Fin du cas.
    }
  // Fin de fetchImage.
  }
// Fin du service.
}

/** Découpe la part (rx, ry) d'une tuile ancêtre de `d` niveaux et l'agrandit à 256 px. */
// Fonction cropUp.
export async function cropUp(img: Buffer, d: number, rx: number, ry: number): Promise<Buffer> {
  // Lit les dimensions de l'image.
  const meta = await sharp(img).metadata();
  // Sa largeur, 256 par défaut.
  const size = meta.width || 256;
  // Côté de la part à découper.
  const part = size / 2 ** d;
  // Reprend l'image,
  return sharp(img)
    // découpe la part (au moins 1 pixel de côté),
    .extract({ left: Math.round(rx * part), top: Math.round(ry * part), width: Math.max(1, Math.round(part)), height: Math.max(1, Math.round(part)) })
    // l'agrandit à 256 pixels (Lanczos),
    .resize(256, 256, { kernel: 'lanczos3' })
    // l'encode en JPEG, qualité 85,
    .jpeg({ quality: 85 })
    // et renvoie les octets.
    .toBuffer();
// Fin de cropUp.
}
