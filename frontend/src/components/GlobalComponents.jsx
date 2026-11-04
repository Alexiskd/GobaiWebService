import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalStyles, useMediaQuery } from '@mui/material';
import { createHudStore, useHud } from '@/engine/hudStore';
import { bodyId } from '@/engine/bodyPlaces';
import {
  fetchBorders, fetchCityLabels, fetchMoonEphemeris, fetchMoonOrbiters, fetchMoonPhases,
  fetchShadowCam, fetchShadowCamMeta, resolveApiUrl, searchPlaces, tilesApi,
} from '@/api';
import { useSolarData } from '@/hooks/useSolarData';
import { useSolarEngine } from '@/hooks/useSolarEngine';
import { useTileLayers } from '@/hooks/useTileLayers';
import { useToasts } from '@/hooks/useToasts';
import { useDraggable } from '@/hooks/useDraggable';
import { BodyLayersMenu, BodyPlacesInfo, useBodyView } from './AdaptiveComponents';
import { CityPointCloud } from './CityPointCloud';
import { ContributionPanel } from './ContributionPanel';

// Composantes globales du frontend : tout ce qui est commun aux astres.
// Seules les deux composantes de AdaptiveComponents.jsx changent selon la planète.
//
// Styles : tout est en MUI (objets `GlobalStyles` + `useMediaQuery`), plus aucun fichier .css.
// Adaptation écrans : toutes les composantes lisent `useViewport()`.
//  - xs  ≤ 480 px   : téléphone portrait
//  - sm  ≤ 720 px   : grand téléphone / petite tablette  → mode « compact »
//  - md  ≤ 1024 px  : tablette
//  - lg  ≤ 1440 px  : ordinateur portable
//  - xl  > 1440 px  : grand écran / TV
// En mode compact : pas de glisser-déposer des panneaux, panneau d'infos en tiroir bas,
// barre d'outils réduite avec menu « Plus », palette plein écran, sources repliables.

// ---------------------------------------------------------------- Utilitaires partagés

const fold = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const coords = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'O'}`;

// ---------------------------------------------------------------- Viewport

// Requêtes média partagées par `useMediaQuery` (JS) et par les styles MUI (CSS-in-JS).
const QUERIES = {
  xs: '(max-width: 480px)',
  sm: '(max-width: 720px)',
  md: '(max-width: 1024px)',
  lg: '(max-width: 1440px)',
  xl: '(min-width: 1441px)',
  tiny: '(max-width: 380px)',
  coarse: '(pointer: coarse)',
  noHover: '(hover: none)',
  short: '(max-height: 500px)',
  landscape: '(orientation: landscape)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
};
const MQ = {
  coarse: `@media ${QUERIES.coarse}`,
  noHover: `@media ${QUERIES.noHover}`,
  xl: `@media ${QUERIES.xl}`,
  tablet: `@media ${QUERIES.md}`,
  // Mobile, ou téléphone en paysage (large mais très bas) : mode compact.
  compact: `@media ${QUERIES.sm}, ${QUERIES.short} and ${QUERIES.coarse}`,
  tiny: `@media ${QUERIES.tiny}`,
  landscapePhone: `@media ${QUERIES.short} and ${QUERIES.landscape} and ${QUERIES.coarse}`,
  reducedMotion: `@media ${QUERIES.reducedMotion}`,
};

/** Catégorie d'écran courante (MUI `useMediaQuery`) ; ne re-rend que lorsque la catégorie change. */
export function useViewport() {
  const opts = { noSsr: true };
  const xs = useMediaQuery(QUERIES.xs, opts);
  const sm = useMediaQuery(QUERIES.sm, opts);
  const md = useMediaQuery(QUERIES.md, opts);
  const lg = useMediaQuery(QUERIES.lg, opts);
  const coarse = useMediaQuery(QUERIES.coarse, opts);
  const short = useMediaQuery(QUERIES.short, opts);
  const landscape = useMediaQuery(QUERIES.landscape, opts);
  return useMemo(() => {
    const size = xs ? 'xs' : sm ? 'sm' : md ? 'md' : lg ? 'lg' : 'xl';
    return {
      size,
      compact: sm || (short && coarse),
      tablet: size === 'md',
      coarse,
      short,
      landscape,
    };
  }, [xs, sm, md, lg, coarse, short, landscape]);
}

// ---------------------------------------------------------------- Styles MUI (ex responsive.css)
//
// Paliers : xs ≤480 · sm ≤720 · md ≤1024 · lg ≤1440 · xl >1440.
// Le préfixe `html` augmente la spécificité pour passer devant la feuille de style principale.

const C = {
  gap: 'var(--gap)',
  safeT: 'var(--safe-t)',
  safeR: 'var(--safe-r)',
  safeB: 'var(--safe-b)',
  safeL: 'var(--safe-l)',
  touch: 'var(--touch)',
  logoW: 'var(--logo-w)',
  toolbarH: 'var(--toolbar-h)',
  stripH: 'var(--strip-h)',
};

const fixedReset = { transform: 'none !important' };

const responsiveStyles = {
  // ------------------------------------------------ Variables
  ':root': {
    '--gap': 'clamp(8px, 1.4vw, 18px)',
    '--safe-t': 'env(safe-area-inset-top, 0px)',
    '--safe-r': 'env(safe-area-inset-right, 0px)',
    '--safe-b': 'env(safe-area-inset-bottom, 0px)',
    '--safe-l': 'env(safe-area-inset-left, 0px)',
    '--touch': '44px', // cible tactile minimale (Apple / Material)
    '--logo-w': 'clamp(120px, 16vw, 252px)',
    '--panel-w': 'clamp(300px, 28vw, 420px)',
    '--toolbar-h': '56px',
    '--strip-h': '52px',
    '--hud-font': 'clamp(12px, 0.75vw + 8px, 15px)',
  },

  // ------------------------------------------------ Base
  'html, body, #root': { height: '100%' },
  body: {
    margin: 0,
    overflow: 'hidden',
    overscrollBehavior: 'none',
    WebkitTextSizeAdjust: '100%',
    WebkitTapHighlightColor: 'transparent',
  },
  '.app-shell': { position: 'fixed', inset: 0, height: '100dvh', fontSize: 'var(--hud-font)' },

  // Le canvas 3D occupe tout l'écran visible, barre d'adresse mobile comprise.
  '.stage': {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    height: ['100vh', '100dvh'],
    touchAction: 'none', // les gestes vont au moteur, pas au navigateur
  },
  '.stage canvas': { display: 'block', width: '100% !important', height: '100% !important' },

  // ------------------------------------------------ En-tête
  'html .hud-title': {
    gap: 0,
    paddingLeft: 0,
    maxWidth: `calc(100vw - 2 * ${C.gap} - ${C.safeL} - ${C.safeR})`,
    display: 'flex',
    alignItems: 'center',
  },
  'html .hud-title .brand-logo': {
    width: C.logoW,
    height: 'auto',
    margin: `0 0 0 calc(${C.logoW} * -0.12)`, // équivaut à −30px à 252px
    position: 'relative',
    zIndex: 2,
    flex: 'none',
  },
  'html .hud-title .title-text': {
    margin: `0 0 0 calc(${C.logoW} * -0.16)`, // équivaut à −40px à 252px
    paddingLeft: 0,
    position: 'relative',
    zIndex: 1,
    minWidth: 0,
  },
  'html .hud-title h1': { fontSize: 'clamp(15px, 1.2vw + 9px, 26px)', lineHeight: 1.15, margin: 0 },
  'html .hud-title p': { margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  // ------------------------------------------------ Panneau droit
  'html .live-panel': {
    width: 'var(--panel-w)',
    maxWidth: `calc(100vw - 2 * ${C.gap})`,
    maxHeight: `calc(100dvh - 2 * ${C.gap} - ${C.safeT} - ${C.safeB})`,
    display: 'flex',
    flexDirection: 'column',
  },
  'html .live-panel .panel-body': {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
  },

  // ------------------------------------------------ Palette
  'html .palette': {
    width: `min(640px, calc(100vw - 2 * ${C.gap}))`,
    maxHeight: 'min(70dvh, 620px)',
    display: 'flex',
    flexDirection: 'column',
  },
  'html .palette ul': { overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0 },
  '.palette-bar': { display: 'flex', alignItems: 'center', gap: '8px' },
  '.palette-bar input': { flex: 1, minWidth: 0, fontSize: '16px' }, // 16px : pas de zoom auto sur iOS
  '.palette-close': { flex: 'none' },

  // ------------------------------------------------ Zoom
  '.zoom-pad button': {
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },

  // ------------------------------------------------ Barre d'outils
  '.tool-btn': { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' },
  '.tool-icon': { fontSize: '1.15em', lineHeight: 1 },
  '.tool-label-short': { display: 'none' },

  // ------------------------------------------------ Barre du bas · ordinateur / laptop
  // Une seule ligne centrée, jamais de retour à la ligne : [zoom] | Explorer | Données | Caméra | ?
  'html .toolbar.toolbar-desktop': {
    position: 'fixed',
    left: '50%',
    right: 'auto',
    top: 'auto',
    bottom: `calc(${C.safeB} + ${C.gap})`,
    transform: 'translateX(-50%)',
    zIndex: 40,
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: '4px',
    width: 'max-content',
    maxWidth: `calc(100vw - 2 * ${C.gap} - ${C.safeL} - ${C.safeR})`,
    height: '52px',
    margin: 0,
    padding: '6px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: 'rgba(10, 14, 24, 0.78)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
    boxShadow: '0 10px 32px rgba(0, 0, 0, 0.4)',
    overflowX: 'auto',          // filet de sécurité : défile plutôt que de passer à la ligne
    overflowY: 'hidden',
    scrollbarWidth: 'none',
  },
  'html .toolbar-desktop::-webkit-scrollbar': { display: 'none' },

  // Indicateur de zoom intégré à gauche de la barre.
  'html .toolbar-desktop .readout': {
    position: 'static',
    inset: 'auto',
    transform: 'none',
    flex: '0 1 auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '1px',
    minWidth: 0,
    maxWidth: '220px',
    height: '100%',
    padding: '0 12px 0 8px',
    marginRight: '2px',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '12px',
    lineHeight: 1.2,
    pointerEvents: 'none',
  },
  'html .toolbar-desktop .readout span': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  'html .toolbar-desktop .readout .dim': { opacity: 0.6, fontSize: '11px' },

  'html .toolbar-desktop .tool-group': { display: 'flex', alignItems: 'center', gap: '4px', flex: 'none', height: '100%' },
  'html .toolbar-desktop .tool-sep': {
    width: '1px',
    alignSelf: 'stretch',
    margin: '6px 4px',
    background: 'rgba(255, 255, 255, 0.12)',
  },

  // Boutons : même hauteur, même rayon, même espacement → alignement parfait.
  'html .toolbar-desktop .tool-btn': {
    height: '40px',
    minHeight: '40px',
    minWidth: 0,
    margin: 0,
    padding: '0 14px',
    gap: '8px',
    borderRadius: '10px',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontSize: '13.5px',
    fontWeight: 500,
    lineHeight: 1,
    cursor: 'pointer',
    transition: 'background-color 120ms ease, border-color 120ms ease, opacity 120ms ease',
  },
  'html .toolbar-desktop .tool-btn .tool-icon': { fontSize: '16px', width: '16px', textAlign: 'center', opacity: 0.85 },
  'html .toolbar-desktop .tool-btn.tool-btn-icon': { width: '40px', padding: 0 },
  'html .toolbar-desktop .tool-btn:hover:not(:disabled)': { background: 'rgba(255, 255, 255, 0.08)' },
  'html .toolbar-desktop .tool-btn:focus-visible': { outline: '2px solid #4fc3f7', outlineOffset: '1px' },
  'html .toolbar-desktop .tool-btn[aria-pressed="true"]': {
    background: 'rgba(79, 195, 247, 0.16)',
    borderColor: 'rgba(79, 195, 247, 0.45)',
    color: '#bfe9ff',
  },
  'html .toolbar-desktop .tool-btn[aria-pressed="true"] .tool-icon': { opacity: 1 },
  'html .toolbar-desktop .tool-btn:disabled': { opacity: 0.38, cursor: 'not-allowed' },

  // Laptop 13–14" (≤ 1366 px) : un peu plus serré.
  '@media (max-width: 1366px)': {
    'html .toolbar-desktop .tool-btn': { padding: '0 11px', gap: '6px', fontSize: '13px' },
    'html .toolbar-desktop .readout': { maxWidth: '170px' },
  },
  // Petit laptop (≤ 1180 px) : libellés courts (« Infos », « Global »), plus de niveau de carte.
  '@media (max-width: 1180px)': {
    'html .toolbar-desktop .tool-label-full.has-short': { display: 'none' },
    'html .toolbar-desktop .tool-label-short': { display: 'inline' },
    'html .toolbar-desktop .readout': { maxWidth: '130px' },
    'html .toolbar-desktop .readout .dim': { display: 'none' },
  },
  // Tablette / fenêtre réduite (≤ 1024 px) : indicateur de zoom masqué, boutons resserrés.
  '@media (max-width: 1024px)': {
    'html .toolbar-desktop .readout': { display: 'none' },
    'html .toolbar-desktop .tool-btn': { padding: '0 9px', fontSize: '12.5px' },
  },
  // Très étroit mais pas mobile (≤ 860 px) : icônes seules, le libellé reste dans l'info-bulle.
  '@media (max-width: 860px)': {
    'html .toolbar-desktop .tool-label': { display: 'none' },
    'html .toolbar-desktop .tool-btn': { width: '40px', padding: 0 },
  },
  '.toolbar-more': { position: 'relative' },
  '.toolbar-menu': {
    position: 'absolute',
    right: 0,
    bottom: 'calc(100% + 8px)',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '190px',
    padding: '6px',
    borderRadius: '14px',
    background: 'rgba(12, 16, 28, 0.94)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
    zIndex: 60,
  },
  '.tool-menu-item': { justifyContent: 'flex-start', width: '100%', minHeight: C.touch },
  '.tool-btn.has-active': { position: 'relative' },
  '.tool-btn.has-active::after': {
    content: '""',
    position: 'absolute',
    top: '6px',
    right: '8px',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#4fc3f7',
  },

  // ------------------------------------------------ Étiquettes de scène
  '.l-city': { fontSize: '11px' },
  '.l-planet': { cursor: 'pointer' },

  // ------------------------------------------------ Sources repliables
  '.attribution-compact summary': { cursor: 'pointer', listStyle: 'none', fontSize: '12px', opacity: 0.8 },
  '.attribution-compact summary::-webkit-details-marker': { display: 'none' },
  '.attribution-compact[open] p': { margin: '6px 0 0', maxHeight: '30dvh', overflowY: 'auto' },

  // ------------------------------------------------ Toasts
  'html .toasts': { maxWidth: `min(440px, calc(100vw - 2 * ${C.gap}))` },
  'html .toast span': { overflowWrap: 'anywhere' },

  // ================================================ Pointeur tactile
  [MQ.coarse]: {
    [[
      'html .toolbar button',
      'html .nav-item',
      'html .zoom-pad button',
      'html .compass',
      'html .ghost',
      'html .palette li',
      'html .place-search li > *',
    ].join(', ')]: { minHeight: C.touch },
    'html .zoom-pad button, html .compass': { minWidth: C.touch },
    'html input, html select, html textarea': { fontSize: '16px' },
  },
  [MQ.noHover]: {
    'html button:hover': { filter: 'none' },
  },

  // ================================================ Grand écran / TV (> 1440px)
  [MQ.xl]: {
    ':root': { '--panel-w': 'clamp(380px, 24vw, 480px)' },
    'html .navigator': { fontSize: '1.05em' },
  },

  // ================================================ Tablette (≤ 1024px)
  [MQ.tablet]: {
    ':root': { '--logo-w': 'clamp(120px, 18vw, 180px)', '--panel-w': 'min(340px, 42vw)' },
    'html .hud-title p.title-focus': { display: 'none' },
    'html .navigator .nav-id': { display: 'none' },
    'html .readout .dim': { display: 'none' },
  },

  // ================================================ Mobile (≤ 720px) et téléphone en paysage
  [MQ.compact]: {
    ':root': { '--logo-w': 'clamp(84px, 26vw, 128px)', '--hud-font': '13px' },

    // En-tête en haut à gauche.
    'html .hud-title': {
      ...fixedReset,
      position: 'fixed',
      top: `calc(${C.safeT} + 6px)`,
      left: `calc(${C.safeL} + 6px)`,
      right: `calc(${C.safeR} + 64px)`, // place pour la boussole
      pointerEvents: 'none',
    },
    'html .hud-title h1': { fontSize: '15px' },
    'html .hud-title .title-glyphs': { display: 'none' },
    'html .hud-title p': { fontSize: '11px' },
    'html .hud-title p.title-focus': { display: 'none' },

    // Boussole en haut à droite.
    'html .compass-pad': {
      position: 'fixed',
      top: `calc(${C.safeT} + 8px)`,
      right: `calc(${C.safeR} + 8px)`,
      left: 'auto',
      bottom: 'auto',
    },
    'html .compass': { width: '48px', height: '48px' },

    // Zoom sur le bord droit, au milieu.
    'html .zoom-pad': {
      position: 'fixed',
      right: `calc(${C.safeR} + 8px)`,
      top: '50%',
      bottom: 'auto',
      left: 'auto',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },

    // Barre d'outils fixe en bas.
    'html .toolbar.toolbar-compact': {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      top: 'auto',
      transform: 'none',
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '4px',
      margin: 0,
      padding: `6px calc(${C.safeR} + 6px) calc(${C.safeB} + 6px) calc(${C.safeL} + 6px)`,
      minHeight: C.toolbarH,
      borderRadius: 0,
      flexWrap: 'nowrap',
      zIndex: 40,
    },
    'html .toolbar-compact .tool-btn': {
      flexDirection: 'column',
      gap: '2px',
      padding: '4px 2px',
      fontSize: '11px',
      minHeight: C.touch,
      width: '100%',
    },
    'html .toolbar-compact .tool-menu-item': { flexDirection: 'row', fontSize: '14px', gap: '10px', padding: '8px 12px' },
    'html .toolbar-compact .tool-icon': { fontSize: '18px' },

    // Indicateur de zoom au-dessus du rail.
    'html .readout': {
      position: 'fixed',
      left: `calc(${C.safeL} + 10px)`,
      bottom: `calc(${C.toolbarH} + ${C.stripH} + ${C.safeB} + 10px)`,
      top: 'auto',
      right: 'auto',
      fontSize: '11px',
      pointerEvents: 'none',
    },
    'html .readout .dim': { display: 'none' },

    // Astres : bande horizontale défilante au-dessus de la barre d'outils.
    'html .navigator.navigator-strip': {
      ...fixedReset,
      position: 'fixed',
      left: 0,
      right: 0,
      top: 'auto',
      bottom: `calc(${C.toolbarH} + ${C.safeB})`,
      width: 'auto',
      height: C.stripH,
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gridTemplateColumns: 'none',
      gap: '6px',
      padding: `6px calc(${C.safeR} + 8px) 6px calc(${C.safeL} + 8px)`,
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollSnapType: 'x proximity',
      scrollbarWidth: 'none',
      borderRadius: 0,
      zIndex: 35,
    },
    'html .navigator-strip::-webkit-scrollbar': { display: 'none' },
    'html .navigator-strip .nav-item': {
      flex: 'none',
      width: 'auto',
      minWidth: 0,
      gridColumn: 'auto',
      padding: '0 12px',
      minHeight: '40px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      borderRadius: '999px',
      scrollSnapAlign: 'center',
      whiteSpace: 'nowrap',
    },
    'html .navigator-strip .nav-orb': { width: '12px', height: '12px', flex: 'none' },

    // Panneau d'infos : tiroir bas.
    'html .live-panel.panel-sheet': {
      ...fixedReset,
      position: 'fixed',
      left: 0,
      right: 0,
      top: 'auto',
      bottom: `calc(${C.toolbarH} + ${C.safeB})`,
      width: 'auto',
      maxWidth: 'none',
      maxHeight: `min(62dvh, calc(100dvh - ${C.toolbarH} - ${C.safeB} - ${C.safeT} - 90px))`,
      margin: 0,
      borderRadius: '18px 18px 0 0',
      paddingLeft: `calc(${C.safeL} + 12px)`,
      paddingRight: `calc(${C.safeR} + 12px)`,
      zIndex: 45,
      boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.45)',
    },
    'html .live-panel.panel-sheet.is-collapsed': { maxHeight: C.stripH, overflow: 'hidden' },
    'html .live-panel.panel-sheet > header': {
      cursor: 'pointer',
      position: 'relative',
      paddingTop: '12px',
      minHeight: C.touch,
    },
    'html .live-panel.panel-sheet > header h2': { fontSize: '15px' },
    '.sheet-handle': {
      position: 'absolute',
      top: '5px',
      left: '50%',
      width: '38px',
      height: '4px',
      marginLeft: '-19px',
      borderRadius: '2px',
      background: 'rgba(255, 255, 255, 0.35)',
    },

    // Sources : coin bas gauche.
    'html .attribution.attribution-compact': {
      position: 'fixed',
      left: `calc(${C.safeL} + 10px)`,
      right: `calc(${C.safeR} + 64px)`,
      bottom: `calc(${C.toolbarH} + ${C.stripH} + ${C.safeB} + 30px)`,
      top: 'auto',
      maxWidth: 'none',
      fontSize: '11px',
      zIndex: 30,
    },

    // Toasts en haut, sous l'en-tête.
    'html .toasts': {
      position: 'fixed',
      top: `calc(${C.safeT} + 70px)`,
      left: `calc(${C.safeL} + 8px)`,
      right: `calc(${C.safeR} + 8px)`,
      bottom: 'auto',
      maxWidth: 'none',
      transform: 'none',
    },

    // Palette plein écran.
    'html .palette-overlay': { alignItems: 'stretch', justifyContent: 'stretch', padding: 0 },
    'html .palette.palette-sheet': {
      width: '100%',
      maxWidth: 'none',
      height: '100dvh',
      maxHeight: 'none',
      margin: 0,
      borderRadius: 0,
      padding: `calc(${C.safeT} + 10px) calc(${C.safeR} + 12px) calc(${C.safeB} + 10px) calc(${C.safeL} + 12px)`,
    },
    'html .palette.palette-sheet ul': { flex: 1, maxHeight: 'none' },
    'html .palette-close': { minHeight: C.touch, padding: '0 10px' },

    // Aide : quasiment plein écran.
    'html .panel.help': {
      width: `calc(100vw - 2 * ${C.gap})`,
      maxHeight: `calc(100dvh - 2 * ${C.gap} - ${C.safeT} - ${C.safeB})`,
      overflowY: 'auto',
    },
    'html .panel.help dl > div': { display: 'flex', flexWrap: 'wrap', gap: '4px 10px' },
  },

  // ================================================ Téléphone très étroit (≤ 380px)
  [MQ.tiny]: {
    ':root': { '--logo-w': '76px' },
    'html .hud-title h1 .live': { display: 'none' },
    'html .toolbar-compact .tool-btn': { fontSize: '10px' },
  },

  // ================================================ Téléphone en paysage : panneau sur le côté
  [MQ.landscapePhone]: {
    ':root': { '--toolbar-h': '48px', '--strip-h': '44px', '--logo-w': '80px' },
    'html .hud-title p': { display: 'none' },
    'html .live-panel.panel-sheet': {
      left: 'auto',
      top: `calc(${C.safeT} + 6px)`,
      right: `calc(${C.safeR} + 64px)`,
      width: 'min(380px, 48vw)',
      maxHeight: `calc(100dvh - ${C.toolbarH} - ${C.stripH} - ${C.safeT} - ${C.safeB} - 12px)`,
      bottom: `calc(${C.toolbarH} + ${C.stripH} + ${C.safeB} + 6px)`,
      borderRadius: '14px',
    },
    'html .live-panel.panel-sheet.is-collapsed': { bottom: 'auto' },
    'html .zoom-pad': { top: `calc(${C.safeT} + 64px)`, transform: 'none', flexDirection: 'row' },
    'html .toolbar.toolbar-compact': { gridTemplateColumns: 'repeat(4, minmax(0, 120px))', justifyContent: 'center' },
    'html .toolbar-compact .tool-btn': { flexDirection: 'row', fontSize: '12px' },
    'html .attribution.attribution-compact': { display: 'none' },
  },

  // ================================================ Téléportation entre astres
  // Couche plein écran, sans interaction : traînées d'hyperespace, anneau de choc, flash
  // à la couleur de l'astre d'arrivée, puis nom de la destination. Durée totale ≈ 1,1 s.
  '@keyframes tpVeil': {
    '0%': { opacity: 0 },
    '18%': { opacity: 1 },
    '62%': { opacity: 1 },
    '100%': { opacity: 0 },
  },
  '@keyframes tpWarp': {
    '0%': { opacity: 0, transform: 'scale(0.15) rotate(0deg)' },
    '20%': { opacity: 0.95 },
    '55%': { opacity: 0.9, transform: 'scale(1.6) rotate(8deg)' },
    '100%': { opacity: 0, transform: 'scale(3.2) rotate(14deg)' },
  },
  '@keyframes tpRing': {
    '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.05)' },
    '35%': { opacity: 0 },
    '45%': { opacity: 1 },
    '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(2.4)' },
  },
  '@keyframes tpFlash': {
    '0%, 35%': { opacity: 0 },
    '46%': { opacity: 0.95 },
    '100%': { opacity: 0 },
  },
  '@keyframes tpCore': {
    '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.2)' },
    '40%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
    '55%': { opacity: 1, transform: 'translate(-50%, -50%) scale(0.6)' },
    '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(4)' },
  },
  '@keyframes tpLabel': {
    '0%, 40%': { opacity: 0, transform: 'translate(-50%, -50%) scale(1.6)', filter: 'blur(14px)', letterSpacing: '0.9em' },
    '58%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', filter: 'blur(0)', letterSpacing: '0.32em' },
    '82%': { opacity: 1 },
    '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.96)', filter: 'blur(4px)', letterSpacing: '0.28em' },
  },

  '.teleport-fx': {
    '--tp': '#8fd3ff',
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    pointerEvents: 'none',
    overflow: 'hidden',
    contain: 'strict',
  },
  // Assombrit et floute légèrement la scène pendant le saut.
  '.teleport-fx .tp-veil': {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(2, 4, 12, 0.55) 55%, rgba(2, 4, 12, 0.92) 100%)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    animation: 'tpVeil 1100ms ease-in-out both',
  },
  // Traînées d'étoiles qui jaillissent du centre (effet hyperespace).
  '.teleport-fx .tp-warp': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '200vmax',
    height: '200vmax',
    margin: '-100vmax 0 0 -100vmax',
    background: [
      'repeating-conic-gradient(from 0deg, transparent 0deg 3.1deg, color-mix(in srgb, var(--tp) 70%, white) 3.1deg 3.35deg, transparent 3.35deg 7.3deg, rgba(255,255,255,0.85) 7.3deg 7.45deg)',
    ].join(','),
    WebkitMaskImage: 'radial-gradient(circle, transparent 0%, transparent 6%, black 22%, transparent 62%)',
    maskImage: 'radial-gradient(circle, transparent 0%, transparent 6%, black 22%, transparent 62%)',
    mixBlendMode: 'screen',
    animation: 'tpWarp 1100ms cubic-bezier(0.55, 0, 0.25, 1) both',
    willChange: 'transform, opacity',
  },
  // Noyau lumineux au centre, qui se contracte puis explose.
  '.teleport-fx .tp-core': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '26vmin',
    height: '26vmin',
    borderRadius: '50%',
    background: 'radial-gradient(circle, white 0%, var(--tp) 28%, transparent 70%)',
    filter: 'blur(2px)',
    mixBlendMode: 'screen',
    animation: 'tpCore 1100ms cubic-bezier(0.5, 0, 0.2, 1) both',
  },
  // Onde de choc à l'arrivée.
  '.teleport-fx .tp-ring': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '60vmin',
    height: '60vmin',
    borderRadius: '50%',
    border: '2px solid var(--tp)',
    boxShadow: '0 0 40px var(--tp), inset 0 0 40px var(--tp)',
    mixBlendMode: 'screen',
    animation: 'tpRing 1100ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
  },
  '.teleport-fx .tp-flash': {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 50%, white 0%, var(--tp) 30%, transparent 75%)',
    mixBlendMode: 'screen',
    animation: 'tpFlash 1100ms ease-out both',
  },
  // Nom de l'astre d'arrivée.
  '.teleport-fx .tp-label': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    margin: 0,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    fontWeight: 700,
    fontSize: 'clamp(22px, 4.2vw, 56px)',
    color: '#fff',
    textShadow: '0 0 18px var(--tp), 0 0 42px var(--tp)',
    animation: 'tpLabel 1100ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
  },
  '.teleport-fx .tp-label small': {
    display: 'block',
    marginTop: '6px',
    textAlign: 'center',
    fontSize: '0.28em',
    fontWeight: 500,
    letterSpacing: '0.4em',
    opacity: 0.75,
  },
  // ================================================ Accessibilité
  [MQ.reducedMotion]: {
    '*, *::before, *::after': {
      animationDuration: '0.01ms !important',
      transitionDuration: '0.01ms !important',
      scrollBehavior: 'auto !important',
    },
  },
};

/** Injecte tous les styles responsive (MUI / Emotion). Objet constant : sérialisé une seule fois. */
export function ResponsiveStyles() {
  return <GlobalStyles styles={responsiveStyles} />;
}

// ---------------------------------------------------------------- Effet sonore « bulle »
//
// Son synthétisé avec la Web Audio API (aucun fichier audio à charger) : une note sinusoïdale
// très courte dont la hauteur monte brusquement, comme une bulle qui éclate.
// Joué sur tout élément cliquable de l'interface, coupé via le bouton « Son » de la barre.

const SOUND_STORAGE_KEY = 'gobai:sound';
const CLICKABLE = [
  'button',
  'a[href]',
  'summary',
  'label',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="file"]',
  '[role="button"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[role="tab"]',
].join(', ');
const BUBBLE_MIN_GAP_MS = 45; // un clic sur un <label> déclenche aussi un clic sur son <input> : un seul son

let audioCtx = null;
let lastBubble = 0;

function playBubble() {
  const now = performance.now();
  if (now - lastBubble < BUBBLE_MIN_GAP_MS) return;
  lastBubble = now;
  const AudioCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtor) return;
  try {
    audioCtx ??= new AudioCtor();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    // Légère variation à chaque clic pour éviter un son mécanique.
    const base = 340 + Math.random() * 160;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 2.8, t + 0.06);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

    osc.connect(filter).connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  } catch {
    // Audio bloqué ou indisponible : l'interface continue sans son.
  }
}

const readSoundPref = () => {
  try { return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'; } catch { return true; }
};

/** Écoute tous les clics de la page et joue la bulle sur les éléments cliquables. Renvoie [actif, basculer]. */
function useBubbleSound() {
  const [enabled, setEnabled] = useState(readSoundPref);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const onClick = (event) => {
      if (!enabledRef.current) return;
      const target = event.target instanceof Element ? event.target.closest(CLICKABLE) : null;
      if (!target || target.closest('[data-no-sound]')) return;
      if (target.matches(':disabled, [aria-disabled="true"]')) return;
      playBubble();
    };
    // Phase de capture : le son part même si un composant arrête la propagation du clic.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try { localStorage.setItem(SOUND_STORAGE_KEY, next ? 'on' : 'off'); } catch { /* stockage indisponible */ }
    if (next) playBubble(); // confirme que le son est réactivé
  }, []);

  return [enabled, toggle];
}

/** Glisser-déposer des panneaux, désactivé en mode compact (les panneaux y ont une place fixe). */
function useHudDraggable(id, enabled) {
  const drag = useDraggable(id);
  return enabled ? drag : { ref: drag.ref, style: undefined, handleProps: {} };
}

/** Ferme un menu flottant quand on touche ou clique ailleurs. */
function useOutsideClose(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onClose]);
}

// ---------------------------------------------------------------- Recherche de lieux

/**
 * Recherche dans les lieux d’un corps (villes, lieux lunaires, repères planétaires).
 * `onPick` absent : la liste reste informative (corps sans surface navigable).
 */
export function PlaceSearch({ places, onPick, placeholder = 'Rechercher un lieu…', max = 8 }) {
  const [query, setQuery] = useState('');
  const q = fold(query.trim());

  const results = useMemo(() => {
    if (!q) return [];
    return places
      .filter((f) => fold(f.name).includes(q)
        || (f.native && fold(f.native).includes(q))
        || (f.kind && fold(f.kind).includes(q))
        || (f.info && fold(f.info).includes(q)))
      .slice(0, max);
  }, [q, places, max]);

  const detail = (f) => [f.kind, f.native ? f.name : null, f.info, coords(f.lat, f.lon)]
    .filter(Boolean).join(' · ');

  const pick = (f) => {
    onPick(f);
    setQuery('');
  };

  return (
    <div className="moon-search place-search">
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onPick && results[0]) pick(results[0]);
          else if (e.key === 'Escape') setQuery('');
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
      />
      {q && (
        <ul>
          {results.map((f) => (
            // Deux lieux peuvent porter le même nom : la clé inclut les coordonnées.
            <li key={`${f.name}-${f.lat}-${f.lon}`}>
              {onPick ? (
                <button type="button" onClick={() => pick(f)} title={f.info || coords(f.lat, f.lon)}>
                  <span>{f.native || f.name}</span>
                  <small>{detail(f)}</small>
                </button>
              ) : (
                <div className="place-row" title={f.info || coords(f.lat, f.lon)}>
                  <span>{f.native || f.name}</span>
                  <small>{detail(f)}</small>
                </div>
              )}
            </li>
          ))}
          {!results.length && <li className="empty">Aucun lieu pour « {query} ».</li>}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Attribution

const ATTRIBUTION_DEBOUNCE_MS = 700;

/** Mention de source de la carte affichée, redemandée quand la vue se stabilise. */
export function Attribution({ hud, moonReal = false, extra = '' }) {
  const { compact } = useViewport();
  const tiles = useHud(hud, (s) => s.tiles);
  const layerId = tiles?.layerId ?? null;
  const b = tiles?.bounds ?? null;
  const [copyright, setCopyright] = useState('');

  const key = b ? `${layerId}|${b.zoom}|${b.north}|${b.south}|${b.east}|${b.west}` : null;
  useEffect(() => {
    if (!layerId || !b) { setCopyright(''); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      tilesApi.attribution(layerId, b, ctrl.signal).then((r) => setCopyright(r.copyright || '')).catch(() => {});
    }, ATTRIBUTION_DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const moon = useHud(hud, (s) => s.moonTiles);
  const mars = useHud(hud, (s) => s.marsTiles);
  const mercury = useHud(hud, (s) => s.mercuryTiles);
  const venus = useHud(hud, (s) => s.venusTiles);
  const tileText = tiles?.layerId ? tiles.attributionText : '';
  // Lune « réelle » : détail Kaguya (fond) coloré par les couleurs naturelles NASA SVS.
  const moonText = moon?.layerId ? (moonReal ? `${moon.attributionText} · couleurs NASA SVS` : moon.attributionText) : '';

  // Construction en liste : plus de cascade de conditions pour les séparateurs.
  const parts = [
    copyright && { key: 'c', node: <span>{copyright}</span> },
    moonText && { key: 'moon', node: <span>Lune : {moonText}</span> },
    mars?.layerId && { key: 'mars', node: <span>Mars : {mars.attributionText}</span> },
    mercury?.layerId && { key: 'mercury', node: <span>Mercure : {mercury.attributionText}</span> },
    venus?.layerId && { key: 'venus', node: <span>Vénus : {venus.attributionText}</span> },
    extra && { key: 'extra', node: <span>{extra}</span> },
  ].filter(Boolean);

  if (!tileText && !parts.length) return null;

  const content = (
    <>
      {tileText && <strong>{tileText}</strong>}
      {parts.map((p, i) => (
        <span key={p.key}>{(tileText || i > 0) ? (p.key === 'c' ? ' ' : ' · ') : ''}{p.node}</span>
      ))}
    </>
  );

  // Petit écran : les sources sont repliées derrière un bouton pour libérer la carte.
  if (compact) {
    return (
      <details className="attribution attribution-compact">
        <summary aria-label="Afficher les sources">ⓘ Sources</summary>
        <p>{content}</p>
      </details>
    );
  }
  return <p className="attribution">{content}</p>;
}

// ---------------------------------------------------------------- Palette de recherche

const MAX_RESULTS = 40;
const WORLD_DEBOUNCE_MS = 300;

/**
 * Recherche rapide (Ctrl K ou /) : astres, villes de l’API, puis lieux mondiaux si Uber Maps est configuré.
 * ↑ ↓ pour choisir, Entrée pour aller, Échap pour fermer. Plein écran sur téléphone.
 */
export function CommandPalette({ open, onClose, cities, bodyNames, onPickCity, onPickBody, onPickPlace, worldSearch = false }) {
  const { compact } = useViewport();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [world, setWorld] = useState({ q: '', items: [], status: 'idle' });
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const index = useMemo(() => [
    ...bodyNames.map((name, i) => ({ type: 'body', name, key: fold(name), i, sub: 'Astre' })),
    ...cities.map((c, i) => ({ type: 'city', name: c.name, key: fold(c.name), i, sub: coords(c.lat, c.lon) })),
  ], [cities, bodyNames]);

  useEffect(() => {
    const q = query.trim();
    if (!open || !worldSearch || q.length < 2) { setWorld({ q: '', items: [], status: 'idle' }); return undefined; }
    const ctrl = new AbortController();
    setWorld((w) => ({ ...w, status: 'loading' }));
    const t = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => setWorld({ q, items: r.items, status: 'ready' }))
        .catch((e) => { if (e.name !== 'AbortError') setWorld({ q, items: [], status: 'error' }); });
    }, WORLD_DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [open, worldSearch, query]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const hits = q ? index.filter((r) => r.key.includes(q)) : index.filter((r) => r.type === 'body');
    if (q) hits.sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)));
    const local = hits.slice(0, MAX_RESULTS);
    const seen = new Set(local.filter((r) => r.type === 'city').map((r) => r.key));
    const places = world.items
      .filter((p) => !seen.has(fold(p.name)))
      .map((p, i) => ({ type: 'place', name: p.name, i, place: p, sub: p.context || coords(p.lat, p.lon) }));
    return [...local, ...places];
  }, [index, query, world.items]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    // Bloque le défilement de la page derrière la palette (iOS).
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active]);

  if (!open) return null;

  const choose = (r) => {
    if (!r) return;
    if (r.type === 'city') onPickCity(r.i);
    else if (r.type === 'place') onPickPlace?.(r.place);
    else onPickBody(r.i);
    inputRef.current?.blur(); // referme le clavier virtuel
    onClose();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="overlay palette-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={compact ? 'palette palette-sheet' : 'palette'} role="dialog" aria-modal="true" aria-label="Rechercher">
        <div className="palette-bar">
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="go"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={worldSearch ? (compact ? 'Ville, planète…' : 'N’importe quelle ville du monde, une planète…') : 'Une ville, une planète…'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `pal-${active}` : undefined}
          />
          {/* Pas de touche Échap sur mobile : bouton de fermeture visible. */}
          <button type="button" className="ghost palette-close" onClick={onClose} aria-label="Fermer la recherche">
            {compact ? 'Annuler' : '×'}
          </button>
        </div>
        <ul id="palette-list" role="listbox" ref={listRef}>
          {results.map((r, n) => (
            <li
              key={`${r.type}-${r.i}`}
              id={`pal-${n}`}
              role="option"
              aria-selected={n === active}
              onPointerMove={(e) => { if (e.pointerType === 'mouse') setActive(n); }}
              onClick={() => choose(r)}
            >
              <span>{r.name}</span>
              <small>{r.sub}</small>
            </li>
          ))}
          {!results.length && world.status !== 'loading' && <li className="empty" aria-disabled="true">Aucun résultat pour « {query} ». Essayez un autre nom.</li>}
          {worldSearch && world.status === 'loading' && <li className="empty" aria-disabled="true">Recherche dans le monde entier…</li>}
          {worldSearch && world.status === 'error' && <li className="empty" aria-disabled="true">Recherche mondiale indisponible.</li>}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Boussole

export function Compass({ hud, onRecalibrate }) {
  const compass = useHud(hud, (s) => s.compass);
  if (!compass) return null;

  const deg = (compass.angle * 180) / Math.PI;
  const shown = Math.round(((deg % 360) + 540) % 360 - 180);
  const side = shown === 0 ? 'en haut' : shown === 180 || shown === -180 ? 'en bas' : `${Math.abs(shown)}° ${shown > 0 ? 'à droite' : 'à gauche'}`;
  const hint = `Nord ${side} · toucher pour recaler la caméra sur le nord`;

  return (
    <div className="compass-pad">
      <button type="button" className="compass" title={hint} aria-label={`Boussole, ${hint}`} onClick={onRecalibrate}>
        <img
          className="compass-needle"
          src="/compass-needle.webp"
          alt=""
          draggable="false"
          style={{ transform: `rotate(${deg}deg)` }}
        />
        <span className="compass-mark" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- En-tête du HUD

export function HudTop({ hud }) {
  const { compact } = useViewport();
  const date = useHud(hud, (s) => s.date);
  const focusText = useHud(hud, (s) => s.focusText);
  const drag = useHudDraggable('titre', !compact);
  // Les tailles et marges du logo sont dans les styles MUI (`responsiveStyles`), plus de valeurs figées en ligne.
  return (
    <header className="title hud-title" ref={drag.ref} style={drag.style} {...drag.handleProps}>
      <img
        className="brand-logo"
        src="/logo.png?v=2"
        alt="Logo Gobai"
        width="252"
        height="138"
        draggable={false}
        decoding="async"
      />
      <div className="title-text">
        <h1>
          Gobai Space <span className="title-glyphs" aria-hidden="true">١д१壹אη하</span> <span className="live">en direct</span>
        </h1>
        <p className="title-date">{date}</p>
        {focusText && <p className="title-focus">{focusText}</p>}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- Rail des astres

// Grand écran : rail bento déplaçable. Petit écran : bande horizontale défilante en bas.
export const Navigator = memo(function Navigator({ bodies, focus, onSelect }) {
  const { compact } = useViewport();
  const drag = useHudDraggable('navigation', !compact);
  const activeRef = useRef(null);

  // En bande horizontale, l'astre actif reste visible.
  useEffect(() => {
    if (compact) activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [compact, focus]);

  return (
    <nav
      className={compact ? 'navigator navigator-strip' : 'navigator'}
      aria-label="Astres"
      ref={drag.ref}
      style={drag.style}
      {...drag.handleProps}
    >
      {!compact && <span className="nav-title" aria-hidden="true"><span className="drag-grip" />Navigation</span>}
      {bodies.map((body, i) => {
        const wide = !compact && (i === 0 || i === bodies.length - 1);
        const current = focus === i;
        return (
          <button
            type="button"
            key={body.name}
            ref={current ? activeRef : undefined}
            className={wide ? 'nav-item nav-wide' : 'nav-item'}
            style={{ '--body': body.color }}
            aria-current={current ? 'true' : undefined}
            onClick={() => onSelect(i)}
          >
            <span className="nav-orb" aria-hidden="true" />
            <span className="nav-name">{body.name}</span>
            {!compact && <span className="nav-id" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>}
          </button>
        );
      })}
    </nav>
  );
});

// ---------------------------------------------------------------- Étiquettes de scène

export const SceneLabels = memo(function SceneLabels({ data, registry, onSelectBody }) {
  const { sun, planets } = data.bodies;
  return (
    <>
      <div className="l" ref={(el) => { registry.sun = el; }} style={{ '--c': sun.color }}>
        {sun.name}
      </div>

      {planets.map((p, i) => (
        <div
          key={p.name}
          className="l l-planet"
          ref={(el) => { registry.planets[i] = el; }}
          style={{ '--c': p.color }}
          title={`Toucher pour centrer ${p.name}`}
          role="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onSelectBody(i + 1); }}
        >
          {p.name}
        </div>
      ))}

      {data.cities.map((c, i) => (
        <div
          key={`${c.name}-${i}`}
          className="l l-city"
          ref={(el) => { registry.cities[i] = el; }}
          style={{ '--c': '#fff', display: 'none' }}
        >
          {c.name}
        </div>
      ))}
    </>
  );
});

// ---------------------------------------------------------------- Aide

const KEYS = [
  ['Ctrl K  ou  /', 'Rechercher une ville ou un astre'],
  ['+  /  −', 'Zoomer, dézoomer'],
  ['← → ↑ ↓', 'Faire tourner la caméra autour de l’astre'],
  ['0 (pavé numérique)', 'Vue d’ensemble'],
  ['L', 'Ouvrir ou fermer les informations'],
  ['?', 'Afficher cette aide'],
  ['Échap', 'Fermer le panneau ouvert'],
];

const GESTURES = [
  ['Un doigt', 'Glisser pour tourner autour de l’astre'],
  ['Deux doigts', 'Pincer pour zoomer'],
  ['Toucher un astre', 'Le centrer'],
  ['Boutons + / −', 'Maintenir pour zoomer en continu'],
  ['Boussole', 'Recaler la caméra sur le nord'],
];

export function ShortcutsHelp({ open, onClose }) {
  const { coarse } = useViewport();
  if (!open) return null;
  const rows = coarse ? GESTURES : KEYS;
  return (
    <div className="overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel help" role="dialog" aria-modal="true" aria-label={coarse ? 'Gestes tactiles' : 'Raccourcis clavier'}>
        <header>
          <h2>{coarse ? 'Gestes tactiles' : 'Raccourcis clavier'}</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <dl>
          {rows.map(([k, d]) => (
            <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>
          ))}
        </dl>
        {!coarse && <p className="hint">Souris : glisser pour tourner, molette ou pincement pour zoomer, clic sur un astre pour le centrer.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Notifications

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.text}</span>
          <button type="button" className="ghost" onClick={() => onDismiss(t.id)} aria-label="Fermer le message">×</button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Barre d’outils

function Readout({ hud }) {
  const zoomText = useHud(hud, (s) => s.zoomText);
  const tileZoom = useHud(hud, (s) => (s.tiles && s.tiles.layerId ? s.tiles.zoom : null));
  return (
    <div className="readout" aria-live="off">
      <span>{zoomText}</span>
      {tileZoom !== null && <span className="dim">carte niveau {tileZoom}</span>}
    </div>
  );
}

export function Toolbar({
  hud, auto, tilt, layersOpen, bodySelected = true,
  citySelected, pointCloudOpen, onPointClouds,
  contributionOpen, onContributions,
  onSearch, onToggleLayers, onToggleAuto, onToggleTilt, onReset, onHelp,
  sound = true, onToggleSound,
}) {
  const { compact } = useViewport();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  useOutsideClose(moreRef, moreOpen, closeMore);
  useEffect(() => { if (!compact) setMoreOpen(false); }, [compact]);

  // `primary` = toujours visible ; les autres passent dans « Plus » sur petit écran.
  // `group` = bloc de la barre ordinateur, séparés par un trait vertical.
  const actions = [
    { id: 'search', group: 'explore', icon: '⌕', label: 'Rechercher', primary: true, onClick: onSearch, title: 'Rechercher une ville ou un astre (Ctrl K)', kbd: 'Ctrl K' },
    { id: 'info', group: 'explore', icon: 'ⓘ', label: 'Informations', short: 'Infos', primary: true, pressed: layersOpen, disabled: !bodySelected, onClick: onToggleLayers, title: bodySelected ? 'Informations sur l’astre (L)' : 'Choisissez une planète pour afficher ses informations' },
    { id: 'reset', group: 'explore', icon: '◎', label: 'Vue globale', short: 'Global', primary: true, onClick: onReset, title: 'Retour à la vue d’ensemble (0 du pavé numérique)' },
    { id: 'cloud', group: 'data', icon: '▦', label: 'Tuile 3D', pressed: pointCloudOpen, disabled: !citySelected, onClick: onPointClouds, title: citySelected ? 'Ouvrir le nuage 3D de cette ville' : 'Choisissez une ville pour ouvrir ses nuages' },
    { id: 'contrib', group: 'data', icon: '⇪', label: 'Contribuer', pressed: contributionOpen, onClick: onContributions, title: 'Importer et évaluer des nuages de points' },
    { id: 'auto', group: 'camera', icon: '↻', label: 'Rotation', pressed: auto, onClick: onToggleAuto, title: 'Rotation automatique' },
    { id: 'tilt', group: 'camera', icon: '◢', label: 'Vue 3/4', pressed: tilt, onClick: onToggleTilt, title: 'Vue 3/4 automatique en approchant du sol' },
    onToggleSound && { id: 'sound', group: 'help', icon: '♪', label: sound ? 'Son activé' : 'Son coupé', short: 'Son', iconOnly: true, pressed: sound, noSound: true, onClick: onToggleSound, title: sound ? 'Couper le son des clics' : 'Activer le son des clics' },
    onHelp && { id: 'help', group: 'help', icon: '?', label: 'Aide', iconOnly: true, onClick: onHelp, title: 'Raccourcis clavier (?)' },
  ].filter(Boolean);

  const renderButton = (a, { inMenu = false } = {}) => (
    <button
      type="button"
      key={a.id}
      className={[
        'tool-btn',
        inMenu && 'tool-menu-item',
        !compact && a.iconOnly && 'tool-btn-icon',
      ].filter(Boolean).join(' ')}
      aria-pressed={a.pressed === undefined ? undefined : Boolean(a.pressed)}
      data-no-sound={a.noSound ? '' : undefined}
      disabled={a.disabled}
      title={a.title}
      aria-label={a.label}
      onClick={() => { a.onClick?.(); if (inMenu) setMoreOpen(false); }}
    >
      <span className="tool-icon" aria-hidden="true">{a.icon}</span>
      {!(a.iconOnly && !compact) && (
        <span className="tool-label">
          {/* Ordinateur : libellé complet ; laptop étroit : libellé court (via CSS) ; mobile : libellé court. */}
          {compact && !inMenu ? (a.short || a.label) : (
            <>
              <span className={a.short ? 'tool-label-full has-short' : 'tool-label-full'}>{a.label}</span>
              {a.short && <span className="tool-label-short" aria-hidden="true">{a.short}</span>}
            </>
          )}
        </span>
      )}
    </button>
  );

  // Indicateur sur « Plus » quand une option cachée est active.
  const hiddenActive = actions.some((a) => !a.primary && a.pressed);

  // Ordinateur / laptop : une seule ligne alignée, groupes séparés, indicateur de zoom intégré à gauche.
  if (!compact) {
    const groups = ['explore', 'data', 'camera', 'help']
      .map((g) => actions.filter((a) => a.group === g))
      .filter((list) => list.length);
    return (
      <div className="toolbar toolbar-desktop" role="toolbar" aria-label="Actions">
        <Readout hud={hud} />
        {groups.map((list, gi) => (
          <div key={list[0].group} className="tool-group" role="group" aria-label={list[0].group}>
            {gi > 0 && <span className="tool-sep" aria-hidden="true" />}
            {list.map((a) => renderButton(a))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <Readout hud={hud} />
      <div className="toolbar toolbar-compact" role="toolbar" aria-label="Actions">
        {(
          <>
            {actions.filter((a) => a.primary).map((a) => renderButton(a))}
            <div className="toolbar-more" ref={moreRef}>
              <button
                type="button"
                className={hiddenActive ? 'tool-btn has-active' : 'tool-btn'}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <span className="tool-icon" aria-hidden="true">⋯</span>
                <span className="tool-label">Plus</span>
              </button>
              {moreOpen && (
                <div className="toolbar-menu" role="menu">
                  {actions.filter((a) => !a.primary).map((a) => renderButton(a, { inMenu: true }))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Zoom

const HOLD_INTERVAL_MS = 65;

export function ZoomPad({ onZoom }) {
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = (factor) => (e) => {
    // Clic droit ignoré ; le doigt reste capturé même s'il glisse hors du bouton.
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stop();
    onZoom(factor);
    timer.current = setInterval(() => onZoom(factor), HOLD_INTERVAL_MS);
  };

  const onKeyDown = (factor) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onZoom(factor);
    }
  };

  useEffect(() => {
    const events = ['pointerup', 'pointercancel'];
    events.forEach((t) => window.addEventListener(t, stop));
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      stop();
      events.forEach((t) => window.removeEventListener(t, stop));
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [stop]);

  const common = {
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    // Empêche le menu contextuel / la loupe sur appui long (iOS, Android).
    onContextMenu: (e) => e.preventDefault(),
  };

  return (
    <div className="zoom-pad" role="group" aria-label="Contrôles de zoom">
      <button type="button" title="Maintenir pour zoomer" aria-label="Maintenir pour zoomer" onPointerDown={start(0.94)} onKeyDown={onKeyDown(0.94)} {...common}>
        +
      </button>
      <button type="button" title="Maintenir pour dézoomer" aria-label="Maintenir pour dézoomer" onPointerDown={start(1.064)} onKeyDown={onKeyDown(1.064)} {...common}>
        −
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Panneau unique (droite / tiroir bas)

function BodyPanelShell({ view, hud, layersOpen, onCloseLayers, menu, children }) {
  const { compact } = useViewport();
  // Replié par défaut sur petit écran, pour laisser la carte visible.
  const [open, setOpen] = useState(() => !compact);
  const drag = useHudDraggable('panneau', !compact);
  const layersRef = useRef(null);

  useEffect(() => {
    if (!layersOpen) return;
    setOpen(true);
    layersRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [layersOpen]);

  // Passage en compact : on replie pour ne pas recouvrir l'écran.
  const wasCompact = useRef(compact);
  useEffect(() => {
    if (compact && !wasCompact.current && !layersOpen) setOpen(false);
    wasCompact.current = compact;
  }, [compact, layersOpen]);

  const className = [
    'panel moon-live live-panel',
    compact && 'panel-sheet',
    compact && (open ? 'is-open' : 'is-collapsed'),
  ].filter(Boolean).join(' ');

  return (
    <section
      className={className}
      data-body={view?.id}
      aria-label={view ? `${view.name} en direct` : 'Informations'}
      ref={drag.ref}
      style={drag.style}
    >
      <header {...drag.handleProps} onClick={compact ? () => setOpen((v) => !v) : undefined}>
        {compact ? <span className="sheet-handle" aria-hidden="true" /> : <span className="drag-grip" aria-hidden="true" />}
        <h2>{view ? <>{view.name} <span className="live">en direct</span></> : 'Informations'}</h2>
        <button
          type="button"
          className="ghost"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          aria-expanded={open}
          aria-label={open ? 'Réduire' : 'Déplier'}
        >
          {open ? '–' : '+'}
        </button>
      </header>
      {open && (
        <div className="panel-body">
          {children}
          {layersOpen && (
            <section className="layers-section" aria-label="Informations" ref={layersRef}>
              <header>
                {view && <h3>Informations{menu.bodyName ? ` · ${menu.bodyName}` : ''}</h3>}
                <button type="button" className="ghost" onClick={onCloseLayers} aria-label="Fermer les informations">×</button>
              </header>
              <BodyLayersMenu hud={hud} {...menu} />
            </section>
          )}
        </div>
      )}
    </section>
  );
}

export function BodyPanel({ hud, data, phases, handlers, layersOpen, onCloseLayers, ...menu }) {
  const view = useBodyView({ hud, data, phases, handlers });
  if (!view && !layersOpen) return null;

  return (
    <BodyPanelShell view={view} hud={hud} layersOpen={layersOpen} onCloseLayers={onCloseLayers} menu={menu}>
      {view && <BodyPlacesInfo view={view} handlers={handlers} Search={PlaceSearch} />}
    </BodyPanelShell>
  );
}

// ---------------------------------------------------------------- Scène complète

const isMoonLayer = (l) => l.body === 'moon';
const isMarsLayer = (l) => l.body === 'mars';
const isMercuryLayer = (l) => l.body === 'mercury';
const isVenusLayer = (l) => l.body === 'venus';
const isEarthLayer = (l) => !l.body || l.body === 'earth';

export function SolarScene({ data }) {
  const viewport = useViewport();
  const { compact } = viewport;
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const labels = useMemo(() => ({ sun: null, planets: [], cities: [] }), []);
  const hud = useMemo(
    () => createHudStore({ date: '', focusText: '', zoomText: 'Zoom · molette ou pincement', cityFocus: null, tiles: null, moonTiles: null, marsTiles: null, mercuryTiles: null, venusTiles: null, moonLive: null, bodyLive: null, compass: null }),
    []
  );
  const bodyNames = useMemo(
    () => [data.bodies.sun.name, ...data.bodies.planets.map((p) => p.name), data.bodies.moon.name],
    [data]
  );
  const navBodies = useMemo(
    () => [
      { name: data.bodies.sun.name, color: data.bodies.sun.color || '#ffb300' },
      ...data.bodies.planets.map((p) => ({ name: p.name, color: p.color || '#8b97b3' })),
      { name: data.bodies.moon.name, color: '#d8d2c4' },
    ],
    [data]
  );

  // Catégorie d'écran exposée au CSS (html[data-vp="sm"], html[data-pointer="coarse"]).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.vp = viewport.size;
    root.dataset.pointer = viewport.coarse ? 'coarse' : 'fine';
    root.dataset.compact = viewport.compact ? 'true' : 'false';
    root.dataset.orientation = viewport.landscape ? 'landscape' : 'portrait';
  }, [viewport]);

  const { toasts, push, dismiss } = useToasts();
  const [sound, toggleSound] = useBubbleSound();
  const { engine, focus, error } = useSolarEngine({ containerRef, data, labels, hud, engineRef });
  const tileLayers = useTileLayers();

  // Le canvas WebGL suit la taille réelle du conteneur (rotation d'écran, barre d'adresse mobile, fenêtre redimensionnée).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (typeof engineRef.current?.resize === 'function') engineRef.current.resize();
        else window.dispatchEvent(new Event('resize'));
      });
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const moonIndex = bodyNames.length - 1;
  const currentBodyId = focus === 0 ? null : focus === moonIndex ? 'moon' : bodyId(data.bodies.planets[focus - 1]);
  const currentBodyName = focus === 0 ? null : bodyNames[focus];

  const [auto, setAuto] = useState(true);
  const [tilt, setTilt] = useState(true);
  const [roads, setRoads] = useState(true);
  const [shade, setShade] = useState(true);
  const [borders, setBorders] = useState(true);
  const [coasts, setCoasts] = useState(true);
  const [countryNames, setCountryNames] = useState(false);
  const [cityNames, setCityNames] = useState(false);
  const [cityInfo, setCityInfo] = useState(null);
  const [bordersInfo, setBordersInfo] = useState(null);
  const [baseId, setBaseId] = useState(null);
  const [moonBaseId, setMoonBaseId] = useState(null);
  const [marsBaseId, setMarsBaseId] = useState(null);
  const [mercuryBaseId, setMercuryBaseId] = useState(null);
  const [venusBaseId, setVenusBaseId] = useState(null);
  const [moonColorOk, setMoonColorOk] = useState(null);
  const [moonFeatures, setMoonFeatures] = useState(false);
  const [moonOrbiters, setMoonOrbiters] = useState(false);
  const [moonModel, setMoonModel] = useState(false);
  const [moonPhases, setMoonPhases] = useState(null);
  const [shadowcam, setShadowcam] = useState(false);
  const [shadowcamInfo, setShadowcamInfo] = useState(null);
  const [moonModelInfo, setMoonModelInfo] = useState(null);
  const [panel, setPanel] = useState(null);     // 'layers' | 'search' | 'help' | null
  const [pointCloudOpen, setPointCloudOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const cityFocus = useHud(hud, (s) => s.cityFocus);
  const autoChosen = useRef(false);
  const baseRequest = useRef(0);
  const moonRequest = useRef(0);
  const marsRequest = useRef(0);
  const mercuryRequest = useRef(0);
  const venusRequest = useRef(0);

  const earthLayers = useMemo(() => tileLayers.layers.filter(isEarthLayer), [tileLayers.layers]);
  const moonLayers = useMemo(() => tileLayers.layers.filter(isMoonLayer), [tileLayers.layers]);
  const marsLayers = useMemo(() => tileLayers.layers.filter(isMarsLayer), [tileLayers.layers]);
  const mercuryLayers = useMemo(() => tileLayers.layers.filter(isMercuryLayer), [tileLayers.layers]);
  const venusLayers = useMemo(() => tileLayers.layers.filter(isVenusLayer), [tileLayers.layers]);
  const moonDetailLayer = moonLayers.find((l) => l.id.includes('kaguya')) || null;
  const moonShadeLayer = moonLayers.find((l) => l.id.includes('lola-shade')) || null;
  const moonRealAvailable = Boolean(moonShadeLayer || moonDetailLayer);
  const baseLayer = earthLayers.find((l) => l.id === baseId) || null;
  const overlayLayer = earthLayers.find((l) => l.kind === 'overlay') || null;
  const roadsIncluded = Boolean(baseLayer && baseLayer.kind !== 'imagery');
  const roadsUnavailable = baseLayer?.kind === 'imagery' && !overlayLayer;
  const roadsHint = roadsIncluded ? 'Déjà inclus dans ce fond' : roadsUnavailable ? 'Non proposé par ce fournisseur' : undefined;
  const namesIncluded = Boolean(baseLayer && baseLayer.kind !== 'imagery');
  const showCityNames = cityNames && !namesIncluded;

  useEffect(() => { engine?.setAutoRotate(auto); }, [engine, auto]);
  useEffect(() => { engine?.setTilt(tilt); }, [engine, tilt]);
  useEffect(() => { engine?.setTileShade(shade); }, [engine, shade]);
  useEffect(() => { engine?.setBordersVisible(borders); }, [engine, borders]);
  useEffect(() => { engine?.setCoastsVisible(coasts); }, [engine, coasts]);
  useEffect(() => { engine?.setCountryLabelsVisible(countryNames); }, [engine, countryNames]);
  useEffect(() => { engine?.setCityLabelsVisible(showCityNames); }, [engine, showCityNames]);
  useEffect(() => { engine?.setMoonFeatureTypes(moonFeatures ? ['landing', 'mare', 'crater', 'region'] : []); }, [engine, moonFeatures]);
  useEffect(() => { engine?.setMoonOrbitersVisible(moonOrbiters); }, [engine, moonOrbiters]);
  useEffect(() => { engine?.setMoonModelVisible(moonModel); }, [engine, moonModel]);
  useEffect(() => { engine?.setShadowCamVisible(shadowcam); }, [engine, shadowcam]);

  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchShadowCam(ctrl.signal)
      .then((r) => {
        engine.setShadowCam(r.items, {
          meta: (id, res) => fetchShadowCamMeta(id, res),
          imageUrl: (id, res) => resolveApiUrl(`/api/v1/danuri/shadowcam/${encodeURIComponent(id)}/${res}/image.png`),
        });
        setShadowcamInfo({ count: r.items.length, source: r.source });
      })
      .catch((e) => { if (e.name !== 'AbortError') setShadowcamInfo({ error: e.message }); });
    return () => ctrl.abort();
  }, [engine]);

  useEffect(() => {
    if (!engine) return undefined;
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonOrbiters(ctrl.signal)
        .then((r) => engine.setMoonOrbiters(r))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('Sondes lunaires indisponibles :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 2 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [engine]);

  useEffect(() => {
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonPhases(ctrl.signal)
        .then((r) => setMoonPhases(r))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('USNO indisponible :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, []);

  useEffect(() => {
    if (!engine || focus !== moonIndex || !moonModel || moonModelInfo) return;
    setMoonModelInfo('loading');
    engine.loadMoonModel(resolveApiUrl('/api/v1/tiles/moon-model.glb'))
      .then((info) => setMoonModelInfo(info || {}))
      .catch((err) => {
        setMoonModelInfo({ error: err.message || String(err) });
        push(`Modèle 3D de la Lune indisponible : ${err.message || err}`, 'warn', 9000);
      });
  }, [engine, focus, moonIndex, moonModel, moonModelInfo, push]);

  useEffect(() => {
    if (!engine) return undefined;
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonEphemeris(ctrl.signal)
        .then((r) => engine.setMoonEphemeris(r.points))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('JPL Horizons indisponible :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [engine]);

  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchCityLabels(ctrl.signal)
      .then((r) => { engine.setCityLabels(r.items); setCityInfo({ attribution: r.attribution, count: r.count }); })
      .catch((e) => { if (e.name !== 'AbortError') push(`Noms des villes indisponibles : ${e.message}`, 'warn', 9000); });
    return () => ctrl.abort();
  }, [engine, push]);

  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchBorders(ctrl.signal)
      .then((r) => { engine.setBorders(r); setBordersInfo({ attribution: r.attribution }); })
      .catch((e) => { if (e.name !== 'AbortError') push(`Frontières indisponibles : ${e.message}`, 'warn', 9000); });
    return () => ctrl.abort();
  }, [engine, push]);

  const chooseBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++baseRequest.current;
    setBaseId(id);
    try {
      await e.setTileBase(id);
    } catch (err) {
      if (request !== baseRequest.current) return;
      setBaseId(null);
      push(`Fond de la Terre indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [push]);

  const chooseMoonBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++moonRequest.current;
    setMoonBaseId(id);
    const real = id === 'real';
    try {
      const pan = real && Boolean(moonDetailLayer);
      e.setMoonComposite(real, { pan });
      await Promise.all([
        e.setMoonTileBase(real ? (moonDetailLayer || moonShadeLayer).id : id),
        e.setMoonTileOverlay(null),
      ]);
    } catch (err) {
      if (request !== moonRequest.current) return;
      setMoonBaseId(null);
      push(`Carte de la Lune indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [push, moonShadeLayer, moonDetailLayer]);

  const chooseMarsBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++marsRequest.current;
    setMarsBaseId(id);
    try {
      await e.setMarsTileBase(id);
    } catch (err) {
      if (request !== marsRequest.current) return;
      setMarsBaseId(null);
      push(`Carte de Mars indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [push]);

  const chooseVenusBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++venusRequest.current;
    setVenusBaseId(id);
    try {
      await e.setVenusTileBase(id);
    } catch (err) {
      if (request !== venusRequest.current) return;
      setVenusBaseId(null);
      push(`Carte de Vénus indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [push]);

  const chooseMercuryBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++mercuryRequest.current;
    setMercuryBaseId(id);
    try {
      await e.setMercuryTileBase(id);
    } catch (err) {
      if (request !== mercuryRequest.current) return;
      setMercuryBaseId(null);
      push(`Carte de Mercure indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [push]);

  useEffect(() => {
    if (!engine || tileLayers.status !== 'ready' || autoChosen.current) return;
    autoChosen.current = true;
    const first = earthLayers.find((l) => l.kind === 'hybrid') || earthLayers.find((l) => l.kind === 'imagery');
    if (first) chooseBase(first.id);
    if (moonRealAvailable) chooseMoonBase('real');
    const mars = marsLayers.find((l) => l.kind === 'imagery');
    if (mars) chooseMarsBase(mars.id);
    const mercury = mercuryLayers.find((l) => l.provider === 'mercury-trek-wmts')
      || mercuryLayers.find((l) => l.provider === 'mercury-quickmap')
      || mercuryLayers.find((l) => l.kind === 'imagery');
    if (mercury) chooseMercuryBase(mercury.id);
    const venus = venusLayers.find((l) => l.id === 'venus-magellan-c3')
      || venusLayers.find((l) => l.kind === 'imagery');
    if (venus) chooseVenusBase(venus.id);
  }, [engine, tileLayers.status, earthLayers, marsLayers, mercuryLayers, venusLayers, moonRealAvailable, chooseBase, chooseMoonBase, chooseMarsBase, chooseMercuryBase, chooseVenusBase]);

  useEffect(() => {
    if (!engine) return undefined;
    let alive = true;
    engine.loadMoonColor(resolveApiUrl('/api/v1/tiles/moon-color.jpg'))
      .then(() => { if (alive) setMoonColorOk(true); })
      .catch((err) => {
        if (!alive) return;
        setMoonColorOk(false);
        push(`Couleurs de la Lune indisponibles : ${err.message}`, 'warn', 9000);
      });
    return () => { alive = false; };
  }, [engine, push]);

  useEffect(() => {
    if (!engine) return;
    const wanted = roads && baseLayer?.kind === 'imagery' && overlayLayer ? overlayLayer.id : null;
    engine.setTileOverlay(wanted).catch((err) => push(`Routes indisponibles : ${err.message}`, 'warn'));
  }, [engine, roads, baseLayer, overlayLayer, push]);

  const selectFocus = useCallback((i) => engineRef.current?.setFocus(i), []);
  const zoom = useCallback((f) => engineRef.current?.zoom(f), []);
  const resetView = useCallback(() => engineRef.current?.resetView(), []);
  const recalibrateNorth = useCallback(() => {
    if (engineRef.current?.recalibrateNorth()) setAuto(false);
  }, []);
  const pickCity = useCallback((index) => engineRef.current?.goCity(index), []);
  const pickPlace = useCallback((place) => engineRef.current?.goTo(place), []);
  const moonSide = useCallback((side) => engineRef.current?.viewMoonSide(side), []);
  const selectOrbiter = useCallback((id) => engineRef.current?.selectOrbiter(id), []);
  const goMoonSite = useCallback((site, altitudeKm) => engineRef.current?.goMoon(site, altitudeKm), []);
  const goMarsSite = useCallback((site) => engineRef.current?.goToMars(site), []);
  const goMercurySite = useCallback((site) => engineRef.current?.goToMercury(site), []);
  const goVenusSite = useCallback((site) => engineRef.current?.goToVenus(site), []);
  const closePanel = useCallback(() => setPanel(null), []);

  // Petit écran : un seul grand panneau à la fois (sinon ils se recouvrent).
  const toggleLayers = useCallback(() => {
    setPanel((p) => (p === 'layers' ? null : 'layers'));
    if (compact) { setPointCloudOpen(false); setContributionOpen(false); }
  }, [compact]);
  const togglePointClouds = useCallback(() => {
    setPointCloudOpen((o) => !o);
    if (compact) { setContributionOpen(false); setPanel((p) => (p === 'layers' ? null : p)); }
  }, [compact]);
  const toggleContributions = useCallback(() => {
    setContributionOpen((o) => !o);
    if (compact) { setPointCloudOpen(false); setPanel((p) => (p === 'layers' ? null : p)); }
  }, [compact]);

  const handlers = useMemo(() => ({
    onSide: moonSide,
    onSelectOrbiter: selectOrbiter,
    onGoMoon: goMoonSite,
    onGoPlace: pickPlace,
    onGoMars: goMarsSite,
    onGoMercury: goMercurySite,
    onGoVenus: goVenusSite,
  }), [moonSide, selectOrbiter, goMoonSite, pickPlace, goMarsSite, goMercurySite, goVenusSite]);

  const bodySelected = focus !== 0;
  const layersOpen = panel === 'layers' && bodySelected;
  const bodySelectedRef = useRef(bodySelected);
  bodySelectedRef.current = bodySelected;
  useEffect(() => {
    if (!bodySelected) setPanel((p) => (p === 'layers' ? null : p));
  }, [bodySelected]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPanel('search'); return; }
      if (e.key === 'Escape') { setPanel(null); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setPanel('search'); }
      else if (e.key === '?') setPanel((p) => (p === 'help' ? null : 'help'));
      else if (e.key.toLowerCase() === 'l' && bodySelectedRef.current) setPanel((p) => (p === 'layers' ? null : 'layers'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={compact ? 'app-shell is-compact' : 'app-shell'} data-vp={viewport.size}>
      <ResponsiveStyles />
      <div className="stage" ref={containerRef} />
      <SceneLabels data={data} registry={labels} onSelectBody={selectFocus} />

      <HudTop hud={hud} />
      <BodyPanel
        hud={hud}
        data={data}
        phases={moonPhases}
        handlers={handlers}
        layersOpen={layersOpen}
        onCloseLayers={closePanel}
        bodyId={currentBodyId}
        bodyName={currentBodyName}
        layers={earthLayers}
        moonRealAvailable={moonRealAvailable}
        moonColorOk={moonColorOk}
        moonLayers={moonLayers}
        moonBaseId={moonBaseId}
        onMoonBase={chooseMoonBase}
        marsLayers={marsLayers}
        marsBaseId={marsBaseId}
        onMarsBase={chooseMarsBase}
        mercuryLayers={mercuryLayers}
        mercuryBaseId={mercuryBaseId}
        onMercuryBase={chooseMercuryBase}
        venusLayers={venusLayers}
        venusBaseId={venusBaseId}
        onVenusBase={chooseVenusBase}
        provider={tileLayers.provider}
        listStatus={tileLayers.status}
        listError={tileLayers.error}
        baseId={baseId}
        onBase={chooseBase}
        roads={roadsIncluded ? true : roadsUnavailable ? false : roads}
        onRoads={setRoads}
        roadsHint={roadsHint}
        shade={shade}
        onShade={setShade}
        borders={borders}
        onBorders={setBorders}
        bordersHint={bordersInfo ? 'Natural Earth 1:50m' : 'Chargement…'}
        coasts={coasts}
        onCoasts={setCoasts}
        countryNames={countryNames}
        onCountryNames={setCountryNames}
        cityNames={namesIncluded ? true : cityNames}
        onCityNames={setCityNames}
        cityNamesHint={namesIncluded ? 'Déjà inclus dans ce fond' : cityInfo ? `${cityInfo.count.toLocaleString('fr-FR')} villes · Natural Earth · visibles en zoomant` : 'Chargement…'}
        cityNamesDisabled={namesIncluded}
        moonFeatures={moonFeatures}
        onMoonFeatures={setMoonFeatures}
        moonOrbiters={moonOrbiters}
        onMoonOrbiters={setMoonOrbiters}
        shadowcam={shadowcam}
        onShadowcam={setShadowcam}
        shadowcamHint={shadowcamInfo?.error ? `Indisponible : ${shadowcamInfo.error}` : shadowcamInfo ? `${shadowcamInfo.count} cratères en ombre permanente · ShadowCam (NASA) à bord de Danuri` : 'Chargement du catalogue…'}
        moonModel={moonModel}
        onMoonModel={setMoonModel}
        moonModelHint={
          moonModelInfo === 'loading' ? 'Chargement du modèle…'
            : moonModelInfo?.error ? `Indisponible : ${moonModelInfo.error}`
              : moonModelInfo ? 'NASA (LRO, couleurs et relief) · vue d’ensemble, tuiles en zoomant'
                : 'NASA (LRO) · chargé en ciblant la Lune'
        }
      />
      <Navigator bodies={navBodies} focus={focus} onSelect={selectFocus} />
      <Compass hud={hud} onRecalibrate={recalibrateNorth} />
      <ZoomPad onZoom={zoom} />
      <Toolbar
        hud={hud}
        auto={auto}
        tilt={tilt}
        layersOpen={layersOpen}
        bodySelected={bodySelected}
        citySelected={Boolean(cityFocus)}
        pointCloudOpen={pointCloudOpen}
        onPointClouds={togglePointClouds}
        contributionOpen={contributionOpen}
        onContributions={toggleContributions}
        onSearch={() => setPanel('search')}
        onToggleLayers={toggleLayers}
        onToggleAuto={() => setAuto((v) => !v)}
        onToggleTilt={() => setTilt((v) => !v)}
        onReset={resetView}
        onHelp={() => setPanel('help')}
        sound={sound}
        onToggleSound={toggleSound}
      />
      <CityPointCloud
        city={cityFocus}
        open={pointCloudOpen}
        onClose={() => setPointCloudOpen(false)}
      />
      <ContributionPanel
        engine={engine}
        open={contributionOpen}
        onClose={() => setContributionOpen(false)}
      />
      <Attribution
        hud={hud}
        moonReal={moonBaseId === 'real'}
        extra={[
          (borders || coasts) && bordersInfo ? bordersInfo.attribution : '',
          showCityNames && cityInfo ? cityInfo.attribution : '',
        ].filter(Boolean).join(' · ')}
      />
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <CommandPalette
        open={panel === 'search'}
        onClose={closePanel}
        cities={data.cities}
        bodyNames={bodyNames}
        onPickCity={pickCity}
        onPickPlace={pickPlace}
        worldSearch={tileLayers.placeSearch}
        onPickBody={selectFocus}
      />
      <ShortcutsHelp open={panel === 'help'} onClose={closePanel} />

      {!engine && <div className="loading">{error || 'Chargement de la Terre et de la Lune…'}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Entrée de l’application

export function SolarSystem() {
  const { status, data, error, retry } = useSolarData();

  if (status === 'ready') return <SolarScene data={data} />;

  return (
    <div className="loading">
      <ResponsiveStyles />
      {status === 'loading' ? (
        'Connexion à l’API…'
      ) : (
        <div className="fail">
          <p>Impossible de joindre l’API : {error}.</p>
          <p className="hint">Lancez le backend (<code>npm run dev:api</code>, port 3001), puis réessayez.</p>
          <button type="button" onClick={retry}>Réessayer</button>
        </div>
      )}
    </div>
  );
}

export default SolarSystem;
