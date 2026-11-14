// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe tileKey, la clé d'une tuile, depuis mercator.
import { tileKey } from './mercator';
// Importe tileRadius, le rayon auquel un niveau est posé, depuis tileGeometry.
import { tileRadius } from './tileGeometry';
// Importe (début)
import {
  // les fonctions des cellules hexagonales : maillage, emprise, clé, images, uv, niveau, découpe, niveaux de repli, sélection et centre d'une image,
  buildCellMesh, cellBox, cellKeyOf, cellTiles, cellUVs, cellZoom, clipCellToTile, fallbackLevels, selectHexCells, tileCenter,
  // la jupe d'un morceau de cellule et sa profondeur relative,
  addCellSkirt, CELL_SKIRT,
// depuis hexCells.
} from './hexCells';

// Nombre maximal de maillages (cellule × image) gardés : 900.
const MAX_PAIRS = 900;         // maillages (cellule × image) gardés au plus ; au-delà, ceux qui ne servent plus sont détruits
// Nombre maximal de cellules dont les calculs sont gardés : 1 500.
const MAX_CELL_INFOS = 1500;   // cellules dont le maillage et les listes d'images sont gardés (hors GPU)
// Nombre maximal d'images par cellule : 24.
const MAX_TILES_PER_CELL = 24; // au-delà (cellule polaire, très grande cellule), des images moins fines sont prises
// Nombre de degrés dans un radian.
const RAD_TO_DEG = 180 / Math.PI;
/** Durée d'un fondu entre deux niveaux d'une cellule (ms). */
// Déclare et exporte la durée d'un fondu : 320 ms.
export const FADE_MS = 320;
// Rang de dessin des cellules en fondu : −1 000.
const FADE_ORDER = -1000;      // cellules en fondu : dessinées juste après les cartes opaques, avant nuages et atmosphère
// Hauteurs pendant un fondu, en fraction de l'écart entre deux niveaux de cellules (jamais un niveau entier : une
// cellule en transition ne passe ni au-dessus des cellules plus fines, ni sous les plus grandes).
//  - celle qui apparaît monte un peu : elle passe sur l'ancienne image de la même cellule. Chaque vague de fondus
//    (FADE_WAVES hauteurs, de FADE_LIFT à FADE_LIFT + FADE_SPAN) est posée au-dessus de la précédente : pendant un zoom
//    continu, deux images de la même cellule en fondu en même temps ne se disputent jamais le même plan ;
//  - l'ancienne, gardée dessous le temps du fondu, descend un peu (HOLD_DROP) : elle ne se dispute pas non plus le plan
//    de l'image qui la remplace, une fois celle-ci opaque.
// Hauteur de départ d'une cellule qui apparaît : 0,2 écart.
const FADE_LIFT = 0.2;
// Étendue des hauteurs des vagues : 0,6 écart.
const FADE_SPAN = 0.6;
// Nombre de vagues de fondus : 64.
const FADE_WAVES = 64;
// Abaissement d'une ancienne image gardée dessous : −0,3 écart.
const HOLD_DROP = -0.3;
// Durée de garde de l'ancienne image : 1,25 durée de fondu.
const HOLD_TIME = 1.25;        // durée de garde de l'ancienne image, en durées de fondu (marge : elle part après la fin)
// Nombre maximal de matériaux de fondu gardés : 128.
const MAX_POOL = 128;          // matériaux de fondu gardés pour resservir
/** Accélération puis ralenti (pas de départ ni d'arrêt brusque). */
// Déclare et exporte fadeEase : la courbe douce t² × (3 − 2t).
export const fadeEase = (t) => t * t * (3 - 2 * t);
// reducedMotion : vrai si le système demande de réduire les animations (hors navigateur : faux),
const reducedMotion = () => typeof window !== 'undefined'
  // d'après la requête média « prefers-reduced-motion ».
  && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Affichage des tuiles en cellules hexagonales (voir hexCells.jsx), pour une couche de tuiles (TileLayer).
 *
 * La couche garde tout le reste : téléchargement, caches, textures, relief, calques. Ici :
 *  - `select`  choisit les cellules visibles et en déduit les images carrées à charger ;
 *  - `show`    décide, cellule par cellule, quelles images afficher : celles de son niveau si elles sont toutes
 *              prêtes, sinon celles du niveau prêt le plus fin en dessous. Une cellule change donc d'un bloc ;
 *  - `animate` fond les changements au lieu de les faire sauter (voir « Fondus » plus bas) ;
 *  - chaque (cellule, image) a son maillage : la partie de la cellule couverte par l'image, découpée une fois pour
 *    toutes côté processeur, avec le matériau de la tuile carrée (même shader, mêmes réglages).
 * Les cellules fines sont posées légèrement au-dessus des grossières (comme les niveaux de tuiles carrées) : un enfant
 * à cheval sur une cellule voisine restée grossière passe simplement par-dessus.
 *
 * Coût par image affichée : rien n'est recalculé tant que les cellules choisies et les images prêtes ne changent pas
 * (`changed`), et tout ce qui ne dépend que de la cellule (maillage, emprise, images qui la touchent à chaque niveau,
 * maillages déjà découpés) est gardé d'une image à l'autre.
 */
// Déclare et exporte la classe HexDisplay (début).
export class HexDisplay {
  // Constructeur : la couche de tuiles (début).
  constructor(layer) {
    // Garde la couche.
    this.layer = layer;
    // Cellules choisies.
    this.cells = [];             // cellules choisies : { ...cellule, z, tiles, info }
    // Calculs gardés par cellule.
    this.infos = new Map();      // clé cellule → { mesh, box, byZoom: Map(z → { z, tiles }), pairs: Map(clé image → paire) }
    // Paires (cellule, image), par clé.
    this.pairs = new Map();      // `${clé cellule}|${clé image}` → paire
    // Clés des paires de chaque image.
    this.byEntry = new Map();    // clé image → Set(clés de paires)
    // Centre de chaque image sur la sphère.
    this.centers = new Map();    // clé image → centre sur la sphère (priorité de chargement)
    // Paires affichées.
    this.shown = [];             // paires affichées
    // Niveau voulu de chaque cellule, à la dernière sélection.
    this.signature = new Map();  // clé cellule → niveau d'images voulu, à la dernière sélection
    // La sélection a changé.
    this.changed = true;         // la dernière sélection diffère de la précédente
    // Numéro de la dernière mise à jour de l'affichage.
    this.stamp = 0;
    // Écart entre niveaux utilisé au dernier placement : aucun.
    this.gap = null;
    // Fondus : paires en cours de transition (qui apparaissent, s'effacent, ou restent dessous le temps du fondu).
    // Paires en transition.
    this.active = new Set();
    // Durée d'un fondu : 0 si le système réduit les animations.
    this.fadeMs = reducedMotion() ? 0 : FADE_MS; // « réduire les animations » du système : changement immédiat
    // Instant de la dernière avancée des fondus.
    this.clock = 0;
    // Numéro de la vague de fondus.
    this.wave = 0;               // numéro de la vague de fondus en cours (hauteur des cellules qui apparaissent)
    // Numéro du lot de mises en garde.
    this.round = 0;              // numéro du lot de mises en garde en cours
    // Anciennes images gardées dessous, par cellule.
    this.held = new Map();       // clé cellule → { round, pairs } : anciennes images gardées dessous
    // Matériaux de fondu libres.
    this.pool = [];              // matériaux de fondu libres
  // Fin du constructeur.
  }

  /** Ce qui ne dépend que de la cellule : calculé une fois, gardé tant que la cellule revient. */
  // info : ce qui ne dépend que de la cellule (début).
  info(cell) {
    // Calculs déjà gardés pour cette cellule.
    let info = this.infos.get(cell.key);
    // S'il n'y en a pas (début).
    if (!info) {
      // Réserve pleine : elle est vidée.
      if (this.infos.size >= MAX_CELL_INFOS) this.infos.clear();
      // Cellule soulevée par le relief : maillage plus fin, comme les tuiles carrées.
      // Le maillage (plus fin avec le relief), l'emprise et deux tables vides.
      info = { mesh: buildCellMesh(cell, this.layer.reliefWanted ? 6 : 1), box: cellBox(cell), byZoom: new Map(), pairs: new Map(), rho: cell.rho };
      // Les garde.
      this.infos.set(cell.key, info);
    // Fin de ce cas.
    }
    // Les renvoie.
    return info;
  // Fin de info.
  }

  /**
   * Images carrées du niveau z qui touchent vraiment la cellule (celles du rectangle englobant qui n'en couvrent
   * aucun triangle sont écartées : ni demandées au réseau, ni attendues pour afficher la cellule).
   */
  // tilesAt : les images du niveau z qui touchent la cellule (début).
  tilesAt(info, z, minZoom) {
    // Liste déjà calculée pour ce niveau.
    let found = info.byZoom.get(z);
    // Si elle n'existe pas (début).
    if (!found) {
      // Projection de la couche.
      const proj = this.layer.projection;
      // Images du rectangle englobant, 24 au plus.
      const raw = cellTiles(proj, info.box, z, minZoom, MAX_TILES_PER_CELL);
      // Ne garde que celles qui couvrent au moins un triangle de la cellule.
      const tiles = raw.tiles.filter((t) => clipCellToTile(info.mesh, cellUVs(info.mesh, proj, t.z, t.x, t.y)).count > 0);
      // Niveau réellement retenu et images ; sans image restante, toutes celles du rectangle.
      found = { z: raw.z, tiles: tiles.length ? tiles : raw.tiles };
      // Donne sa clé à chaque image.
      for (const t of found.tiles) t.key = tileKey(t.z, t.x, t.y);
      // Garde la liste.
      info.byZoom.set(z, found);
    // Fin de ce cas.
    }
    // La renvoie.
    return found;
  // Fin de tilesAt.
  }

  /**
   * Cellules visibles et images carrées à charger pour les remplir.
   * @returns {Array<{z,x,y,d,c,key}>} même forme que selectTiles : la couche les demande comme d'habitude.
   */
  // select : les cellules visibles et les images à charger (début).
  select(view, opts) {
    // La couche.
    const layer = this.layer;
    // Sa projection.
    const proj = layer.projection;
    // Pixels par unité à une distance de 1.
    const pxPerUnit = view.viewportH / (2 * Math.tan(view.fovY / 2));
    // Niveau minimal, jamais négatif.
    const minZoom = Math.max(0, opts.minZoom ?? 0);
    // Choisit les cellules (début).
    const cells = selectHexCells(view, {
      // Téléphone (la couche y envoie moins de textures par image) : moins de cellules à la fois.
      // 130 cellules au plus sur téléphone, 200 sinon.
      maxCells: layer.uploadsPerFrame <= 4 ? 130 : 200,
      // Relief en volume : marge de la hauteur des plus hautes montagnes (≈ 9 km, exagération comprise).
      // Marge de hauteur avec le relief en volume : 0,0015 rayon × l'exagération, sinon 0.
      lift: layer.reliefWanted ? 0.0015 * Math.max(1, layer.uniforms.reliefExag?.value || 1) : 0,
      // Inutile de redécouper une cellule déjà plus petite que deux images du niveau le plus fin de la couche.
      // canRefine : une cellule se redécoupe sous le niveau 2,
      canRefine: (cell) => cell.level < 2
        // ou tant que son rayon englobant dépasse la taille au sol d'une image du niveau le plus fin, à sa latitude.
        || cell.bound > proj.groundSize(opts.maxZoom, Math.asin(Math.max(-1, Math.min(1, cell.center[1]))) * RAD_TO_DEG),
    // Fin du choix.
    });
    // Images voulues, par clé.
    const wanted = new Map();
    // Niveau voulu de chaque cellule.
    const signature = new Map();
    // Même sélection que la précédente, a priori, si le nombre de cellules est le même.
    let same = cells.length === this.signature.size;
    // Pour chaque cellule (début).
    for (const cell of cells) {
      // Ses calculs gardés.
      const info = this.info(cell);
      // Son niveau d'images et ses images.
      const { z, tiles } = this.tilesAt(info, cellZoom(proj, cell, cell.near, pxPerUnit, opts), minZoom);
      // Les calculs sont rangés sur la cellule.
      cell.info = info;
      // Le niveau aussi.
      cell.z = z;
      // Les images aussi.
      cell.tiles = tiles;
      // Note le niveau voulu.
      signature.set(cell.key, z);
      // Niveau différent de la dernière fois : la sélection a changé.
      if (same && this.signature.get(cell.key) !== z) same = false;
      // Pour chaque image (début).
      for (const t of tiles) {
        // Image déjà voulue par une autre cellule.
        const known = wanted.get(t.key);
        // Dans ce cas : garde la plus petite distance, puis image suivante.
        if (known) { if (cell.d < known.d) known.d = cell.d; continue; }
        // Centre de l'image.
        let c = this.centers.get(t.key);
        // S'il n'est pas connu (début).
        if (!c) {
          // Réserve de 4 000 centres pleine : vidée.
          if (this.centers.size >= 4000) this.centers.clear();
          // Le calcule.
          c = tileCenter(proj, t.z, t.x, t.y);
          // Le garde.
          this.centers.set(t.key, c);
        // Fin de ce cas.
        }
        // Ajoute l'image voulue, avec la distance de la cellule.
        wanted.set(t.key, { z: t.z, x: t.x, y: t.y, key: t.key, d: cell.d, sse: 0, c });
      // Fin de la boucle des images.
      }
    // Fin de la boucle des cellules.
    }
    // Garde les cellules.
    this.cells = cells;
    // Garde les niveaux voulus.
    this.signature = signature;
    // Note si la sélection a changé.
    this.changed = !same;
    // Renvoie les images, de la plus proche à la plus lointaine.
    return [...wanted.values()].sort((a, b) => a.d - b.d);
  // Fin de select.
  }

  /**
   * Images prêtes d'une cellule : son niveau si tout est là ; sinon un niveau plus fin déjà prêt (dézoom : ce qui
   * était à l'écran y reste, pas de retour à une image floue) ; sinon le niveau prêt le plus fin en dessous (ou null).
   */
  // resolve : les images prêtes d'une cellule (début).
  resolve(cell) {
    // La couche.
    const layer = this.layer;
    // Niveau minimal de la source.
    const min = Math.max(0, layer.source.minZoom);
    // Pour chaque niveau de repli, dans l'ordre (début).
    for (const z of fallbackLevels(cell.z, min, layer.maxZoom)) {
      // Images de ce niveau : celles de la cellule, ou la liste calculée.
      const found = z === cell.z ? cell : this.tilesAt(cell.info, z, min);
      // Niveau abaissé : au suivant.
      if (found.z !== z) continue; // niveau abaissé (trop d'images pour cette cellule) : essayé à son tour plus bas
      // Images prêtes.
      const entries = [];
      // Pour chaque image (début).
      for (const t of found.tiles) {
        // L'image prête, si elle l'est.
        const e = layer.ready(t.key);
        // Une image manque : la liste est vidée et la boucle s'arrête.
        if (!e) { entries.length = 0; break; }
        // Ajoute l'image.
        entries.push(e);
      // Fin de la boucle.
      }
      // `sharp` : au moins aussi fin que voulu. Sinon la cellule attend encore ses images (voir `show`).
      // Niveau complet : le renvoie, avec « sharp » s'il est au moins aussi fin que voulu.
      if (entries.length) return { entries, sharp: z >= cell.z };
    // Fin de la boucle des niveaux.
    }
    // Aucun niveau prêt.
    return null;
  // Fin de resolve.
  }

  /** Met à jour ce qui est affiché. Renvoie { entries, full, zoom } pour la couche. */
  // show : met à jour ce qui est affiché (début).
  show(now = performance.now()) {
    // Nouveau numéro de mise à jour.
    const stamp = ++this.stamp;
    // Paires affichées.
    const shown = [];
    // Images utilisées.
    const entries = new Set();
    // Tout est couvert, a priori, s'il y a des cellules ; niveau le plus fin affiché : 0.
    let full = this.cells.length > 0, zoom = 0;
    // Cellules qui attendent encore leurs images, par fréquence.
    const waiting = new Map(); // fréquence → Set(clés des cellules qui attendent encore leurs images)
    // wait : note une cellule en attente (début).
    const wait = (cell) => {
      // Ensemble de sa fréquence.
      let set = waiting.get(cell.f);
      // Créé s'il manque.
      if (!set) waiting.set(cell.f, (set = new Set()));
      // Y ajoute la cellule.
      set.add(cell.key);
    // Fin de wait.
    };
    // Pour chaque cellule (début).
    for (const cell of this.cells) {
      // Ses images prêtes.
      const found = this.resolve(cell);
      // Aucune : la vue n'est pas couverte, la cellule attend ; cellule suivante.
      if (!found) { full = false; wait(cell); continue; }
      // Images moins fines que voulu : la cellule attend aussi.
      if (!found.sharp) wait(cell);
      // Pour chaque image (début).
      for (const e of found.entries) {
        // La paire de la cellule et de l'image, créée au besoin.
        const pair = cell.info.pairs.get(e.key) || this.pair(cell, e);
        // Note l'image.
        entries.add(e);
        // Retient le niveau le plus fin.
        if (e.z > zoom) zoom = e.z;
        // Paire sans maillage : suivante.
        if (!pair.mesh) continue; // image qui ne touche pas la cellule : rien à dessiner
        // Marque la paire comme utilisée.
        pair.used = stamp;
        // L'affiche.
        shown.push(pair);
      // Fin de la boucle des images.
      }
    // Fin de la boucle des cellules.
    }
    // Dézoom sans retour en arrière : tant qu'une cellule attend ses images, les cellules plus fines qui étaient
    // affichées à cet endroit restent à l'écran, par-dessus son image provisoire (elles sont posées plus haut).
    // Elles partent quand la cellule a ses images, ou quand leur propre image quitte la mémoire.
    // Paires qui quittent l'affichage.
    const leaving = [];
    // Pour chaque paire affichée jusque-là (début).
    for (const pair of this.shown) {
      // Encore utilisée : suivante.
      if (pair.used === stamp) continue;
      // À garder ? Non a priori.
      let keep = false;
      // S'il y a des cellules en attente et que la paire existe toujours (début).
      if (waiting.size && this.pairs.get(pair.key) === pair) {
        // Pour chaque fréquence en attente (début).
        for (const [f, keys] of waiting) {
          // La paire est plus fine et son centre est dans une cellule en attente : à garder.
          if (pair.f > f && keys.has(cellKeyOf(pair.center, f))) { keep = true; break; }
        // Fin de la boucle.
        }
      // Fin de ce cas.
      }
      // Son image, si elle est gardée et toujours prête.
      const entry = keep ? this.layer.ready(pair.entryKey) : null;
      // Sans image : la paire quitte l'affichage ; suivante.
      if (!entry) { leaving.push(pair); continue; }
      // Marque la paire comme utilisée.
      pair.used = stamp;
      // L'affiche.
      shown.push(pair);
      // Note son image.
      entries.add(entry);
    // Fin de la boucle.
    }
    // Lance les fondus.
    this.transition(shown, leaving, now);
    // Garde les paires affichées.
    this.shown = shown;
    // Placement à refaire.
    this.gap = null; // les nouvelles paires doivent être placées
    // Trop de paires : destruction de celles qui ne servent plus.
    if (this.pairs.size > MAX_PAIRS) this.prune(stamp);
    // Renvoie les images, la couverture et le niveau.
    return { entries: [...entries], full, zoom };
  // Fin de show.
  }

  /** Maillage d'une cellule pour une image : la partie de la cellule que l'image couvre. Créé à la première demande. */
  // pair : crée le maillage d'une cellule pour une image (début).
  pair(cell, entry) {
    // La couche.
    const layer = this.layer;
    // Les calculs de la cellule.
    const info = cell.info;
    // Clé de la paire.
    const key = `${cell.key}|${entry.key}`;
    // Ancienne paire de même clé.
    const old = this.pairs.get(key);
    // Elle est retirée.
    if (old) this.remove(old); // paire d'une ancienne fiche de la même cellule
    // Partie de la cellule couverte par l'image.
    // Morceau de la cellule couvert par l'image, avec sa jupe : pas de trou aux coins entre cellules voisines.
    const part = addCellSkirt(clipCellToTile(info.mesh, cellUVs(info.mesh, layer.projection, entry.z, entry.x, entry.y)), info.mesh.center, CELL_SKIRT * info.rho);
    // La paire (début).
    const pair = {
      // Sa clé, son centre, son niveau, sa fréquence, les clés de sa cellule et de son image, ses calculs.
      key, mesh: null, center: info.mesh.center, level: cell.level, f: cell.f, cellKey: cell.key, entryKey: entry.key, info, used: 0,
      // Matériau opaque de la tuile.
      base: entry.mesh.material, // matériau opaque de la tuile carrée, repris à la fin d'un fondu
      // Pas encore dans l'affichage voulu.
      on: false,                 // fait partie de l'affichage voulu
      // Aucune transition.
      fx: null,                  // transition en cours : { mode: 'in' | 'out' | 'hold', t, mat, lift }
    // Fin de la paire.
    };
    // Si la partie a des triangles (début).
    if (part.count) {
      // Géométrie.
      const geometry = new THREE.BufferGeometry();
      // Positions.
      geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
      // Normales.
      geometry.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
      // Coordonnées de texture.
      geometry.setAttribute('uv', new THREE.BufferAttribute(part.uvs, 2));
      // Maillage, avec le matériau de la tuile.
      const mesh = new THREE.Mesh(geometry, entry.mesh.material);
      // Matrice fixée à la main.
      mesh.matrixAutoUpdate = false;
      // Jamais écarté par le champ de vision.
      mesh.frustumCulled = false; // les cellules hors champ sont déjà écartées par la sélection
      // Masqué au départ.
      mesh.visible = false;
      // L'ajoute au groupe de la couche.
      layer.group.add(mesh);
      // Le garde sur la paire.
      pair.mesh = mesh;
    // Fin de ce cas.
    }
    // Range la paire dans les calculs de la cellule.
    info.pairs.set(entry.key, pair);
    // Et dans la table des paires.
    this.pairs.set(key, pair);
    // Paires de cette image.
    let set = this.byEntry.get(entry.key);
    // Ensemble créé s'il manque.
    if (!set) this.byEntry.set(entry.key, (set = new Set()));
    // Y ajoute la clé.
    set.add(key);
    // Renvoie la paire.
    return pair;
  // Fin de pair.
  }

  // ---------------------------------------------------------------- fondus
  //
  // Quand l'affichage voulu change, rien ne saute :
  //  - zoom avant (image plus fine de la même cellule, ou cellules plus petites) : la nouvelle image apparaît en fondu
  //    par-dessus l'ancienne, qui reste dessous, opaque, le temps du fondu ;
  //  - zoom arrière (une grande cellule remplace des petites) : la grande cellule est posée dessous d'un coup et les
  //    petites, qui sont au-dessus, s'effacent en fondu.
  // Dans les deux cas l'écran passe d'une image à l'autre sans jamais montrer autre chose (ni trou, ni éclair).
  //
  // Zoom continu : l'affichage voulu change plus vite qu'un fondu ne dure. Une image qui apparaissait et qui n'est déjà
  // plus voulue TERMINE son fondu, puis reste dessous à son tour le temps que la suivante la recouvre : chaque fondu va
  // au bout, il y a toujours une image opaque sous celles qui apparaissent, et la vue s'affine par couches successives
  // au lieu de clignoter. Seul le demi-tour (zoom avant puis arrière) fait repartir un fondu en sens inverse, depuis
  // l'opacité atteinte.
  //
  // Une paire en fondu est dessinée avec un matériau transparent qui partage les uniformes de sa tuile (mêmes
  // réglages), sauf l'opacité. Ces matériaux resservent d'un fondu à l'autre (`pool`) : en créer un neuf par cellule à
  // chaque changement de niveau coûterait une image saccadée. À la fin la paire reprend le matériau opaque.

  /** Compare l'affichage voulu au précédent et lance les fondus. */
  // transition : compare l'affichage voulu au précédent et lance les fondus (début).
  transition(shown, leaving, now) {
    // Sans fondu (début).
    if (!this.fadeMs) {
      // Les paires qui partent sont masquées.
      for (const pair of leaving) { pair.on = false; this.hide(pair); }
      // Les paires affichées sont posées d'un coup.
      for (const pair of shown) { pair.on = true; this.settle(pair); }
      // Terminé.
      return;
    // Fin de ce cas.
    }
    // Aucun fondu en cours : l'horloge repart de maintenant.
    if (!this.active.size) this.clock = now;
    // Cellules voulues, par fréquence.
    const current = new Map(); // fréquence → Set(clés des cellules voulues)
    // Pour chaque cellule (début).
    for (const cell of this.cells) {
      // Ensemble de sa fréquence.
      let set = current.get(cell.f);
      // Créé s'il manque.
      if (!set) current.set(cell.f, (set = new Set()));
      // Y ajoute la cellule.
      set.add(cell.key);
    // Fin de la boucle.
    }
    // Paires qui partent et qui sont au-dessus d'une cellule voulue plus grande : elles s'effaceront en fondu.
    // Cellules voulues recouvertes par une paire qui part.
    const covered = new Set(); // clés des cellules voulues recouvertes par une telle paire
    // Filtre les paires qui partent (début).
    leaving = leaving.filter((pair) => {
      // La paire existe toujours : gardée.
      if (this.pairs.get(pair.key) === pair) return true;
      // Sinon elle n'est plus voulue.
      pair.on = false; // paire déjà détruite (son image a quitté la mémoire) : plus rien à animer
      // Et elle est écartée.
      return false;
    // Fin du filtre.
    });
    // Pour chaque paire qui part (début).
    for (const pair of leaving) {
      // Aucune cellule recouverte, a priori.
      pair.over = null;
      // Sa cellule est toujours voulue : c'est son image qui change, pas un zoom arrière (une cellule voisine plus
      // grande peut contenir son centre sans la remplacer).
      // Sa cellule est toujours voulue : suivante.
      if (current.get(pair.f)?.has(pair.cellKey)) continue;
      // Pour chaque fréquence voulue (début).
      for (const [f, keys] of current) {
        // Fréquence aussi fine ou plus fine : suivante.
        if (pair.f <= f) continue;
        // Cellule de cette fréquence qui contient le centre de la paire.
        const key = cellKeyOf(pair.center, f);
        // Elle est voulue : la paire la recouvre ; fin de la recherche.
        if (keys.has(key)) { pair.over = key; covered.add(key); break; }
      // Fin de la boucle.
      }
    // Fin de la boucle des paires.
    }
    // Cellules dont les nouvelles images sont posées d'un coup.
    const instant = new Set(); // cellules dont les nouvelles images sont posées d'un coup (sous un fondu sortant)
    // Hauteur de la vague.
    let lift = 0;              // hauteur de cette vague, choisie à la première paire qui apparaît
    // Nouveau lot de mises en garde.
    this.round++;
    // Pour chaque paire affichée (début).
    for (const pair of shown) {
      // Déjà voulue : suivante.
      if (pair.on) continue;
      // Elle l'est maintenant.
      pair.on = true;
      // Sa cellule est recouverte : posée d'un coup ; suivante.
      if (covered.has(pair.cellKey)) { instant.add(pair.cellKey); this.settle(pair); continue; }
      // Première apparition de ce tour : choisit la hauteur de la vague suivante.
      if (!lift) lift = FADE_LIFT + (FADE_SPAN * (this.wave = (this.wave + 1) % FADE_WAVES)) / FADE_WAVES;
      // Lance son fondu d'apparition.
      this.fadeIn(pair, lift);
    // Fin de la boucle.
    }
    // Pour chaque paire qui part (début).
    for (const pair of leaving) {
      // Elle n'est plus voulue.
      pair.on = false;
      // Elle recouvre une cellule voulue : elle s'efface en fondu.
      if (pair.over) this.fadeOut(pair);
      // Sinon, si sa cellule a été posée d'un coup : masquée.
      else if (instant.has(pair.cellKey)) this.hide(pair);   // remplacée au même rayon par une image opaque
      // Sinon : gardée dessous.
      else this.hold(pair);                                  // reste dessous le temps du fondu qui la recouvre
    // Fin de la boucle.
    }
  // Fin de transition.
  }

  /** Matériau transparent pour le fondu d'une paire : uniformes de sa tuile (partagés), opacité propre. */
  // fadeMaterial : le matériau transparent du fondu d'une paire (début).
  fadeMaterial(pair, alpha) {
    // Matériau opaque de la tuile.
    const base = pair.base;
    // Matériau libre, s'il y en a un.
    let mat = this.pool.pop();
    // Sinon (début).
    if (!mat) {
      // Nouveau matériau (début).
      mat = new THREE.ShaderMaterial({
        // Sans variable pour l'instant.
        uniforms: {},
        // Même shader de sommet.
        vertexShader: base.vertexShader,
        // Même shader de fragment.
        fragmentShader: base.fragmentShader,
        // Transparent.
        transparent: true,
      // Fin du matériau.
      });
      // Mêmes extensions.
      mat.extensions = base.extensions;
      // Mêmes faces.
      mat.side = base.side;
      // Son opacité propre.
      mat.fadeAlpha = { value: 0 };
    // Fin de ce cas.
    }
    // Sur place : le moteur de rendu garde cet objet `uniforms`, seules ses cases changent de propriétaire.
    // Recopie les variables uniformes de la tuile.
    Object.assign(mat.uniforms, base.uniforms);
    // Remplace l'opacité par la sienne.
    mat.uniforms.alpha = mat.fadeAlpha;
    // Règle l'opacité.
    mat.fadeAlpha.value = alpha;
    // Pose le matériau sur le maillage.
    pair.mesh.material = mat;
    // Rang de dessin des fondus.
    pair.mesh.renderOrder = FADE_ORDER;
    // Renvoie le matériau.
    return mat;
  // Fin de fadeMaterial.
  }

  // fadeIn : fait apparaître une paire (début).
  fadeIn(pair, lift) {
    // Sa transition en cours.
    const fx = pair.fx;
    // Maillage visible.
    pair.mesh.visible = true;
    // En garde : posée d'un coup, terminé.
    if (fx?.mode === 'hold') { this.settle(pair); return; } // elle était encore là, opaque : rien à animer
    // Autre transition : elle repart vers l'apparition, terminé.
    if (fx) { fx.mode = 'in'; fx.leave = false; return; }    // elle s'effaçait (ou partait) : elle revient de là où elle en était
    // Nouvelle transition d'apparition, depuis l'opacité 0.
    pair.fx = { mode: 'in', t: 0, mat: this.fadeMaterial(pair, 0), lift, leave: false };
    // La note en transition.
    this.active.add(pair);
    // Placement à refaire.
    this.gap = null;
  // Fin de fadeIn.
  }

  // fadeOut : efface une paire (début).
  fadeOut(pair) {
    // Sa transition en cours.
    const fx = pair.fx;
    // Elle a déjà un matériau de fondu : elle repart vers l'effacement, terminé.
    if (fx?.mat) { fx.mode = 'out'; fx.leave = false; return; }
    // En garde : la garde s'arrête.
    if (fx) this.endFx(pair);
    // Nouvelle transition d'effacement, depuis l'opacité 1.
    pair.fx = { mode: 'out', t: 1, mat: this.fadeMaterial(pair, 1), lift: 0, leave: false };
    // La note en transition.
    this.active.add(pair);
  // Fin de fadeOut.
  }

  /** L'image n'est plus voulue mais reste dessous, opaque, le temps que celle qui la remplace la recouvre. */
  // hold : garde une image dessous le temps du fondu (début).
  hold(pair) {
    // Sa transition en cours.
    const fx = pair.fx;
    // Elle apparaissait : elle partira à la fin de son fondu.
    if (fx?.mode === 'in') { fx.leave = true; return; } // elle termine son fondu, puis reste dessous à son tour
    // Autre transition : rien à faire.
    if (fx) return;                                      // déjà en garde, ou en train de s'effacer
    // Commence la garde.
    this.beginHold(pair);
  // Fin de hold.
  }

  // beginHold : commence la garde d'une paire (début).
  beginHold(pair) {
    // Les images gardées plus tôt pour la même cellule sont entièrement sous celles-ci : elles partent.
    // Lot de la même cellule.
    let lot = this.held.get(pair.cellKey);
    // S'il vient d'un tour précédent (début).
    if (lot && lot.round !== this.round) {
      // Ses images encore en garde sont masquées.
      for (const old of lot.pairs) if (old.fx?.mode === 'hold') this.hide(old);
      // Le lot est oublié.
      lot = null;
    // Fin de ce cas.
    }
    // Sans lot : en crée un pour ce tour.
    if (!lot) this.held.set(pair.cellKey, (lot = { round: this.round, pairs: [] }));
    // Y ajoute la paire.
    lot.pairs.push(pair);
    // Même horloge que les fondus (t décroît) : elle ne part jamais avant la fin de celui qui la recouvre.
    // Transition de garde, abaissée, pour 1,25 durée de fondu.
    pair.fx = { mode: 'hold', t: HOLD_TIME, mat: null, lift: HOLD_DROP, leave: false };
    // La note en transition.
    this.active.add(pair);
    // Placement à refaire.
    this.gap = null;
  // Fin de beginHold.
  }

  /** Fin de transition, paire affichée : matériau opaque de la tuile, rayon normal. */
  // settle : fin de transition, paire affichée (début).
  settle(pair) {
    // Maillage visible.
    pair.mesh.visible = true;
    // Termine la transition.
    if (pair.fx) this.endFx(pair);
  // Fin de settle.
  }

  /** Fin de transition, paire retirée de l'écran. */
  // hide : fin de transition, paire masquée (début).
  hide(pair) {
    // Maillage masqué.
    pair.mesh.visible = false;
    // Termine la transition.
    if (pair.fx) this.endFx(pair);
  // Fin de hide.
  }

  // endFx : termine la transition d'une paire (début).
  endFx(pair) {
    // Son matériau de fondu.
    const { mat } = pair.fx;
    // S'il y en a un (début).
    if (mat) {
      // Le maillage reprend le matériau opaque.
      pair.mesh.material = pair.base;
      // Et son rang de dessin normal.
      pair.mesh.renderOrder = 0;
      // Le matériau retourne dans la réserve, ou est détruit si elle est pleine.
      if (this.pool.length < MAX_POOL) this.pool.push(mat); else mat.dispose();
    // Fin de ce cas.
    }
    // Plus de transition.
    pair.fx = null;
    // La retire des transitions.
    this.active.delete(pair);
    // Placement à refaire.
    this.gap = null; // elle reprend son rayon normal
  // Fin de endFx.
  }

  /** Avance les fondus. Appelé à chaque image ; ne coûte rien quand aucune transition n'est en cours. */
  // animate : avance les fondus (début).
  animate(now = performance.now()) {
    // Aucune transition : faux.
    if (!this.active.size) return false;
    // Une image en retard (onglet ralenti, gros chargement) ne fait pas sauter le fondu : il reprend où il en était.
    // Avancée : le temps écoulé, 64 ms au plus, en durées de fondu.
    const step = Math.min(64, Math.max(0, now - this.clock)) / this.fadeMs;
    // Note l'instant.
    this.clock = now;
    // Nouveau tour.
    this.round++;
    // Pour chaque paire en transition (début).
    for (const pair of [...this.active]) {
      // Sa transition.
      const fx = pair.fx;
      // Plus de transition : suivante.
      if (!fx) continue; // retirée pendant ce tour (remplacée par une garde plus récente)
      // En garde : le temps restant diminue ; à 0, la paire est masquée ; suivante.
      if (fx.mode === 'hold') { fx.t -= step; if (fx.t <= 0) this.hide(pair); continue; }
      // Avance vers 1 pour une apparition, vers 0 pour un effacement.
      fx.t = fx.mode === 'in' ? Math.min(1, fx.t + step) : Math.max(0, fx.t - step);
      // Règle l'opacité, avec la courbe douce.
      fx.mat.uniforms.alpha.value = fadeEase(fx.t);
      // Effacement : à 0, la paire est masquée ; suivante.
      if (fx.mode === 'out') { if (fx.t <= 0) this.hide(pair); continue; }
      // Apparition pas finie : suivante.
      if (fx.t < 1) continue;
      // Apparition finie : gardée dessous si elle doit partir, sinon posée.
      if (fx.leave) { this.endFx(pair); this.beginHold(pair); } else this.settle(pair);
    // Fin de la boucle.
    }
    // Plus aucune transition : oublie les gardes.
    if (!this.active.size) this.held.clear();
    // Vrai s'il reste des transitions.
    return this.active.size > 0;
  // Fin de animate.
  }

  /** Vrai tant qu'une transition est en cours (la couche garde alors la sphère de fond et le plein rythme d'images). */
  // fading : vrai tant qu'une transition est en cours.
  get fading() { return this.active.size > 0; }

  /** Place les paires affichées : rayon du niveau de la cellule, centre porté par la matrice (double précision). */
  // place : place les paires affichées (début).
  place() {
    // Écart entre niveaux de la couche.
    const gap = this.layer.gap;
    // Inchangé : rien à faire.
    if (gap === this.gap) return;
    // Le garde.
    this.gap = gap;
    // put : place une paire (début).
    const put = ({ mesh, center, level, fx }) => {
      // Rayon du niveau de la cellule, décalé pendant une transition.
      const r = tileRadius(level + (fx ? fx.lift : 0), gap);
      // Matrice : échelle au rayon et centre porté au même rayon.
      mesh.matrix.makeScale(r, r, r).setPosition(center[0] * r, center[1] * r, center[2] * r);
      // Matrice dans la scène à recalculer.
      mesh.matrixWorldNeedsUpdate = true;
    // Fin de put.
    };
    // Place les paires affichées.
    for (const pair of this.shown) put(pair);
    // Et les paires en transition.
    for (const pair of this.active) put(pair);
  // Fin de place.
  }

  // remove : détruit une paire (début).
  remove(pair) {
    // Termine sa transition.
    if (pair.fx) this.endFx(pair);
    // Si elle a un maillage (début).
    if (pair.mesh) {
      // Le retire du groupe.
      this.layer.group.remove(pair.mesh);
      // Libère sa géométrie.
      pair.mesh.geometry.dispose(); // le matériau appartient à la tuile carrée : il n'est pas détruit ici
    // Fin de ce cas.
    }
    // La retire de la table des paires.
    this.pairs.delete(pair.key);
    // Et des calculs de sa cellule, si c'est bien elle.
    if (pair.info.pairs.get(pair.entryKey) === pair) pair.info.pairs.delete(pair.entryKey);
    // Paires de son image.
    const set = this.byEntry.get(pair.entryKey);
    // Y retire sa clé ; l'ensemble vide est supprimé.
    if (set) { set.delete(pair.key); if (!set.size) this.byEntry.delete(pair.entryKey); }
  // Fin de remove.
  }

  /** Détruit les paires qui ne sont pas affichées (appelé quand il y en a trop). */
  // prune : détruit les paires inutiles (début).
  prune(stamp) {
    // Chaque paire ni affichée ni en transition est détruite.
    for (const pair of [...this.pairs.values()]) if (pair.used !== stamp && !pair.fx) this.remove(pair);
  // Fin de prune.
  }

  /** Une tuile carrée quitte le GPU : ses paires partent avec elle (elles utilisent son matériau et sa texture). */
  // dropEntry : une image quitte la carte graphique (début).
  dropEntry(entry) {
    // Ses paires.
    const set = this.byEntry.get(entry.key);
    // Aucune : rien à faire.
    if (!set) return;
    // Pour chaque clé (début).
    for (const key of [...set]) {
      // La paire.
      const pair = this.pairs.get(key);
      // Elle est détruite.
      if (pair) this.remove(pair);
    // Fin de la boucle.
    }
    // Ne garde à l'affichage que les paires qui existent encore.
    this.shown = this.shown.filter((pair) => this.pairs.get(pair.key) === pair);
  // Fin de dropEntry.
  }

  // dispose : libère tout (début).
  dispose() {
    // Détruit chaque paire.
    for (const pair of [...this.pairs.values()]) this.remove(pair);
    // Libère chaque matériau de la réserve.
    for (const mat of this.pool) mat.dispose();
    // Vide la réserve.
    this.pool = [];
    // Oublie les gardes.
    this.held.clear();
    // Plus rien d'affiché.
    this.shown = [];
    // Plus de cellules.
    this.cells = [];
    // Oublie les calculs.
    this.infos.clear();
    // Oublie les centres.
    this.centers.clear();
    // Oublie les niveaux voulus.
    this.signature.clear();
  // Fin de dispose.
  }
// Fin de la classe HexDisplay.
}
