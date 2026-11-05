// Thème clair (encyclopédie) : noir pour l'accent, gris Codex pour filets et encadrés.
export const ACCENT = '#202122';
export const LINE = '#eaecf0';
export const CARD_BG = '#f8f9fa';
export const CARD_BORDER = '#c8ccd1';
export const R = 'html .ac'; // portée : uniquement le contenu de ces deux composantes

export const card = {
  margin: 0,
  padding: 0,
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: '2px',
  overflow: 'hidden',
};
export const smallCaps = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.6,
};
export const muted = { fontSize: '11px', opacity: 0.55, lineHeight: 1.35 };
export const resetButton = {
  appearance: 'none',
  WebkitAppearance: 'none',
  margin: 0,
  border: 0,
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
};
