/**
 * Nature d'une icône d'action : comment la dessiner.
 *
 * Pourquoi ce module séparé, sans JSX : la question « est-ce un composant ? » est la source d'une panne réelle,
 * et elle se teste sans React.
 *
 * Une icône MUI n'est **pas une fonction**. `createSvgIcon` rend `React.memo(React.forwardRef(…))`, c'est-à-dire
 * un *objet* portant `$$typeof`, `type` et `compare`. Un test `typeof icon === 'function'` le manque donc, et
 * l'objet finit rendu comme enfant : React lève l'erreur 31, « Objects are not valid as a React child », avec
 * exactement ces trois clés en argument — et toute l'interface tombe.
 *
 * Les quatre natures reconnues :
 *  - `composant` : une fonction, une classe, ou un objet React (`memo`, `forwardRef`, `lazy`) — à instancier ;
 *  - `element`   : un élément React déjà construit — à rendre tel quel ;
 *  - `image`     : un objet `{ img }`, une image du dossier public (le logo de Claude) ;
 *  - `texte`     : tout le reste, rendu tel quel (la lettre « N » de la navball, par exemple).
 */

/** Marqueur des éléments React déjà construits, selon la version de React. */
const ELEMENT_TYPES = new Set([
  // React jusqu'à la 18.
  Symbol.for('react.element'),
  // React 19 et au-delà.
  Symbol.for('react.transitional.element'),
// Fin des marqueurs.
]);

/** La nature d'une icône : « composant », « element », « image » ou « texte ». */
export function iconKind(icon) {
  // Une fonction : composant simple ou classe.
  if (typeof icon === 'function') return 'composant';
  // Tout ce qui n'est pas un objet non nul est du texte (chaîne, nombre, null, undefined).
  if (!icon || typeof icon !== 'object') return 'texte';
  // Un objet React : son marqueur dit lequel.
  if (icon.$$typeof) return ELEMENT_TYPES.has(icon.$$typeof) ? 'element' : 'composant';
  // Un objet qui porte une image.
  if (icon.img) return 'image';
  // Un autre objet : rien à dessiner, traité comme du texte (React le refuserait, mais ce n'est pas une icône).
  return 'texte';
// Fin de iconKind.
}
