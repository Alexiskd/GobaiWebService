// Injectable : rend le service injectable par NestJS.
import { Injectable } from '@nestjs/common';
// Format commun des événements.
import { AtmosphericEvent, AtmosphericEventType } from './atmospheric-event';
// Gestionnaire des événements (filtrage, déduplication, contrôle) et test d'emprise.
import { AtmosphericEventManager, inBbox } from './atmospheric-event-manager';
// Lecture des positions courantes des cyclones (NHC, GDACS).
import { CycloneFix, parseGdacsCyclones, parseNhcStorms } from './cyclone-sources';
// Fusion des cyclones, prévisions officielles et adresse de leurs fichiers.
import { attachForecasts, mergeCyclones, nhcForecastUrl } from './cyclones';
// Prévision officielle au format ATCF.
import { AtcfForecast, parseAtcf } from './atcf';
// Foudre : lecture de l'API Xweather Lightning, statistiques, format commun, adresses des requêtes.
import { LIGHTNING_RADIUS_KM, LIGHTNING_WINDOW_MIN, LightningStats, Strike, lightningCell, lightningStats, parseXweatherLightning, strikeConfidence, strikeToEvent, xweatherLightningTileUrl, xweatherLightningUrl } from './lightning';
// Lecture de NASA EONET (incendies déclarés, trajectoires de tempêtes).
import { StormTrack, parseEonetStorms, parseEonetWildfires } from './eonet';
// Points chauds FIRMS : lecture, fusion, agrégation, détail par emprise, format commun.
import { FireCells, FireDetail, Hotspot, HotspotStats, aggregateHotspots, hotspotToEvent, hotspotsInBounds, parseFirmsCsv, prepareHotspots } from './firms';
// Cache à durée de vie, tuiles et limite de débit.
import { CacheResult, RateGate, TILE_DEG, TtlCache, isTile, tileBounds, tileOf } from './geo-cache';
// Lecture et écriture du format PNG (tuiles radar).
import { decodePng, encodePngRgb, type DecodedPng } from './png';
// Radar Rain Viewer : index des images, adresses des tuiles, décodage des réflectivités.
import { RADAR_MAX_ZOOM, RADAR_STALE_MS, RADAR_TILE_SIZE, RadarFrame, RadarIndex, coverageMask, coverageTileUrl, decodeRadarTile, isRadarTile, parseWeatherMaps, radarTileUrl, radarToRgb } from './radar';
// Cellules orageuses estimées : détection, suivi, format commun.
import { CELL_CORE_DBZ, CELL_EDGE_DBZ, RadarCell, cellToEvent, detectCells, trackCells } from './storms';
// Avertissements officiels d'orages violents et de tornades (NWS).
import { NWS_STORM_EVENTS, nwsAlertsUrl, parseNwsAlerts } from './nws-alerts';
// Registre des fournisseurs.
import { ProviderPublic, listProviders, provider } from './providers';

// Service du moteur atmosphérique (partie données) : incendies et cyclones (lots 1-2), foudre (lot 3), radar des précipitations et orages (lot 4).
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
/** Niveau de la grille mondiale de détection des cellules : 2 (4 × 4 tuiles de 512 px, environ 20 km par pixel à l'équateur). */
// Déclare et exporte le niveau de détection.
export const STORM_DETECT_ZOOM = 2;
/** Nombre d'images suivies pour les cellules : 3 (20 minutes, durée minimale d'un déplacement mesuré). */
// Déclare et exporte le nombre d'images suivies.
export const STORM_TRACK_FRAMES = 3;
// Durée de vie d'une image radar chez Rain Viewer (2 h) et marge : 2 h 10.
const FRAME_LIFE_MS = 130 * 60_000;

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

/** Réponse de la foudre autour d'un point. */
// Forme de la réponse.
export interface LightningResponse {
  // generatedAt : l'heure de fabrication.
  generatedAt: string;
  // available : faux sans identifiants Xweather (reason dit pourquoi).
  available: boolean;
  // reason : la raison d'une indisponibilité, ou null.
  reason: string | null;
  // center : le centre de la requête (arrondi au demi-degré) ; radiusKm et windowMin : son disque et sa fenêtre.
  center: { lon: number; lat: number } | null; radiusKm: number; windowMin: number;
  // strikes : impacts, en colonnes (âge en secondes, nature 1 = nuage-sol, 2 = intra-nuage, 0 = inconnue ; courant signé ; confiance).
  strikes: { count: number; lon: number[]; lat: number[]; ageS: number[]; kind: number[]; peak: number[]; conf: number[] };
  // stats : fréquence, densité, natures, polarités, zones actives.
  stats: LightningStats;
  // source : l'état du fournisseur.
  source: SourceState | null;
// Fin de LightningResponse.
}

/** Réponse du radar : images disponibles, fraîcheur et codage des tuiles. */
// Forme de la réponse.
export interface RadarResponse {
  // generatedAt : l'heure de fabrication.
  generatedAt: string;
  // available : faux si aucune image n'est disponible (reason dit pourquoi).
  available: boolean;
  // reason : la raison d'une indisponibilité, ou null.
  reason: string | null;
  // frames : les images, de la plus ancienne à la plus récente (identifiant et heure ISO).
  frames: { id: string; time: string }[];
  // ageMin : l'âge de la dernière image, en minutes, ou null.
  ageMin: number | null;
  // stale : vrai si la dernière image a plus de 30 minutes ou si le fournisseur ne répond plus.
  stale: boolean;
  // tile : côté, niveau maximal et codage des tuiles servies.
  tile: { size: number; maxZoom: number; encoding: string };
  // source : l'état du fournisseur.
  source: SourceState;
// Fin de RadarResponse.
}

/** Réponse des orages : cellules estimées d'après le radar et avertissements officiels. */
// Forme de la réponse.
export interface StormsResponse {
  // generatedAt : l'heure de fabrication.
  generatedAt: string;
  // frame : l'image radar des cellules (identifiant et heure ISO), ou null.
  frame: { id: string; time: string } | null;
  // cells : les cellules convectives estimées (non confirmées).
  cells: AtmosphericEvent[];
  // warnings : les avertissements officiels en vigueur (États-Unis).
  warnings: AtmosphericEvent[];
  // stats : décompte des cellules (fortes, très fortes, suivies, en mouvement), des avertissements et qualité du décodage.
  stats: { cells: number; strong: number; veryStrong: number; persistent: number; moving: number; warnings: number; tornado: number; framesUsed: number; unknownShare: number };
  // method : la méthode de détection, en clair.
  method: string;
  // sources : l'état de chaque fournisseur.
  sources: SourceState[];
  // stale : vrai si une source est en panne ou périmée.
  stale: boolean;
// Fin de StormsResponse.
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
  // Prévisions officielles du NHC, une par cyclone actif, gardées au rythme du fournisseur (15 min).
  private readonly forecasts = new TtlCache<AtcfForecast>(provider('nhc-atcf').refreshMs, 32);
  // Foudre : une lecture par cellule d'un demi-degré, gardée 1 minute, partagée par tous les visiteurs.
  private readonly lightningCells = new TtlCache<Strike[]>(provider('xweather-lightning').refreshMs, 256);
  // Foudre : tuiles de la couche mondiale (niveaux 0 à 3), gardées 2 minutes.
  private readonly lightningTiles = new TtlCache<{ body: Buffer; type: string }>(2 * 60_000, 128);
  // Radar : limite des requêtes vers Rain Viewer (80 par minute, sous les 100 permises par adresse IP).
  private readonly radarGate = new RateGate(80);
  // Radar : tuiles décodées puis réencodées (codes de réflectivité), gardées le temps de vie d'une image.
  private readonly radarTiles = new TtlCache<Buffer>(FRAME_LIFE_MS, 192, 20_000);
  // Radar : masque de couverture par tuile, gardé 6 heures (Rain Viewer le met rarement à jour).
  private readonly coverageTiles = new TtlCache<Uint8Array>(6 * 3_600_000, 64, 60_000);
  // Orages : cellules détectées par image (et part de couleurs inconnues), gardées le temps de vie d'une image.
  private readonly radarCells = new TtlCache<{ cells: RadarCell[]; unknownShare: number }>(FRAME_LIFE_MS, 16, 60_000);

  // Méthode privée xweatherKeys : identifiants Xweather valides, ou null (jamais renvoyés au navigateur).
  private xweatherKeys(): { id: string; secret: string } | null {
    // Identifiants lus dans l'environnement.
    const id = process.env.XWEATHER_CLIENT_ID?.trim() || '', secret = process.env.XWEATHER_CLIENT_SECRET?.trim() || '';
    // Formes attendues (comme pour les nuages Xweather) : sinon null.
    return /^[A-Za-z0-9]{8,64}$/.test(id) && /^[A-Za-z0-9]{16,128}$/.test(secret) ? { id, secret } : null;
  // Fin de xweatherKeys.
  }

  /** Impacts de foudre des 5 dernières minutes dans 100 km autour d'un point (accès standard Xweather). */
  // Méthode lightning : longitude et latitude visées.
  async lightning(lon: number, lat: number): Promise<LightningResponse> {
    // Instant de référence.
    const now = Date.now();
    // Colonnes vides.
    const empty = { count: 0, lon: [], lat: [], ageS: [], kind: [], peak: [], conf: [] };
    // Identifiants.
    const keys = this.xweatherKeys();
    // Sans identifiants : indisponible, sans appel.
    if (!keys) return { generatedAt: new Date(now).toISOString(), available: false, reason: 'Identifiants Xweather absents sur le serveur (XWEATHER_CLIENT_ID, XWEATHER_CLIENT_SECRET)', center: null, radiusKm: LIGHTNING_RADIUS_KM, windowMin: LIGHTNING_WINDOW_MIN, strikes: empty, stats: lightningStats([]), source: null };
    // Cellule partagée du point visé.
    const cell = lightningCell(lon, lat);
    // Lecture par le cache (début de la fonction de lecture).
    const r = await this.lightningCells.get(cell.key, async () => {
      // Appel de l'API, avec abandon au bout du délai (l'adresse contient les identifiants : jamais journalisée).
      const res = await fetch(xweatherLightningUrl(keys.id, keys.secret, cell.lon, cell.lat), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT } });
      // Réponse lue (l'API rend aussi ses erreurs en JSON).
      const parsed = parseXweatherLightning(await res.json().catch(() => null));
      // Erreur de l'API (accès refusé, option foudre absente…) : son message.
      if (parsed.error) throw new Error(`Xweather : ${parsed.error}`);
      // Réponse HTTP en erreur sans message : son code.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Impacts.
      return parsed.strikes;
    // Fin de la lecture.
    });
    // Impacts de moins de 10 minutes (une donnée en cache, périmée, ne montre pas de vieux impacts).
    const strikes = (r.data ?? []).filter((s) => now - s.t <= 10 * 60_000);
    // État du fournisseur.
    const source = this.state('xweather-lightning', r);
    // Événements au format commun, gardés par le gestionnaire (dernière cellule lue).
    this.manager.update('foudre', strikes.map((s) => strikeToEvent(s, source.fetchedAt ?? new Date(now).toISOString())), { stale: r.stale, errors: r.error ? [`xweather-lightning : ${r.error}`] : [] }, now);
    // Colonnes des impacts.
    const cols = { count: strikes.length, lon: strikes.map((s) => s.lon), lat: strikes.map((s) => s.lat), ageS: strikes.map((s) => Math.max(0, Math.round((now - s.t) / 1000))), kind: strikes.map((s) => (s.type === 'cg' ? 1 : s.type === 'ic' ? 2 : 0)), peak: strikes.map((s) => s.peakAmp ?? 0), conf: strikes.map((s) => strikeConfidence(s)) };
    // Réponse.
    return { generatedAt: new Date(now).toISOString(), available: true, reason: r.data === null && r.error ? r.error : null, center: { lon: cell.lon, lat: cell.lat }, radiusKm: LIGHTNING_RADIUS_KM, windowMin: LIGHTNING_WINDOW_MIN, strikes: cols, stats: lightningStats(strikes), source };
  // Fin de lightning.
  }

  /** Tuile de la couche mondiale des impacts de foudre (Xweather Raster Maps), niveaux 0 à 3 ; null si indisponible. */
  // Méthode lightningTile : niveau, colonne et ligne.
  async lightningTile(z: number, x: number, y: number): Promise<{ body: Buffer; type: string } | null> {
    // Identifiants.
    const keys = this.xweatherKeys();
    // Sans identifiants, ou tuile hors des niveaux 0 à 3 : null.
    if (!keys || ![z, x, y].every(Number.isInteger) || z < 0 || z > 3 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return null;
    // Lecture par le cache (début de la fonction de lecture).
    const r = await this.lightningTiles.get(`${z}/${x}/${y}`, async () => {
      // Appel de la tuile (adresse avec identifiants : jamais journalisée).
      const res = await fetch(xweatherLightningTileUrl(keys.id, keys.secret, z, x, y), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      // Réponse en erreur : son code.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Nature du contenu.
      const type = res.headers.get('content-type') || 'image/png';
      // Pas une image : échec.
      if (!type.startsWith('image/')) throw new Error('réponse qui n’est pas une image');
      // Image.
      return { body: Buffer.from(await res.arrayBuffer()), type };
    // Fin de la lecture.
    });
    // Image, ou null.
    return r.data;
  // Fin de lightningTile.
  }

  // Méthode privée fetchPng : une image PNG de Rain Viewer, sous la limite de débit, décodée.
  private async fetchPng(url: string): Promise<DecodedPng> {
    // Place prise dans la limite (attente de 15 s au plus, sinon refus).
    await this.radarGate.take();
    // Appel, avec abandon au bout du délai et identification du serveur.
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT } });
    // Réponse en erreur : son code.
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Image décodée.
    return decodePng(new Uint8Array(await res.arrayBuffer()));
  // Fin de fetchPng.
  }

  // Méthode privée radarIndex : l'index des images radar (lu au plus toutes les 5 minutes).
  private radarIndex(): Promise<CacheResult<RadarIndex>> {
    // Lecture par le registre ; index illisible ou hôte inattendu : format inattendu.
    return this.read<RadarIndex>('rainviewer', (text) => parseWeatherMaps(json(text)));
  // Fin de radarIndex.
  }

  /** Images radar disponibles (deux dernières heures, toutes les 10 minutes) et codage des tuiles servies. */
  // Méthode radar.
  async radar(): Promise<RadarResponse> {
    // Index lu.
    const r = await this.radarIndex();
    // Instant de référence.
    const now = Date.now();
    // Images.
    const frames = r.data?.frames ?? [];
    // La plus récente, ou null.
    const latest = frames[frames.length - 1] ?? null;
    // Réponse (début).
    return {
      // Heure de fabrication ; disponibilité et raison.
      generatedAt: new Date(now).toISOString(), available: frames.length > 0, reason: frames.length ? null : r.error ?? 'aucune image radar publiée',
      // Images, heures en ISO.
      frames: frames.map((f) => ({ id: f.id, time: new Date(f.time).toISOString() })),
      // Âge de la dernière image et péremption.
      ageMin: latest ? Math.round((now - latest.time) / 60_000) : null, stale: r.stale || (latest !== null && now - latest.time > RADAR_STALE_MS),
      // Tuiles servies : côté, niveau maximal, codage.
      tile: { size: RADAR_TILE_SIZE, maxZoom: RADAR_MAX_ZOOM, encoding: 'PNG RVB : rouge = pluie, vert = neige (code = dBZ + 11 ; 0 = aucun écho), bleu = couverture radar (255 couverte, 0 aucun radar, 128 inconnue)' },
      // État du fournisseur.
      source: this.state('rainviewer', r),
    // Fin de la réponse.
    };
  // Fin de radar.
  }

  // Méthode privée coverage : masque de couverture d'une tuile, ou null (indisponible : la couverture est dite inconnue).
  private async coverage(z: number, x: number, y: number): Promise<Uint8Array | null> {
    // Lecture par le cache.
    const r = await this.coverageTiles.get(`${z}/${x}/${y}`, async () => coverageMask(await this.fetchPng(coverageTileUrl(z, x, y))));
    // Masque, ou null.
    return r.data;
  // Fin de coverage.
  }

  /**
   * Tuile radar d'une image, décodée : PNG RVB dont les canaux portent la pluie, la neige (réflectivités codées) et la
   * couverture radar. Null si l'image n'est pas (ou plus) dans l'index, si la tuile est hors des niveaux permis ou si
   * Rain Viewer ne répond pas.
   */
  // Méthode radarTile : identifiant de l'image, niveau, colonne, ligne.
  async radarTile(id: string, z: number, x: number, y: number): Promise<Buffer | null> {
    // Identifiant mal formé ou tuile hors des niveaux : null.
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(id) || !isRadarTile(z, x, y)) return null;
    // Index courant.
    const idx = await this.radarIndex();
    // Image inconnue de l'index : null (aucune requête vers une image inventée).
    if (!idx.data?.frames.some((f) => f.id === id)) return null;
    // Lecture par le cache (début de la fonction de lecture).
    const r = await this.radarTiles.get(`${id}/${z}/${x}/${y}`, async () => {
      // Tuile radar et masque de couverture, en parallèle.
      const [img, cov] = await Promise.all([this.fetchPng(radarTileUrl(id, z, x, y)), this.coverage(z, x, y)]);
      // Réflectivités.
      const d = decodeRadarTile(img, cov);
      // Réencodées en PNG RVB.
      return encodePngRgb(d.width, d.height, radarToRgb(d));
    // Fin de la lecture.
    });
    // Image, ou null.
    return r.data;
  // Fin de radarTile.
  }

  // Méthode privée cellsOf : cellules d'une image, détectées sur la mosaïque mondiale du niveau 2 (16 tuiles).
  private cellsOf(f: RadarFrame): Promise<CacheResult<{ cells: RadarCell[]; unknownShare: number }>> {
    // Lecture par le cache (début de la fonction de lecture).
    return this.radarCells.get(f.id, async () => {
      // Tuiles par côté, côté d'une tuile, côté du monde.
      const n = 2 ** STORM_DETECT_ZOOM, size = RADAR_TILE_SIZE, W = n * size;
      // Grilles mondiales de la pluie et de la neige.
      const rain = new Uint8Array(W * W), snow = new Uint8Array(W * W);
      // Bilan du décodage.
      let echoes = 0, unknown = 0;
      // Tuile par tuile, l'une après l'autre (mémoire bornée) (début).
      for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
        // Réflectivités de la tuile (sans couverture : inutile à la détection).
        const d = decodeRadarTile(await this.fetchPng(radarTileUrl(f.id, STORM_DETECT_ZOOM, tx, ty)), null);
        // Taille inattendue : échec.
        if (d.width !== size || d.height !== size) throw new Error('tuile radar de taille inattendue');
        // Bilan.
        echoes += d.echoes; unknown += d.unknown;
        // Lignes recopiées à leur place dans la grille mondiale.
        for (let row = 0; row < size; row++) { const o = (ty * size + row) * W + tx * size; rain.set(d.rain.subarray(row * size, (row + 1) * size), o); snow.set(d.snow.subarray(row * size, (row + 1) * size), o); }
      // Fin des tuiles.
      }
      // Cellules et part des couleurs inconnues.
      return { cells: detectCells({ rain, snow, width: W, height: W, worldPx: W, x0: 0, y0: 0 }), unknownShare: echoes + unknown ? Math.round((unknown / (echoes + unknown)) * 1000) / 1000 : 0 };
    // Fin de la lecture.
    });
  // Fin de cellsOf.
  }

  // Méthode privée readNws : avertissements d'orages violents et de tornades en vigueur (une requête par nature).
  private readNws(): Promise<CacheResult<AtmosphericEvent[]>> {
    // Lecture par le cache du fournisseur (début de la fonction de lecture).
    return this.cacheOf<AtmosphericEvent[]>('nws-alerts').get('all', async () => {
      // Heure de lecture.
      const at = new Date().toISOString();
      // Une requête par nature, en parallèle (début).
      const lists = await Promise.all(NWS_STORM_EVENTS.map(async (ev) => {
        // Appel, en GeoJSON, avec identification du serveur (demandée par le NWS).
        const res = await fetch(nwsAlertsUrl(ev), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } });
        // Réponse en erreur : son code.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Corps lu.
        const j = (await res.json().catch(() => null)) as { features?: unknown } | null;
        // Sans liste : format inattendu.
        if (!Array.isArray(j?.features)) throw new Error('format inattendu');
        // Avertissements en vigueur.
        return parseNwsAlerts(j, at, Date.now());
      // Fin des requêtes.
      }));
      // Listes réunies.
      return lists.flat();
    // Fin de la lecture.
    });
  // Fin de readNws.
  }

  /**
   * Orages : cellules convectives estimées d'après le radar (monde, là où des radars couvrent), suivies sur les
   * 20 dernières minutes, et avertissements officiels d'orages violents et de tornades (États-Unis).
   */
  // Méthode storms.
  async storms(): Promise<StormsResponse> {
    // Index radar et avertissements, en parallèle.
    const [idx, nws] = await Promise.all([this.radarIndex(), this.readNws()]);
    // Instant de référence.
    const now = Date.now();
    // Dernières images de l'index.
    const frames = (idx.data?.frames ?? []).slice(-STORM_TRACK_FRAMES);
    // Cellules de chaque image.
    const per = await Promise.all(frames.map((f) => this.cellsOf(f)));
    // Images lues, de la plus ancienne à la plus récente.
    const ok = frames.map((f, i) => ({ f, r: per[i] })).filter((x) => x.r.data !== null);
    // Chaîne d'images consécutives (écart de 15 minutes au plus) se terminant par la plus récente lue.
    const chain: typeof ok = [];
    // Remontée depuis la plus récente.
    for (let i = ok.length - 1; i >= 0; i--) { if (chain.length && chain[0].f.time - ok[i].f.time > 15 * 60_000) break; chain.unshift(ok[i]); }
    // Image des cellules.
    const last = chain[chain.length - 1] ?? null;
    // Cellules suivies.
    const tracked = last ? trackCells(chain.map((x) => ({ time: x.f.time, cells: x.r.data!.cells }))) : [];
    // Cellules au format commun.
    const cellEvents = last ? tracked.map((c) => cellToEvent(c, last.f.time, last.f.id, new Date(last.r.fetchedAt ?? now).toISOString())) : [];
    // Avertissements encore en vigueur.
    const warningEvents = (nws.data ?? []).filter((e) => Date.parse(e.validTo ?? '') >= now);
    // État du radar : l'index, et le premier échec de décodage d'image.
    const radarState: SourceState = { ...this.state('rainviewer', idx), error: idx.error ?? per.find((r) => r.error)?.error ?? null };
    // Fournisseurs.
    const sources = [radarState, this.state('nws-alerts', nws)];
    // Péremption : une source en panne, ou une image des cellules de plus de 30 minutes.
    const stale = sources.some((s) => s.stale || (s.error !== null && s.fetchedAt === null)) || (last !== null && now - last.f.time > RADAR_STALE_MS);
    // Filtrage par le gestionnaire (sources, âge, confiance).
    const snap = this.manager.update('orages', [...cellEvents, ...warningEvents], { stale, errors: sources.filter((s) => s.error).map((s) => `${s.id} : ${s.error}`) }, now);
    // Cellules et avertissements gardés.
    const cells = snap.events.filter((e) => e.sources[0]?.provider === 'rainviewer'), warnings = snap.events.filter((e) => e.sources[0]?.provider === 'nws-alerts');
    // dbz : réflectivité maximale d'une cellule.
    const dbz = (e: AtmosphericEvent): number => Number(e.intensity.value) || 0;
    // Réponse (début).
    return {
      // Heure de fabrication et image des cellules.
      generatedAt: new Date(now).toISOString(), frame: last ? { id: last.f.id, time: new Date(last.f.time).toISOString() } : null,
      // Cellules et avertissements.
      cells, warnings,
      // Décomptes.
      stats: { cells: cells.length, strong: cells.filter((e) => dbz(e) >= 50).length, veryStrong: cells.filter((e) => dbz(e) >= 55).length, persistent: cells.filter((e) => Number(e.details.frames) >= 2).length, moving: cells.filter((e) => e.details.motion).length, warnings: warnings.length, tornado: warnings.filter((e) => e.details.kind === 'tornade').length, framesUsed: chain.length, unknownShare: last?.r.data?.unknownShare ?? 0 },
      // Méthode, en clair.
      method: `Cellules estimées : zones d’au moins ${CELL_EDGE_DBZ} dBZ contenant un noyau d’au moins ${CELL_CORE_DBZ} dBZ sur le composite radar mondial (environ 20 km par pixel à l’équateur), suivies d’une image à l’autre ; déplacement mesuré sur 20 minutes.`,
      // Fournisseurs et péremption.
      sources, stale,
    // Fin de la réponse.
    };
  // Fin de storms.
  }

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
    // Prévisions officielles des cyclones actifs du NHC (aucun hors saison : aucun appel).
    const fc = await Promise.all((nhc.data ?? []).map((s) => this.forecasts.get(s.key.toLowerCase(), async () => {
      // Appel du fichier ATCF, avec abandon au bout du délai.
      const res = await fetch(nhcForecastUrl(s.key), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT } });
      // Réponse en erreur : échec, avec son code.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Prévision lue ; aucune ligne utile : format inattendu.
      const parsed = parseAtcf(await res.text(), s.key);
      // Illisible : échec explicite.
      if (!parsed) throw new Error('format inattendu');
      // Prévision.
      return parsed;
    // Fin de la lecture.
    })));
    // État du fournisseur des prévisions, s'il a été appelé : le plus ancien relevé et le premier échec.
    if (fc.length) sources.push({ id: 'nhc-atcf', attribution: provider('nhc-atcf').attribution, fetchedAt: fc.every((r) => r.fetchedAt) ? new Date(Math.min(...fc.map((r) => r.fetchedAt as number))).toISOString() : null, stale: fc.some((r) => r.stale), error: fc.find((r) => r.error)?.error ?? null });
    // Fusion des lectures, puis prévisions attachées aux cyclones du NHC.
    const merged = mergeCyclones(eonet.data ?? [], [...(nhc.data ?? []), ...(gdacs.data ?? [])], fetchedAt, now);
    // Prévisions lues.
    merged.cyclones = attachForecasts(merged.cyclones, fc.map((r) => r.data).filter((d): d is AtcfForecast => d !== null), new Date(now).toISOString(), now);
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
    // Données à jour (les orages seulement s'ils sont demandés : leur détection lit 48 tuiles radar).
    await Promise.all([this.fires(), this.cyclones(), ...(types?.includes('storm') ? [this.storms()] : [])]);
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
