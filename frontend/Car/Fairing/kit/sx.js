/**
 * Petites conversions pour les styles en ligne (`style={{…}}`) dont la valeur n'est connue qu'au rendu.
 * Tout ce qui est fixe est écrit en classes Tailwind, compilées au build ; il ne reste ici que les valeurs
 * calculées (une couleur d'astre, une marge de sécurité, une largeur mesurée). Ce sont de simples fonctions
 * pures : aucune feuille de style n'est fabriquée pendant le rendu.
 */

// Table des couleurs nommées de l'interface → variable CSS du thème (voir theme/app.css).
const TOKENS = {
  // Textes.
  'text.primary': 'var(--color-ink)', 'text.secondary': 'var(--color-soft)', 'text.disabled': 'var(--color-faint)',
  // Couleur principale.
  primary: 'var(--color-primary)', 'primary.main': 'var(--color-primary)', 'primary.light': 'var(--color-primary-light)',
  'primary.dark': 'var(--color-primary-dark)', 'primary.contrastText': 'var(--color-on-primary)',
  // Couleur secondaire.
  secondary: 'var(--color-secondary)', 'secondary.main': 'var(--color-secondary)', 'secondary.contrastText': 'var(--color-on-secondary)',
  // États.
  error: 'var(--color-error)', 'error.main': 'var(--color-error)', success: 'var(--color-success)', 'success.main': 'var(--color-success)',
  info: 'var(--color-info)', 'info.main': 'var(--color-info)', warning: 'var(--color-warning)', 'warning.main': 'var(--color-warning)',
  // Surfaces et filets.
  divider: 'var(--color-line)', 'background.paper': 'var(--color-surface)', 'background.default': 'var(--color-bg)',
  // Survol, sélection et focus.
  'action.hover': 'var(--color-hover)', 'action.selected': 'var(--color-selected)', 'action.focus': 'var(--color-focus)',
  'action.disabled': 'var(--color-faint)', 'action.active': 'var(--color-soft)',
// Fin de la table.
};

/** Couleur : un nom de l'interface (« text.secondary ») devient sa variable CSS ; toute autre valeur passe telle quelle. */
export const tok = (v) => (typeof v === 'string' && TOKENS[v]) || v;

/** Espacement : un nombre compte en pas de 8 px (1,5 → 12 px) ; une chaîne CSS passe telle quelle. */
export const sp = (v) => (typeof v === 'number' ? `${v * 8}px` : v);

/** Taille : un nombre entre 0 et 1 est une fraction (0,5 → 50 %), au-delà des pixels ; une chaîne passe telle quelle. */
export const sz = (v) => (typeof v === 'number' ? (v > 0 && v <= 1 ? `${v * 100}%` : `${v}px`) : v);

/** Rayon d'angle : un nombre compte en pas de 8 px ; une chaîne passe telle quelle. */
export const rad = (v) => (typeof v === 'number' ? `${v * 8}px` : v);

/** Bordure : un nombre est une épaisseur en pixels, trait plein ; une chaîne passe telle quelle. */
export const bd = (v) => (typeof v === 'number' ? `${v}px solid` : v);
