// Marge de sécurité des écrans à encoche.
import { safe } from './mediaQueries.jsx';

// Cotes de la mise en page du HUD, partagées par les composants (sx).
// Marge au bord de l'écran : 14 pixels.
export const GUTTER = 14;      // marge au bord de l'écran (px)
// Largeur du rail des astres : 260 pixels.
export const RAIL = 260;       // largeur maximale du rail des astres (ordinateur)
/**
 * Rail des astres (ordinateur) : sa largeur suit celle de la fenêtre (208 px au plus étroit, 260 px au plus large),
 * et il tient entre le bandeau du haut (logo, titre, date) et la barre d'outils du bas.
 */
export const RAIL_W = `clamp(208px, 19vw, ${RAIL}px)`;
export const RAIL_TOP = 96;     // place du bandeau du haut, marge comprise (ordinateur)
export const RAIL_BOTTOM = 76;  // place de la barre d'outils du bas, marge comprise (ordinateur)
// Hauteur de la bande des astres : 52 pixels.
export const STRIP_H = 52;     // hauteur de la bande des astres (mobile)
// Ordinateur : distance entre le bas de l'écran et le bas des boutons +/−, posés juste au-dessus de la barre d'outils
// (8 px de marge + ≈ 44 px de barre + 12 px d'air). La navball se pose juste au-dessus des boutons.
// Distance entre le bas de l'écran et le bas des boutons de zoom : 64 pixels.
export const ZOOM_BOTTOM = 64;
// Téléphone : l'écran est découpé en trois zones qui ne se recouvrent jamais.
//  - En haut, la zone du titre (MobileTopBar) : bandeau titre, bouton de don, puis les indicateurs (chargement des
//    tuiles), les uns sous les autres dans le flux. Sa limite basse est publiée dans --hud-top.
//  - En bas, le dock (MobileDock) : de haut en bas, le tiroir Informations, la barre de l'assistant, la bande des astres
//    et la navigation (Explorer, Orbite, Données, Menu), empilés dans le flux. Sa hauteur est publiée dans
//    --hud-bottom. En largeur suffisante (paysage), les deux premiers se partagent une rangée.
//  - Entre les deux, la scène 3D, libre ; la navball et les coordonnées GPS s'y placent avec ces deux variables.
// Les variables sont mesurées (ResizeObserver) : une barre qui s'ouvre, se replie ou change de hauteur (rotation,
// clavier, texte traduit) déplace d'elle-même tout ce qui en dépend, sans constante à tenir à jour.
// Hauteur de l'en-tête replié du tiroir Informations : 54 pixels.
export const SHEET_HEAD_H = 54; // en-tête replié du tiroir Informations (mobile)
// Hauteur du bandeau titre : 64 pixels (valeur de repli de --hud-top, avant la première mesure).
export const TITLE_H = 64;      // bandeau titre et sa marge (mobile)
// Hauteur de la navigation du bas : 60 pixels (valeur de repli de --hud-bottom, avant la première mesure).
export const NAV_H = 60;        // navigation du bas, sans la marge de sécurité (mobile)
// Limite basse de la zone du titre (téléphone), mesurée.
export const HUD_TOP = `var(--hud-top, calc(${safe('top')} + ${TITLE_H}px))`;
// Hauteur du dock du bas (téléphone), mesurée, marge de sécurité comprise.
export const HUD_BOTTOM = `var(--hud-bottom, calc(${safe('bottom')} + ${NAV_H}px))`;
/**
 * Position verticale (propriété `top`) d'un élément de hauteur h centré dans la zone libre du téléphone, entre la zone
 * du titre et le dock, jamais au-dessus de la zone du titre (marge de 8 px).
 */
// Fonction freeZoneTop : la hauteur de l'élément.
export const freeZoneTop = (h) => `max(calc(${HUD_TOP} + 8px), calc(${HUD_TOP} + (100dvh - ${HUD_TOP} - ${HUD_BOTTOM} - ${h}px) / 2))`;
// Largeur d'un panneau : 26 % de l'écran, entre 300 et 400 pixels.
export const PANEL_W = 'clamp(300px, 26vw, 400px)';

/** Distance au bord (px) + marge de sécurité de l'écran. */
// Fonction edge : la distance à un bord, marge de sécurité comprise.
export const edge = (side, px = GUTTER) => `calc(${safe(side)} + ${px}px)`;
