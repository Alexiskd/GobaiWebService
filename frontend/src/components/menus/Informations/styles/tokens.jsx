export const ACCENT = '#4fc3f7';
export const LINE = 'rgba(255, 255, 255, 0.07)';
export const CARD_BG = 'rgba(255, 255, 255, 0.035)';
export const CARD_BORDER = 'rgba(255, 255, 255, 0.08)';
export const R = 'html .ac'; // portée : uniquement le contenu de ces deux composantes

export const card = {
  margin: 0,
  padding: 0,
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: '10px',
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
