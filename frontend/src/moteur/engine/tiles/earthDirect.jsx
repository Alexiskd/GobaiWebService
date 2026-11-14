// Chargement direct des tuiles de la Terre : le navigateur choisit lui-même la source de chaque tuile (mêmes règles
// que le serveur, backend earth-sources.ts) et la charge chez son fournisseur, sans détour par le serveur de l'app.
// Le relais du serveur ne sert plus que pour les sources qu'on ne peut pas charger d'ici (services WMS) et en secours.
// Fonctions pures, sans navigateur ni three.js (testées dans earthDirect.test.jsx).

// lon : longitude du bord ouest d'une colonne de tuiles.
const lon = (x, z) => (x / 2 ** z) * 360 - 180;
// lat : latitude du bord nord d'une ligne de tuiles, en projection de Mercator.
const lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

/** La tuile touche-t-elle l'emprise [ouest, sud, est, nord] (degrés) ? */
// Déclare et exporte tileTouches : l'emprise et les coordonnées de la tuile.
export function tileTouches([w, s, e, n], z, x, y) {
  // Vrai si la tuile et l'emprise se recouvrent, en longitude et en latitude.
  return lon(x + 1, z) > w && lon(x, z) < e && lat(y + 1, z) < n && lat(y, z) > s;
// Fin de tileTouches.
}

/** Sources capables de servir la tuile à son niveau et à son emplacement, dans l'ordre de priorité du serveur. */
// Déclare et exporte candidatesAt : les sources et les coordonnées de la tuile.
export function candidatesAt(sources, z, x, y) {
  // Renvoie les sources dont les niveaux contiennent z et dont une emprise touche la tuile, ou qui n'ont pas d'emprise.
  return sources.filter((s) => z >= s.minZoom && z <= s.maxZoom && (!s.bboxes || s.bboxes.some((b) => tileTouches(b, z, x, y))));
// Fin de candidatesAt.
}

/** Remplit un modèle d'adresse {z}/{x}/{y}. */
// Déclare et exporte fillDirect : le modèle d'adresse et les coordonnées.
export const fillDirect = (template, z, x, y) =>
  // Remplace les jetons {z}, {x} et {y} par leur valeur.
  template.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(y));

/** Niveaux d'écart au plus entre une tuile et l'ancêtre dans lequel on la découpe (256 px / 2^6 = 4 px). */
// Déclare et exporte le nombre maximal de niveaux entre une tuile et l'ancêtre où on la découpe : 6.
export const MAX_CROP_LEVELS = 6;

/**
 * Mémoire des tuiles vides par source : une source qui n'a rien pour une tuile n'a rien non plus pour ses
 * descendantes (voir CoverageMemo côté serveur).
 */
// Déclare et exporte la classe EmptyMemo (début).
export class EmptyMemo {
  // Constructeur : la capacité, 20 000 par défaut (début).
  constructor(capacity = 20_000) {
    // Garde la capacité.
    this.capacity = capacity;
    // Ensemble des tuiles vides.
    this.empty = new Set();
  // Fin du constructeur.
  }

  // mark : note une tuile vide pour une source (début).
  mark(id, z, x, y) {
    // Ajoute sa clé.
    this.empty.add(`${id}/${z}/${x}/${y}`);
    // Au-delà de la capacité : la plus ancienne clé est retirée.
    if (this.empty.size > this.capacity) this.empty.delete(this.empty.values().next().value);
  // Fin de mark.
  }

  // isEmpty : la tuile, ou un de ses ancêtres, est-elle notée vide (début).
  isEmpty(id, z, x, y, minZoom) {
    // Pour la tuile puis chacun de ses ancêtres, jusqu'au niveau minimal de la source (début).
    for (let d = 0; z - d >= minZoom && z - d >= 0; d++) {
      // Notée vide : vrai.
      if (this.empty.has(`${id}/${z - d}/${Math.floor(x / 2 ** d)}/${Math.floor(y / 2 ** d)}`)) return true;
    // Fin de la boucle.
    }
    // Sinon faux.
    return false;
  // Fin de isEmpty.
  }
// Fin de la classe EmptyMemo.
}

/**
 * Mémoire à durée limitée des tuiles qu'une source n'a pas pu donner alors qu'elle fonctionne (réponse d'erreur
 * immédiate : tuile absente chez le fournisseur — mer, pays voisin dans son emprise rectangulaire). Même règle que
 * EmptyMemo (les descendantes d'une tuile absente le sont aussi), mais tout est oublié au bout de `ttlMs` : une
 * erreur passagère ne prive pas la zone de sa meilleure source pour toute la visite.
 */
// Déclare et exporte la classe MissingMemo, qui étend EmptyMemo (début).
export class MissingMemo extends EmptyMemo {
  // Constructeur : la durée de vie (10 minutes par défaut), l'horloge et la capacité (début).
  constructor(ttlMs = 10 * 60_000, now = Date.now, capacity = 20_000) {
    // Constructeur de la classe mère.
    super(capacity);
    // Garde la durée de vie.
    this.ttlMs = ttlMs;
    // Garde l'horloge.
    this.now = now;
    // Instant du dernier vidage.
    this.since = now();
  // Fin du constructeur.
  }

  // expire : vide la mémoire quand la durée de vie est écoulée (début).
  expire() {
    // Pas encore écoulée : rien à faire.
    if (this.now() - this.since < this.ttlMs) return;
    // Vide l'ensemble.
    this.empty.clear();
    // Note l'instant du vidage.
    this.since = this.now();
  // Fin de expire.
  }

  // mark : vérifie l'expiration, puis note la tuile.
  mark(id, z, x, y) { this.expire(); super.mark(id, z, x, y); }
  // isEmpty : vérifie l'expiration, puis répond comme la classe mère.
  isEmpty(id, z, x, y, minZoom) { this.expire(); return super.isEmpty(id, z, x, y, minZoom); }
// Fin de la classe MissingMemo.
}

// Nombre d'échecs d'affilée avant de couper une source : 5.
const OPEN_AFTER = 5;
// Durée de la première coupure : une minute.
const OPEN_MS = 60_000;
// Durée maximale d'une coupure : 30 minutes.
const OPEN_MAX_MS = 30 * 60_000;
/** Une source qui a donné une image depuis moins longtemps que cela fonctionne : un échec isolé n'est pas une panne. */
// Délai pendant lequel une source qui a répondu est tenue pour en état de marche : 2 minutes.
const RECENT_MS = 2 * 60_000;

/**
 * Coupe-circuit par source : après 5 échecs d'affilée, la source n'est plus chargée en direct pendant une minute,
 * puis deux, quatre… jusqu'à 30 minutes (une source qui refuse les autres sites échouera toujours : ses tuiles
 * passent alors par le relais). Une réussite remet tout à zéro.
 */
// Déclare et exporte la classe DirectBreaker (début).
export class DirectBreaker {
  // Constructeur : l'horloge (début).
  constructor(now = Date.now) {
    // Garde l'horloge.
    this.now = now;
    // État de chaque source, par identifiant.
    this.state = new Map(); // id → { failures, openUntil, opens, lastSuccess }
  // Fin du constructeur.
  }

  // of : l'état d'une source, créé au besoin (début).
  of(id) {
    // État existant.
    let s = this.state.get(id);
    // Sinon : un état neuf, sans échec ni coupure ni réussite.
    if (!s) this.state.set(id, (s = { failures: 0, openUntil: 0, opens: 0, lastSuccess: -Infinity }));
    // Le renvoie.
    return s;
  // Fin de of.
  }

  // usable : vrai quand la coupure de la source est terminée.
  usable(id) { return this.now() >= this.of(id).openUntil; }

  /** La source a-t-elle donné une image dans les `ms` dernières millisecondes ? */
  // recent : vrai si la source a réussi dans le délai donné.
  recent(id, ms = RECENT_MS) { return this.now() - this.of(id).lastSuccess < ms; }

  // success : note une réussite (début).
  success(id) {
    // L'état de la source.
    const s = this.of(id);
    // Échecs remis à 0.
    s.failures = 0;
    // Nombre de coupures remis à 0.
    s.opens = 0;
    // Plus de coupure.
    s.openUntil = 0;
    // Instant de la réussite.
    s.lastSuccess = this.now();
  // Fin de success.
  }

  // failure : note un échec (début).
  failure(id) {
    // L'état de la source.
    const s = this.of(id);
    // Un échec de plus ; sous le seuil, rien d'autre.
    if (++s.failures < OPEN_AFTER) return;
    // Échecs remis à 0.
    s.failures = 0;
    // Coupure : une minute, doublée à chaque coupure, 30 minutes au plus.
    s.openUntil = this.now() + Math.min(OPEN_MAX_MS, OPEN_MS * 2 ** s.opens);
    // Une coupure de plus.
    s.opens++;
  // Fin de failure.
  }
// Fin de la classe DirectBreaker.
}

/**
 * Image vide ? `data` : pixels RGBA d'une vignette de la tuile. Vrai pour une image presque entièrement transparente,
 * ou unie et presque blanche ou presque noire : c'est ce que renvoient les services nationaux hors de leur territoire.
 */
// Déclare et exporte isBlankPixels : les pixels RGBA.
export function isBlankPixels(data) {
  // Nombre de pixels.
  const n = Math.floor(data.length / 4);
  // Aucun : faux.
  if (!n) return false;
  // Somme des opacités.
  let alpha = 0;
  // Minimum, maximum et somme de chaque canal.
  const min = [255, 255, 255], max = [0, 0, 0], sum = [0, 0, 0];
  // Pour chaque pixel (début).
  for (let i = 0; i < n; i++) {
    // Ajoute son opacité.
    alpha += data[4 * i + 3];
    // Pour chaque canal (début).
    for (let c = 0; c < 3; c++) {
      // Sa valeur.
      const v = data[4 * i + c];
      // Met à jour le minimum.
      if (v < min[c]) min[c] = v;
      // Met à jour le maximum.
      if (v > max[c]) max[c] = v;
      // Ajoute à la somme.
      sum[c] += v;
    // Fin de la boucle des canaux.
    }
  // Fin de la boucle des pixels.
  }
  // Opacité moyenne inférieure à 13 : image vide.
  if (alpha / n < 13) return true;
  // Image unie : moins de 10 d'écart sur chaque canal.
  const flat = [0, 1, 2].every((c) => max[c] - min[c] < 10);
  // Pas unie : pas vide.
  if (!flat) return false;
  // Moyenne de chaque canal.
  const mean = sum.map((v) => v / n);
  // Vide si elle est presque blanche ou presque noire.
  return mean.every((v) => v > 245) || mean.every((v) => v < 10);
// Fin de isBlankPixels.
}

/**
 * Prochaine tentative pour afficher la tuile (z, x, y) :
 *  - { kind: 'direct', source, z, x, y, depth }  charger la tuile (z, x, y) de cette source chez son fournisseur ;
 *    depth > 0 : c'est un ancêtre de la tuile demandée, à découper puis agrandir ;
 *  - { kind: 'relay' }  demander la tuile au relais du serveur (source non chargeable d'ici, ou en panne en direct).
 * Les sources sont parcourues dans l'ordre du serveur, la plus détaillée d'abord ; celles déjà vues vides à cet
 * endroit sont sautées. La première source qui couvre l'endroit décide : chargeable en direct, ou relais.
 * @param isEmpty (source, z, x, y) => bool ; usable (id) => bool
 */
// Déclare et exporte nextAttempt : les sources, la tuile et les deux tests (vide, utilisable).
export function nextAttempt(sources, z, x, y, { isEmpty = () => false, usable = () => true } = {}) {
  // Pour la tuile puis ses ancêtres, sur six niveaux au plus (début).
  for (let depth = 0; depth <= MAX_CROP_LEVELS && z - depth >= 0; depth++) {
    // Coordonnées de l'ancêtre à cette profondeur.
    const az = z - depth, ax = Math.floor(x / 2 ** depth), ay = Math.floor(y / 2 ** depth);
    // Pour chaque source candidate à cet endroit (début).
    for (const source of candidatesAt(sources, az, ax, ay)) {
      // Déjà vue vide ici : sautée.
      if (isEmpty(source, az, ax, ay)) continue;
      // Sans adresse directe, ou coupée : relais.
      if (!source.templates?.length || !usable(source.id)) return { kind: 'relay' };
      // Sinon : chargement direct de cette tuile de cette source, avec la profondeur.
      return { kind: 'direct', source, z: az, x: ax, y: ay, depth };
    // Fin de la boucle des sources.
    }
  // Fin de la boucle des niveaux.
  }
  // Aucune source : relais.
  return { kind: 'relay' };
// Fin de nextAttempt.
}

/** Rectangle (pixels) à découper dans un ancêtre de `size` px pour la tuile (z, x, y) située `depth` niveaux plus bas. */
// Déclare et exporte cropRect : la taille de l'ancêtre, la profondeur et la tuile.
export function cropRect(size, depth, x, y) {
  // Nombre de tuiles par côté de l'ancêtre.
  const n = 2 ** depth;
  // Taille d'une part, en pixels.
  const part = size / n;
  // Renvoie le rectangle : sa position et sa taille.
  return { sx: (x % n) * part, sy: (y % n) * part, sw: part, sh: part };
// Fin de cropRect.
}

/** Plan de chargement direct utilisable ? (liste non vide de sources bien formées) */
// Déclare et exporte validPlan : le plan de chargement direct.
export function validPlan(direct) {
  // Vrai si c'est une liste non vide
  return Array.isArray(direct) && direct.length > 0
    // dont chaque source a un identifiant et des niveaux numériques.
    && direct.every((s) => s && typeof s.id === 'string' && Number.isFinite(s.minZoom) && Number.isFinite(s.maxZoom));
// Fin de validPlan.
}

/**
 * Serveurs des images du monde entier (sources sans emprise nationale, chargeables d'ici) : le navigateur ouvre la
 * connexion avec eux dès que le plan est connu, avant la première tuile. `max` origines au plus.
 */
// Déclare et exporte worldOrigins : le plan et le nombre maximal d'origines (4 par défaut).
export function worldOrigins(plan, max = 4) {
  // Liste des origines.
  const origins = [];
  // Pour chaque source du plan (début).
  for (const source of Array.isArray(plan) ? plan : []) {
    // Source nationale ou sans adresses : ignorée.
    if (source?.bboxes || !Array.isArray(source?.templates)) continue;
    // Pour chacune de ses adresses (début).
    for (const template of source.templates) {
      // Origine : inconnue.
      let origin = null;
      // La lit dans l'adresse ; une adresse illisible est ignorée.
      try { origin = new URL(template).origin; } catch { /* modèle relatif ou illisible : ignoré */ }
      // Ajoute l'origine si elle est nouvelle.
      if (origin && origin !== 'null' && !origins.includes(origin)) origins.push(origin);
      // Maximum atteint : renvoie la liste.
      if (origins.length >= max) return origins;
    // Fin de la boucle des adresses.
    }
  // Fin de la boucle des sources.
  }
  // Renvoie la liste.
  return origins;
// Fin de worldOrigins.
}

// ------------------------------------------------------------------ vue de loin : imagerie détaillée gardée, en réduit

/**
 * Sources nationales à poser par-dessus l'image du monde pour une tuile plus haute que leur niveau natif (`lowZoom`
 * ≤ z < `minZoom`) : le fournisseur sert lui-même sa mosaïque réduite à ces niveaux. Dans l'ordre de priorité.
 */
// Déclare et exporte farCandidatesAt : les sources et la tuile.
export function farCandidatesAt(sources, z, x, y) {
  // Renvoie les sources nationales chargeables d'ici qui ont un niveau bas,
  return sources.filter((s) => s.templates?.length && s.bboxes && Number.isFinite(s.lowZoom)
    // pour un niveau entre ce niveau bas et leur niveau natif, et dont une emprise touche la tuile.
    && z >= s.lowZoom && z < s.minZoom && s.bboxes.some((b) => tileTouches(b, z, x, y)));
// Fin de farCandidatesAt.
}

/** Pixel sans image : transparent, ou presque blanc, ou presque noir (hors du territoire d'une source nationale). */
// Déclare et exporte blankLike : vrai pour un pixel transparent, presque blanc ou presque noir.
export const blankLike = (r, g, b, a) => a < 16 || (r >= 250 && g >= 250 && b >= 250) || (r <= 5 && g <= 5 && b <= 5);

/** Part des pixels sans image (0 … 1) dans des pixels RGBA. */
// Déclare et exporte blankRatio : les pixels RGBA.
export function blankRatio(data) {
  // Nombre de pixels.
  const n = Math.floor(data.length / 4);
  // Aucun : 1.
  if (!n) return 1;
  // Nombre de pixels sans image.
  let blank = 0;
  // Compte chaque pixel sans image.
  for (let i = 0; i < 4 * n; i += 4) if (blankLike(data[i], data[i + 1], data[i + 2], data[i + 3])) blank++;
  // Renvoie leur part.
  return blank / n;
// Fin de blankRatio.
}

/**
 * Mosaïque d'une tuile : chaque pixel prend la première couche qui a une image à cet endroit, sinon garde le fond.
 * `base` (pixels RGBA du fond) est modifié sur place. `layers` : [{ data, gain?, offset? }] dans l'ordre de priorité ;
 * gain / offset (par canal, sur 0 … 1) : correction de couleur de la couche, appliquée ici.
 */
// Déclare et exporte composeOver : les pixels du fond et les couches.
export function composeOver(base, layers) {
  // Pour chaque pixel (début).
  for (let i = 0; i + 3 < base.length; i += 4) {
    // Pour chaque couche, par ordre de priorité (début).
    for (const layer of layers) {
      // Ses pixels.
      const d = layer.data;
      // Sans image à cet endroit : couche suivante.
      if (blankLike(d[i], d[i + 1], d[i + 2], d[i + 3])) continue;
      // Son gain et son décalage.
      const g = layer.gain, o = layer.offset;
      // Copie la couleur, corrigée si la couche a un gain.
      for (let c = 0; c < 3; c++) base[i + c] = g ? d[i + c] * g[c] + o[c] * 255 : d[i + c]; // tableau borné : arrondi et limites 0 … 255
      // Pixel opaque.
      base[i + 3] = 255;
      // Les autres couches sont ignorées.
      break;
    // Fin de la boucle des couches.
    }
  // Fin de la boucle des pixels.
  }
  // Renvoie le fond.
  return base;
// Fin de composeOver.
}

/**
 * Niveaux où une source ne répond pas (le fournisseur ne sert pas sa mosaïque réduite à ce niveau) : après 6 échecs
 * sans aucune réussite, la source n'est plus demandée à ce niveau. Ne touche pas au coupe-circuit des niveaux natifs.
 */
// Déclare et exporte la classe LevelGate (début).
export class LevelGate {
  // Constructeur : la limite d'échecs, 6 par défaut (début).
  constructor(limit = 6) {
    // Garde la limite.
    this.limit = limit;
    // État par source et par niveau.
    this.state = new Map(); // « source/z » → { ok, failed }
  // Fin du constructeur.
  }

  // of : l'état d'une source à un niveau, créé au besoin (début).
  of(id, z) {
    // Sa clé.
    const key = `${id}/${z}`;
    // État existant.
    let s = this.state.get(key);
    // Sinon : un état neuf, sans réussite ni échec.
    if (!s) this.state.set(key, (s = { ok: 0, failed: 0 }));
    // Le renvoie.
    return s;
  // Fin de of.
  }

  // ok : une réussite de plus.
  ok(id, z) { this.of(id, z).ok++; }
  // fail : un échec de plus.
  fail(id, z) { this.of(id, z).failed++; }
  // usable : vrai s'il y a eu une réussite, ou moins d'échecs que la limite.
  usable(id, z) { const s = this.of(id, z); return s.ok > 0 || s.failed < this.limit; }
// Fin de la classe LevelGate.
}

// ------------------------------------------------------------------ même colorimétrie pour toutes les couches

// Déclare et exporte le nombre de tuiles mesurées avant d'appliquer une correction : 3.
export const COLOR_MIN_SAMPLES = 3;   // échantillons (tuiles) avant d'appliquer une correction
// Déclare et exporte le nombre au-delà duquel la correction est figée : 12.
export const COLOR_MAX_SAMPLES = 12;  // au-delà, la correction est figée
// Bornes du gain et du décalage.
const GAIN_MIN = 0.6, GAIN_MAX = 1.6, OFFSET_MAX = 0.25;

/**
 * Accord des couleurs d'une source sur l'image de référence (la mosaïque mondiale) : on compare les mêmes endroits
 * vus par les deux, et on en tire, par canal, un gain et un décalage (transfert de moyenne et d'écart-type) :
 * couleur corrigée = couleur × gain + décalage. Les mesures de plusieurs tuiles sont cumulées.
 */
// Déclare et exporte la classe ColorStats (début).
export class ColorStats {
  // Constructeur : des mesures gardées, facultatives (début).
  constructor(saved) {
    // Nombre de tuiles mesurées.
    this.samples = Number(saved?.samples) || 0;
    // Nombre de pixels mesurés.
    this.n = Number(saved?.n) || 0;
    // arr : un tableau de trois nombres, ou trois zéros.
    const arr = (v) => (Array.isArray(v) && v.length === 3 ? v.map(Number) : [0, 0, 0]);
    // Sommes et sommes des carrés, pour la source et pour la référence.
    this.s = arr(saved?.s); this.s2 = arr(saved?.s2); this.r = arr(saved?.r); this.r2 = arr(saved?.r2);
  // Fin du constructeur.
  }

  /** Ajoute une tuile : pixels RGBA de la source et de la référence, mêmes dimensions. Renvoie true si elle compte. */
  // add : ajoute les mesures d'une tuile (début).
  add(src, ref) {
    // Nombre de pixels communs.
    const n = Math.floor(Math.min(src.length, ref.length) / 4);
    // Nombre de pixels utilisés.
    let used = 0;
    // Sommes de cette tuile.
    const s = [0, 0, 0], s2 = [0, 0, 0], r = [0, 0, 0], r2 = [0, 0, 0];
    // Pour chaque pixel (début).
    for (let i = 0; i < 4 * n; i += 4) {
      // Sans image dans la source ou dans la référence : ignoré.
      if (blankLike(src[i], src[i + 1], src[i + 2], src[i + 3]) || blankLike(ref[i], ref[i + 1], ref[i + 2], ref[i + 3])) continue;
      // Un pixel utilisé de plus.
      used++;
      // Pour chaque canal (début).
      for (let c = 0; c < 3; c++) {
        // Les deux valeurs, entre 0 et 1.
        const a = src[i + c] / 255, b = ref[i + c] / 255;
        // Ajoute aux sommes et aux sommes des carrés.
        s[c] += a; s2[c] += a * a; r[c] += b; r2[c] += b * b;
      // Fin de la boucle des canaux.
      }
    // Fin de la boucle des pixels.
    }
    // Moins d'un quart des pixels utilisés : tuile ignorée.
    if (!n || used < n / 4) return false; // trop peu d'endroits communs : tuile ignorée
    // Ajoute les sommes de la tuile aux totaux.
    for (let c = 0; c < 3; c++) { this.s[c] += s[c]; this.s2[c] += s2[c]; this.r[c] += r[c]; this.r2[c] += r2[c]; }
    // Ajoute les pixels utilisés.
    this.n += used;
    // Une tuile mesurée de plus.
    this.samples++;
    // La tuile compte.
    return true;
  // Fin de add.
  }

  // ready : vrai à partir de trois tuiles mesurées.
  get ready() { return this.samples >= COLOR_MIN_SAMPLES; }
  // full : vrai à partir de douze tuiles mesurées.
  get full() { return this.samples >= COLOR_MAX_SAMPLES; }

  /** { gain: [r, g, b], offset: [r, g, b] } (bornés), ou null tant qu'il n'y a pas assez de mesures. */
  // solve : calcule la correction (début).
  solve() {
    // Pas assez de mesures : null.
    if (!this.ready || !this.n) return null;
    // Gain et décalage neutres.
    const gain = [1, 1, 1], offset = [0, 0, 0];
    // Pour chaque canal (début).
    for (let c = 0; c < 3; c++) {
      // Moyennes de la source et de la référence.
      const ms = this.s[c] / this.n, mr = this.r[c] / this.n;
      // Leurs écarts-types.
      const sd = Math.sqrt(Math.max(0, this.s2[c] / this.n - ms * ms)), rd = Math.sqrt(Math.max(0, this.r2[c] / this.n - mr * mr));
      // Gain : le rapport des écarts-types, borné ; 1 si la source est unie.
      const g = sd > 1e-3 ? Math.min(GAIN_MAX, Math.max(GAIN_MIN, rd / sd)) : 1;
      // Le range.
      gain[c] = g;
      // Décalage : l'écart des moyennes après gain, borné.
      offset[c] = Math.min(OFFSET_MAX, Math.max(-OFFSET_MAX, mr - g * ms));
    // Fin de la boucle.
    }
    // Renvoie le gain et le décalage.
    return { gain, offset };
  // Fin de solve.
  }

  // toJSON : les mesures, pour les garder.
  toJSON() { return { samples: this.samples, n: this.n, s: this.s, s2: this.s2, r: this.r, r2: this.r2 }; }
// Fin de la classe ColorStats.
}

// ------------------------------------------------------------------ bords de couverture (frontières, côtes)

/** Côté (px) de la vignette qui sert à repérer les zones sans image d'une tuile : un pixel de vignette = un bloc de la tuile. */
// Déclare et exporte le côté de la vignette : 16 pixels.
export const THUMB = 16;

/**
 * Zone sans image d'une tuile, d'après sa vignette (pixels RGBA, THUMB × THUMB) : les blocs sans image, élargis à
 * leurs voisins (le bord de la couverture passe dans les blocs voisins). Tableau de THUMB² octets (1 = dans la
 * zone), ou null si toute la tuile a une image.
 */
// Déclare et exporte blankZone : les pixels de la vignette.
export function blankZone(thumb) {
  // Côté de la vignette.
  const n = THUMB;
  // Blocs sans image.
  const blank = new Uint8Array(n * n);
  // Aucun trouvé pour l'instant.
  let any = false;
  // Pour chaque bloc (début).
  for (let i = 0; i < n * n; i++) {
    // Sans image : noté.
    if (blankLike(thumb[4 * i], thumb[4 * i + 1], thumb[4 * i + 2], thumb[4 * i + 3])) { blank[i] = 1; any = true; }
  // Fin de la boucle.
  }
  // Aucun : null.
  if (!any) return null;
  // Zone élargie.
  const zone = new Uint8Array(n * n);
  // Pour chaque ligne (début).
  for (let y = 0; y < n; y++) {
    // Pour chaque colonne (début).
    for (let x = 0; x < n; x++) {
      // Bloc avec image : suivant.
      if (!blank[y * n + x]) continue;
      // Pour les trois lignes voisines (début).
      for (let dy = -1; dy <= 1; dy++) {
        // Pour les trois colonnes voisines (début).
        for (let dx = -1; dx <= 1; dx++) {
          // Coordonnées du voisin.
          const yy = y + dy, xx = x + dx;
          // S'il est dans la vignette : il entre dans la zone.
          if (yy >= 0 && yy < n && xx >= 0 && xx < n) zone[yy * n + xx] = 1;
        // Fin de la boucle des colonnes voisines.
        }
      // Fin de la boucle des lignes voisines.
      }
    // Fin de la boucle des colonnes.
    }
  // Fin de la boucle des lignes.
  }
  // Renvoie la zone.
  return zone;
// Fin de blankZone.
}

/**
 * Pixel sans image, au sens large : dans la zone sans image d'une tuile, le bord de la photo est bavé par la
 * compression (gris très clair ou très sombre). Seuils plus larges que `blankLike`, pour ne pas laisser de liseré.
 */
// Déclare et exporte blankNear : comme blankLike, avec des seuils plus larges.
export const blankNear = (r, g, b, a) => a < 32 || (r >= 232 && g >= 232 && b >= 232) || (r <= 12 && g <= 12 && b <= 12);

/**
 * Pose une couche sur un fond, sauf là où elle n'a pas d'image : dans sa zone sans image (`zone`, voir blankZone),
 * les pixels sans image gardent le fond ; partout ailleurs la couche l'emporte, même sur un pixel blanc (toit, neige).
 * `base` et `layer.data` : pixels RGBA de `size` px de côté ; `base` est modifié sur place. `zone` null : la couche
 * couvre toute la tuile. gain / offset : correction de couleur de la couche.
 */
// Déclare et exporte composeZoned : le fond, la couche, sa zone sans image et la taille (256 par défaut).
export function composeZoned(base, layer, zone, size = 256) {
  // Les pixels, le gain et le décalage de la couche.
  const d = layer.data, g = layer.gain, o = layer.offset;
  // Taille d'un bloc de la vignette, en pixels.
  const block = size / THUMB;
  // Pour chaque ligne (début).
  for (let y = 0; y < size; y++) {
    // Position de la ligne de blocs dans la zone.
    const row = Math.floor(y / block) * THUMB;
    // Pour chaque colonne (début).
    for (let x = 0; x < size; x++) {
      // Indice du pixel.
      const i = 4 * (y * size + x);
      // Dans la zone sans image, pixel sans image : le fond est gardé.
      if (zone && zone[row + Math.floor(x / block)] && blankNear(d[i], d[i + 1], d[i + 2], d[i + 3])) continue;
      // Copie la couleur de la couche, corrigée si elle a un gain.
      for (let c = 0; c < 3; c++) base[i + c] = g ? d[i + c] * g[c] + o[c] * 255 : d[i + c];
      // Pixel opaque.
      base[i + 3] = 255;
    // Fin de la boucle des colonnes.
    }
  // Fin de la boucle des lignes.
  }
  // Renvoie le fond.
  return base;
// Fin de composeZoned.
}

/** Applique une correction de couleur (gain, décalage par canal) à des pixels RGBA, sur place. */
// Déclare et exporte applyGain : les pixels, le gain et le décalage.
export function applyGain(data, gain, offset) {
  // Pour chaque pixel (début).
  for (let i = 0; i + 3 < data.length; i += 4) {
    // Corrige chacun de ses trois canaux.
    for (let c = 0; c < 3; c++) data[i + c] = data[i + c] * gain[c] + offset[c] * 255;
  // Fin de la boucle.
  }
  // Renvoie les pixels.
  return data;
// Fin de applyGain.
}
