import { ACCENT, CARD_BG, LINE, R, card, muted } from './tokens';

export const controlStyles = {
  // ------------------------------------------------ Groupes de réglages
  [`${R} .ac-group-body`]: { ...card, display: 'flex', flexDirection: 'column' },
  [`${R} .ac-group-body > * + *`]: { borderTop: `1px solid ${LINE}` },
  [`${R} .ac-group-body > .ac-hint`]: { padding: '9px 12px' },

  // Interrupteur : texte à gauche, bouton aligné à droite sur toutes les lignes.
  [`${R} .ac-switch`]: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '12px',
    padding: '9px 12px',
    margin: 0,
    cursor: 'pointer',
  },
  [`${R} .ac-switch:hover`]: { background: 'rgba(255, 255, 255, 0.025)' },
  [`${R} .ac-switch.is-disabled`]: { cursor: 'default', opacity: 0.55 },
  [`${R} .ac-switch-text, ${R} .ac-option-text`]: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  [`${R} .ac-switch-label, ${R} .ac-option-label`]: { fontWeight: 500 },
  [`${R} .ac-switch small, ${R} .ac-option small`]: { ...muted, marginTop: '2px', overflowWrap: 'anywhere' },
  [`${R} .ac-toggle`]: {
    appearance: 'none',
    WebkitAppearance: 'none',
    position: 'relative',
    flex: 'none',
    width: '36px',
    height: '20px',
    margin: 0,
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.18)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  },
  [`${R} .ac-toggle::before`]: {
    content: '""',
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
    transition: 'transform 150ms ease',
  },
  [`${R} .ac-toggle:checked`]: { background: ACCENT },
  [`${R} .ac-toggle:checked::before`]: { transform: 'translateX(16px)' },
  [`${R} .ac-toggle:disabled`]: { cursor: 'default' },
  [`${R} .ac-toggle:focus-visible, ${R} .ac-radio:focus-visible`]: { outline: `2px solid ${ACCENT}`, outlineOffset: '2px' },

  // Choix de fond : pastille alignée à gauche, texte à droite.
  [`${R} .ac-option`]: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    alignItems: 'start',
    gap: '10px',
    padding: '9px 12px',
    margin: 0,
    cursor: 'pointer',
    transition: 'background-color 120ms ease',
  },
  [`${R} .ac-option:hover`]: { background: 'rgba(255, 255, 255, 0.025)' },
  [`${R} .ac-option.is-checked`]: { background: 'rgba(79, 195, 247, 0.08)' },
  [`${R} .ac-radio`]: {
    appearance: 'none',
    WebkitAppearance: 'none',
    display: 'grid',
    placeContent: 'center',
    flex: 'none',
    width: '16px',
    height: '16px',
    margin: '2px 0 0',
    borderRadius: '50%',
    border: '1.5px solid rgba(255, 255, 255, 0.4)',
    cursor: 'pointer',
  },
  [`${R} .ac-radio::before`]: {
    content: '""',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: ACCENT,
    transform: 'scale(0)',
    transition: 'transform 120ms ease',
  },
  [`${R} .ac-radio:checked`]: { borderColor: ACCENT },
  [`${R} .ac-radio:checked::before`]: { transform: 'scale(1)' },

  // ------------------------------------------------ État des cartes
  [`${R} .ac-status`]: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0,
    padding: '8px 12px',
    borderRadius: '8px',
    background: CARD_BG,
    fontSize: '12px',
    overflowWrap: 'anywhere',
  },
  [`${R} .ac-status-dot`]: { width: '8px', height: '8px', borderRadius: '50%', flex: 'none' },
  [`${R} .ac-status.is-ok .ac-status-dot`]: { background: '#49df8a' },
  [`${R} .ac-status.is-busy .ac-status-dot`]: { background: '#ffc857', animation: 'acPulse 1.2s ease-in-out infinite' },
  [`${R} .ac-status.is-bad`]: { color: '#ffb3ba' },
  [`${R} .ac-status.is-bad .ac-status-dot`]: { background: '#ff5b69' },

  // ================================================ Tactile : lignes d'au moins 44 px
  '@media (pointer: coarse)': {
    [`${R} .ac-switch, ${R} .ac-option, ${R} .ac-row, ${R} .ac-fact`]: { minHeight: '44px' },
    [`${R} .ac-btn`]: { height: '44px' },
    [`${R} .ac-orbiter-head`]: { minHeight: '48px' },
    [`${R} .ac-toggle`]: { width: '42px', height: '24px' },
    [`${R} .ac-toggle::before`]: { width: '20px', height: '20px' },
    [`${R} .ac-toggle:checked::before`]: { transform: 'translateX(18px)' },
    [`${R} .ac-radio`]: { width: '20px', height: '20px', margin: 0 },
    [`${R} .ac-option`]: { alignItems: 'center' },
  },

  // ================================================ Téléphone étroit : fiche sur une colonne
  '@media (max-width: 480px)': {
    [`${R} .ac-stats, ${R} .ac-orbiter .ac-hint`]: { paddingLeft: '12px' },
  },

  '@media (prefers-reduced-motion: reduce)': {
    [`${R} .ac-status.is-busy .ac-status-dot`]: { animation: 'none' },
  },
};
