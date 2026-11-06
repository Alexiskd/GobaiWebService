import { createTheme } from '@mui/material';

/**
 * Thème Material Design sombre de toute l'application.
 * Les panneaux flottent au-dessus de la scène 3D : fond légèrement translucide et flou pour garder le globe visible.
 * Les niveaux d'empilement (`zIndex`) placent le HUD sous les fenêtres et les dialogues MUI.
 */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#05070d', paper: '#121621' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontSize: 14,
    button: { textTransform: 'none', fontWeight: 600 },
  },
  zIndex: {
    // Repères de l'application (les valeurs MUI des menus, dialogues et alertes restent au-dessus).
    hud: 20,
    hudPanel: 30,
    toolbar: 40,
    panel: 70,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(18, 22, 33, 0.9)',
          backdropFilter: 'blur(14px)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { backgroundColor: '#121621' } },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTooltip: { defaultProps: { enterDelay: 400 } },
    MuiListSubheader: {
      styleOverrides: { root: { backgroundColor: 'transparent', lineHeight: '32px' } },
    },
  },
});
