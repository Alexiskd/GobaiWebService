/**
 * Couleurs et polices de l'assistant, les mêmes de jour comme de nuit : fond anthracite chaud, texte blanc cassé,
 * lignes survolées en gris plus clair, orange de l'accent pour l'action principale. Partagées par la fenêtre, l'écran
 * de connexion et l'écran de facturation.
 */
export const C = {
  panel: '#1f1e1d', field: '#262624', row: '#30302e', border: '#3b3a37',
  text: '#eceae3', muted: '#a3a097', accent: '#d97757', error: '#e5867a',
};
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
/** Texte lu par les lecteurs d'écran, absent de l'affichage. */
export const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
/** Texte qui passe toujours à la ligne : jamais de débordement ni de chevauchement, même sur un iPhone étroit. */
export const WRAP = { minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', hyphens: 'auto' };
