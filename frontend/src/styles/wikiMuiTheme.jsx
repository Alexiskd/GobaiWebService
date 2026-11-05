import { createTheme } from '@mui/material';
import { RADIUS, SANS, SERIF, W, box, btn, btnActive, btnHover, btnPressed } from './responsiveWiki';

// Thème MUI clair « encyclopédie » : mêmes jetons que les styles globaux (responsiveWiki), pour les composantes MUI
// (visionneuse LiDAR, et toute composante MUI future via le ThemeProvider de App).

/** Boîte blanche prête pour `sx` (Paper, Box). */
export const wikiBox = { ...box };

export const wikiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: W.ink, contrastText: '#fff' },
    secondary: { main: W.inkSubtle, contrastText: '#fff' },
    error: { main: W.error },
    background: { paper: W.bg, default: W.bg },
    text: { primary: W.ink, secondary: W.inkSubtle },
    divider: W.borderSubtle,
  },
  typography: {
    fontSize: 13,
    fontFamily: SANS,
    h6: { fontFamily: SERIF, fontWeight: 400 },
    button: { textTransform: 'none', fontWeight: 700 },
    overline: { letterSpacing: '0.06em', fontWeight: 700 },
  },
  shape: { borderRadius: 2 },
  components: {
    MuiPaper: { styleOverrides: { root: { ...box } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { ...btn, '&:hover': btnHover, '&:active': btnActive },
        contained: { ...btnPressed, '&:hover': { background: '#404244', color: '#fff' } },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          ...btn, fontWeight: 400,
          '&:hover': { background: W.neutral },
          '&.Mui-selected, &.Mui-selected:hover': btnPressed,
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { color: W.ink, borderRadius: RADIUS, '&:hover': { background: W.neutral } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: RADIUS }, outlined: { borderColor: W.border, background: W.subtle } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          background: W.bg,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: W.border },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: W.ink, borderWidth: 2 },
        },
      },
    },
    MuiTooltip: { styleOverrides: { tooltip: { background: W.ink, borderRadius: RADIUS, fontSize: '0.8rem' } } },
    MuiLinearProgress: { styleOverrides: { root: { background: W.neutral }, bar: { background: W.ink } } },
    MuiSlider: { styleOverrides: { root: { color: W.ink } } },
    MuiSwitch: { styleOverrides: { switchBase: { '&.Mui-checked + .MuiSwitch-track': { backgroundColor: W.ink, opacity: 1 } } } },
  },
});
