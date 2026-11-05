import { ThemeProvider } from '@mui/material';
import SolarSystem from './components/SolarSystem';
import { wikiTheme } from './styles/wikiMuiTheme';

// Thème MUI clair « encyclopédie » pour toute l'app (les styles globaux du même thème sont dans styles/responsiveWiki).
export default function App() {
  return (
    <ThemeProvider theme={wikiTheme}>
      <SolarSystem />
    </ThemeProvider>
  );
}
