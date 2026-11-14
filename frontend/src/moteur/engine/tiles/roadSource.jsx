// Importe LruCache, le cache à taille limitée, depuis lru.
import { LruCache } from './lru';
// Importe fillTemplate, qui remplit l'adresse d'une tuile, depuis mercator.
import { fillTemplate } from './mercator';
// Importe templateFromTileJson, la lecture d'une fiche TileJSON, depuis relief.
import { templateFromTileJson } from './relief';
// Importe le décodage des lignes d'une tuile vectorielle et la détection du gzip, depuis vectorTile.
import { decodeLines, isGzip } from './vectorTile';
// Importe depuis roadStyle (début de la liste).
import {
  // Les constantes du calque : nombre de noms, liseré, types de voie et niveaux.
  MAX_LABELS, ROAD_CASING, ROAD_CLASSES, ROAD_MAX_ZOOM, ROAD_MIN_ZOOM,
  // La teinte et l'opacité des littoraux tracés dans la tuile.
  COAST_ALPHA, COAST_COLOR,
  // Les fonctions de dessin : visibilité, choix des noms, type, nom et peinture d'une voie, passage aux pixels et largeur.
  boxVisible, planLabels, roadClass, roadLabel, roadPaint, roadTileTransform, roadWidth,
  // Le test des segments qui longent un bord de la tuile.
  isEdgeRun,
// Fin de la liste : le module roadStyle.
} from './roadStyle';

/** Identifiant du calque des rues (calque de la Terre, voir TileManager.setOverlay). */
// Déclare et exporte l'identifiant du calque des rues.
export const ROADS_LAYER_ID = 'earth-roads';
/** Fiche TileJSON d'OpenFreeMap : donne l'adresse des tuiles du moment (elle change à chaque mise à jour hebdomadaire). */
// Déclare et exporte l'adresse de la fiche TileJSON d'OpenFreeMap.
export const ROADS_TILEJSON = 'https://tiles.openfreemap.org/planet';
// Déclare et exporte la mention des sources.
export const ROADS_ATTRIBUTION = 'Rues © OpenStreetMap · OpenFreeMap · OpenMapTiles';
// Clé sous laquelle le modèle d'adresse est gardé dans le stockage local.
const TEMPLATE_KEY = 'gobai:rues-modele';
/** Couches lues dans chaque tuile, et propriétés gardées. */
// Couches à lire et propriétés à garder.
// La couche « eau » (mers, lacs) fournit les littoraux : seuls ses contours sont lus, sans propriété.
const LAYERS = { transportation: ['class', 'brunnel'], transportation_name: ['class', 'name', 'ref'], water: [] };
/** Tuiles de données décodées gardées en mémoire (une tuile de niveau 14 sert jusqu'à 64 tuiles affichées). */
// Nombre de tuiles de données gardées en mémoire : 24.
const DATA_CACHE = 24;
/** Attente de la fiche du fournisseur quand une adresse est déjà connue (ms). */
// Attente maximale de la fiche quand une adresse est déjà connue : 1,5 seconde.
const FRESH_WAIT_MS = 1500;
// Polices des noms.
const FONT = '"Google Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// abortError : fabrique une erreur nommée AbortError.
const abortError = () => Object.assign(new Error('annulé'), { name: 'AbortError' });

// Accès réels au réseau et au navigateur (début).
const browserIo = {
  // fetchJson : télécharge un document JSON (début).
  async fetchJson(url) {
    // Attend la réponse.
    const res = await fetch(url);
    // Réponse en erreur : exception avec le code HTTP.
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Renvoie le JSON.
    return res.json();
  // Fin de fetchJson.
  },
  /** Octets d'une tuile, ou null si elle n'existe pas (océan, hors couverture). */
  // fetchBytes : télécharge les octets d'une tuile (début).
  async fetchBytes(url) {
    // Attend la réponse.
    const res = await fetch(url);
    // Code 404 ou 204 : null.
    if (res.status === 404 || res.status === 204) return null;
    // Autre erreur : exception avec le code HTTP.
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Les octets de la réponse.
    let bytes = new Uint8Array(await res.arrayBuffer());
    // Le navigateur décompresse d'ordinaire lui-même ; si le fichier arrive encore en gzip, on le décompresse ici.
    // S'ils sont encore en gzip et que le navigateur sait décompresser (début).
    if (isGzip(bytes) && typeof DecompressionStream !== 'undefined') {
      // Flux de décompression.
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      // Les octets décompressés.
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    // Fin de ce cas.
    }
    // Renvoie les octets.
    return bytes;
  // Fin de fetchBytes.
  },
  // makeCanvas : crée un canevas carré (début).
  makeCanvas(size) {
    // Le canevas.
    const canvas = document.createElement('canvas');
    // Sa largeur et sa hauteur.
    canvas.width = canvas.height = size;
    // Le renvoie.
    return canvas;
  // Fin de makeCanvas.
  },
  // storage : le stockage local (début).
  storage() {
    // Le renvoie, ou null s'il est absent ou refusé.
    try { return globalThis.localStorage ?? null; } catch { return null; }
  // Fin de storage.
  },
// Fin des accès réels.
};

/**
 * Calque des rues de la Terre, dessiné dans le navigateur à partir des tuiles vectorielles d'OpenFreeMap
 * (OpenStreetMap, gratuit, sans clé ni inscription). Même interface qu'une source d'images (TileSource) : la couche
 * de tuiles lui demande l'image d'une tuile et reçoit un canevas transparent, tracés et noms dessinés.
 *
 * - De loin (niveaux 6 à 10) : autoroutes et grands axes seulement. En zoomant : routes secondaires, puis toutes les
 *   rues à partir du niveau 12, chemins et allées à partir du niveau 15.
 * - Noms : grands axes dès le niveau 10, rues à partir du niveau 15, écrits le long de la voie.
 * - Au-delà du niveau 14 (le plus fin des données), la tuile de niveau 14 est redessinée agrandie, jusqu'au niveau 17.
 * - Une tuile sans route (océan, désert) renvoie un canevas vide partagé : rien à envoyer à la carte graphique.
 */
// Déclare et exporte la classe RoadSource (début).
export class RoadSource {
  /**
   * @param {{ onChange?: () => void, handheld?: boolean, io?: Partial<typeof browserIo> }} options
   *  handheld  téléphone ou tablette : canevas de 256 px à tous les niveaux (quatre fois moins de mémoire)
   */
  // Constructeur : la fonction de changement, le mode tenu en main et les accès de remplacement (début).
  constructor({ onChange = () => {}, handheld = false, io = {} } = {}) {
    // Identifiant du calque.
    this.layerId = ROADS_LAYER_ID;
    // Garde la fonction de changement.
    this.onChange = onChange;
    // Garde le mode tenu en main.
    this.handheld = handheld;
    // Accès : les réels, remplacés par ceux reçus.
    this.io = { ...browserIo, ...io };
    // État : en chargement.
    this.status = 'loading';
    // Message d'erreur : aucun.
    this.error = null;
    // Modèle d'adresse : inconnu.
    this.template = null;
    // Pas encore libéré.
    this.disposed = false;
    // Description du calque (début).
    this.info = {
      // Son identifiant, son libellé, son type, son fournisseur, son astre et sa projection.
      id: ROADS_LAYER_ID, label: 'Rues et routes', kind: 'overlay', provider: 'openfreemap', body: 'earth', projection: 'mercator',
      // Ses niveaux et sa mention des sources.
      minZoom: ROAD_MIN_ZOOM, maxZoom: ROAD_MAX_ZOOM, attribution: { text: ROADS_ATTRIBUTION },
    // Fin de la description.
    };
    // Compteurs de chargements.
    this.stats = { network: 0, disk: 0, direct: 0, relay: 0 };
    // Cache des tuiles de données décodées.
    this.data = new LruCache(DATA_CACHE); // « z/x/y » de la tuile de données → promesse des lignes décodées (ou null)
    // Canevas vide partagé : pas encore créé.
    this.blank = null;
    // Nombre d'échecs : 0.
    this.failures = 0;
  // Fin du constructeur.
  }

  // ready : vrai quand l'état est « ready ».
  get ready() { return this.status === 'ready'; }
  // minZoom : le premier niveau du calque.
  get minZoom() { return ROAD_MIN_ZOOM; }
  // maxZoom : le dernier niveau du calque.
  get maxZoom() { return ROAD_MAX_ZOOM; }

  /** Le calque couvre toute la Terre, à partir du niveau où les grands axes se distinguent. */
  // covers : vrai à partir du premier niveau du calque.
  covers({ z }) { return z >= ROAD_MIN_ZOOM; }

  /**
   * Lit l'adresse des tuiles dans la fiche du fournisseur. L'adresse de la visite précédente sert tout de suite si
   * elle est connue, et de secours si la fiche ne répond pas.
   */
  // start, asynchrone : lit l'adresse des tuiles (début).
  async start() {
    // Le stockage local.
    const storage = this.io.storage();
    // Adresse gardée : aucune pour l'instant.
    let saved = null;
    // La lit dans le stockage ; une erreur est ignorée.
    try { saved = storage?.getItem(TEMPLATE_KEY) || null; } catch { /* stockage refusé */ }
    // Lecture de la fiche du fournisseur (début).
    const read = this.io.fetchJson(ROADS_TILEJSON).then((json) => {
      // Le modèle d'adresse trouvé dans la fiche.
      const found = templateFromTileJson(json);
      // Aucun : erreur.
      if (!found) throw new Error('fiche sans adresse de tuiles');
      // Source libérée entre-temps : rien à faire.
      if (this.disposed) return;
      // Nouvelle version des données : les tuiles déjà décodées de l'ancienne adresse sont oubliées.
      // Si l'adresse a changé : vide le cache des tuiles décodées.
      if (this.template && this.template !== found.template) this.data.clear();
      // Garde la nouvelle adresse.
      this.template = found.template;
      // L'écrit dans le stockage ; une erreur est ignorée.
      try { storage?.setItem(TEMPLATE_KEY, found.template); } catch { /* stockage plein ou refusé */ }
    // Fin de la lecture.
    });
    // Si une adresse https est gardée (début).
    if (saved && /^https:\/\//.test(saved)) {
      // La fiche a 1,5 s pour répondre ; passé ce délai, l'adresse gardée sert tout de suite et la fiche la remplacera.
      // Course entre la fiche et un délai de 1,5 seconde : vrai si la fiche a échoué ou tarde.
      const late = await Promise.race([read.then(() => false, () => true), new Promise((r) => setTimeout(() => r(true), FRESH_WAIT_MS))]);
      // Dans ce cas, sans adresse lue : l'adresse gardée sert.
      if (late && !this.template) this.template = saved;
      // État : prêt.
      this.status = 'ready';
      // Renvoie la source.
      return this;
    // Fin de ce cas.
    }
    // Sinon, essai (début).
    try {
      // Attend la fiche.
      await read;
      // État : prêt.
      this.status = 'ready';
    // En cas d'erreur (début).
    } catch (e) {
      // État : erreur.
      this.status = 'error';
      // Message : « Rues indisponibles », suivi de la cause.
      this.error = `Rues indisponibles : ${e.message || e}`;
    // Fin de l'essai.
    }
    // Renvoie la source.
    return this;
  // Fin de start.
  }

  /** Lignes décodées d'une tuile de données (partagées entre les tuiles affichées qui en montrent une portion). */
  // tileData : les lignes décodées d'une tuile de données (début).
  tileData(coord) {
    // Clé de la tuile.
    const key = `${coord.z}/${coord.x}/${coord.y}`;
    // Promesse déjà en cache.
    let p = this.data.get(key);
    // Sinon (début).
    if (!p) {
      // Télécharge les octets de la tuile, puis (début) :
      p = this.io.fetchBytes(fillTemplate(this.template, coord)).then((bytes) => {
        // un chargement par le réseau de plus ;
        this.stats.network++;
        // le compteur d'échecs revient à 0 ;
        this.failures = 0;
        // renvoie les lignes décodées, ou null pour une tuile absente.
        return bytes ? decodeLines(bytes, LAYERS) : null;
      // Fin du traitement.
      });
      // Un échec n'est pas gardé : la tuile sera redemandée.
      // En cas d'échec : un échec de plus, et la promesse est retirée du cache si elle y est encore.
      p.catch(() => { this.failures++; if (this.data.peek(key) === p) this.data.delete(key); });
      // Range la promesse dans le cache.
      this.data.set(key, p);
    // Fin de ce cas.
    }
    // Renvoie la promesse.
    return p;
  // Fin de tileData.
  }

  /** Canevas de la tuile (z, x, y). Rejette en AbortError si `signal` est déclenché pendant le téléchargement. */
  // loadImage, asynchrone : le canevas d'une tuile, avec un signal d'annulation facultatif (début).
  async loadImage(coord, signal) {
    // Déjà annulé : erreur AbortError.
    if (signal?.aborted) throw abortError();
    // Sans adresse : erreur.
    if (!this.template) throw new Error('Rues indisponibles');
    // Taille du canevas à ce niveau.
    const size = this.sizeFor(coord.z);
    // Tuile de données et passage aux pixels.
    const t = roadTileTransform(coord, 4096, size);
    // Attend les lignes de la tuile de données.
    const data = await this.tileData(t.data);
    // Annulé entre-temps : erreur AbortError.
    if (signal?.aborted) throw abortError();
    // Renvoie le dessin, ou le canevas vide s'il n'y a rien à dessiner.
    return this.draw(coord, data, size) ?? this.emptyCanvas();
  // Fin de loadImage.
  }

  /** Côté du canevas : 512 px là où les noms s'écrivent (ordinateur), 256 px sinon. */
  // sizeFor : 512 pixels à partir du niveau 13 sur ordinateur, sinon 256.
  sizeFor(z) { return !this.handheld && z >= 13 ? 512 : 256; }

  // emptyCanvas : le canevas vide partagé (début).
  emptyCanvas() {
    // Créé à la première demande, de 4 pixels de côté.
    if (!this.blank) this.blank = this.io.makeCanvas(4);
    // Le renvoie.
    return this.blank;
  // Fin de emptyCanvas.
  }

  /** Dessine tracés et noms. Renvoie null si la tuile n'a aucune route à ce niveau. */
  // draw : dessine les tracés et les noms d'une tuile (début).
  draw(coord, data, size) {
    // La couche des tracés.
    const roads = data?.transportation;
    // La couche de l'eau, dont les contours sont les littoraux.
    const water = data?.water;
    // Ni route ni eau : null.
    if (!roads?.features.length && !water?.features.length) return null;
    // Niveau de la tuile.
    const { z } = coord;
    // Passage aux pixels pour l'étendue des données (la même pour toutes les couches d'une tuile).
    const t = roadTileTransform(coord, (roads ?? water).extent, size);
    // Rapport de taille par rapport à 256 pixels.
    const s = size / 256;
    // Tracés regroupés par type de voie (et tunnel ou non) : un seul tracé de canevas par groupe.
    // Groupes de tracés.
    const groups = new Map();
    // Pour chaque objet (début).
    for (const f of roads?.features ?? []) {
      // Son type de voie.
      const cls = roadClass(f.props);
      // Non dessiné, ou pas encore à ce niveau : ignoré.
      if (!cls || z < ROAD_CLASSES[cls].minZoom) continue;
      // Largeur du tracé à ce niveau.
      const width = roadWidth(cls, z) * s;
      // Pour chacune de ses lignes (début).
      for (const line of f.lines) {
        // Hors de la tuile, largeur comprise : ignorée.
        if (!boxVisible(line.box, t, size, width + 2)) continue;
        // Tunnel ou pont.
        const tunnel = f.props.brunnel === 'tunnel', bridge = f.props.brunnel === 'bridge';
        // Clé du groupe : le type, le tunnel et le pont.
        const key = `${cls}|${tunnel ? 1 : 0}|${bridge ? 1 : 0}`;
        // Groupe existant.
        let g = groups.get(key);
        // Sinon : il est créé, avec sa peinture, et rangé.
        if (!g) { g = { cls, tunnel, bridge, width, paint: roadPaint(cls, { tunnel, bridge }, s), lines: [] }; groups.set(key, g); }
        // Ajoute la ligne au groupe.
        g.lines.push(line.points);
      // Fin de la boucle des lignes.
      }
    // Fin de la boucle des objets.
    }
    // Ni tracé ni littoral : null.
    if (!groups.size && !water?.features.length) return null;
    // Canevas de la tuile.
    const canvas = this.io.makeCanvas(size);
    // Son contexte de dessin.
    const ctx = canvas.getContext('2d');
    // Angles arrondis.
    ctx.lineJoin = 'round';
    // Bouts arrondis.
    ctx.lineCap = 'round';
    // Groupes triés par rang croissant, les tunnels d'abord à rang égal.
    const ordered = [...groups.values()].sort((a, b) => ROAD_CLASSES[a.cls].rank - ROAD_CLASSES[b.cls].rank || Number(b.tunnel) - Number(a.tunnel));
    // trace : prépare le chemin d'un groupe (début).
    const trace = (g) => {
      // Nouveau chemin.
      ctx.beginPath();
      // Pour chaque ligne (début).
      for (const points of g.lines) {
        // Va à son premier point, en pixels.
        ctx.moveTo(points[0] * t.scale + t.offsetX, points[1] * t.scale + t.offsetY);
        // Trace jusqu'à chacun des points suivants.
        for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i] * t.scale + t.offsetX, points[i + 1] * t.scale + t.offsetY);
      // Fin de la boucle.
      }
    // Fin de trace.
    };
    // Littoraux (couche « eau ») : contours des surfaces, sous les routes, sans les segments qui longent un bord de la tuile.
    // S'il y a de l'eau dans la tuile (début).
    if (water) {
      // Opacité des littoraux.
      ctx.globalAlpha = COAST_ALPHA;
      // Teinte des littoraux.
      ctx.strokeStyle = COAST_COLOR;
      // Épaisseur du trait, à l'échelle du canevas.
      ctx.lineWidth = 1.2 * s;
      // Nouveau chemin.
      ctx.beginPath();
      // Pour chaque contour de chaque surface d'eau (début).
      for (const f of water.features) for (const line of f.lines) {
        // Ses points.
        const p = line.points;
        // Pour chaque segment du contour (début).
        for (let i = 2; i < p.length; i += 2) {
          // Segment qui longe un bord de la tuile (découpage, pas littoral) : ignoré.
          if (isEdgeRun(p[i - 2], p[i - 1], p[i], p[i + 1], water.extent)) continue;
          // Va au début du segment, en pixels.
          ctx.moveTo(p[i - 2] * t.scale + t.offsetX, p[i - 1] * t.scale + t.offsetY);
          // Trace jusqu'à sa fin.
          ctx.lineTo(p[i] * t.scale + t.offsetX, p[i + 1] * t.scale + t.offsetY);
        // Fin de la boucle des segments.
        }
      // Fin de la boucle des contours.
      }
      // Dessine tous les littoraux d'un seul trait.
      ctx.stroke();
      // Rétablit l'opacité entière.
      ctx.globalAlpha = 1;
    // Fin des littoraux.
    }
    // Liseré sombre sous tous les tracés (lisible sur une image claire), puis les tracés, grands axes en dernier.
    // Pour chaque groupe, le liseré (début).
    for (const g of ordered) {
      // Opacité du type (réduite pour un tunnel).
      ctx.globalAlpha = g.paint.alpha;
      // Couleur du liseré.
      ctx.strokeStyle = ROAD_CASING;
      // Liseré toujours plein.
      ctx.setLineDash([]);
      // Largeur du tracé, plus le liseré (élargi pour un pont).
      ctx.lineWidth = g.width + g.paint.casing;
      // Prépare le chemin.
      trace(g);
      // Le dessine.
      ctx.stroke();
    // Fin de la boucle.
    }
    // Pour chaque groupe, le tracé (début).
    for (const g of ordered) {
      // Opacité du type (réduite pour un tunnel).
      ctx.globalAlpha = g.paint.alpha;
      // Couleur du type de voie.
      ctx.strokeStyle = ROAD_CLASSES[g.cls].color;
      // Tirets des voies ferrées, trait plein sinon.
      ctx.setLineDash(g.paint.dash);
      // Largeur du tracé.
      ctx.lineWidth = g.width;
      // Prépare le chemin.
      trace(g);
      // Le dessine.
      ctx.stroke();
    // Fin de la boucle.
    }
    // Opacité entière et trait plein pour les noms.
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    // Dessine les noms.
    this.drawNames(ctx, coord, data.transportation_name, size);
    // Renvoie le canevas.
    return canvas;
  // Fin de draw.
  }

  /** Écrit les noms des voies, droits le long de la voie, blancs à liseré sombre. */
  // drawNames : écrit les noms des voies (début).
  drawNames(ctx, coord, names, size) {
    // Aucun nom : rien à faire.
    if (!names?.features.length) return;
    // Niveau de la tuile.
    const { z } = coord;
    // Passage aux pixels pour l'étendue de cette couche.
    const t = roadTileTransform(coord, names.extent, size);
    // Taille de la police : 10 pixels pour un canevas de 256.
    const font = 10 * (size / 256);
    // Lignes candidates.
    const candidates = [];
    // Pour chaque objet (début).
    for (const f of names.features) {
      // Son type de voie.
      const cls = roadClass(f.props);
      // Non dessiné, ou nom pas encore écrit à ce niveau : ignoré.
      if (!cls || z < ROAD_CLASSES[cls].nameZoom) continue;
      // Son nom.
      const label = roadLabel(f.props);
      // Aucun : ignoré.
      if (!label) continue;
      // Pour chacune de ses lignes (début).
      for (const line of f.lines) {
        // Hors de la tuile : ignorée.
        if (!boxVisible(line.box, t, size, 0)) continue;
        // Tableau de ses points en pixels.
        const points = new Array(line.points.length);
        // Pour chaque point (début).
        for (let i = 0; i < line.points.length; i += 2) {
          // Son abscisse en pixels.
          points[i] = line.points[i] * t.scale + t.offsetX;
          // Son ordonnée en pixels.
          points[i + 1] = line.points[i + 1] * t.scale + t.offsetY;
        // Fin de la boucle des points.
        }
        // Ajoute la candidate, avec son nom et son rang.
        candidates.push({ label, rank: ROAD_CLASSES[cls].rank, points });
      // Fin de la boucle des lignes.
      }
    // Fin de la boucle des objets.
    }
    // Aucune candidate : rien à faire.
    if (!candidates.length) return;
    // Police des noms, en graisse 600.
    ctx.font = `600 ${font}px ${FONT}`;
    // Texte centré horizontalement.
    ctx.textAlign = 'center';
    // Et verticalement.
    ctx.textBaseline = 'middle';
    // Noms retenus et leur position.
    const labels = planLabels(candidates, { size, font, measure: (text) => ctx.measureText(text).width, max: MAX_LABELS });
    // Angles du contour arrondis.
    ctx.lineJoin = 'round';
    // Épaisseur du contour.
    ctx.lineWidth = font * 0.28;
    // Couleur du contour : noir à 82 %.
    ctx.strokeStyle = 'rgba(0,0,0,0.82)';
    // Couleur du texte : blanc.
    ctx.fillStyle = '#ffffff';
    // Pour chaque nom (début).
    for (const l of labels) {
      // Sauvegarde l'état du contexte.
      ctx.save();
      // Se place au centre du nom.
      ctx.translate(l.x, l.y);
      // Tourne de son angle.
      ctx.rotate(l.angle);
      // Dessine le contour.
      ctx.strokeText(l.label, 0, 0);
      // Dessine le texte.
      ctx.fillText(l.label, 0, 0);
      // Restaure l'état du contexte.
      ctx.restore();
    // Fin de la boucle.
    }
  // Fin de drawNames.
  }

  // dispose : libère la source (début).
  dispose() {
    // Note qu'elle est libérée.
    this.disposed = true;
    // Vide le cache.
    this.data.clear();
    // Oublie le canevas vide.
    this.blank = null;
  // Fin de dispose.
  }
// Fin de la classe RoadSource.
}
