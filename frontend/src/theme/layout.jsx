import { safe } from './mediaQueries';

// Cotes de la mise en page du HUD, partagées par les composants (sx).
export const GUTTER = 14;      // marge au bord de l'écran (px)
export const RAIL = 196;       // largeur du rail des astres (ordinateur)
export const TOOLBAR_H = 64;   // hauteur de la barre d'outils du bas (mobile)
export const STRIP_H = 52;     // hauteur de la bande des astres (mobile)
export const PANEL_W = 'clamp(300px, 26vw, 400px)';

/** Distance au bord (px) + marge de sécurité de l'écran. */
export const edge = (side, px = GUTTER) => `calc(${safe(side)} + ${px}px)`;
