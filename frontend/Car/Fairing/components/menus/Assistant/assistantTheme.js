import { NIGHT } from '../../../theme/palette.js';

/**
 * Couleurs et polices de l'assistant, prises dans la palette Orbite (thème nuit, les mêmes de jour comme de nuit) :
 * fond bleu nuit, texte encre, bleu de la marque pour l'action principale, corail pour les erreurs. Partagées par la
 * fenêtre, l'écran de connexion et l'écran de facturation. Seul le logo du fournisseur (Claude, Mistral) l'identifie.
 */
export const C = {
  panel: NIGHT.panel, field: NIGHT.raised, row: NIGHT.raised, border: 'rgba(177, 199, 255, 0.17)',
  text: NIGHT.ink, muted: NIGHT.soft, accent: NIGHT.primary, error: NIGHT.coral,
};
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
/** Texte lu par les lecteurs d'écran, absent de l'affichage. */
export const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
/** Texte qui passe toujours à la ligne : jamais de débordement ni de chevauchement, même sur un iPhone étroit. */
export const WRAP = { minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', hyphens: 'auto' };
