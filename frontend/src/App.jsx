import { ThemeProvider } from '@mui/material';
import SolarSystem from './components/SolarSystem';
import { crayonTheme } from './styles/crayonMuiTheme';

// Thème MUI « crayon » pour toute l'app (les styles globaux du même thème sont dans styles/responsiveCrayon).
export default function App() {
  return (
    <ThemeProvider theme={crayonTheme}>
      <SolarSystem />
    </ThemeProvider>
  );
}
