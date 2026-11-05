import { createTheme } from '@mui/material';
import {
  GRAIN, HATCH_DENSE, SKETCH, SKETCH_SM, T, boxFill, boxStroke, btn, btnActive, btnHover, btnPressed, field,
} from './responsiveCrayon';

// Thème MUI « crayon » : mêmes jetons que les styles globaux (responsiveCrayon), pour les composantes MUI
// (visionneuse LiDAR, et toute composante MUI future via le ThemeProvider de App).

/** Boîte crayon prête pour `sx` (Paper, Box) : fond bleu hachuré, double trait blanc. */
export const crayonBox = { ...boxFill, ...boxStroke, color: T.ink };

export const crayonTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#f7f9ff', contrastText: T.blueDeep },
    secondary: { main: '#ffd36b', contrastText: T.blueDeep },
    background: { paper: T.blueDeep, default: T.blueNight },
    text: { primary: T.ink, secondary: T.inkDim },
    divider: 'rgba(255, 255, 255, 0.22)',
  },
  typography: {
    fontSize: 13,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    button: { fontFamily: 'var(--crayon-font)', textTransform: 'none', fontSize: '0.95rem', letterSpacing: '0.02em' },
    overline: { fontFamily: 'var(--crayon-font)', fontSize: '0.8rem', letterSpacing: '0.1em' },
    h6: { fontFamily: 'var(--crayon-font)', fontWeight: 400 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper: { styleOverrides: { root: { ...crayonBox, backgroundColor: T.blueDeep } } },
    MuiButton: {
      styleOverrides: {
        root: { ...btn, '&:hover': btnHover, '&:active': btnActive, '&.Mui-disabled': { opacity: 0.42, color: T.ink } },
        contained: btnPressed,
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          ...btn,
          boxShadow: 'none',
          '&:hover': { backgroundColor: 'rgba(36, 82, 160, 0.85)' },
          '&.Mui-selected, &.Mui-selected:hover': btnPressed,
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { color: T.ink, '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.12)' } } } },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: 'var(--crayon-font)', borderRadius: SKETCH_SM, backgroundImage: HATCH_DENSE },
        outlined: { borderColor: T.stroke, borderWidth: 1.5 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { ...field, border: 0, '& .MuiOutlinedInput-notchedOutline': { border: `2px solid ${T.strokeSoft}`, borderRadius: SKETCH_SM } },
      },
    },
    MuiSelect: { styleOverrides: { icon: { color: T.ink } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: SKETCH_SM } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { ...boxFill, border: `1.5px solid ${T.stroke}`, borderRadius: SKETCH_SM, fontFamily: 'var(--crayon-font)', fontSize: '0.85rem' },
      },
    },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.15)', backgroundImage: GRAIN } } },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(255, 255, 255, 0.22)', borderStyle: 'dashed' } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: SKETCH } } },
  },
});
