import { createTheme } from '@mui/material';

const BRAND = {
  blue: '#8BAEFF',
  blueLight: '#B5CAFF',
  blueDark: '#5E82D5',
  violet: '#B39AFF',
  cyan: '#70DCEB',
  mint: '#5AD9B3',
};

const SURFACES = {
  oled: {
    mode: 'dark',
    paper: 'rgba(4, 8, 18, 0.94)',
    solid: '#05070D',
    edge: 'rgba(177, 199, 255, 0.17)',
    divider: 'rgba(177, 199, 255, 0.14)',
    text: '#F4F7FF',
    textSoft: '#9DAAC4',
  },
  night: {
    mode: 'dark',
    paper: 'rgba(12, 20, 39, 0.91)',
    solid: '#101A31',
    edge: 'rgba(159, 185, 255, 0.16)',
    divider: 'rgba(159, 185, 255, 0.14)',
    text: '#F3F6FF',
    textSoft: '#A6B2CC',
  },
  day: {
    mode: 'light',
    paper: 'rgba(249, 251, 255, 0.96)',
    solid: '#E9EFF8',
    edge: 'rgba(43, 66, 110, 0.14)',
    divider: 'rgba(43, 66, 110, 0.14)',
    text: '#19243A',
    textSoft: '#58677F',
  },
};

const PRESS = {
  '@media (pointer: coarse)': { minWidth: 44, minHeight: 44 },
  '&:active': { transform: 'scale(0.975)' },
  '@media (prefers-reduced-motion: reduce)': { '&:active': { transform: 'none' } },
};

const surfaces = (dayNight, oled) => dayNight === 'day' ? SURFACES.day : oled ? SURFACES.oled : SURFACES.night;

export const statusBarColor = (dayNight = 'night', { oled = false } = {}) => surfaces(dayNight, oled).solid;

/**
 * Thème Material UI partagé par toutes les surfaces Gobai Space.
 * La scène reste noire ; les panneaux, formulaires, menus et dialogues suivent les tokens de couleur ci-dessous.
 */
export function makeTheme(dayNight = 'night', { oled = false } = {}) {
  const s = surfaces(dayNight, oled);
  const dark = s.mode === 'dark';
  const field = dark ? 'rgba(255,255,255,0.045)' : 'rgba(25,45,78,0.035)';
  const hover = dark ? 'rgba(139,174,255,0.10)' : 'rgba(75,112,183,0.08)';
  const focus = dark ? 'rgba(139,174,255,0.25)' : 'rgba(66,112,204,0.18)';

  return createTheme({
    palette: {
      mode: s.mode,
      primary: { main: BRAND.blue, light: BRAND.blueLight, dark: BRAND.blueDark, contrastText: '#08152C' },
      secondary: { main: BRAND.violet, light: '#D3C5FF', dark: '#8970D2', contrastText: '#17112C' },
      success: { main: BRAND.mint },
      info: { main: BRAND.cyan },
      warning: { main: '#F3C66D' },
      error: { main: '#FF8294' },
      background: { default: '#05070D', paper: s.solid },
      text: { primary: s.text, secondary: s.textSoft, disabled: dark ? '#68758E' : '#8B96A9' },
      divider: s.divider,
      action: {
        hover,
        selected: focus,
        disabledOpacity: 0.42,
        focus: focus,
      },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Google Sans", "Roboto", "Helvetica", "Arial", var(--i18n-font, "Arial"), sans-serif',
      fontSize: 14,
      h1: { fontSize: '2.35rem', lineHeight: 1.12, fontWeight: 750, letterSpacing: '-0.045em' },
      h2: { fontSize: '1.85rem', lineHeight: 1.2, fontWeight: 730, letterSpacing: '-0.035em' },
      h3: { fontSize: '1.4rem', lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.025em' },
      h4: { fontSize: '1.2rem', lineHeight: 1.3, fontWeight: 700 },
      h5: { fontSize: '1.05rem', lineHeight: 1.35, fontWeight: 650 },
      h6: { fontSize: '0.94rem', lineHeight: 1.4, fontWeight: 650 },
      subtitle1: { fontSize: '0.98rem', lineHeight: 1.45, fontWeight: 650 },
      subtitle2: { fontSize: '0.86rem', lineHeight: 1.4, fontWeight: 650 },
      body1: { fontSize: '0.94rem', lineHeight: 1.6 },
      body2: { fontSize: '0.84rem', lineHeight: 1.55 },
      caption: { fontSize: '0.72rem', lineHeight: 1.45, letterSpacing: '0.01em' },
      overline: { fontSize: '0.67rem', lineHeight: 1.5, fontWeight: 700, letterSpacing: '0.13em' },
      button: { fontSize: '0.84rem', textTransform: 'none', fontWeight: 680, letterSpacing: '0.005em' },
    },
    zIndex: {
      hud: 20,
      hudPanel: 30,
      toolbar: 40,
      panel: 70,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { minHeight: '100%', backgroundColor: '#05070D' },
          body: {
            minHeight: '100%',
            backgroundColor: '#05070D',
            color: s.text,
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
          '::selection': { background: 'rgba(139,174,255,0.34)', color: s.text },
          '*': { scrollbarColor: dark ? 'rgba(151,174,220,0.28) transparent' : 'rgba(63,86,126,0.24) transparent' },
          '*:focus-visible': { outline: `2px solid ${BRAND.blue}`, outlineOffset: '2px' },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { scrollBehavior: 'auto !important', animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: s.paper,
            backdropFilter: 'blur(18px) saturate(135%)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
            border: `1px solid ${s.edge}`,
          },
          rounded: { borderRadius: 16 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: s.paper,
            border: `1px solid ${s.edge}`,
            borderRadius: 18,
            boxShadow: '0 12px 30px rgba(0,0,0,0.10)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: false },
        styleOverrides: {
          root: {
            minHeight: 40,
            borderRadius: 12,
            paddingInline: 16,
            fontWeight: 680,
            transition: 'transform 150ms ease, background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
            ...PRESS,
          },
          containedPrimary: {
            color: '#08152C',
            background: 'linear-gradient(135deg, #AFC5FF 0%, #82A7FF 58%, #8C9BFF 100%)',
            boxShadow: '0 7px 22px rgba(98,132,215,0.22)',
            '&:hover': { background: 'linear-gradient(135deg, #C1D1FF 0%, #93B3FF 58%, #A5B0FF 100%)', boxShadow: '0 10px 26px rgba(98,132,215,0.30)' },
          },
          outlined: { borderColor: s.edge, '&:hover': { borderColor: BRAND.blue, backgroundColor: hover } },
          text: { '&:hover': { backgroundColor: hover } },
          sizeSmall: { minHeight: 34, paddingInline: 12, borderRadius: 10 },
          sizeLarge: { minHeight: 48, paddingInline: 20, borderRadius: 14 },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 12, ...PRESS } } },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderColor: s.edge,
            borderRadius: '10px !important',
            textTransform: 'none',
            fontWeight: 650,
            '&.Mui-selected': { color: 'primary.main', backgroundColor: hover },
            ...PRESS,
          },
        },
      },
      MuiTextField: { defaultProps: { variant: 'outlined', fullWidth: true, size: 'medium' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: 12,
            backgroundColor: field,
            transition: 'background-color 160ms ease, box-shadow 160ms ease',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: dark ? 'rgba(173,195,245,0.40)' : 'rgba(57,83,129,0.34)' },
            '&.Mui-focused': { backgroundColor: dark ? 'rgba(139,174,255,0.075)' : 'rgba(91,132,211,0.055)', boxShadow: `0 0 0 4px ${focus}` },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.blue, borderWidth: 1 },
          },
          notchedOutline: { borderColor: s.edge },
          input: { padding: '13px 14px', '&::placeholder': { opacity: 0.68 } },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontWeight: 550, '&.Mui-focused': { color: BRAND.blue } } } },
      MuiFormHelperText: { styleOverrides: { root: { marginInline: 2, marginTop: 5 } } },
      MuiFormLabel: { styleOverrides: { root: { '&.Mui-focused': { color: BRAND.blue } } } },
      MuiChip: {
        styleOverrides: {
          root: { height: 28, borderRadius: 9, fontWeight: 650, backgroundColor: hover },
          label: { paddingInline: 10 },
          outlined: { borderColor: s.edge },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 13, alignItems: 'flex-start', border: `1px solid ${s.edge}` },
          icon: { paddingTop: 3 },
          message: { minWidth: 0, lineHeight: 1.5 },
          standardInfo: { backgroundColor: dark ? 'rgba(112,220,235,0.09)' : 'rgba(42,158,178,0.08)' },
          standardSuccess: { backgroundColor: dark ? 'rgba(90,217,179,0.09)' : 'rgba(36,155,119,0.08)' },
          standardWarning: { backgroundColor: dark ? 'rgba(243,198,109,0.09)' : 'rgba(194,137,40,0.08)' },
          standardError: { backgroundColor: dark ? 'rgba(255,130,148,0.09)' : 'rgba(200,65,87,0.07)' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: s.solid,
            backgroundImage: dark ? 'linear-gradient(145deg, rgba(35,53,91,0.45), rgba(8,13,27,0.96))' : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(232,239,249,0.98))',
            border: `1px solid ${s.edge}`,
            borderRadius: 20,
            boxShadow: '0 24px 80px rgba(0,0,0,0.38)',
          },
        },
      },
      MuiDrawer: { styleOverrides: { paper: { backgroundColor: s.solid, backgroundImage: 'none', borderColor: s.edge } } },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 14, marginTop: 6, backgroundColor: s.solid } } },
      MuiMenuItem: {
        styleOverrides: {
          root: { minHeight: 42, borderRadius: 9, marginInline: 5, '&.Mui-selected': { backgroundColor: hover }, '&:hover': { backgroundColor: hover } },
        },
      },
      MuiTabs: { styleOverrides: { root: { minHeight: 42 }, indicator: { height: 3, borderRadius: 6, background: `linear-gradient(90deg, ${BRAND.blue}, ${BRAND.violet})` } } },
      MuiTab: { styleOverrides: { root: { minHeight: 42, textTransform: 'none', fontWeight: 650, color: s.textSoft, '&.Mui-selected': { color: s.text } } } },
      MuiDivider: { styleOverrides: { root: { borderColor: s.divider } } },
      MuiTooltip: { defaultProps: { enterDelay: 350, arrow: true }, styleOverrides: { tooltip: { borderRadius: 9, backgroundColor: '#17233E', color: '#F4F7FF', border: '1px solid rgba(177,199,255,0.16)', fontSize: '0.72rem' } } },
      MuiListSubheader: { styleOverrides: { root: { backgroundColor: 'transparent', lineHeight: '34px', fontWeight: 700, color: s.textSoft } } },
      MuiListItemButton: { styleOverrides: { root: { borderRadius: 11, '&:hover': { backgroundColor: hover }, '&.Mui-selected': { backgroundColor: hover } } } },
      MuiTableCell: { styleOverrides: { root: { borderColor: s.divider }, head: { fontWeight: 700, color: s.textSoft } } },
      MuiAvatar: { styleOverrides: { root: { fontWeight: 750, background: 'linear-gradient(145deg, #8BAEFF, #B39AFF)', color: '#101A31' } } },
      MuiSwitch: { styleOverrides: { track: { borderRadius: 10 }, thumb: { boxShadow: '0 2px 5px rgba(0,0,0,0.22)' } } },
      MuiCheckbox: { styleOverrides: { root: { borderRadius: 7, ...PRESS } } },
      MuiRadio: { styleOverrides: { root: { ...PRESS } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 99, backgroundColor: hover }, bar: { borderRadius: 99, background: `linear-gradient(90deg, ${BRAND.blue}, ${BRAND.violet})` } } },
      MuiSkeleton: { styleOverrides: { root: { backgroundColor: hover } } },
    },
  });
}

export const theme = makeTheme('night');
