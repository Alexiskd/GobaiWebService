// Outils NestJS : erreur 502, service injectable, journal, erreur 404.
import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
// createRequire : fabrique un « require » pour charger un module CommonJS.
import { createRequire } from 'node:module';
// Types (effacés à la compilation) d'une couche résolue, d'une description de couche et d'un fournisseur de tuiles.
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from '../providers/tile-provider';
// Ouvre l'import du module des sources de la Terre :
import {
  // ses classes, sa table des sources et ses fonctions ;
  CoverageMemo, NoCoverageError, SourceHealth, TileAbsentError, candidates, enabledSources, hedged, isAbsentStatus, isBlank, isOff,
  // et deux types : une source et son identifiant.
  type EarthSource, type EarthSourceId,
// Fin de l'import.
} from './earth-sources';
// Table de priorité des sources, servie au navigateur : sa fabrication, son type et son adresse.
import { EARTH_PLAN_PATH, earthPlan, type EarthPlan } from './earth-plan';
// Fonds marins (GEBCO, NOAA NCEI) : leur table par identifiant de relais, et la fusion dans la couche unique.
import { SEAFLOOR_BY_ID, seafloorFusion } from './earth-seafloor';

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
 *     agrandie (sharp, Lanczos).
 * Aucune tuile n'est gardée sur ce serveur : seuls les téléchargements simultanés d'une même tuile (ou d'un même
 * ancêtre) sont partagés le temps de leur trajet. La table de priorité des sources est servie au navigateur par
 * earth-plan.ts ; le navigateur charge lui-même toutes les sources qui l'autorisent et ne demande ici que le reste.
 *
 * C'est la seule couche d'imagerie de la Terre listée. Le serveur relaie aussi, sans les lister, les tuiles des fonds
 * marins de la carte marine (earth-seafloor.ts) : « earth-ncei » (NOAA, vue de l'espace), « earth-gebco » (relief ombré
 * des fonds) et « earth-gebco-flat » (carte plate de GEBCO, pour les isobathes).
 */

// Niveau de zoom maximal de la couche unique : 19.
export const EARTH_HD_MAX_ZOOM = 19;
// Nombre maximal de niveaux qu'on remonte pour découper une tuile : 6.
const MAX_CROP_LEVELS = 6; // 256 px / 2^6 = 4 px : en dessous, l'agrandissement n'a plus de sens
// Délai maximal d'un téléchargement : 8 secondes.
const TIMEOUT_MS = 8_000;
// Délai de la cascade rapprochée : EARTH_HEDGE_MS, ou 450 ms, jamais moins de 50 ms.
const HEDGE_MS = Math.max(50, Number(process.env.EARTH_HEDGE_MS) || 450);
// Taille maximale d'une tuile : 2 Mo.
const MAX_BYTES = 2 * 1024 * 1024;

// Valeurs communes aux descriptions de couche :
const base = {
  // fournisseur « earth-hd », astre Terre, projection Web Mercator, zoom minimal 0, tuiles de 256 pixels ;
  provider: 'earth-hd' as const, body: 'earth' as const, projection: 'mercator' as const, minZoom: 0, tileSize: 256,
  // format JPEG, opaque, sans clé, vérifié.
  format: 'jpeg' as const, transparent: false, requiresKey: false, experimental: false,
// Fin de base.
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
  // Téléchargements en cours, par clé (partagés le temps du trajet, jamais gardés ensuite).
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
  // Heure du dernier avertissement écrit au journal.
  private lastWarn = 0;

  // Constructeur ; ses paramètres :
  constructor(
    // la fonction de téléchargement, fetch par défaut.
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  // Corps du constructeur :
  ) {
    // retient les sources actives ;
    this.sources = enabledSources();
    // écrit leur liste dans le journal.
    this.log.log(`Couche unique : ${describeSources(this.sources)}`);
  // Fin du constructeur.
  }

  // Méthode layers : la seule couche proposée, la couche unique.
  layers(): TileLayerInfo[] {
    // Une seule couche :
    return [{
      // les valeurs communes, l'identifiant « earth-hd », son nom, sa nature et son zoom maximal ;
      ...base, id: 'earth-hd', label: 'Terre', kind: 'imagery', maxZoom: EARTH_HD_MAX_ZOOM,
      // sa description, avec la liste des sources, et les fonds marins quand ils y sont fondus.
      description: `Une seule couche, la meilleure source pour chaque tuile : ${describeSources(this.sources)}.${seafloorFusion() ? ' Au large, la carte marine : teinte des océans de la NOAA (ETOPO 2022) vue de l’espace, relief des fonds et isobathes de GEBCO 2026 en zoomant.' : ''} Zoom jusqu’au niveau 19.`,
    // Fin de la liste.
    }];
  // Fin de layers.
  }

  // Méthode has : vrai pour la seule couche listée, « earth-hd ».
  has(id: string): boolean { return id === 'earth-hd'; }

  // Méthode serves : vrai pour les tuiles relayées, celles de « earth-hd » et des fonds marins.
  serves(id: string): boolean { return this.has(id) || SEAFLOOR_BY_ID.has(id); }

  // Méthode resolve : la version asynchrone de resolveSync.
  async resolve(id: string): Promise<ResolvedTileLayer> { return this.resolveSync(id); }

  // Méthode resolveSync : la couche unique prête à charger.
  resolveSync(id: string): ResolvedTileLayer {
    // Couche inconnue : erreur 404.
    if (!this.has(id)) throw new NotFoundException(`Couche terrestre inconnue : « ${id} ».`);
    // Réglage de la fusion des fonds marins, ou null si elle est coupée.
    const fusion = seafloorFusion();
    // Renvoie
    return {
      // la description de la couche unique ;
      ...this.layers()[0],
      // Tout passe par le serveur : cache, choix de la source, découpage au-delà du niveau natif.
      // le modèle d'adresse, qui passe par ce serveur ;
      urlTemplate: `/api/v1/tiles/earth/${id}/{z}/{x}/{y}`,
      // pas d'expiration ;
      expiresAt: null,
      // Le navigateur lit la table de priorité des sources (GET /api/v1/tiles/earth/plan), charge lui-même les tuiles
      // des sources qui le permettent et ne demande au relais que le reste.
      // l'adresse de la table de priorité ;
      plan: EARTH_PLAN_PATH,
      // Même colorimétrie pour toutes les sources : le navigateur accorde chaque source nationale sur la mosaïque
      // mondiale. `EARTH_COLOR_MATCH=0` coupe cet accord.
      // l'accord de couleur (faux si EARTH_COLOR_MATCH est coupé) ;
      colorMatch: !isOff(process.env.EARTH_COLOR_MATCH),
      // les fonds marins fondus par le navigateur (absents si EARTH_SEAFLOOR est coupé) ;
      ...(fusion ? { seafloor: fusion } : {}),
      // la mention : celles des sources, puis celles de la NOAA et de GEBCO quand la carte marine est active.
      attribution: { text: [...this.sources.map((s) => s.attribution), ...(fusion ? ['earth-ncei', 'earth-gebco'].map((id) => SEAFLOOR_BY_ID.get(id)!.source.attribution) : [])].join(' · ') },
    // Fin de l'objet.
    };
  // Fin de resolveSync.
  }

  /** Table de priorité des sources de la couche unique (voir earth-plan.ts). */
  // Méthode plan : la table, pour les sources actives.
  plan(): EarthPlan { return earthPlan(this.sources); }

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

  /** Sources d'une couche relayée : toutes pour « earth-hd », la sienne seule pour un fond marin. */
  // Méthode privée sourcesOf.
  private sourcesOf(id: string): EarthSource[] {
    // Fond marin : sa source seule.
    const seafloor = SEAFLOOR_BY_ID.get(id);
    // Sa source s'il y en a un, sinon toutes les sources.
    return seafloor ? [seafloor.source] : this.sources;
  // Fin de sourcesOf.
  }

  /** Tuile (z, x, y) de la couche `id`, téléchargée chez ses sources (rien n'est gardé sur ce serveur). */
  // Méthode tile.
  tile(id: string, z: number, x: number, y: number): Promise<EarthTile> {
    // Couche ni listée ni relayée : erreur 404.
    if (!this.serves(id)) throw new NotFoundException(`Couche terrestre inconnue : « ${id} ».`);
    // Tuile hors de la grille : erreur 404.
    if (!isTile(z, x, y)) throw new NotFoundException(`Tuile ${z}/${x}/${y} inexistante.`);
    // Fabrique la tuile, en partageant un téléchargement déjà en cours.
    return this.shared(`t/${id}/${z}/${x}/${y}`, () => this.build(id, z, x, y));
  // Fin de tile.
  }

  /** Regroupement des demandes simultanées d'une même tuile : un seul téléchargement, oublié dès qu'il est fini. */
  // Méthode privée shared : la clé et la fabrication.
  private shared(key: string, make: () => Promise<EarthTile>): Promise<EarthTile> {
    // Cherche une fabrication en cours.
    let p = this.pending.get(key);
    // Aucune :
    if (!p) {
      // lance la fabrication et la retire de la liste quand elle finit, réussie ou non ;
      p = make().finally(() => this.pending.delete(key));
      // l'inscrit dans la liste.
      this.pending.set(key, p);
    // Fin du cas.
    }
    // Renvoie la promesse.
    return p;
  // Fin de shared.
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
        // Sinon l'ancêtre, téléchargé une fois pour ses descendants demandés en même temps.
        const parent = await this.shared(`a/${id}/${az}/${ax}/${ay}`, () => this.native(sources, az, ax, ay));
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
