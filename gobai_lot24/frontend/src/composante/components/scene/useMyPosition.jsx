// Importe de React les crochets useCallback, useEffect et useSyncExternalStore.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
// Importe le nom du lieu « Ma position », l'altitude d'arrivée, le message d'erreur de géolocalisation et la lecture unique de la boussole.
import { MY_POSITION_NAME, flyAltitude, geolocationMessage, readCompassOnce } from '@/moteur/lib/homePlace';
// Importe livePosition, le suivi de la position en direct.
import { livePosition } from '@/moteur/lib/livePosition';
// Importe compassHeading, qui calcule le cap à partir d'un événement d'orientation.
import { compassHeading } from '@/moteur/engine/userMarkerMath';

/**
 * « Ma position » : position de l'appareil suivie en direct (point bleu qui se déplace) et zoom d'arrivée dessus.
 * `goToMe` doit partir d'un appui (condition de Safari pour demander l'autorisation). La position reste sur l'appareil.
 *
 * @param showPosition (point | null) → pose le point bleu (moteur)
 * @param goPlace      (lieu) → déplace la caméra (moteur, engine.goTo)
 * @param push         message à l'écran en cas de refus ou d'échec
 */
// Déclare et exporte le crochet useMyPosition : reçoit les trois fonctions décrites ci-dessus.
export function useMyPosition({ showPosition, goPlace, push }) {
  // Lit l'état du suivi et s'y abonne.
  const state = useSyncExternalStore(livePosition.subscribe, livePosition.getState, livePosition.getState);
  // Vrai quand le suivi est en cours.
  const live = state.status === 'on';

  // Chaque nouvelle mesure déplace le point bleu ; à l'arrêt, le dernier point reste, sans l'onde du direct.
  // Effet relancé à chaque nouvelle mesure.
  useEffect(() => {
    // S'il y a un point, le pose sur la scène, avec l'indicateur de direct.
    if (state.point) showPosition({ ...state.point, live });
  // Fin de l'effet ; dépendances : le point, le direct et la fonction d'affichage.
  }, [state.point, live, showPosition]);

  // Autorisation déjà donnée à ce site : le point s'affiche dès l'ouverture, sans demande ni déplacement de la vue.
  // Le suivi s'arrête avec la page.
  // Effet exécuté une seule fois, au montage.
  useEffect(() => {
    // Reprend le suivi si l'autorisation a déjà été donnée.
    livePosition.resumeIfAllowed();
    // Nettoyage : arrête le suivi au démontage.
    return () => livePosition.stop();
  // Fin de l'effet ; aucune dépendance.
  }, []);

  // `toast: false` : l'appelant affiche lui-même le message d'échec (fenêtre des paramètres).
  // goToMe : va à la position de l'appareil ; l'option toast (vraie par défaut) affiche le message d'échec.
  const goToMe = useCallback(async ({ toast = true } = {}) => {
    // Cap du téléphone pour le cône du point bleu : demandé pendant l'appui, lu une fois, jamais bloquant.
    // Lit l'angle de rotation de l'écran, 0 à défaut.
    const screenAngle = globalThis.screen?.orientation?.angle ?? 0;
    // Demande une lecture unique de la boussole, convertie en cap.
    const compass = readCompassOnce((event) => compassHeading(event, screenAngle));
    // Début du bloc protégé : la géolocalisation peut être refusée.
    try {
      // Lance le suivi et attend la première position.
      const point = await livePosition.start();
      // Téléportation à la verticale de la position, puis zoom d'arrivée ; la caméra suit ensuite les déplacements.
      // Déplace la caméra vers cette position, à une altitude choisie selon la précision, avec suivi et vol d'arrivée.
      goPlace({ name: MY_POSITION_NAME, lat: point.lat, lon: point.lon, altitudeM: flyAltitude(point.accuracyM), follow: true, fly: true });
      // Quand le cap arrive, s'il est connu, le transmet au suivi.
      compass.then((headingDeg) => { if (headingDeg !== null) livePosition.setCompass(headingDeg); });
      // Réussite.
      return { ok: true };
    // En cas de refus ou d'échec.
    } catch (error) {
      // Construit le message d'erreur.
      const message = geolocationMessage(error);
      // L'affiche pendant 7 secondes, sauf si l'appelant s'en charge.
      if (toast !== false) push?.(message, 'error', 7000);
      // Échec, avec son message.
      return { ok: false, message };
    // Fin du bloc try/catch.
    }
  // Fin de goToMe ; dépendances : goPlace et push.
  }, [goPlace, push]);

  // stop : arrête le suivi ; fonction stable.
  const stop = useCallback(() => livePosition.stop(), []);

  // Renvoie l'état du direct, l'attente, le point et les deux fonctions.
  return { live, waiting: state.status === 'waiting', point: state.point, goToMe, stop };
// Fin de useMyPosition.
}
