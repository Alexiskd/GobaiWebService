import { ACCENT, CARD_BORDER, LINE, R, card, muted, resetButton, smallCaps } from './tokens';

export const layoutStyles = {
  '@keyframes acPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 } },

  // ------------------------------------------------ Conteneur
  [R]: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minWidth: 0,
    fontSize: '13px',
    lineHeight: 1.4,
  },
  [`${R} *, ${R} *::before, ${R} *::after`]: { boxSizing: 'border-box' },

  // ------------------------------------------------ Sections et textes
  [`${R} .ac-section, ${R} .ac-group`]: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, margin: 0, padding: 0 },
  [`${R} .ac-title, ${R} .ac-group-title`]: smallCaps,
  [`${R} .ac-title`]: { textAlign: 'center' },
  [`${R} .ac-section > .ac-hint`]: { textAlign: 'center' },
  [`${R} .moon-search`]: { margin: 0 }, // la marge héritée de la feuille globale décalait le champ
  [`${R} .ac-subtitle`]: { margin: '2px 0 0', fontSize: '12px', fontWeight: 600, opacity: 0.8 },
  [`${R} .ac-hint`]: { margin: 0, fontSize: '12px', opacity: 0.6, lineHeight: 1.45, overflowWrap: 'anywhere' },
  [`${R} .ac-hint strong`]: { fontWeight: 600, opacity: 1 },
  [`${R} .ac-card`]: card,

  // ------------------------------------------------ Fiche : tuiles centrées sur deux colonnes (libellé, valeur, note)
  [`${R} .ac-facts`]: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  [`${R} .ac-fact`]: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    minWidth: 0,
    padding: '12px 10px',
    textAlign: 'center',
  },
  [`${R} .ac-fact:nth-child(odd)`]: { borderRight: `1px solid ${LINE}` },
  [`${R} .ac-fact:nth-child(n + 3)`]: { borderTop: `1px solid ${LINE}` },
  [`${R} .ac-fact:last-child:nth-child(odd)`]: { gridColumn: '1 / -1', borderRight: 0 }, // nombre impair : dernière tuile pleine largeur
  [`${R} .ac-fact dt`]: { ...smallCaps, fontSize: '10px', opacity: 0.55 },
  [`${R} .ac-fact dd`]: { margin: 0, minWidth: 0, maxWidth: '100%', textAlign: 'center' },
  [`${R} .ac-value`]: { display: 'block', fontSize: '15px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' },
  [`${R} .ac-fact small`]: { ...muted, display: 'block', marginTop: '3px' },

  // ------------------------------------------------ Lignes simples (phases) : nom à gauche, date à droite
  [`${R} .ac-rows`]: { ...card, listStyle: 'none' },
  [`${R} .ac-row`]: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '8px 12px',
    margin: 0,
  },
  [`${R} .ac-row + .ac-row`]: { borderTop: `1px solid ${LINE}` },
  [`${R} .ac-row-value`]: { opacity: 0.8, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' },

  // ------------------------------------------------ Boutons
  [`${R} .ac-btn`]: {
    ...resetButton,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    height: '36px',
    padding: '0 12px',
    borderRadius: '8px',
    border: `1px solid ${CARD_BORDER}`,
    background: 'rgba(255, 255, 255, 0.05)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 120ms ease, border-color 120ms ease',
  },
  [`${R} .ac-btn:hover:not(:disabled)`]: { background: 'rgba(255, 255, 255, 0.1)' },
  [`${R} .ac-btn:disabled`]: { opacity: 0.4, cursor: 'not-allowed' },
  [`${R} .ac-btn:focus-visible, ${R} .ac-orbiter-head:focus-visible`]: { outline: `2px solid ${ACCENT}`, outlineOffset: '1px' },
  [`${R} .ac-segmented`]: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' },

  // ------------------------------------------------ Sondes : en-tête aligné + 3 colonnes de mesures
  [`${R} .ac-orbiters`]: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  [`${R} .ac-orbiter`]: { ...card, transition: 'border-color 150ms ease, box-shadow 150ms ease' },
  [`${R} .ac-orbiter.is-selected`]: {
    borderColor: 'color-mix(in srgb, var(--c) 55%, transparent)',
    boxShadow: '0 0 18px -8px var(--c)',
  },
  [`${R} .ac-orbiter-head`]: {
    ...resetButton,
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    cursor: 'pointer',
  },
  [`${R} .ac-orbiter-head:hover:not(:disabled)`]: { background: 'rgba(255, 255, 255, 0.04)' },
  [`${R} .ac-orbiter-head:disabled`]: { cursor: 'default', opacity: 0.6 },
  [`${R} .ac-dot`]: { width: '10px', height: '10px', borderRadius: '50%', background: 'var(--c)', boxShadow: '0 0 8px var(--c)' },
  [`${R} .ac-orbiter-name`]: { fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  [`${R} .ac-orbiter-agency`]: { ...muted, whiteSpace: 'nowrap' },
  [`${R} .ac-stats`]: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
    margin: 0,
    padding: '0 12px 10px 32px',
  },
  [`${R} .ac-stats > div`]: { minWidth: 0 },
  [`${R} .ac-stats dt`]: { ...smallCaps, fontSize: '10px', opacity: 0.5 },
  [`${R} .ac-stats dd`]: {
    margin: '2px 0 0',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  [`${R} .ac-orbiter .ac-hint`]: { padding: '0 12px 10px 32px' },

  // ------------------------------------------------ ShadowCam : tuiles de même taille, 2 colonnes
  [`${R} .ac-tiles`]: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },
  [`${R} .ac-tile`]: {
    height: 'auto',
    minHeight: '46px',
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '2px',
    padding: '6px 10px',
    textAlign: 'left',
  },
  [`${R} .ac-tile-name`]: { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  [`${R} .ac-tile small`]: muted,
};
