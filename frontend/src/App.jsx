import { CssBaseline, ThemeProvider } from '@mui/material';
import SolarSystem from './components/SolarSystem';
import { SceneStyles } from './theme/SceneStyles';
import { theme } from './theme/theme';

// Thème Material Design sombre pour toute l'app ; `SceneStyles` habille les éléments que le moteur 3D crée lui-même.
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <SceneStyles />
      <SolarSystem />
    </ThemeProvider>
  );
}
