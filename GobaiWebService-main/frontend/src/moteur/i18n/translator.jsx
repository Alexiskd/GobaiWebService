// Ouvre l'import des calculs de traduction :
import {
  // les fonctions utilisées ici.
  fromTemplate, isSourceLanguage, looksUntranslated, packBatches, parseResponse, shouldTranslate, splitBatch, toTemplate,
// Fin de l'import.
} from './i18nMath';

// Adresse du service MyMemory.
const ENDPOINT = 'https://api.mymemory.translated.net/get';
// Adresse de contact facultative (variable de build) : MyMemory relève alors le quota gratuit quotidien.
// Adresse de contact donnée au service, si elle est définie.
const CONTACT_EMAIL = (import.meta.env?.VITE_MYMEMORY_EMAIL || '').trim();
// Préfixe des clés du cache dans le navigateur.
const STORE_PREFIX = 'gobai.i18n.v1.';
// Nombre maximal de traductions gardées : 4 000.
const MAX_STORED = 4000;
// Attributs traduits : infobulle, texte d'attente, libellé pour lecteur d'écran, texte de remplacement.
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
// Jamais traduits : code, saisies, scène 3D, noms propres affichés sur la carte, noms des langues (attribut translate="no").
// Éléments jamais traduits :
const SKIP = [
  // scripts, styles, code, saisies, dessins, et ce qui porte translate="no" ;
  'script', 'style', 'noscript', 'code', 'kbd', 'pre', 'textarea', 'svg', 'canvas', '[translate="no"]',
  // les noms affichés sur la carte et dans la fiche d'un pays.
  '.map-label', '.country-label', '.cc-head h2', '.cc-sub', '.cc-alt strong',
// Réunis en un seul sélecteur.
].join(', ');
// Délai avant un envoi : 200 ms.
const FLUSH_MS = 200;
// Nombre d'envois en même temps : 2.
const CONCURRENCY = 2;
// Délai maximal d'un envoi : 10 secondes.
const TIMEOUT_MS = 10000;

/**
 * Traduit toute l'interface (textes, infobulles, champs) sans toucher aux composants :
 * le texte d'origine de chaque nœud est mémorisé, remplacé par sa traduction et restauré au retour au français.
 * Les nœuds sont modifiés sur place (pas de remplacement), ce que React tolère : il réécrit simplement
 * le texte quand sa valeur change, et la traduction suit.
 *
 * Seuls les textes affichés sont envoyés à MyMemory, regroupés par lots, puis gardés en cache
 * (mémoire et localStorage par langue) : une interface déjà vue ne coûte plus aucune requête.
 */
// Classe UiTranslator : le traducteur de l'interface.
export class UiTranslator {
  // Constructeur ; par défaut : toute la page, le fetch du navigateur, son stockage.
  constructor({ root = document.body, fetchImpl = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, onStatus } = {}) {
    // Élément racine.
    this.root = root;
    // Fonction de téléchargement.
    this.fetch = fetchImpl;
    // Stockage.
    this.storage = storage;
    // Fonction prévenue de l'état, ou une fonction vide.
    this.onStatus = onStatus || (() => {});
    // Textes d'origine des nœuds de texte.
    this.texts = new WeakMap(); // nœud texte → { orig, applied }
    // Textes d'origine des attributs.
    this.attrs = new WeakMap(); // élément → { [attribut]: { orig, applied } }
    // Chaîne des langues à essayer.
    this.chain = [];
    // Rang de la langue en cours dans la chaîne.
    this.level = 0;
    // Code de la langue active.
    this.target = '';           // code MyMemory actif ('' = français d'origine)
    // Numéro de génération.
    this.gen = 0;               // génération : les réponses d'une langue abandonnée sont ignorées
    // Cache des traductions.
    this.cache = new Map();
    // Gabarits en attente d'envoi.
    this.queue = new Set();
    // Gabarits en cours d'envoi.
    this.inflight = new Set();
    // Lots à envoyer.
    this.batches = [];
    // Nombre d'envois en cours.
    this.active = 0;
    // Gabarits en échec.
    this.failed = new Set();
    // Quota épuisé ou non.
    this.quota = false;
    // Compte des textes revenus identiques.
    this.stats = { identical: 0, total: 0 };
    // Nœuds modifiés à revoir.
    this.dirty = new Set();
    // Observateur des changements de la page, si le navigateur en a un :
    this.observer = typeof MutationObserver === 'function'
      // il passe les changements à onMutations ;
      ? new MutationObserver((records) => this.onMutations(records))
      // sinon aucun.
      : null;
  // Fin du constructeur.
  }

  // ----------------------------------------------------------------- langue

  /** Codes à essayer dans l'ordre (voir fallbackChain). Vide ou français : interface d'origine. */
  // Méthode setChain.
  setChain(chain) {
    // Chaîne sans valeurs vides.
    const next = (chain || []).filter(Boolean);
    // Même langue en tête (chaîne seulement précisée) : on garde le travail en cours.
    // Même langue en tête, déjà active :
    if (next.length && next[0] === this.chain[0] && this.level === 0 && this.target) {
      // garde seulement la nouvelle chaîne ;
      this.chain = next;
      // rien d'autre.
      return;
    // Fin du cas.
    }
    // Garde la chaîne.
    this.chain = next;
    // Revient au premier rang.
    this.level = 0;
    // Oublie le quota.
    this.quota = false;
    // Chaîne vide ou français en tête :
    if (!this.chain.length || isSourceLanguage(this.chain[0])) {
      // revient au français ;
      this.activate('');
      // fin.
      return;
    // Fin du cas.
    }
    // Active la première langue.
    this.activate(this.chain[0]);
  // Fin de setChain.
  }

  // Méthode activate : active une langue (ou le français avec un code vide).
  activate(code) {
    // Nouvelle génération.
    this.gen++;
    // Garde le code.
    this.target = code;
    // Vide les gabarits en attente,
    this.queue.clear();
    // ceux en cours d'envoi,
    this.inflight.clear();
    // les lots,
    this.batches = [];
    // les échecs,
    this.failed.clear();
    // et le compte des textes identiques.
    this.stats = { identical: 0, total: 0 };
    // Charge le cache de la langue, ou un cache vide.
    this.cache = code ? this.load(code) : new Map();
    // Avec une langue :
    if (code) {
      // observe la page,
      this.observer?.observe(this.root, {
        // ses éléments, ses textes et les attributs traduits.
        subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS,
      // Fin de l'observation.
      });
    // Sans langue :
    } else {
      // cesse d'observer.
      this.observer?.disconnect();
    // Fin du choix.
    }
    // Parcourt toute la page.
    this.scan(this.root);
    // Prévient de l'état.
    this.emit();
  // Fin de activate.
  }

  /** Langue suivante de la chaîne : la précédente n'est pas prise en charge par le service. */
  // Méthode fallbackNext.
  fallbackNext() {
    // Plus de langue à essayer : faux.
    if (this.level >= this.chain.length - 1) return false;
    // Passe au rang suivant.
    this.level++;
    // Langue suivante.
    const next = this.chain[this.level];
    // L'active, ou revient au français.
    this.activate(isSourceLanguage(next) ? '' : next);
    // Vrai.
    return true;
  // Fin de fallbackNext.
  }

  // Méthode status : l'état.
  status() {
    // Renvoie
    return {
      // la langue demandée ;
      requested: this.chain[0] || '',
      // la langue active ;
      active: this.target,
      // si c'est une langue de repli ;
      fallback: this.level > 0,
      // les langues abandonnées ;
      skipped: this.chain.slice(0, this.level),
      // si le quota est épuisé ;
      quota: this.quota,
      // le nombre de textes en attente ;
      pending: this.queue.size + this.inflight.size,
      // le nombre de traductions en cache.
      cached: this.cache.size,
    // Fin de l'objet.
    };
  // Fin de status.
  }

  // Méthode emit : prévient de l'état.
  emit() { this.onStatus(this.status()); }

  // Méthode dispose : arrête le traducteur.
  dispose() {
    // Cesse d'observer.
    this.observer?.disconnect();
    // Arrête la minuterie d'envoi.
    clearTimeout(this.flushTimer);
    // Arrête celle de l'enregistrement.
    clearTimeout(this.saveTimer);
    // Nouvelle génération.
    this.gen++;
    // Plus de langue active.
    this.target = '';
    // Remet le français partout.
    this.scan(this.root); // remet le français
  // Fin de dispose.
  }

  // ----------------------------------------------------------------- DOM

  // Méthode skipped : ce nœud est-il à laisser tel quel ?
  skipped(node) {
    // Son élément : le parent pour un texte, lui-même sinon.
    const el = node.nodeType === 3 ? node.parentElement : node;
    // Oui s'il n'a pas d'élément ou s'il est dans une zone jamais traduite.
    return !el || Boolean(el.closest?.(SKIP));
  // Fin de skipped.
  }

  // Méthode scan : parcourt un morceau de la page.
  scan(root) {
    // Rien : fin.
    if (!root) return;
    // Un nœud de texte : le traite, sauf s'il est à laisser.
    if (root.nodeType === 3) { if (!this.skipped(root)) this.processText(root); return; }
    // Ni élément, ni à traiter : fin.
    if (root.nodeType !== 1 || this.skipped(root)) return;
    // Parcours des éléments et des textes,
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      // sans entrer dans les zones jamais traduites.
      acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    // Fin des réglages.
    });
    // Traite les attributs de la racine.
    this.processAttrs(root);
    // Pour chaque nœud :
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      // un texte : le traite ;
      if (n.nodeType === 3) this.processText(n);
      // un élément : traite ses attributs.
      else this.processAttrs(n);
    // Fin de la boucle.
    }
  // Fin de scan.
  }

  // Méthode processText : traite un nœud de texte.
  processText(node) {
    // Son texte.
    const v = node.nodeValue;
    // Ce qu'on sait de lui.
    let st = this.texts.get(node);
    // Rien :
    if (!st) {
      // sans langue active, rien à faire ;
      if (!this.target) return; // jamais traduit : rien à restaurer
      // retient son texte d'origine ;
      st = { orig: v, applied: null };
      // le garde.
      this.texts.set(node, st);
    // Si le texte n'est plus celui qu'on avait posé :
    } else if (v !== st.applied) {
      // c'est un nouveau texte d'origine ;
      st.orig = v; // nouveau texte écrit par l'application
      // plus de traduction posée.
      st.applied = null;
    // Fin du choix.
    }
    // Texte à afficher : la traduction, ou l'origine sans langue active.
    const out = this.target ? this.translate(st.orig) : st.orig;
    // S'il est connu et différent du texte affiché :
    if (out !== null && out !== node.nodeValue) {
      // le note ;
      st.applied = out;
      // l'écrit.
      node.nodeValue = out;
    // S'il est connu et déjà affiché :
    } else if (out !== null) {
      // le note.
      st.applied = out;
    // Fin du choix.
    }
  // Fin de processText.
  }

  // Méthode processAttrs : traite les attributs d'un élément.
  processAttrs(el) {
    // Pas un élément : fin.
    if (!el.hasAttribute) return;
    // Pour chaque attribut traduit :
    for (const name of ATTRS) {
      // absent : suivant ;
      if (!el.hasAttribute(name)) continue;
      // sa valeur ;
      const v = el.getAttribute(name);
      // ce qu'on sait de l'élément ;
      let map = this.attrs.get(el);
      // rien :
      if (!map) {
        // sans langue active, suivant ;
        if (!this.target) continue;
        // crée la fiche ;
        map = {};
        // la garde.
        this.attrs.set(el, map);
      // Fin du cas.
      }
      // Ce qu'on sait de l'attribut.
      let st = map[name];
      // Rien : retient sa valeur d'origine.
      if (!st) st = map[name] = { orig: v, applied: null };
      // Valeur changée par l'application : nouvelle origine.
      else if (v !== st.applied) { st.orig = v; st.applied = null; }
      // Valeur à afficher : la traduction, ou l'origine.
      const out = this.target ? this.translate(st.orig) : st.orig;
      // Si elle est connue :
      if (out !== null) {
        // la note ;
        st.applied = out;
        // l'écrit si elle diffère.
        if (out !== v) el.setAttribute(name, out);
      // Fin du cas.
      }
    // Fin de la boucle.
    }
  // Fin de processAttrs.
  }

  // Méthode onMutations : la page a changé.
  onMutations(records) {
    // Pour chaque changement :
    for (const r of records) {
      // nœuds ajoutés : à revoir ;
      if (r.type === 'childList') r.addedNodes.forEach((n) => this.dirty.add(n));
      // sinon le nœud changé : à revoir.
      else this.dirty.add(r.target);
    // Fin de la boucle.
    }
    // Passage déjà prévu : fin.
    if (this.raf) return;
    // Fonction run : le passage.
    const run = () => {
      // Plus de passage prévu.
      this.raf = 0;
      // Nœuds à revoir.
      const nodes = [...this.dirty];
      // Vide la liste.
      this.dirty.clear();
      // Parcourt ceux qui sont encore dans la page.
      for (const n of nodes) if (n.isConnected) this.scan(n);
    // Fin de run.
    };
    // Prévoit le passage à la prochaine image, ou dans 16 ms.
    this.raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : setTimeout(run, 16);
  // Fin de onMutations.
  }

  /** Texte traduit si connu, texte d'origine s'il n'y a rien à traduire, `null` si la traduction est en attente. */
  // Méthode translate.
  translate(text) {
    // Gabarit du texte.
    const t = toTemplate(text);
    // Rien à traduire : le texte tel quel.
    if (!shouldTranslate(t.key)) return text;
    // Cherche dans le cache.
    const hit = this.cache.get(t.key);
    // Trouvé : le texte recomposé, ou le texte d'origine si un repère manque.
    if (hit !== undefined) return fromTemplate(hit, t.values, t.lead, t.trail) ?? text;
    // Quota épuisé ou gabarit en échec : le texte d'origine.
    if (this.quota || this.failed.has(t.key)) return text;
    // S'il n'est pas déjà en cours d'envoi :
    if (!this.inflight.has(t.key)) {
      // le met en attente ;
      this.queue.add(t.key);
      // prévoit un envoi.
      this.scheduleFlush();
    // Fin du cas.
    }
    // En attente : null.
    return null;
  // Fin de translate.
  }

  // ----------------------------------------------------------------- réseau

  // Méthode scheduleFlush : prévoit un envoi.
  scheduleFlush() {
    // Déjà prévu : fin.
    if (this.flushTimer) return;
    // Dans 200 ms :
    this.flushTimer = setTimeout(() => {
      // plus d'envoi prévu ;
      this.flushTimer = 0;
      // gabarits en attente ;
      const keys = [...this.queue];
      // vide l'attente ;
      this.queue.clear();
      // les marque en cours d'envoi ;
      keys.forEach((k) => this.inflight.add(k));
      // les range en lots ;
      this.batches.push(...packBatches(keys));
      // lance les envois ;
      this.pump();
      // prévient de l'état.
      this.emit();
    // Fin de la minuterie.
    }, FLUSH_MS);
  // Fin de scheduleFlush.
  }

  // Méthode pump : lance les envois.
  pump() {
    // Tant qu'il reste une place et un lot :
    while (this.active < CONCURRENCY && this.batches.length) {
      // prend le lot ;
      const batch = this.batches.shift();
      // un envoi de plus ;
      this.active++;
      // l'envoie ; à la fin :
      this.request(batch, this.gen, this.target).finally(() => {
        // un envoi de moins ;
        this.active--;
        // relance.
        this.pump();
      // Fin du traitement.
      });
    // Fin de la boucle.
    }
  // Fin de pump.
  }

  // Méthode request : envoie un lot.
  async request(batch, gen, code) {
    // Réponse lue.
    let parsed;
    // Contrôleur d'annulation, si le navigateur en a un.
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    // Annule au bout de 10 secondes.
    const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
    // Essaie :
    try {
      // paramètres : les textes, un par ligne, et le couple de langues ;
      const params = new URLSearchParams({ q: batch.join('\n'), langpair: `fr|${code}` });
      // l'adresse de contact, si elle est définie ;
      if (CONTACT_EMAIL) params.set('de', CONTACT_EMAIL);
      // appelle le service ;
      const res = await this.fetch(`${ENDPOINT}?${params}`, { headers: { Accept: 'application/json' }, signal: ctrl?.signal });
      // lit la réponse.
      parsed = parseResponse(await res.json().catch(() => null));
    // En cas d'échec :
    } catch {
      // erreur « other ».
      parsed = { error: 'other' };
    // Dans tous les cas :
    } finally {
      // arrête la minuterie.
      clearTimeout(timer);
    // Fin du cas.
    }
    // Langue changée entre-temps : la réponse est ignorée.
    if (gen !== this.gen) return; // langue changée entre-temps
    // Les gabarits ne sont plus en cours d'envoi.
    batch.forEach((k) => this.inflight.delete(k));

    // Quota épuisé :
    if (parsed.error === 'quota') {
      // le note ;
      this.quota = true;
      // vide les lots ;
      this.batches = [];
      // vide les envois en cours ;
      this.inflight.clear();
      // remet le français sur les textes en attente ;
      this.scan(this.root); // les textes en attente restent en français
      // prévient de l'état ;
      this.emit();
      // fin.
      return;
    // Fin du cas.
    }
    // Langue non prise en charge :
    if (parsed.error === 'language') {
      // passe à la langue suivante ; s'il n'y en a plus, vide les lots et prévient de l'état ;
      if (!this.fallbackNext()) { this.batches = []; this.emit(); }
      // fin.
      return;
    // Fin du cas.
    }

    // Traductions : aucune en cas d'erreur ; le texte entier pour un seul gabarit ; sinon le texte découpé.
    const parts = parsed.error ? null : batch.length === 1 ? [parsed.text.trim()] : splitBatch(parsed.text, batch.length);
    // Sans traductions :
    if (!parts) {
      // Lot mal découpé ou échec ponctuel : on réessaie texte par texte, puis on abandonne ce texte.
      // pour un lot, renvoie chaque gabarit seul ;
      if (batch.length > 1) batch.forEach((k) => { this.inflight.add(k); this.batches.push([k]); });
      // pour un gabarit seul, le marque en échec.
      else this.failed.add(batch[0]);
      // Prévient de l'état.
      this.emit();
      // Fin.
      return;
    // Fin du cas.
    }

    // Pour chaque gabarit :
    batch.forEach((k, i) => {
      // garde sa traduction ;
      this.cache.set(k, parts[i]);
      // un texte de plus ;
      this.stats.total++;
      // identique à l'origine : un de plus.
      if (parts[i] === k) this.stats.identical++;
    // Fin de la boucle.
    });
    // Langue visiblement non traduite : passe à la suivante, s'il y en a une.
    if (looksUntranslated(this.stats.identical, this.stats.total) && this.fallbackNext()) return;
    // Prévoit l'enregistrement du cache.
    this.scheduleSave();
    // Prévoit un nouveau parcours de la page.
    this.scheduleRescan();
    // Prévient de l'état.
    this.emit();
  // Fin de request.
  }

  // Méthode scheduleRescan.
  scheduleRescan() {
    // Déjà prévu : fin.
    if (this.rescanTimer) return;
    // Dans 50 ms :
    this.rescanTimer = setTimeout(() => {
      // plus de parcours prévu ;
      this.rescanTimer = 0;
      // parcourt la page.
      this.scan(this.root);
    // Fin de la minuterie.
    }, 50);
  // Fin de scheduleRescan.
  }

  // ----------------------------------------------------------------- cache local

  // Méthode load : charge le cache d'une langue.
  load(code) {
    // Essaie
    try {
      // de lire le texte gardé ;
      const raw = this.storage?.getItem(STORE_PREFIX + code);
      // d'en faire une table, vide s'il n'y a rien.
      return new Map(raw ? Object.entries(JSON.parse(raw)) : []);
    // En cas d'échec :
    } catch {
      // une table vide.
      return new Map();
    // Fin du cas.
    }
  // Fin de load.
  }

  // Méthode scheduleSave : prévoit l'enregistrement du cache.
  scheduleSave() {
    // Annule l'enregistrement prévu.
    clearTimeout(this.saveTimer);
    // Langue du moment.
    const code = this.target;
    // Cache du moment.
    const cache = this.cache;
    // Dans une seconde :
    this.saveTimer = setTimeout(() => {
      // essaie
      try {
        // de prendre les 4 000 dernières traductions ;
        const entries = [...cache].slice(-MAX_STORED);
        // de les écrire dans le navigateur.
        this.storage?.setItem(STORE_PREFIX + code, JSON.stringify(Object.fromEntries(entries)));
      // Un échec est ignoré.
      } catch { /* stockage plein ou indisponible : le cache reste en mémoire */ }
    // Fin de la minuterie.
    }, 1000);
  // Fin de scheduleSave.
  }
// Fin de la classe.
}
