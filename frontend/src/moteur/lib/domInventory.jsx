/**
 * Inventaire des éléments actionnables de la page, envoyé au modèle à chaque message.
 *
 * Le modèle ne voit pas l'écran : il reçoit cette liste — un identifiant, un libellé, un rôle et un état par
 * élément — et désigne par son identifiant celui sur lequel agir. Le navigateur retrouve l'élément et le clique
 * réellement. Rien n'est écrit en dur ici : l'inventaire est relevé sur la page telle qu'elle est à l'instant.
 *
 * Un élément absent de l'inventaire est hors de portée : il n'est pas à l'écran. Le modèle doit alors ouvrir la
 * fenêtre qui le contient, et agir au message suivant.
 */

/** Sélecteur des éléments actionnables : boutons, cases, champs, liens et entrées de menu. */
// Sélecteur CSS des éléments actionnables.
const ACTIONABLE = [
  // les boutons et les éléments qui en tiennent le rôle,
  'button', '[role="button"]',
  // les cases à cocher et les interrupteurs,
  'input[type="checkbox"]', 'input[type="radio"]', '[role="checkbox"]', '[role="switch"]',
  // les champs de texte et les listes déroulantes,
  'input[type="text"]', 'input[type="search"]', 'textarea', 'select', '[role="combobox"]',
  // les liens, les entrées de menu, les onglets et les options.
  'a[href]', '[role="menuitem"]', '[role="tab"]', '[role="option"]', '[role="link"]',
// Assemble le sélecteur.
].join(',');

/**
 * Sous-arbre exclu du relevé : le panneau de Claude lui-même. Ce n'est pas une restriction sur ce que le modèle
 * peut atteindre dans l'application, mais une protection contre la boucle — son propre bouton d'envoi et sa croix
 * de fermeture n'ont rien à faire dans l'inventaire.
 */
// Sélecteur du panneau de Claude.
export const SELF_PANEL = '[data-claude-panel]';

/** Nombre maximal d'éléments relevés : au-delà, la consigne envoyée au modèle deviendrait trop longue. */
// Nombre maximal d'éléments de l'inventaire.
export const MAX_ELEMENTS = 120;
/** Longueur maximale d'un libellé : de quoi reconnaître l'élément, sans recopier un paragraphe. */
// Longueur maximale d'un libellé.
export const MAX_LABEL = 60;

/** Texte réduit à une ligne, sans espaces superflus, coupé à la longueur maximale. */
// Déclare et exporte oneLine : reçoit un texte.
export function oneLine(text = '') {
  // Remplace toute suite d'espaces par une seule, retire les espaces des bords.
  const flat = String(text).replace(/\s+/g, ' ').trim();
  // Renvoie le texte, coupé à la longueur maximale si besoin.
  return flat.length > MAX_LABEL ? `${flat.slice(0, MAX_LABEL - 1)}…` : flat;
// Fin de oneLine.
}

/**
 * Libellé d'un élément : son nom pour les lecteurs d'écran s'il en a un, sinon son infobulle, sinon son texte,
 * sinon son texte d'invite. Un élément sans aucun libellé n'entre pas dans l'inventaire : le modèle ne pourrait
 * pas le désigner, et le lui montrer ne ferait qu'allonger la consigne.
 */
// Déclare et exporte labelOf : reçoit un élément.
export function labelOf(el) {
  // Le nom pour les lecteurs d'écran.
  const aria = el.getAttribute?.('aria-label');
  // Son infobulle.
  const title = el.getAttribute?.('title');
  // Son texte d'invite, pour un champ.
  const placeholder = el.getAttribute?.('placeholder');
  // Le premier libellé non vide, dans cet ordre.
  return oneLine(aria || title || el.textContent || placeholder || '');
// Fin de labelOf.
}

/** Rôle d'un élément : celui qu'il déclare, sinon celui que son type de balise lui donne. */
// Déclare et exporte roleOf : reçoit un élément.
export function roleOf(el) {
  // Le rôle déclaré.
  const role = el.getAttribute?.('role');
  // S'il y en a un, c'est lui.
  if (role) return role;
  // Le nom de la balise, en minuscules.
  const tag = (el.tagName || '').toLowerCase();
  // Une case à cocher ou un bouton radio garde son type ; les autres champs sont des champs de saisie.
  if (tag === 'input') return el.type === 'checkbox' || el.type === 'radio' ? el.type : 'textbox';
  // Un textarea et un select sont des champs ; un lien est un lien ; sinon le nom de la balise.
  return tag === 'textarea' ? 'textbox' : tag === 'a' ? 'link' : tag;
// Fin de roleOf.
}

/**
 * État d'un élément, en un mot ou deux : coché, enfoncé, désactivé, étendu. Il évite au modèle les gestes inutiles —
 * rallumer un interrupteur déjà allumé — et les gestes impossibles — cliquer un élément désactivé.
 */
// Déclare et exporte stateOf : reçoit un élément.
export function stateOf(el) {
  // Les mentions d'état, vides au départ.
  const parts = [];
  // Désactivé : par la propriété ou par l'attribut.
  if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') parts.push('désactivé');
  // Coché : la propriété d'une case, ou l'attribut d'un interrupteur.
  const checked = el.getAttribute?.('aria-checked');
  // Si l'un des deux dit coché ou décoché, on le note.
  if (el.type === 'checkbox' || el.type === 'radio' || checked) {
    // coché ou décoché, selon la propriété puis l'attribut.
    parts.push((el.checked ?? checked === 'true') ? 'coché' : 'décoché');
  // Fin du cas.
  }
  // Enfoncé : un bouton qui garde un état.
  const pressed = el.getAttribute?.('aria-pressed');
  // Si l'attribut est là, on le note.
  if (pressed) parts.push(pressed === 'true' ? 'enfoncé' : 'relâché');
  // Étendu : un menu ou une section déroulante.
  const expanded = el.getAttribute?.('aria-expanded');
  // Si l'attribut est là, on le note.
  if (expanded) parts.push(expanded === 'true' ? 'ouvert' : 'fermé');
  // Renvoie les mentions réunies, ou une chaîne vide.
  return parts.join(', ');
// Fin de stateOf.
}

/** Élément réellement visible : il occupe une surface à l'écran. Un élément masqué n'est pas cliquable. */
// Déclare et exporte isVisible : reçoit un élément.
export function isVisible(el) {
  // Sans méthode de mesure (élément d'essai), on le considère visible.
  if (typeof el.getBoundingClientRect !== 'function') return true;
  // Sa surface à l'écran.
  const r = el.getBoundingClientRect();
  // Visible s'il a une largeur et une hauteur.
  return r.width > 0 && r.height > 0;
// Fin de isVisible.
}

/**
 * Relève l'inventaire dans un document. Renvoie `{ elements, byId }` : la liste à envoyer au modèle, et la table
 * qui retrouve l'élément à partir de son identifiant, pour l'exécution. Les identifiants sont des numéros d'ordre
 * (`e1`, `e2`…) : ils ne valent que pour ce relevé, ce qui évite de les confondre d'un message à l'autre.
 */
// Déclare et exporte collectInventory : reçoit le document (celui de la page par défaut).
export function collectInventory(doc = globalThis.document) {
  // Sans document : un inventaire vide.
  if (!doc?.querySelectorAll) return { elements: [], byId: new Map() };
  // La liste envoyée au modèle.
  const elements = [];
  // La table des éléments, par identifiant.
  const byId = new Map();
  // Pour chaque élément actionnable du document (début).
  for (const el of doc.querySelectorAll(ACTIONABLE)) {
    // L'inventaire est plein : on s'arrête.
    if (elements.length >= MAX_ELEMENTS) break;
    // Élément masqué : ignoré, il n'est pas cliquable.
    if (!isVisible(el)) continue;
    // Élément du panneau de Claude : ignoré, pour qu'il ne se clique pas lui-même.
    if (el.closest?.(SELF_PANEL)) continue;
    // Son libellé.
    const label = labelOf(el);
    // Sans libellé : ignoré, le modèle ne pourrait pas le désigner.
    if (!label) continue;
    // Son identifiant : son numéro d'ordre dans ce relevé.
    const id = `e${elements.length + 1}`;
    // Son état.
    const state = stateOf(el);
    // Ajoute la ligne : identifiant, libellé, rôle, et l'état seulement s'il y en a un.
    elements.push({ id, label, role: roleOf(el), ...(state ? { state } : {}) });
    // Garde l'élément, pour l'exécution.
    byId.set(id, el);
  // Fin de la boucle.
  }
  // Renvoie la liste et la table.
  return { elements, byId };
// Fin de collectInventory.
}
