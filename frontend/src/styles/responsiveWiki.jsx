// Thème « encyclopédie » : blanc dominant, texte noir, filets gris fins, angles presque droits, titres à empattements.
// Palette en noir et blanc reprise du système Codex de Wikipédia (gris #f8f9fa / #eaecf0 / #c8ccd1 / #a2a9b1,
// texte #202122). Seule exception : le rouge des erreurs. Couche appliquée en dernier (préfixe `html body`) : elle
// habille toutes les composantes sans toucher à leur mise en page. Le texte posé directement sur la scène 3D
// (étiquettes, sources, mesures) reste blanc pour rester lisible sur l'espace.

export const W = {
  bg: '#ffffff',
  subtle: '#f8f9fa',      // fond des encadrés (infobox)
  neutral: '#eaecf0',     // survol, sélection, cases
  borderSubtle: '#c8ccd1',
  border: '#a2a9b1',
  borderStrong: '#72777d',
  ink: '#202122',
  inkSubtle: '#54595d',
  placeholder: '#72777d',
  black: '#000000',
  error: '#d33',
};
export const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Lato, Helvetica, Arial, sans-serif';
export const SERIF = '"Linux Libertine", "Georgia", "Times", serif';
export const RADIUS = '2px';
const SHADOW = '0 2px 2px rgba(0, 0, 0, 0.2)';
const SHADOW_FLOAT = '0 4px 16px rgba(0, 0, 0, 0.28)';

/** Boîte blanche (panneaux, menus, fiches). */
export const box = {
  background: W.bg,
  backgroundImage: 'none',
  color: W.ink,
  border: `1px solid ${W.border}`,
  borderRadius: RADIUS,
  boxShadow: SHADOW_FLOAT,
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
};
/** Bouton par défaut (Codex) : gris très clair, filet gris, texte noir gras. */
export const btn = {
  fontFamily: SANS,
  fontWeight: 700,
  color: W.ink,
  background: W.subtle,
  backgroundImage: 'none',
  border: `1px solid ${W.border}`,
  borderRadius: RADIUS,
  boxShadow: 'none',
  textShadow: 'none',
  transform: 'none',
  backdropFilter: 'none',
  transition: 'background-color 100ms ease, border-color 100ms ease, color 100ms ease',
};
export const btnHover = { background: W.bg, borderColor: W.borderStrong, color: '#404244', transform: 'none', boxShadow: 'none' };
export const btnActive = { background: W.neutral, borderColor: W.borderStrong, color: W.black, transform: 'none', boxShadow: 'none' };
/** Bouton enfoncé / astre sélectionné : noir, texte blanc. */
export const btnPressed = { background: W.ink, backgroundImage: 'none', borderColor: W.ink, color: '#fff', boxShadow: 'none', textShadow: 'none' };
/** Bouton discret (barre d'outils) : sans fond tant qu'on ne le survole pas. */
const btnQuiet = { ...btn, background: 'transparent', borderColor: 'transparent' };
export const field = {
  fontFamily: SANS,
  color: W.ink,
  background: W.bg,
  backgroundImage: 'none',
  border: `1px solid ${W.border}`,
  borderRadius: RADIUS,
  boxShadow: 'none',
  outline: 'none',
};

const H = 'html body';
const list = (...items) => items.join(', ');
const BUTTONS = list(
  // :where() : exclusions sans poids de spécificité, pour que l'état enfoncé et le survol passent devant.
  `${H} button:where(:not(.ghost, .ac-orbiter-head, .moon-search button, [class*="Mui"]))`,
  `${H} .ac .ac-btn`,
  `${H} .zoom-pad button`,
  `${H} .contribution-panel button`,
);
const each = (s, suffix) => s.split(', ').map((x) => `${x}${suffix}`).join(', ');
const BOXES = list(
  `${H} .panel`,
  `${H} .palette`,
  `${H} .toast`,
  `${H} .city-card`,
  `${H} .navigator`,
  `${H} .toolbar.toolbar`,
  `${H} .toolbar-menu`,
  `${H} .contribution-panel`,
);
const CARDS = list(
  `${H} .lidar-card`,
  `${H} .contribution-card`,
  `${H} .cc-weather`,
  `${H} .cc-grid > div`,
);
const FIELDS = list(
  `${H} input[type="text"]`,
  `${H} input[type="search"]`,
  `${H} input[type="number"]`,
  `${H} input[type="url"]`,
  `${H} select`,
  `${H} textarea`,
  `${H} .moon-live .moon-search input`,
  `${H} .contribution-panel input`,
);

// Clés uniques (`:root:root`, `@media screen and …`) : la fusion d'objets de responsiveStyles n'écrase pas
// les blocs du même nom des couches précédentes (variables de base, animations réduites).
export const wikiStyles = {
  ':root:root': {
    // Jetons globaux remappés : les composantes qui les lisent passent d'elles-mêmes au thème clair.
    '--panel': W.bg,
    '--panel-solid': W.bg,
    '--line': W.borderSubtle,
    '--line-strong': W.border,
    '--ink': W.ink,
    '--dim': W.inkSubtle,
    '--sun': W.ink,          // ancien accent ambré → noir
    '--sun-ink': '#fff',
    '--accent': W.ink,
    '--busy': W.inkSubtle,
    '--bad': W.error,
    '--radius': RADIUS,
  },
  '@keyframes wikiLive': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.25 } },

  [`${H}`]: { fontFamily: SANS },
  [`${H} .loading`]: { background: W.bg, color: W.inkSubtle },
  [`${H} .overlay`]: { background: 'rgba(255, 255, 255, 0.65)', backdropFilter: 'none' },

  // ------------------------------------------------ Boîtes
  [BOXES]: box,
  [`${H} .navigator, ${H} .toolbar.toolbar`]: { boxShadow: SHADOW },
  [`${H} .panel > header, ${H} .contribution-panel > header, ${H} .city-pointcloud > header`]: { borderBottom: `1px solid ${W.border}` },
  [`${H} .live-panel.panel-sheet`]: { borderRadius: 0, boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.2)' },
  [`${H} .sheet-handle`]: { background: W.borderSubtle },
  [`${H} .drag-grip`]: { color: W.placeholder },
  [CARDS]: { background: W.subtle, backgroundImage: 'none', border: `1px solid ${W.borderSubtle}`, borderRadius: RADIUS, boxShadow: 'none' },

  // En-tête du site : encadré blanc, nom en caractères à empattements (comme le logotype de Wikipédia).
  [`${H} .hud-title`]: { ...box, boxShadow: SHADOW, padding: '6px 18px 6px 0', overflow: 'hidden' },
  [`${H} .hud-title h1`]: { fontFamily: SERIF, fontWeight: 400, color: W.black, letterSpacing: 0 },
  [`${H} .title p`]: { color: W.inkSubtle },

  // Titres
  [list(`${H} .panel h2`, `${H} .palette h2`, `${H} .contribution-panel h2`, `${H} .cc-head h2`)]: {
    fontFamily: SERIF, fontWeight: 400, color: W.black, letterSpacing: 0,
  },
  [`${H} .live-heading h2`]: { fontSize: '1.45rem' },
  [`${H} .city-pointcloud-kicker, ${H} .lidar-globe-kicker`]: { color: W.inkSubtle, letterSpacing: '0.06em' },
  [`${H} .panel h3`]: { color: W.ink },
  // Sections du panneau planète : titre à empattements souligné d'un filet, comme une section d'article.
  [`${H} .ac .ac-title`]: {
    fontFamily: SERIF, fontSize: '16px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 1,
    color: W.black, paddingBottom: '3px', borderBottom: `1px solid ${W.border}`,
  },
  [`${H} .ac .ac-group-title`]: { color: W.inkSubtle, opacity: 1 },
  [`${H} .ac .ac-fact dt`]: { color: W.inkSubtle, opacity: 1, fontWeight: 700 },
  [`${H} .ac .ac-value`]: { color: W.black },
  [`${H} .ac .ac-hint, ${H} .ac .ac-fact small`]: { color: W.inkSubtle, opacity: 1 },

  // ------------------------------------------------ Boutons
  [BUTTONS]: btn,
  [each(BUTTONS, ':hover:not(:disabled)')]: btnHover,
  [each(BUTTONS, ':active:not(:disabled)')]: btnActive,
  [list(`${H} button[aria-pressed="true"]:not(.ghost)`, `${H} button[aria-pressed="true"]:not(.ghost):hover:not(:disabled)`)]: btnPressed,
  [`${H} button:disabled`]: { background: '#dadde3', borderColor: W.borderSubtle, color: W.placeholder, opacity: 1, cursor: 'not-allowed' },
  [`${H} button.ghost`]: { background: 'none', border: 0, color: W.inkSubtle, boxShadow: 'none' },
  [`${H} button.ghost:hover`]: { color: W.black },
  [list(`${H} button:focus-visible`, `${H} .nav-item:focus-visible`, `${H} .toolbar .tool-btn:focus-visible`)]: {
    outline: `2px solid ${W.ink}`, outlineOffset: '1px',
  },

  // Barre d'outils : boutons discrets, séparateurs gris, indicateur de zoom en gris.
  [`${H} .toolbar .tool-btn`]: { ...btnQuiet, fontWeight: 400 },
  [`${H} .toolbar .tool-btn:hover:not(:disabled)`]: { background: W.neutral, borderColor: 'transparent', color: W.black },
  [`${H} .toolbar .tool-btn:active:not(:disabled)`]: { background: W.borderSubtle },
  [list(`${H} .toolbar .tool-btn[aria-pressed="true"]`, `${H} .toolbar .tool-btn[aria-pressed="true"]:hover:not(:disabled)`)]: btnPressed,
  [`${H} .toolbar .tool-btn[aria-pressed="true"] .tool-icon`]: { color: '#fff' },
  [`${H} .toolbar .tool-btn:disabled`]: { background: 'transparent', color: W.placeholder, opacity: 0.6 },
  [`${H} .toolbar .tool-sep`]: { background: W.borderSubtle },
  [`${H} .toolbar .readout`]: { color: W.inkSubtle, textShadow: 'none' },
  [`${H} .tool-btn.has-active::after`]: { background: W.ink },

  // Navigation des astres : liste à filets, astre courant en noir.
  [`${H} .nav-title`]: { color: W.inkSubtle },
  [`${H} .nav-title::after`]: { background: W.borderSubtle },
  [`${H} .nav-item`]: {
    ...btn, fontWeight: 400, background: W.bg, borderColor: W.borderSubtle, transform: 'none',
  },
  [`${H} .nav-item:hover`]: { background: W.subtle, borderColor: W.border, color: W.black, transform: 'none', boxShadow: 'none' },
  [`${H} .nav-item:active`]: { background: W.neutral, transform: 'none' },
  [list(`${H} .nav-item[aria-current="true"]`, `${H} .nav-item[aria-current="true"]:hover`)]: btnPressed,
  [`${H} .nav-item[aria-current="true"]::after`]: { display: 'none' },
  [`${H} .nav-id`]: { color: W.placeholder },
  [`${H} .nav-item[aria-current="true"] .nav-id`]: { color: W.borderSubtle },
  [`${H} .nav-orb`]: { boxShadow: `0 0 0 1px ${W.border}` },

  // Zoom et boussole
  [`${H} .zoom-pad button`]: { fontWeight: 400, boxShadow: SHADOW },
  [`${H} .compass`]: { ...box, boxShadow: SHADOW, borderRadius: '50%' },
  [`${H} .compass:hover`]: { background: W.subtle, borderColor: W.borderStrong, transform: 'none', boxShadow: SHADOW },
  [`${H} .compass::after`]: { borderColor: W.borderSubtle, boxShadow: 'none' },
  [`${H} .compass-mark`]: { background: W.ink, boxShadow: 'none' },

  // ------------------------------------------------ Badge « En direct » : étiquette encadrée, point noir qui clignote
  [`${H} .live`]: {
    background: W.subtle, border: `1px solid ${W.border}`, borderRadius: RADIUS, color: W.ink,
    fontWeight: 700, letterSpacing: '0.08em', textShadow: 'none',
  },
  [`${H} .live::before`]: { background: W.ink, boxShadow: 'none', animation: 'wikiLive 1.6s ease-in-out infinite' },

  // ------------------------------------------------ Champs de saisie
  [FIELDS]: field,
  [each(FIELDS, ':focus')]: { borderColor: W.ink, boxShadow: `inset 0 0 0 1px ${W.ink}` },
  [`${H} input::placeholder, ${H} textarea::placeholder`]: { color: W.placeholder },
  [`${H} .palette input`]: { border: 0, borderBottom: `1px solid ${W.borderSubtle}`, borderRadius: 0, boxShadow: 'none' },
  [`${H} input[type="checkbox"], ${H} input[type="radio"], ${H} input[type="range"]`]: { accentColor: W.ink },
  [`${H} kbd`]: { background: W.subtle, border: `1px solid ${W.borderSubtle}`, borderRadius: RADIUS, color: W.ink },

  // Listes de résultats (recherche, palette) : surlignage gris, filet noir à gauche.
  [list(`${H} .palette li[aria-selected="true"]`, `${H} .moon-search button:hover`, `${H} .moon-search button:focus-visible`)]: {
    background: W.neutral, boxShadow: `inset 2px 0 0 ${W.ink}`,
  },

  // ------------------------------------------------ Notifications
  [`${H} .toast`]: { borderLeft: `4px solid ${W.ink}`, boxShadow: SHADOW },
  [`${H} .toast.warn`]: { borderLeftColor: W.borderStrong },
  [`${H} .toast.error`]: { borderLeftColor: W.error },

  // ------------------------------------------------ Fiche ville (au survol du globe)
  [`${H} .city-card::before`]: { background: W.bg, borderColor: W.border },
  [`${H} .city-card[data-placement="above"]::before`]: { background: W.bg },
  [list(`${H} .cc-sub`, `${H} .cc-alt span`, `${H} .cc-w-cond`, `${H} .cc-w-metric em`, `${H} .cc-pop span`, `${H} .cc-src`,
    `${H} .cc-grid dt`, `${H} .cc-row dt`, `${H} .cc-energy-head`, `${H} .cc-energy-note`, `${H} .cc-foot`)]: { color: W.inkSubtle },
  [list(`${H} .cc-alt`, `${H} .cc-w-temp`, `${H} .cc-w-metrics`, `${H} .cc-pop strong`, `${H} .cc-grid dd`, `${H} .cc-row dd`,
    `${H} .cc-energy-head strong`)]: { color: W.ink },
  [`${H} .cc-badge`]: { borderColor: W.border, background: W.subtle, color: W.ink },
  [`${H} .cc-w-icon`]: { background: W.bg, border: `1px solid ${W.borderSubtle}` },
  [list(...['sun', 'moon', 'cloud', 'fog', 'rain', 'snow', 'bolt'].map((k) => `${H} .cc-w-svg .w-${k}`))]: { stroke: W.ink },
  [list(`${H} .cc-w-svg .w-sun`, `${H} .cc-w-svg .w-moon`, `${H} .cc-w-svg .w-cloud`, `${H} .cc-w-svg .w-bolt`)]: { fill: 'rgba(32, 33, 34, 0.06)' },
  [`${H} .cc-rows, ${H} .cc-foot`]: { borderTopColor: W.borderSubtle },
  [`${H} .cc-meter`]: { background: W.neutral },
  [`${H} .cc-meter i`]: { background: W.ink },

  // ------------------------------------------------ Contributions, Tuile 3D, LiDAR
  [`${H} .contribution-peer-status`]: { color: W.inkSubtle },
  [`${H} .contribution-badge`]: { background: W.subtle, border: `1px solid ${W.border}`, borderRadius: RADIUS, color: W.ink },
  [`${H} .contribution-badge.validated`]: { color: W.ink, borderColor: W.ink },
  [`${H} .contribution-badge.contested`]: { color: W.error, borderColor: W.error },
  [`${H} .contribution-comments, ${H} .contribution-comment`]: { borderLeftColor: W.borderSubtle },
  [`${H} .city-pointcloud-lyon a`]: { color: W.ink, textDecoration: 'underline' },
  [`${H} .lidar-drop`]: { borderColor: W.border, background: W.subtle },
  [`${H} .lidar-drop.is-over`]: { borderColor: W.ink, background: W.neutral },
  [`${H} .lidar-warn`]: { color: W.ink, fontWeight: 700 },
  [`${H} .lidar-error, ${H} .contribution-error`]: { color: W.error },

  // ------------------------------------------------ Texte posé sur la scène 3D : reste blanc
  [`${H} .readout`]: { color: '#fff' },
  [`${H} .attribution strong`]: { color: '#fff' },
  [`${H} .l.map-label:hover, ${H} .l.map-label:active`]: { color: '#fff', textDecoration: 'underline' },
  [`${H} .l[title]:active`]: { background: 'rgba(255, 255, 255, 0.3)' },
  [`${H} .donation-button`]: { background: W.ink, borderRadius: RADIUS, boxShadow: SHADOW, backdropFilter: 'none' },
  [`${H} .donation-unavailable`]: { ...box, boxShadow: SHADOW, padding: '4px 10px', color: W.inkSubtle },

  '@media screen and (prefers-reduced-motion: reduce)': {
    [`${H} .live::before`]: { animation: 'none' },
  },
};
