// Marge de sécurité des écrans à encoche.
import { safe } from './mediaQueries';

// Cotes de la mise en page du HUD, partagées par les composants (sx).
// Marge au bord de l'écran : 14 pixels.
export const GUTTER = 14;      // marge au bord de l'écran (px)
// Largeur du rail des astres : 260 pixels.
export const RAIL = 260;       // largeur du rail des astres (ordinateur)
// Hauteur de la bande des astres : 52 pixels.
export const STRIP_H = 52;     // hauteur de la bande des astres (mobile)
// Ordinateur : distance entre le bas de l'écran et le bas des boutons +/−, posés juste au-dessus de la barre d'outils
// (8 px de marge + ≈ 44 px de barre + 12 px d'air). La navball se pose juste au-dessus des boutons.
// Distance entre le bas de l'écran et le bas des boutons de zoom : 64 pixels.
export const ZOOM_BOTTOM = 64;
// Téléphone : l'écran est découpé en étages qui ne se recouvrent jamais. De bas en haut : bande des astres (STRIP_H),
// en-tête du tiroir Informations (SHEET_HEAD_H) ; en haut, le bandeau titre et le bouton ⋯ (TITLE_H). Il n'y a pas de
// barre d'outils en bas : toutes les actions sont dans le menu du bouton ⋯ (MORE_W de large, marge comprise).
// La scène, la navball et les coordonnées GPS se partagent ce qui reste entre les deux.
// Hauteur de l'en-tête replié du tiroir Informations : 54 pixels.
export const SHEET_HEAD_H = 54; // en-tête replié du tiroir Informations (mobile)
// Hauteur du bandeau titre : 64 pixels.
export const TITLE_H = 64;      // bandeau titre et sa marge (mobile)
// Largeur du bouton ⋯ : 56 pixels.
export const MORE_W = 56;       // bouton ⋯ et sa marge, en haut à droite (mobile)
// Hauteur des deux étages du bas, sur téléphone.
export const BOTTOM_STACK = STRIP_H + SHEET_HEAD_H;
// Largeur d'un panneau : 26 % de l'écran, entre 300 et 400 pixels.
export const PANEL_W = 'clamp(300px, 26vw, 400px)';

/** Distance au bord (px) + marge de sécurité de l'écran. */
// Fonction edge : la distance à un bord, marge de sécurité comprise.
export const edge = (side, px = GUTTER) => `calc(${safe(side)} + ${px}px)`;
