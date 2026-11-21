/** Compatibilité avec le moteur 3D historique : calcul entièrement offline. */
import { calculateOfflineOrbitPosition } from './offlineEphemeris.jsx';
export function calculateOrbitPosition(body, timeMs = Date.now()) {
  return calculateOfflineOrbitPosition(body, timeMs);
}
