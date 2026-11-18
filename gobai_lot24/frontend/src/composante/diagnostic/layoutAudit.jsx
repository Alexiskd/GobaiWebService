/**
 * Diagnostic de la mise en page : relève les commandes (boutons, liens, champs, curseurs, onglets…) de l'écran et
 * signale celles qui posent problème sur un téléphone :
 *  - hors écran : en partie ou entièrement hors de la fenêtre, sans conteneur défilant pour les atteindre ;
 *  - recouverte : le doigt ne l'atteint pas, un autre élément est au-dessus (hors fenêtre modale ouverte, qui
 *    désactive volontairement ce qu'elle couvre) ;
 *  - chevauchement : deux commandes atteignables dont les zones tactiles se recouvrent ;
 *  - petite : cible tactile de moins de 44 px de côté au doigt (recommandation d'accessibilité, 44 à 48 px), de
 *    moins de 24 px à la souris (WCAG 2.5.8) ;
 *  - texte coupé : libellé plus large que son bouton.
 * La partie pure (auditRects) se teste sans navigateur ; la partie DOM (auditDocument) mesure l'écran réel. Utilisé
 * par le banc d'essai de l'interface et, dans l'application, par l'adresse `?diagnostic=interface`.
 */

/** Sélecteur des éléments interactifs. */
// Déclare et exporte INTERACTIVE : boutons, liens, champs et rôles ARIA interactifs.
export const INTERACTIVE = [
  // Boutons, liens et champs.
  'button', 'a[href]', 'input:not([type="hidden"])', 'select', 'textarea',
  // Rôles ARIA interactifs.
  '[role="button"]', '[role="switch"]', '[role="slider"]', '[role="tab"]', '[role="menuitem"]', '[role="checkbox"]', '[role="radio"]', '[role="option"]', '[role="link"]',
// Joints par des virgules.
].join(', ');

/** Côté minimal d'une cible tactile, en pixels CSS. */
// Déclare et exporte MIN_TARGET : 44 px.
export const MIN_TARGET = 44;

/** Aire de l'intersection de deux rectangles { x, y, w, h } (0 s'ils ne se touchent pas). */
// Déclare et exporte overlapArea : les deux rectangles.
export function overlapArea(a, b) {
  // Largeur commune.
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  // Hauteur commune.
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  // Aire, nulle si l'une des deux est négative.
  return w > 0 && h > 0 ? w * h : 0;
// Fin de overlapArea.
}

/**
 * Analyse pure. `items` : [{ id, label, rect: { x, y, w, h }, reachable, scrollable, ancestors: [ids], occluder,
 * truncated, modal }] ; `viewport` : { w, h } ; `tolerance` : pixels de marge. Renvoie { offscreen, occluded,
 * overlaps, small, truncated, count }.
 */
// Déclare et exporte auditRects : les éléments, la fenêtre et les options.
export function auditRects(items, viewport, { minTarget = MIN_TARGET, tolerance = 1 } = {}) {
  // Résultats.
  const out = { offscreen: [], occluded: [], overlaps: [], small: [], truncated: [], count: items.length };
  // Pour chaque élément (début).
  for (const it of items) {
    // Rectangle.
    const r = it.rect;
    // Hors écran : déborde de la fenêtre au-delà de la marge, sans conteneur défilant qui permette de l'atteindre.
    const out_ = r.x < -tolerance || r.y < -tolerance || r.x + r.w > viewport.w + tolerance || r.y + r.h > viewport.h + tolerance;
    // Noté.
    if (out_ && !it.scrollable) out.offscreen.push(it);
    // Recouvert : visible mais inatteignable, hors fenêtre modale, hors partie masquée d'un conteneur défilant et hors
    // commande désactivée (elle laisse passer le doigt volontairement).
    if (!it.reachable && !it.modal && !it.scrollable && !it.disabled && !out_) out.occluded.push(it);
    // Petite cible : seulement si elle est atteignable (une commande inactive n'est pas une cible), mesurée sur sa
    // zone tactile (cadre d'un champ), hors lien dans le texte.
    const t = it.target || r;
    // Notée.
    if (it.reachable && !it.inline && (t.w < minTarget - tolerance || t.h < minTarget - tolerance)) out.small.push(it);
    // Texte coupé.
    if (it.truncated) out.truncated.push(it);
  // Fin de la boucle.
  }
  // Commandes atteignables.
  const live = items.filter((it) => it.reachable);
  // Chaque paire (début).
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    // Les deux éléments.
    const a = live[i], b = live[j];
    // L'un dans l'autre (bouton dans une carte cliquable) : pas un chevauchement.
    if (a.ancestors?.includes(b.id) || b.ancestors?.includes(a.id)) continue;
    // Parties visibles (coupées par leur conteneur défilant).
    const ra = a.vis || a.rect, rb = b.vis || b.rect;
    // Aire commune.
    const area = overlapArea(ra, rb);
    // Au-delà d'une bande de la marge sur le plus petit côté : chevauchement.
    if (area > tolerance * Math.min(ra.w, ra.h, rb.w, rb.h)) out.overlaps.push({ a, b, area: Math.round(area) });
  // Fin des paires.
  }
  // Renvoie l'analyse.
  return out;
// Fin de auditRects.
}

/** Libellé lisible d'un élément : aria-label, texte ou titre. */
// Déclare labelOf : l'élément.
const labelOf = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 60);

/** Vrai si l'élément est rendu (taille non nulle, ni caché, ni transparent). */
// Déclare isShown : l'élément et son rectangle.
function isShown(el, r) {
  // Sans surface : non.
  if (r.width < 1 || r.height < 1) return false;
  // Remonte les ancêtres (début).
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    // Style calculé.
    const s = getComputedStyle(n);
    // Caché ou transparent : non.
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
  // Fin de la remontée.
  }
  // Rendu.
  return true;
// Fin de isShown.
}

/** Ancêtre défilant de l'élément (débordement auto ou scroll et contenu plus grand), ou null. */
// Déclare scrollParent : l'élément.
function scrollParent(el) {
  // Remonte les ancêtres (début).
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    // Style calculé.
    const s = getComputedStyle(n);
    // Défilant dans un sens où il a plus de contenu que de place : trouvé.
    if ((/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) || (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1)) return n;
  // Fin de la remontée.
  }
  // Aucun.
  return null;
// Fin de scrollParent.
}

/**
 * Vrai si une ligne du texte de l'élément sort de sa boîte (libellé coupé ou caché). Le décor débordant et volontairement
 * rogné (halo en pseudo-élément, fond) n'a pas de texte : il ne compte pas.
 */
// Déclare textClipped : l'élément.
function textClipped(el) {
  // Boîte de l'élément.
  const b = el.getBoundingClientRect();
  // Parcours des nœuds de texte de l'élément (NodeFilter.SHOW_TEXT = 4).
  const walker = el.ownerDocument.createTreeWalker(el, 4);
  // Plage de mesure du texte.
  const range = el.ownerDocument.createRange();
  // Chaque nœud de texte (début).
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    // Texte vide : ignoré.
    if (!t.textContent.trim()) continue;
    // La plage couvre ce texte.
    range.selectNodeContents(t);
    // Une de ses lignes dépasse à gauche ou à droite de plus de 2 px : coupé.
    for (const r of range.getClientRects()) if (r.width > 0 && (r.right > b.right + 2 || r.left < b.left - 2)) return true;
  // Fin du parcours.
  }
  // Aucun texte ne dépasse.
  return false;
// Fin de textClipped.
}

/**
 * Mesure l'écran réel : chaque commande rendue, son rectangle, si le doigt l'atteint (essai au centre et à quatre
 * points intérieurs), si une fenêtre modale ouverte la couvre volontairement, si un conteneur défilant permet de
 * l'atteindre, si son libellé est coupé. Renvoie l'analyse de auditRects, plus le débordement de la page.
 */
// Déclare et exporte auditDocument : le document et les options.
export function auditDocument(doc = document, options = {}) {
  // Cible minimale selon le pointeur : 44 px au doigt (écran tactile), 24 px à la souris (WCAG 2.5.8).
  const coarse = doc.defaultView?.matchMedia?.('(pointer: coarse)').matches;
  // Réglage final : celui demandé, sinon selon le pointeur.
  options = { minTarget: coarse ? MIN_TARGET : 24, ...options };
  // Fenêtre.
  const viewport = { w: doc.documentElement.clientWidth, h: doc.documentElement.clientHeight };
  // Fenêtres modales ouvertes (MUI : .MuiModal-root ; ARIA : aria-modal).
  const modals = [...doc.querySelectorAll('.MuiModal-root, [aria-modal="true"]')].filter((m) => isShown(m, m.getBoundingClientRect()));
  // Éléments interactifs rendus, chacun numéroté.
  const els = [...doc.querySelectorAll(INTERACTIVE)].filter((el) => !el.closest('[aria-hidden="true"]') && isShown(el, el.getBoundingClientRect()));
  // Numéros.
  const ids = new Map(els.map((el, i) => [el, i]));
  // Relevé de chaque élément (début).
  const items = els.map((el, i) => {
    // Rectangle.
    const b = el.getBoundingClientRect();
    // Rectangle simple.
    const rect = { x: b.left, y: b.top, w: b.width, h: b.height };
    // Points d'essai : centre et quatre points à un quart des bords, dans la fenêtre.
    const pts = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([fx, fy]) => [b.left + fx * b.width, b.top + fy * b.height]).filter(([x, y]) => x >= 0 && y >= 0 && x < viewport.w && y < viewport.h);
    // Élément au-dessus de chaque point.
    const tops = pts.map(([x, y]) => doc.elementFromPoint(x, y));
    // Atteint si l'un des points touche l'élément ou l'un de ses descendants (ou son étiquette).
    const reachable = tops.some((t) => t && (t === el || el.contains(t) || (t.tagName === 'LABEL' && t.contains(el)) || (el.labels && [...el.labels].some((l) => l.contains(t)))));
    // Ce qui le couvre, s'il est inatteignable.
    const occ = reachable ? null : tops.find(Boolean);
    // Couvert par une fenêtre modale ouverte dont il ne fait pas partie : désactivé volontairement.
    const modal = !reachable && modals.some((m) => !m.contains(el));
    // Conteneur défilant le plus proche.
    const sp = scrollParent(el);
    // Sa zone visible.
    const sr = sp?.getBoundingClientRect();
    // Hors de la zone visible de ce conteneur (en partie) : atteignable en faisant défiler.
    const scrollable = Boolean(sr) && (b.top < sr.top - 1 || b.bottom > sr.bottom + 1 || b.left < sr.left - 1 || b.right > sr.right + 1);
    // Partie visible (coupée par le conteneur défilant) : seule elle peut en chevaucher une autre.
    const vis = sr ? { x: Math.max(b.left, sr.left), y: Math.max(b.top, sr.top), w: Math.max(0, Math.min(b.right, sr.right) - Math.max(b.left, sr.left)), h: Math.max(0, Math.min(b.bottom, sr.bottom) - Math.max(b.top, sr.top)) } : rect;
    // Cible tactile : un champ de saisie se touche sur tout son cadre (MUI : .MuiInputBase-root), pas seulement sa ligne.
    const frame = /^(INPUT|TEXTAREA)$/.test(el.tagName) ? el.closest('.MuiInputBase-root') : null;
    // Taille de la cible.
    const tb = frame ? frame.getBoundingClientRect() : b;
    // Lien dans le texte (en ligne) : exempté de la taille minimale, comme le prévoit WCAG 2.5.8.
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
    // Ancêtres interactifs.
    const ancestors = [];
    // Remonte les ancêtres.
    for (let n = el.parentElement; n; n = n.parentElement) if (ids.has(n)) ancestors.push(ids.get(n));
    // Libellé coupé : contenu plus large que l'élément, rogné, et c'est bien du texte qui dépasse (boutons et liens).
    const truncated = /^(BUTTON|A)$/.test(el.tagName) && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && textClipped(el);
    // Désactivé (attribut, ARIA ou classe MUI) : pas une commande à atteindre pour l'instant.
    const disabled = el.disabled === true || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('Mui-disabled');
    // Le relevé.
    return { id: i, label: labelOf(el), tag: el.tagName.toLowerCase(), rect, vis, target: { w: tb.width, h: tb.height }, inline, reachable, modal, scrollable, ancestors, truncated, disabled, occluder: occ ? labelOf(occ).slice(0, 40) || occ.tagName : null, el };
  // Fin du relevé.
  });
  // Analyse.
  const res = auditRects(items, viewport, options);
  // Débordement de la page : largeur ou hauteur du document au-delà de la fenêtre.
  res.pageOverflow = { x: Math.max(0, doc.documentElement.scrollWidth - viewport.w), y: Math.max(0, doc.documentElement.scrollHeight - viewport.h) };
  // Fenêtre et nombre de fenêtres modales.
  res.viewport = viewport; res.modals = modals.length;
  // Liste des éléments.
  res.items = items;
  // Renvoie l'analyse.
  return res;
// Fin de auditDocument.
}

/** Résumé sans les nœuds du DOM (transmissible, lisible dans la console). */
// Déclare et exporte summarize : l'analyse.
export function summarize(res) {
  // Un élément : libellé, balise, rectangle arrondi (et sa zone tactile si elle diffère).
  const brief = (it) => ({ label: it.label, tag: it.tag, rect: Object.fromEntries(Object.entries(it.target && (it.target.w !== it.rect.w || it.target.h !== it.rect.h) ? { ...it.rect, w: it.target.w, h: it.target.h } : it.rect).map(([k, v]) => [k, Math.round(v)])), occluder: it.occluder || undefined });
  // Le résumé.
  return {
    // Fenêtre, nombre de commandes et de fenêtres modales.
    viewport: res.viewport, count: res.count, modals: res.modals, pageOverflow: res.pageOverflow,
    // Chaque catégorie.
    offscreen: res.offscreen.map(brief), occluded: res.occluded.map(brief), small: res.small.map(brief), truncated: res.truncated.map(brief),
    // Chevauchements.
    overlaps: res.overlaps.map(({ a, b, area }) => ({ a: brief(a), b: brief(b), area })),
    // Commandes atteignables.
    reachable: res.items.filter((it) => it.reachable).map(brief),
  // Fin du résumé.
  };
// Fin de summarize.
}
