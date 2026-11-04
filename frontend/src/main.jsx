import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Pas de <StrictMode> : le moteur WebGL (textures 8192 px, routes) est coûteux à initialiser.
createRoot(document.getElementById('root')).render(<App />);
