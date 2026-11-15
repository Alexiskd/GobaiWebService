// Injectable : rend le service injectable par NestJS.
import { Injectable } from '@nestjs/common';
// Format commun des événements.
import { AtmosphericEvent, AtmosphericEventType } from './atmospheric-event';
// Gestionnaire des événements (filtrage, déduplication, contrôle) et test d'emprise.
import { AtmosphericEventManager, inBbox } from './atmospheric-event-manager';
// Lecture des positions courantes des cyclones (NHC, GDACS).
import { CycloneFix, parseGdacsCyclones, parseNhcStorms } from './cyclone-sources';
// Fusion des cyclones.
import { mergeCyclones } from './cyclones';
// Lecture de NASA EONET (incendies déclarés, trajectoires de tempêtes).
import { StormTrack, parseEonetStorms, parseEonetWildfires } from './eonet';
// Points chauds FIRMS : lecture, fusion, agrégation, détail par emprise, format commun.
import { FireCells, FireDetail, Hotspot, HotspotStats, aggregateHotspots, hotspotToEvent, hotspotsInBounds, parseFirmsCsv, prepareHotspots } from './firms';
// Cache à durée de vie et tuiles.
import { CacheResult, TILE_DEG, TtlCache, isTile, tileBounds, tileOf } from './geo-cache';
// Registre des fournisseurs.
import { ProviderPublic, listProviders, provider } from './providers';

// Service du moteur atmosphérique (lot 1 : WildfireEngine et CycloneEngine, partie données).
// Aucun appel aux fournisseurs par requête du navigateur : chaque fournisseur est lu au plus une fois par période de
// rafraîchissement (registre), sa réponse est gardée et partagée ; en panne, sa dernière réponse est rendue, marquée
// périmée. Les appels passent par le fetch global du serveur, qui respecte la liste des API déconnectées.

// Fichiers FIRMS lus : VIIRS sur trois satellites, puis MODIS (repli).
const FIRMS_IDS = ['firms-viirs-n20', 'firms-viirs-n21', 'firms-viirs-snpp', 'firms-modis'];
/** Taille des cellules de la vue du globe, en degrés : 0,5° (environ 55 km). */
// Taille des cellules : 0,5 degré.
export const FIRE_CELL_DEG = 0.5;
// Délai maximal d'un appel : 30 secondes (un fichier FIRMS pèse quelques mégaoctets).
const TIMEOUT_MS = 30_000;
// Identification du serveur auprès des fournisseurs.
const USER_AGENT = 'GobaiSpace/1.0 (+https://www.gobaispace.com)';

/** État d'un fournisseur pour une réponse : heure de lecture, péremption et dernier échec. */
// Forme de l'état.
export interface SourceState {
  // id : le fournisseur.
  id: string;
  // attribution : la mention à afficher.
  attribution: string;
  // fetchedAt : l'heure de la dernière lecture réussie (ISO 8601), ou null.
  fetchedAt: string | null;
  // stale : vrai si la donnée rendue est la dernière connue, le fournisseur ne répondant plus.
  stale: boolean;
  // error : le dernier échec, ou null.
  error: string | null;
// Fin de SourceState.
}

/** Réponse des incendies : cellules agrégées (points chauds) et incendies confirmés. */
// Forme de la réponse.
export interface FiresResponse {
  // generatedAt : l'heure de fabrication.
  generatedAt: string;
  // windowHours : la fenêtre des points chauds, en heures.
  windowHours: number;
  // tileDeg : la taille des tuiles de détail, en degrés.
  tileDeg: number;
  // cells : les points chauds agrégés.
  cells: FireCells;
  // confirmed : les incendies confirmés par une agence.
  confirmed: AtmosphericEvent[];
  // stats : la préparation des points chauds.
  stats: HotspotStats;
  // sources : l'état de chaque fournisseur.
  sources: SourceState[];
  // stale : vrai si un fournisseur au moins est en panne.
  stale: boolean;
// Fin de FiresResponse.
}

/** Réponse des cyclones. */
// Forme de la réponse.
export interface CyclonesResponse {
  // generatedAt : l'heure de fabrication.
  generatedAt: string;
  // cyclones : les cyclones actifs confirmés.
  cyclones: AtmosphericEvent[];
  // excluded : les cyclones écartés et leurs raisons.
  excluded: { id: string; name: string | null; reason: string }[];
  // sources : l'état de chaque fournisseur.
  sources: SourceState[];
  // stale : vrai si un fournisseur au moins est en panne.
  stale: boolean;
// Fin de CyclonesResponse.
}

// Données des incendies préparées : signature des lectures, points, statistiques, cellules et points par tuile.
interface FireData {
  // signature : heures de lecture des fichiers (change quand un fichier est relu).
  signature: string;
  // hotspots : les points chauds gardés.
  hotspots: Hotspot[];
  // stats : la préparation.
  stats: HotspotStats;
  // byTile : les points rangés par tuile (« colonne,ligne »).
  byTile: Map<string, Hotspot[]>;
  // fetchedAt : l'heure de lecture la plus récente (ISO 8601).
  fetchedAt: string;
// Fin de FireData.
}

// json : lit un texte JSON ; null s'il est illisible.
const json = (text: string): Record<string, unknown> | null => {
  // Essaie
  try {
    // de le lire.
    const v = JSON.parse(text);
    // Objet : rendu ; sinon null.
    return v && typeof v === 'object' ? v : null;
  // En cas d'échec,
  } catch {
    // null.
    return null;
  // Fin du cas.
  }
// Fin de json.
};

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service atmosphérique.
export class AtmosphereService {
  // Gestionnaire des événements normalisés.
  private readonly manager = new AtmosphericEventManager();
  // Un cache par fournisseur, à sa propre durée de rafraîchissement.
  private readonly caches = new Map<string, TtlCache<unknown>>();
  // Données des incendies préparées, null avant la première lecture.
  private fire: FireData | null = null;

  // Méthode privée cacheOf : le cache d'un fournisseur, créé à la première demande.
  private cacheOf<T>(id: string): TtlCache<T> {
    // Cache existant.
    let c = this.caches.get(id) as TtlCache<T> | undefined;
    // Absent : créé à la durée de rafraîchissement du fournisseur.
    if (!c) { c = new TtlCache<T>(provider(id).refreshMs, 1); this.caches.set(id, c as TtlCache<unknown>); }
    // Renvoie le cache.
    return c;
  // Fin de cacheOf.
  }

  // Méthode privée read : lit un fournisseur (au plus une fois par période) et met sa réponse en forme.
  private read<T>(id: string, parse: (body: string, fetchedAt: string) => T | null): Promise<CacheResult<T>> {
    // Fiche du fournisseur.
    const p = provider(id);
    // Lecture par le cache (début de la fonction de lecture).
    return this.cacheOf<T>(id).get('all', async () => {
      // Appel, avec abandon au bout du délai et identification du serveur.
      const res = await fetch(p.url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT } });
      // Réponse en erreur : échec, avec son code.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Corps mis en forme ; null : format inattendu.
      const data = parse(await res.text(), new Date().toISOString());
      // Format inattendu : échec explicite.
      if (data === null) throw new Error('format inattendu');
      // Donnée lue.
      return data;
    // Fin de la fonction de lecture.
    });
  // Fin de read.
  }

  // Méthode privée state : l'état d'un fournisseur pour une réponse.
  private state(id: string, r: CacheResult<unknown>): SourceState {
    // Identifiant, mention, heure de lecture, péremption et échec.
    return { id, attribution: provider(id).attribution, fetchedAt: r.fetchedAt ? new Date(r.fetchedAt).toISOString() : null, stale: r.stale, error: r.error };
  // Fin de state.
  }

  /** Points chauds (agrégés) et incendies confirmés. */
  // Méthode fires.
  async fires(): Promise<FiresResponse> {
    // Lit les fichiers FIRMS et prépare les points chauds, et lit les incendies déclarés (réponse sans liste
    // d'événements : format inattendu), en parallèle.
    const [{ firms, data }, wild] = await Promise.all([this.loadFirms(), this.read<AtmosphericEvent[]>('eonet-wildfires', (text, at) => { const j = json(text); return Array.isArray(j?.events) ? parseEonetWildfires(j, at) : null; })]);
    // Instant de référence.
    const now = Date.now();
    // État des fournisseurs.
    const sources = [...FIRMS_IDS.map((id, i) => this.state(id, firms[i])), this.state('eonet-wildfires', wild)];
    // Incendies confirmés, filtrés et dédupliqués par le gestionnaire.
    const snap = this.manager.update('incendies', wild.data ?? [], { stale: wild.stale, errors: wild.error ? [`eonet-wildfires : ${wild.error}`] : [] }, now);
    // Cellules recalculées à l'instant présent (l'âge des détections avance entre deux lectures).
    const cells = data ? aggregateHotspots(data.hotspots, FIRE_CELL_DEG, now) : aggregateHotspots([], FIRE_CELL_DEG, now);
    // Réponse.
    return { generatedAt: new Date(now).toISOString(), windowHours: 24, tileDeg: TILE_DEG, cells, confirmed: snap.events, stats: data?.stats ?? { read: 0, merged: 0, dropped: 0, kept: 0 }, sources, stale: sources.some((s) => s.stale || (s.error !== null && s.fetchedAt === null)) };
  // Fin de fires.
  }

  // Méthode privée loadFirms : lit les quatre fichiers FIRMS (un fichier lisible mais sans aucune ligne valide est un
  // format inattendu) puis prépare les points chauds.
  private async loadFirms(): Promise<{ firms: CacheResult<Hotspot[]>[]; data: FireData | null }> {
    // Lectures, en parallèle.
    const firms = await Promise.all(FIRMS_IDS.map((id) => this.read<Hotspot[]>(id, (text) => { const list = parseFirmsCsv(text, id); return list.length || text.trim().split('\n').length <= 1 ? list : null; })));
    // Lectures et données préparées.
    return { firms, data: this.prepareFires(firms) };
  // Fin de loadFirms.
  }

  // Méthode privée prepareFires : fusionne et range les points chauds, seulement quand une lecture a changé.
  private prepareFires(firms: CacheResult<Hotspot[]>[]): FireData | null {
    // Signature : heures de lecture des fichiers.
    const signature = firms.map((r) => r.fetchedAt ?? 0).join('|');
    // Rien de lu : pas de données.
    if (firms.every((r) => !r.data)) return this.fire;
    // Inchangé : données déjà préparées.
    if (this.fire?.signature === signature) return this.fire;
    // Fusion entre satellites et filtre de confiance.
    const { hotspots, stats } = prepareHotspots(firms.map((r) => r.data ?? []));
    // Points rangés par tuile.
    const byTile = new Map<string, Hotspot[]>();
    // Pour chaque point : sa tuile, créée au besoin.
    for (const h of hotspots) { const { tx, ty } = tileOf(h.lon, h.lat); const k = `${tx},${ty}`; const list = byTile.get(k) ?? []; list.push(h); byTile.set(k, list); }
    // Lecture la plus récente.
    const fetchedAt = new Date(Math.max(...firms.map((r) => r.fetchedAt ?? 0))).toISOString();
    // Données préparées (l'agrégat est calculé à chaque réponse : l'âge des détections avance).
    this.fire = { signature, hotspots, stats, byTile, fetchedAt };
    // Renvoie les données.
    return this.fire;
  // Fin de prepareFires.
  }

  /** Points chauds d'une tuile, un par un ; null si la tuile n'existe pas. */
  // Méthode fireTile : colonne et ligne de la tuile.
  async fireTile(tx: number, ty: number): Promise<{ generatedAt: string; tile: { tx: number; ty: number; sizeDeg: number; bounds: number[] }; detail: FireDetail; fetchedAt: string | null } | null> {
    // Tuile hors de la grille : null.
    if (!isTile(tx, ty)) return null;
    // Points chauds à jour (lectures en cache le plus souvent ; ni agrégat ni incendies déclarés).
    await this.loadFirms();
    // Bornes de la tuile.
    const bounds = tileBounds(tx, ty);
    // Points de la tuile, sous forme de détail.
    const detail = hotspotsInBounds(this.fire?.byTile.get(`${tx},${ty}`) ?? [], bounds, Date.now());
    // Réponse.
    return { generatedAt: new Date().toISOString(), tile: { tx, ty, sizeDeg: TILE_DEG, bounds }, detail, fetchedAt: this.fire?.fetchedAt ?? null };
  // Fin de fireTile.
  }

  /** Cyclones actifs confirmés, réunis entre NHC, EONET (JTWC) et GDACS. */
  // Méthode cyclones.
  async cyclones(): Promise<CyclonesResponse> {
    // Lit les trois fournisseurs en parallèle (début).
    const [nhc, eonet, gdacs] = await Promise.all([
      // NHC : liste des cyclones actifs (vide hors saison).
      this.read<CycloneFix[]>('nhc', (text) => { const j = json(text); return Array.isArray(j?.activeStorms) ? parseNhcStorms(j) : null; }),
      // EONET : trajectoires observées.
      this.read<StormTrack[]>('eonet-storms', (text) => { const j = json(text); return Array.isArray(j?.events) ? parseEonetStorms(j) : null; }),
      // GDACS : positions courantes.
      this.read<CycloneFix[]>('gdacs', (text) => { const j = json(text); return Array.isArray(j?.features) ? parseGdacsCyclones(j) : null; }),
    // Fin des lectures.
    ]);
    // Instant de référence.
    const now = Date.now();
    // État des fournisseurs.
    const sources = [this.state('nhc', nhc), this.state('eonet-storms', eonet), this.state('gdacs', gdacs)];
    // Heures de lecture par fournisseur.
    const fetchedAt = Object.fromEntries(sources.filter((s) => s.fetchedAt).map((s) => [s.id, s.fetchedAt as string]));
    // Fusion des lectures.
    const merged = mergeCyclones(eonet.data ?? [], [...(nhc.data ?? []), ...(gdacs.data ?? [])], fetchedAt, now);
    // Pannes, en clair.
    const errors = sources.filter((s) => s.error).map((s) => `${s.id} : ${s.error}`);
    // Filtrage et déduplication par le gestionnaire.
    const snap = this.manager.update('cyclones', merged.cyclones, { stale: sources.some((s) => s.stale), errors, excluded: merged.excluded.map((x) => ({ id: x.name, name: x.name, reason: x.reason })) }, now);
    // Réponse.
    return { generatedAt: new Date(now).toISOString(), cyclones: snap.events, excluded: snap.excluded, sources, stale: sources.some((s) => s.stale || (s.error !== null && s.fetchedAt === null)) };
  // Fin de cyclones.
  }

  /**
   * Événements au format commun, toutes familles branchées. Les points chauds, trop nombreux pour le globe entier,
   * ne sont rendus qu'avec une emprise (2 000 au plus, les plus puissants d'abord).
   */
  // Méthode events : familles, emprise et limite.
  async events(types: AtmosphericEventType[] | undefined, bbox: [number, number, number, number] | undefined, limit = 2_000): Promise<{ generatedAt: string; count: number; events: AtmosphericEvent[]; notes: string[] }> {
    // Données à jour.
    await Promise.all([this.fires(), this.cyclones()]);
    // Événements du gestionnaire (incendies confirmés, cyclones).
    const events = this.manager.query({ types: types?.filter((t) => t !== 'hotspot'), bbox });
    // Remarques sur la réponse.
    const notes: string[] = [];
    // Points chauds demandés (explicitement ou par défaut) :
    if (!types?.length || types.includes('hotspot')) {
      // sans emprise : non rendus, remarque ;
      if (!bbox) notes.push('Points chauds : ajouter une emprise (bbox) pour les recevoir un par un.');
      // avec emprise : les points de l'emprise, au format commun.
      else events.push(...this.hotspotsIn(bbox, limit).map((h) => hotspotToEvent(h, this.fire?.fetchedAt ?? new Date().toISOString())));
    // Fin du cas.
    }
    // Réponse limitée.
    return { generatedAt: new Date().toISOString(), count: Math.min(events.length, limit), events: events.slice(0, limit), notes };
  // Fin de events.
  }

  // Méthode privée hotspotsIn : points chauds d'une emprise, les plus puissants d'abord.
  private hotspotsIn(bbox: [number, number, number, number], limit: number): Hotspot[] {
    // Âge maximal et instant de référence.
    const now = Date.now();
    // Points de l'emprise, récents.
    const list = (this.fire?.hotspots ?? []).filter((h) => inBbox(h.lon, h.lat, bbox) && now - h.t <= 24 * 3_600_000);
    // Les plus puissants d'abord, coupés à la limite.
    return list.sort((a, b) => b.frp - a.frp).slice(0, limit);
  // Fin de hotspotsIn.
  }

  /** Registre des fournisseurs, avec la présence des clés (jamais leur valeur) et l'état de la dernière lecture. */
  // Méthode providers.
  providers(): (ProviderPublic & { cached: boolean; lastError: string | null })[] {
    // Pour chaque fiche publique :
    return listProviders(process.env).map((p) => {
      // son cache, s'il a déjà servi ;
      const c = this.caches.get(p.id);
      // état du cache ;
      const stats = c?.stats();
      // fiche, donnée en mémoire ou non, et dernier échec.
      return { ...p, cached: Boolean(c && c.peek('all') !== null), lastError: stats?.lastFailure?.message ?? null };
    // Fin du parcours.
    });
  // Fin de providers.
  }

  /** État de contrôle des calques : nombre d'événements, exclusions, contradictions, péremption, pannes. */
  // Méthode health.
  health(): { generatedAt: string; layers: ReturnType<AtmosphericEventManager['health']>; hotspots: HotspotStats | null } {
    // Calques du gestionnaire et statistiques des points chauds.
    return { generatedAt: new Date().toISOString(), layers: this.manager.health(), hotspots: this.fire?.stats ?? null };
  // Fin de health.
  }
// Fin du service.
}
