// Thème « crayon » : textures dessinées au crayon (pack public/textures/crayon, palette Gobai), traits blancs à main
// levée par-dessus. Couche appliquée en dernier (préfixe `html body`) : elle habille toutes les composantes
// (boutons, panneaux, cartes, champs, barre d'outils, navigation) sans toucher à leur mise en page.
//
// Pack : une tuile 256 px raccordable par couleur (`<nom>.webp`), sa variante ombrée en hachures croisées
// (`<nom>-ombre.webp`), plus deux calques transparents (`hachures-blanches.webp`, `grain.webp`).

const BASE = '/textures/crayon/';

/** Palette relevée sur la planche Gobai (couleur moyenne de chaque tuile). */
export const PALETTE = {
  cobalt: '#1f4288', petrole: '#185264', foret: '#1a5e4c', sauge: '#507149',
  corail: '#a34542', brique: '#803935', bordeaux: '#54312e', ocre: '#bc870f',
  marine: '#1c2d5f', ardoise: '#193d5a', sarcelle: '#215c66', canard: '#0d4852',
  moutarde: '#c39a3a', caramel: '#ab795e', mauve: '#91626c', prune: '#613745',
  terre: '#613d1d', taupe: '#7f6e5a',
};

const url = (file) => `url("${BASE}${file}.webp")`;

/**
 * Fond texturé au crayon.
 * @param name   couleur du pack
 * @param veil   voile sombre (0 à 1) : calme la texture sous du texte
 * @param opts   ombre : variante en hachures croisées ; light : hachures blanches par-dessus (reflet, survol)
 */
export function tex(name, veil = 0, { ombre = false, light = false } = {}) {
  const layers = [];
  if (light) layers.push(url('hachures-blanches'));
  if (veil) layers.push(`linear-gradient(rgba(6, 12, 30, ${veil}), rgba(6, 12, 30, ${veil}))`);
  layers.push(url(ombre ? `${name}-ombre` : name));
  return {
    backgroundColor: PALETTE[name], // couleur affichée tant que la texture charge, ou hors ligne
    backgroundImage: layers.join(', '),
    backgroundSize: '256px 256px',
    backgroundRepeat: 'repeat',
  };
}

// Calques sans fichier, gardés pour les composantes MUI (puce, barre de progression).
export const GRAIN = url('grain');
export const HATCH = url('hachures-blanches');
export const HATCH_DENSE = url('hachures-blanches');

// Contours irréguliers « tracés à main levée » (rayons elliptiques différents à chaque coin).
export const SKETCH = '18px 7px 16px 9px / 8px 16px 9px 18px';
export const SKETCH_SM = '12px 5px 11px 6px / 6px 11px 5px 12px';
export const SKETCH_PILL = '16px 20px 15px 22px / 13px 11px 14px 12px';

export const T = {
  ink: '#f7f9ff',
  inkSoft: 'rgba(247, 249, 255, 0.8)',
  inkDim: 'rgba(222, 230, 250, 0.7)',
  inkOnLight: '#10224f',          // texte posé sur moutarde / ocre
  stroke: 'rgba(255, 255, 255, 0.9)',
  strokeSoft: 'rgba(255, 255, 255, 0.45)',
  blue: PALETTE.cobalt,
  blueDeep: PALETTE.marine,
  blueNight: '#0b1530',
};

// Boîte : marine au crayon + double trait blanc (contour + second passage décalé) + ombre portée.
export const boxFill = tex('marine', 0.22);
export const boxStroke = {
  border: `2px solid ${T.stroke}`,
  borderRadius: SKETCH,
  boxShadow: [
    `3px 4px 0 -1px ${T.strokeSoft}`,
    'inset 0 -14px 22px -16px rgba(255, 255, 255, 0.25)',
    '0 16px 40px rgba(2, 6, 20, 0.55)',
  ].join(', '),
};

export const btn = {
  ...tex('cobalt'),
  fontFamily: 'var(--crayon-font)',
  fontSize: '1.02em',
  letterSpacing: '0.02em',
  color: T.ink,
  border: `2px solid ${T.stroke}`,
  borderRadius: SKETCH_SM,
  boxShadow: `2px 3px 0 -1px ${T.strokeSoft}`,
  textShadow: '0 1px 0 rgba(6, 12, 30, 0.65)',
  backdropFilter: 'none',
  transition: 'transform 120ms ease, box-shadow 120ms ease, color 120ms ease',
};
// Survol : sarcelle, rehaussé de hachures blanches.
export const btnHover = {
  ...tex('sarcelle', 0, { light: true }),
  borderColor: '#fff',
  color: '#fff',
  transform: 'translate(-1px, -1px) rotate(-0.4deg)',
  boxShadow: '3px 4px 0 -1px rgba(255, 255, 255, 0.6)',
};
export const btnActive = { transform: 'translate(1px, 1px)', boxShadow: '0 0 0 0 transparent' };
// Enfoncé / actif : moutarde, texte bleu nuit (comme le Soleil du logo). Remplissage simple : texte lisible.
export const btnPressed = {
  ...tex('moutarde'),
  color: T.inkOnLight,
  borderColor: '#fff',
  textShadow: '0 1px 0 rgba(255, 240, 200, 0.45)',
  boxShadow: '2px 3px 0 -1px rgba(255, 255, 255, 0.6), 0 0 18px rgba(255, 211, 107, 0.28)',
};

export const field = {
  ...tex('marine', 0.5),
  fontFamily: 'inherit',
  color: T.ink,
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

// Fiche « en direct » : une couleur par astre (voile adapté pour garder le texte blanc lisible).
const BODY_TEXTURES = {
  earth: ['cobalt', 0.3], moon: ['ardoise', 0.2], mars: ['brique', 0.32], mercury: ['taupe', 0.45],
  venus: ['terre', 0.2], jupiter: ['caramel', 0.5], saturn: ['bordeaux', 0.15], uranus: ['sarcelle', 0.28],
  neptune: ['petrole', 0.2],
};
const bodyRules = Object.fromEntries(
  Object.entries(BODY_TEXTURES).map(([id, [name, veil]]) => [`${H} .moon-live[data-body="${id}"]`, tex(name, veil)]),
);

// Clés uniques (`:root:root`, `@media screen and …`) : la fusion d'objets de responsiveStyles n'écrase pas
// les blocs du même nom des couches précédentes (variables de base, animations réduites).
export const crayonStyles = {
  ':root:root': {
    '--crayon-font': '"Patrick Hand", "Segoe Print", "Comic Neue", system-ui, sans-serif',
    // Jetons globaux remappés : les composantes qui les lisent passent d'elles-mêmes au thème.
    '--panel': 'rgba(28, 45, 95, 0.94)',
    '--panel-solid': PALETTE.marine,
    '--line': 'rgba(255, 255, 255, 0.22)',
    '--line-strong': 'rgba(255, 255, 255, 0.55)',
    '--ink': T.ink,
    '--dim': T.inkDim,
    '--accent': PALETTE.moutarde,
    '--sun': '#e3b54f',
  },

  // ------------------------------------------------ Boîtes : marine par défaut, une couleur par composante
  [BOXES]: { ...boxFill, ...boxStroke, color: T.ink },
  [`${H} .toolbar`]: tex('ardoise', 0.12),
  [`${H} .navigator`]: tex('canard', 0.15),
  [`${H} .toast`]: tex('petrole', 0.1),
  [`${H} .toast.warn`]: { ...tex('terre', 0.05), borderLeft: `5px solid ${PALETTE.moutarde}` },
  [`${H} .toast.error`]: { ...tex('brique', 0.1), borderLeft: `5px solid ${PALETTE.corail}` },
  [`${H} .city-card`]: tex('foret', 0.2),
  [`${H} .city-card::before`]: { background: PALETTE.foret, borderColor: T.stroke },
  [`${H} .city-pointcloud`]: tex('sarcelle', 0.25),        // Tuile 3D
  [`${H} .lidar-globe`]: tex('sauge', 0.3),                // LiDAR sur le globe
  [`${H} .contribution-panel`]: tex('prune', 0.12),        // Contributions
  [`${H} .help`]: tex('petrole', 0.15),                    // Aide
  ...bodyRules,
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
    opacity: 0.9,
    color: T.ink,
  },

  // Cartes intérieures : pétrole voilé (ressort légèrement sur chaque fond), trait simple.
  [CARDS]: {
    ...tex('petrole', 0.4),
    border: `1.5px solid ${T.strokeSoft}`,
    borderRadius: SKETCH_SM,
    boxShadow: '2px 2px 0 -1px rgba(255, 255, 255, 0.2)',
  },
  [`${H} .lidar-card`]: tex('foret', 0.3),
  [`${H} .contribution-card`]: tex('mauve', 0.5),
  [`${H} .ac .ac-fact, ${H} .ac .ac-row`]: { borderColor: 'rgba(255, 255, 255, 0.18) !important' },
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
    `${H} .nav-item[aria-current="true"]:hover:not(:disabled)`,
  ].join(', ')]: btnPressed,
  [`${H} .nav-item[aria-current="true"] .nav-name, ${H} .nav-item[aria-current="true"] .nav-id`]: { color: T.inkOnLight },
  [`${H} .toolbar .tool-btn[aria-pressed="true"] .tool-icon`]: { color: T.inkOnLight },
  [`${H} .nav-item[aria-current="true"]::after`]: { background: T.inkOnLight },
  [`${H} button:disabled, ${H} .toolbar .tool-btn:disabled`]: {
    ...tex('taupe', 0.45),
    opacity: 0.55,
    cursor: 'not-allowed',
    transform: 'none',
    boxShadow: 'none',
  },
  [`${H} button.ghost`]: { color: T.inkSoft, fontFamily: 'var(--crayon-font)' },
  [`${H} button.ghost:hover`]: { color: '#fff' },
  [`${H} button:focus-visible, ${H} .nav-item:focus-visible`]: { outline: '2px dashed #fff', outlineOffset: '3px' },

  // Barre d'outils : un seul trait autour du groupe, séparateurs dessinés.
  [`${H} .toolbar.toolbar`]: { padding: '7px 9px', borderRadius: SKETCH },
  [`${H} .toolbar .tool-sep`]: {
    background: 'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0 4px, transparent 4px 7px)',
    width: '2px',
  },
  [`${H} .zoom-pad button`]: { ...tex('sarcelle'), borderRadius: '50% 46% 52% 44% / 46% 52% 44% 50%', fontSize: '28px' },
  [`${H} .compass`]: tex('marine', 0.1),
  [`${H} .navigator.navigator`]: { padding: '10px' },
  [`${H} .nav-item`]: { borderRadius: SKETCH_SM, transform: 'none', padding: '5px 8px', minWidth: 0 },
  [`${H} .nav-name`]: { fontFamily: 'var(--crayon-font)', fontSize: '0.82rem' },

  // ------------------------------------------------ Badge « En direct » : corail au crayon, point moutarde
  [`${H} .live`]: {
    ...tex('corail', 0, { ombre: true }),
    fontFamily: 'var(--crayon-font)',
    fontSize: '0.8rem',
    letterSpacing: '0.12em',
    color: '#fff',
    border: `1.5px solid ${T.stroke}`,
    borderRadius: SKETCH_PILL,
    textShadow: '0 1px 0 rgba(6, 12, 30, 0.5)',
  },
  [`${H} .live::before`]: { background: '#ffd36b' },
  [`${H} .contribution-badge`]: { ...tex('mauve'), border: `1.5px solid ${T.stroke}`, borderRadius: SKETCH_PILL, color: '#fff' },

  // ------------------------------------------------ Champs de saisie
  [FIELDS]: field,
  [FIELDS.split(', ').map((s) => `${s}:focus`).join(', ')]: {
    borderColor: '#fff',
    boxShadow: `inset 0 2px 6px rgba(0, 0, 0, 0.35), 0 0 0 3px rgba(195, 154, 58, 0.35)`,
  },
  [`${H} input::placeholder, ${H} textarea::placeholder`]: { color: T.inkDim, fontFamily: 'var(--crayon-font)' },
  [`${H} .palette input`]: { border: 0, borderBottom: `2px solid ${T.strokeSoft}`, borderRadius: 0, boxShadow: 'none', background: 'transparent' },

  // Interrupteurs et cases : moutarde une fois activés.
  [`${H} .ac .ac-toggle`]: { ...tex('marine', 0.4), border: `1.5px solid ${T.stroke}` },
  [`${H} .ac .ac-toggle:checked`]: tex('moutarde', 0, { ombre: true }),
  [`${H} .ac .ac-toggle:checked::before`]: { background: T.inkOnLight },
  [`${H} input[type="checkbox"], ${H} input[type="radio"], ${H} input[type="range"]`]: { accentColor: PALETTE.moutarde },

  // Listes de résultats (recherche) : surlignage moutarde.
  [`${H} .palette li[aria-selected="true"], ${H} .moon-search button:hover, ${H} .moon-search button:focus-visible`]: {
    background: 'rgba(195, 154, 58, 0.22)',
    boxShadow: `inset 3px 0 0 ${PALETTE.moutarde}`,
  },

  // Texte d'aide et sources : blanc atténué plutôt que gris.
  [`${H} .ac .ac-hint, ${H} .ac .ac-fact small, ${H} .title p`]: { color: T.inkDim, opacity: 1 },

  '@media screen and (prefers-reduced-motion: reduce)': {
    [hov(BUTTONS)]: { transform: 'none' },
  },
};
