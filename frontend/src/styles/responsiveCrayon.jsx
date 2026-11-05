// Thème « crayon » : traits blancs dominants posés sur un fond bleu, ombrés au crayon (hachures, grain, double trait).
// Même esprit que le logo dessiné. Couche appliquée en dernier (préfixe `html body`) : elle habille toutes les
// composantes (boutons, panneaux, cartes, champs, barre d'outils, navigation) sans toucher à leur mise en page.

// Grain de papier : bruit fractal en SVG (aucun fichier à charger).
export const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
// Hachures au crayon : traits fins en diagonale, plus serrés pour les boutons.
export const HATCH = 'repeating-linear-gradient(-38deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 6px)';
export const HATCH_DENSE = 'repeating-linear-gradient(-38deg, rgba(255, 255, 255, 0.09) 0 1px, transparent 1px 4px)';

// Contours irréguliers « tracés à main levée » (rayons elliptiques différents à chaque coin).
export const SKETCH = '18px 7px 16px 9px / 8px 16px 9px 18px';
export const SKETCH_SM = '12px 5px 11px 6px / 6px 11px 5px 12px';
export const SKETCH_PILL = '16px 20px 15px 22px / 13px 11px 14px 12px';

export const T = {
  ink: '#f7f9ff',
  inkSoft: 'rgba(247, 249, 255, 0.78)',
  inkDim: 'rgba(214, 226, 255, 0.62)',
  stroke: 'rgba(255, 255, 255, 0.88)',
  strokeSoft: 'rgba(255, 255, 255, 0.42)',
  blue: '#163a7a',
  blueDeep: '#0d2453',
  blueNight: '#081633',
};

// Fond de boîte : bleu profond, hachures et grain, léger voile clair en haut (ombrage au crayon).
export const boxFill = {
  backgroundColor: T.blueDeep,
  backgroundImage: [
    GRAIN,
    HATCH,
    'linear-gradient(165deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0) 38%)',
    `linear-gradient(160deg, ${T.blue}, ${T.blueDeep} 60%, ${T.blueNight})`,
  ].join(', '),
};
// Double trait : contour principal + second passage du crayon décalé, puis ombre portée douce.
export const boxStroke = {
  border: `2px solid ${T.stroke}`,
  borderRadius: SKETCH,
  boxShadow: [
    `3px 4px 0 -1px ${T.strokeSoft}`,
    'inset 0 -14px 22px -16px rgba(255, 255, 255, 0.28)',
    '0 16px 40px rgba(2, 6, 20, 0.55)',
  ].join(', '),
};

export const btn = {
  fontFamily: 'var(--crayon-font)',
  fontSize: '1.02em',
  letterSpacing: '0.02em',
  color: T.ink,
  backgroundColor: 'rgba(22, 58, 122, 0.72)',
  backgroundImage: `${GRAIN}, ${HATCH_DENSE}`,
  border: `2px solid ${T.stroke}`,
  borderRadius: SKETCH_SM,
  boxShadow: `2px 3px 0 -1px ${T.strokeSoft}`,
  textShadow: '0 1px 0 rgba(8, 22, 51, 0.6)',
  backdropFilter: 'none',
  transition: 'transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease, color 120ms ease',
};
export const btnHover = {
  backgroundColor: 'rgba(36, 82, 160, 0.85)',
  borderColor: '#fff',
  color: '#fff',
  transform: 'translate(-1px, -1px) rotate(-0.4deg)',
  boxShadow: `3px 4px 0 -1px rgba(255, 255, 255, 0.6)`,
};
export const btnActive = { transform: 'translate(1px, 1px)', boxShadow: '0 0 0 0 transparent' };
// Bouton enfoncé : le blanc domine, texte bleu (comme une zone coloriée au crayon blanc).
export const btnPressed = {
  color: T.blueDeep,
  backgroundColor: '#f4f7ff',
  backgroundImage: `${GRAIN}, repeating-linear-gradient(-38deg, rgba(13, 36, 83, 0.10) 0 1px, transparent 1px 4px)`,
  borderColor: '#fff',
  textShadow: 'none',
  boxShadow: `2px 3px 0 -1px rgba(255, 255, 255, 0.55), 0 0 18px rgba(255, 255, 255, 0.25)`,
};

export const field = {
  fontFamily: 'inherit',
  color: T.ink,
  backgroundColor: 'rgba(8, 22, 51, 0.6)',
  backgroundImage: GRAIN,
  border: `2px solid ${T.strokeSoft}`,
  borderRadius: SKETCH_SM,
  boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.35)',
  outline: 'none',
};

const H = 'html body';
const BUTTONS = [
  // :where() : exclusions sans poids de spécificité, pour que l'état enfoncé et le survol passent devant.
  `${H} button:where(:not(.ghost, .ac-orbiter-head, [class*="Mui"]))`,
  `${H} .ac .ac-btn`,
  `${H} .toolbar .tool-btn`, // passe devant `html .toolbar-desktop .tool-btn` et `html .toolbar-compact .tool-btn`
  `${H} .zoom-pad button`,
  `${H} .compass`,
  `${H} .nav-item`,
].join(', ');
const hov = (s) => s.split(', ').map((x) => `${x}:hover:not(:disabled)`).join(', ');
const act = (s) => s.split(', ').map((x) => `${x}:active:not(:disabled)`).join(', ');
const BOXES = [
  `${H} .panel`,
  `${H} .palette`,
  `${H} .toast`,
  `${H} .city-card`,
  `${H} .navigator`,
  `${H} .toolbar`,
].join(', ');
const CARDS = [
  `${H} .ac .ac-card`,
  `${H} .ac .ac-rows`,
  `${H} .ac .ac-orbiter`,
  `${H} .lidar-card`,
  `${H} .contribution-card`,
].join(', ');
const FIELDS = [
  `${H} input[type="text"]`,
  `${H} input[type="search"]`,
  `${H} input[type="number"]`,
  `${H} input[type="url"]`,
  `${H} select`,
  `${H} textarea`,
].join(', ');

// Clés uniques (`:root:root`, `@media screen and …`) : la fusion d'objets de responsiveStyles n'écrase pas
// les blocs du même nom des couches précédentes (variables de base, animations réduites).
export const crayonStyles = {
  ':root:root': {
    '--crayon-font': '"Patrick Hand", "Segoe Print", "Comic Neue", system-ui, sans-serif',
    // Jetons globaux remappés : les composantes qui les lisent passent d'elles-mêmes au thème.
    '--panel': 'rgba(13, 36, 83, 0.92)',
    '--panel-solid': T.blueDeep,
    '--line': 'rgba(255, 255, 255, 0.22)',
    '--line-strong': 'rgba(255, 255, 255, 0.55)',
    '--ink': T.ink,
    '--dim': T.inkDim,
    '--accent': '#ffffff',
  },

  // ------------------------------------------------ Boîtes : panneaux, palette, notifications, fiches
  [BOXES]: { ...boxFill, ...boxStroke, color: T.ink },
  [`${H} .city-card::before`]: { background: T.blueDeep, borderColor: T.stroke },
  [`${H} .overlay`]: { background: 'rgba(4, 12, 32, 0.55)', backdropFilter: 'blur(2px)' },

  // Titres : écriture à la main, blanc, soulignés d'un trait de crayon.
  [`${H} .panel h2, ${H} .panel h3, ${H} .palette h2, ${H} .hud-title h1`]: {
    fontFamily: 'var(--crayon-font)',
    fontWeight: 400,
    letterSpacing: '0.02em',
    color: T.ink,
  },
  [`${H} .live-heading h2`]: {
    fontSize: '1.5rem',
    paddingBottom: '2px',
    backgroundImage: 'linear-gradient(transparent 0 calc(100% - 3px), rgba(255, 255, 255, 0.55) calc(100% - 3px) calc(100% - 1px), transparent calc(100% - 1px))',
  },
  [`${H} .panel > header`]: { borderBottomColor: T.strokeSoft },
  [`${H} .ac .ac-title, ${H} .ac .ac-group-title, ${H} .ac .ac-fact dt`]: {
    fontFamily: 'var(--crayon-font)',
    fontSize: '13px',
    letterSpacing: '0.08em',
    opacity: 0.85,
    color: T.ink,
  },

  // Cartes intérieures : trait simple, hachures plus légères.
  [CARDS]: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backgroundImage: HATCH,
    border: `1.5px solid ${T.strokeSoft}`,
    borderRadius: SKETCH_SM,
    boxShadow: `2px 2px 0 -1px rgba(255, 255, 255, 0.18)`,
  },
  [`${H} .ac .ac-fact, ${H} .ac .ac-row`]: { borderColor: 'rgba(255, 255, 255, 0.16) !important' },
  [`${H} .ac .ac-value`]: { fontFamily: 'var(--crayon-font)', fontSize: '18px', fontWeight: 400, color: '#fff' },

  // ------------------------------------------------ Boutons
  [BUTTONS]: btn,
  [hov(BUTTONS)]: btnHover,
  [act(BUTTONS)]: btnActive,
  [[
    `${H} button[aria-pressed="true"]:not(.ghost)`,
    `${H} .toolbar .tool-btn[aria-pressed="true"]`,
    `${H} .toolbar .tool-btn[aria-pressed="true"]:hover:not(:disabled)`,
    `${H} .nav-item[aria-current="true"]`,
  ].join(', ')]: btnPressed,
  [`${H} .nav-item[aria-current="true"] .nav-name, ${H} .nav-item[aria-current="true"] .nav-id`]: { color: T.blueDeep },
  [`${H} .toolbar .tool-btn[aria-pressed="true"] .tool-icon`]: { color: T.blueDeep },
  [`${H} .nav-item[aria-current="true"]::after`]: { background: T.blueDeep },
  [`${H} button:disabled, ${H} .toolbar .tool-btn:disabled`]: { opacity: 0.42, cursor: 'not-allowed', transform: 'none', boxShadow: 'none' },
  [`${H} button.ghost`]: { color: T.inkSoft, fontFamily: 'var(--crayon-font)' },
  [`${H} button.ghost:hover`]: { color: '#fff' },
  [`${H} button:focus-visible, ${H} .nav-item:focus-visible`]: { outline: '2px dashed #fff', outlineOffset: '3px' },

  // Barre d'outils : un seul trait autour du groupe, séparateurs dessinés.
  [`${H} .toolbar`]: { padding: '7px 9px', borderRadius: SKETCH },
  [`${H} .toolbar .tool-sep`]: {
    background: 'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0 4px, transparent 4px 7px)',
    width: '2px',
  },
  [`${H} .zoom-pad button`]: { borderRadius: '50% 46% 52% 44% / 46% 52% 44% 50%', fontSize: '28px' },
  [`${H} .navigator`]: { padding: '10px' },
  [`${H} .nav-item`]: { borderRadius: SKETCH_SM, transform: 'none', padding: '5px 8px', minWidth: 0 },
  [`${H} .nav-name`]: { fontFamily: 'var(--crayon-font)', fontSize: '0.82rem' },

  // ------------------------------------------------ Badge « En direct » : pastille blanche tracée au crayon
  [`${H} .live`]: {
    fontFamily: 'var(--crayon-font)',
    fontSize: '0.8rem',
    letterSpacing: '0.12em',
    color: '#fff',
    background: 'rgba(255, 255, 255, 0.10)',
    backgroundImage: HATCH_DENSE,
    border: `1.5px solid ${T.stroke}`,
    borderRadius: SKETCH_PILL,
  },
  [`${H} .live::before`]: { background: '#ffd36b' },

  // ------------------------------------------------ Champs de saisie
  [FIELDS]: field,
  [FIELDS.split(', ').map((s) => `${s}:focus`).join(', ')]: { borderColor: '#fff', boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.35), 0 0 0 3px rgba(255, 255, 255, 0.15)' },
  [`${H} input::placeholder, ${H} textarea::placeholder`]: { color: T.inkDim, fontFamily: 'var(--crayon-font)' },
  [`${H} .palette input`]: { border: 0, borderBottom: `2px solid ${T.strokeSoft}`, borderRadius: 0, boxShadow: 'none', background: 'transparent' },

  // Interrupteurs et cases : blanc sur bleu.
  [`${H} .ac .ac-toggle`]: { background: 'rgba(8, 22, 51, 0.7)', border: `1.5px solid ${T.stroke}` },
  [`${H} .ac .ac-toggle:checked`]: { background: '#f4f7ff' },
  [`${H} .ac .ac-toggle:checked::before`]: { background: T.blueDeep },
  [`${H} input[type="checkbox"], ${H} input[type="radio"], ${H} input[type="range"]`]: { accentColor: '#ffffff' },

  // Listes de résultats (recherche) : surlignage blanc au lieu de l'ambre.
  [`${H} .palette li[aria-selected="true"], ${H} .moon-search button:hover, ${H} .moon-search button:focus-visible`]: {
    background: 'rgba(255, 255, 255, 0.14)',
    boxShadow: 'inset 3px 0 0 #fff',
  },

  // Texte d'aide et sources : blanc atténué plutôt que gris.
  [`${H} .ac .ac-hint, ${H} .ac .ac-fact small, ${H} .title p`]: { color: T.inkDim, opacity: 1 },

  '@media screen and (prefers-reduced-motion: reduce)': {
    [hov(BUTTONS)]: { transform: 'none' },
  },
};
