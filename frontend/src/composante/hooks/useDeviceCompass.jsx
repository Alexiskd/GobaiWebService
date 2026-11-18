// Importe de React les crochets useCallback, useEffect, useRef et useState.
import { useCallback, useEffect, useRef, useState } from 'react';
// Importe les lecteurs des deux sensibilités d'inclinaison (déplacement et zoom).
import { getTiltSensitivity, getTiltZoomSensitivity } from '@/moteur/lib/tiltSensitivity';
// Importe les calculs purs du pilotage : inclinaison avant/arrière, bascule latérale, lissage, vitesse de déplacement, facteur de zoom.
import { devicePitchDeg, deviceRollDeg, smoothValue, tiltPanRate, tiltZoomFactor } from '@/moteur/engine/deviceCompassMath';

// screenAngle : angle de rotation de l'écran (API moderne, sinon ancienne propriété, sinon 0).
const screenAngle = () => globalThis.screen?.orientation?.angle ?? globalThis.orientation ?? 0;

/**
 * Pilotage de la caméra en penchant le téléphone (gyroscope), par rapport à la façon dont on le tenait en activant.
 * Deux modes, jamais ensemble :
 *  - 'arrow' (bouton ⬆️) : zoom uniquement, pencher vers l'avant zoome, vers l'arrière dézoome ;
 *  - 'ship' (bouton 🚀) : le même zoom, et en plus pencher à droite ou à gauche déplace la vue horizontalement.
 * Plus on penche, plus ça va vite ; revenir à la tenue de départ arrête le mouvement.
 * Sur iPhone, Safari exige une autorisation demandée depuis un appui : `start` doit venir d'un bouton.
 * Renvoie { available, mode, start, stop } ; `start(mode)` résout à true si le pilotage est lancé.
 */
// Déclare et exporte le crochet useDeviceCompass : reçoit le moteur et la fonction d'affichage des messages.
export function useDeviceCompass({ engine, push }) {
  // État : le mode de pilotage en cours.
  const [mode, setMode] = useState(null); // null | 'arrow' | 'ship'
  // Référence : le mode courant, lisible depuis la boucle d'animation.
  const modeRef = useRef(null);
  // Référence : la fonction d'arrêt du pilotage en cours, null s'il n'y en a pas.
  const cleanup = useRef(null);
  // Référence : la fonction qui reprend la tenue actuelle du téléphone comme référence.
  const recenter = useRef(null);
  // Disponible s'il y a une fenêtre, des événements d'orientation et un écran tactile.
  const available = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && (navigator.maxTouchPoints || 0) > 0;

  // stop : arrête le pilotage ; début de la fonction mémorisée.
  const stop = useCallback(() => {
    // Appelle la fonction d'arrêt, s'il y en a une.
    cleanup.current?.();
    // Oublie la fonction d'arrêt.
    cleanup.current = null;
    // Oublie la fonction de recentrage.
    recenter.current = null;
    // Plus aucun mode en cours dans la référence.
    modeRef.current = null;
    // Plus aucun mode en cours dans l'état.
    setMode(null);
  // Fin de stop ; fonction stable.
  }, []);

  // start : lance le pilotage dans le mode demandé ; début de la fonction asynchrone mémorisée.
  const start = useCallback(async (next) => {
    // Refuse s'il n'y a pas de moteur ou si le mode n'est ni « arrow » ni « ship ».
    if (!engine || (next !== 'arrow' && next !== 'ship')) return false;
    // Déjà lancé : on change seulement de mode, et la tenue actuelle du téléphone devient la nouvelle référence.
    // Si un pilotage est déjà en cours.
    if (cleanup.current) {
      // Change le mode lu par la boucle.
      modeRef.current = next;
      // Reprend la tenue actuelle du téléphone comme référence.
      recenter.current?.();
      // Met l'état à jour.
      setMode(next);
      // Pilotage lancé.
      return true;
    // Fin du cas « déjà lancé ».
    }
    // Récupère la classe des événements d'orientation.
    const Orientation = window.DeviceOrientationEvent;
    // Début du bloc protégé : la demande d'autorisation peut échouer.
    try {
      // iOS 13+ : autorisation explicite, à demander pendant l'appui.
      // Si le navigateur exige une autorisation et qu'elle n'est pas accordée.
      if (typeof Orientation?.requestPermission === 'function' && (await Orientation.requestPermission()) !== 'granted') {
        // Affiche un avertissement de 9 secondes qui explique comment autoriser les capteurs.
        push?.('Capteurs refusés : autorisez « Mouvement et orientation » pour ce site dans les réglages de Safari.', 'warn', 9000);
        // Pilotage non lancé.
        return false;
      // Fin du cas « autorisation refusée ».
      }
    // En cas d'erreur pendant la demande.
    } catch (e) {
      // Affiche l'erreur pendant 9 secondes.
      push?.(`Capteurs du téléphone indisponibles : ${e?.message || e}.`, 'error', 9000);
      // Pilotage non lancé.
      return false;
    // Fin du bloc try/catch.
    }
    // Si un pilotage a démarré entre-temps, on s'arrête là.
    if (cleanup.current) return true; // un autre appui a démarré pendant la demande d'autorisation
    // Inclinaison avant/arrière lissée, inconnue au départ.
    let pitch = null;
    // Inclinaison de référence avant/arrière.
    let neutral = null;     // tenue du téléphone à l'activation : référence avant/arrière
    // Bascule latérale lissée, inconnue au départ.
    let roll = null;
    // Bascule latérale de référence.
    let neutralRoll = null; // idem pour la bascule latérale : référence droite/gauche
    // Devient vrai dès qu'une mesure est reçue.
    let got = false;
    // Déclare onOrientation, appelé à chaque mesure des capteurs.
    const onOrientation = (event) => {
      // Lit l'angle de rotation de l'écran.
      const angle = screenAngle();
      // Calcule l'inclinaison avant/arrière en degrés, selon la rotation de l'écran.
      const tilt = devicePitchDeg(event, angle);
      // Si la mesure est exploitable.
      if (tilt != null) {
        // Note que les capteurs répondent.
        got = true;
        // Lisse la mesure avec la valeur précédente.
        pitch = smoothValue(pitch, tilt);
        // La première mesure sert de référence.
        if (neutral == null) neutral = pitch;
      // Fin du traitement de l'inclinaison avant/arrière.
      }
      // Calcule la bascule latérale en degrés.
      const side = deviceRollDeg(event, angle);
      // Si la mesure est exploitable.
      if (side != null) {
        // Lisse la mesure avec la valeur précédente.
        roll = smoothValue(roll, side);
        // La première mesure sert de référence.
        if (neutralRoll == null) neutralRoll = roll;
      // Fin du traitement de la bascule latérale.
      }
    // Fin de onOrientation.
    };
    // Recentrage : la tenue actuelle devient la référence sur les deux axes.
    recenter.current = () => { neutral = pitch; neutralRoll = roll; };
    // Mouvement continu tant que le téléphone reste penché : appliqué à chaque image, à vitesse indépendante de l'écran.
    // Identifiant de la prochaine image d'animation.
    let raf = 0;
    // Instant de l'image précédente.
    let last = performance.now();
    // Déclare loop, appelée à chaque image.
    const loop = (now) => {
      // Programme l'image suivante et garde son identifiant.
      raf = requestAnimationFrame(loop);
      // Temps écoulé depuis l'image précédente, en secondes, plafonné à 0,1 s.
      const dt = Math.min(0.1, (now - last) / 1000);
      // Mémorise l'instant de cette image.
      last = now;
      // Réglettes (Paramètres, navball), lues en direct : une pour avancer / reculer, une pour droite / gauche.
      // Lit la sensibilité du déplacement latéral.
      const sensitivity = getTiltSensitivity();
      // Avant / arrière : zoom, dans les deux modes.
      // Écart d'inclinaison avec la référence ; 0 tant qu'une mesure manque.
      const lean = pitch != null && neutral != null ? pitch - neutral : 0;
      // Facteur de zoom selon l'écart, le temps écoulé et la sensibilité du zoom.
      const f = tiltZoomFactor(lean, dt, getTiltZoomSensitivity());
      // Applique le zoom s'il change quelque chose (facteur différent de 1).
      if (f !== 1) engine.zoom(f);
      // Droite / gauche : déplacement horizontal, seulement avec le vaisseau (la flèche ne fait que zoomer).
      // Seulement en mode vaisseau, et si la bascule latérale est connue.
      if (modeRef.current === 'ship' && roll != null && neutralRoll != null) {
        // Déplace la vue horizontalement : vitesse selon la bascule et la sensibilité, multipliée par le temps écoulé.
        engine.moveBy(tiltPanRate(roll - neutralRoll, sensitivity) * dt, 0);
      // Fin du déplacement latéral.
      }
    // Fin de loop.
    };
    // Enregistre le mode demandé pour la boucle.
    modeRef.current = next;
    // Lance la boucle d'animation.
    raf = requestAnimationFrame(loop);
    // Écoute les mesures d'orientation du téléphone.
    window.addEventListener('deviceorientation', onOrientation);
    // Programme une vérification dans 3 secondes.
    const timer = setTimeout(() => {
      // Si aucune mesure n'est arrivée, affiche un avertissement de 9 secondes.
      if (!got) push?.('Les capteurs de mouvement du téléphone ne répondent pas.', 'warn', 9000);
    // Fin de la vérification ; délai de 3 000 ms.
    }, 3000);
    // Définit la fonction d'arrêt de ce pilotage.
    cleanup.current = () => {
      // Annule la vérification programmée.
      clearTimeout(timer);
      // Retire l'écouteur d'orientation.
      window.removeEventListener('deviceorientation', onOrientation);
      // Arrête la boucle d'animation.
      cancelAnimationFrame(raf);
    // Fin de la fonction d'arrêt.
    };
    // Met l'état à jour avec le mode lancé.
    setMode(next);
    // Pilotage lancé.
    return true;
  // Fin de start ; recréée si le moteur ou la fonction de messages change.
  }, [engine, push]);

  // Moteur recréé ou composante démontée : on lâche le pilotage.
  // Effet dont le nettoyage est stop : exécuté quand le moteur change ou au démontage.
  useEffect(() => stop, [engine, stop]);

  // Renvoie la disponibilité, le mode en cours et les deux fonctions.
  return { available, mode, start, stop };
// Fin de useDeviceCompass.
}
