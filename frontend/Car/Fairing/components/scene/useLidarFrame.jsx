// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe le rayon de la Terre en mètres et la conversion repère de la Terre → degrés (voir gpsState).
import { EARTH_RADIUS_M, toLonLat } from '@/Engine/AstreSolideEngine/InputEngine/gps';
// Importe l'ouverture du cadre, la conversion ECEF et le changement de base du quaternion, la construction de
// l'adresse et les seuils de rechargement.
import { LIDAR_FRAME_RELOAD_MS, cameraEcefQuat, cameraMoved, lidarFrameUrl, shouldShowFrame } from '@/Engine/AstreSolideEngine/LidarEngine/lidarFrameMath.js';

// Visionneuse LiDAR HD de l'IGN en cadre, sous la scène : la caméra de Gobai survole Paris à moins de 0,22 km
// d'altitude, l'adresse de la visionneuse est reconstruite à sa position (ECEF) et son orientation (quaternion,
// convention three.js supposée côté IGN). L'iframe ne se recharge pas à chaque image : seulement quand la caméra
// a bougé (25 m ou 3°, voir lidarFrameMath.js) et après au moins LIDAR_FRAME_RELOAD_MS.

// L'intervalle de lecture de la caméra : 400 ms, assez court pour suivre un vol, assez lent pour être invisible.
// Période de lecture.
const TICK_MS = 400;

/**
 * Lit l'état de la caméra sur la Terre : latitude, longitude, altitude en mètres et orientation dans le repère de
 * la Terre. Renvoie null hors de la Terre (pas de moteur, pas de caméra, autre astre visé).
 */
// Déclare et exporte cameraEarthState : le moteur.
export function cameraEarthState(engine) {
  // Le moteur, sa caméra et la Terre.
  const cam = engine?.cam, earth = engine?.earth;
  // Sans caméra ni Terre, ou visant un autre astre : null.
  if (!cam || !earth?.mesh || engine.focus !== engine.earthFocus) return null;
  // Met les matrices à jour.
  cam.updateMatrixWorld(true);
  earth.mesh.updateWorldMatrix(true, false);
  // La position de la caméra dans le monde, ramenée dans le repère de la Terre.
  const pLocal = cam.matrixWorld.elements;
  // La matrice monde de la Terre, inversée.
  const inv = earth.mesh.matrixWorld.clone().invert().elements;
  // La position de la caméra dans le repère de la Terre.
  const px = pLocal[12], py = pLocal[13], pz = pLocal[14];
  const x = inv[0] * px + inv[4] * py + inv[8] * pz + inv[12];
  const y = inv[1] * px + inv[5] * py + inv[9] * pz + inv[13];
  const z = inv[2] * px + inv[6] * py + inv[10] * pz + inv[14];
  // Le rayon de la sphère de la Terre dans son repère, et les mètres par unité de scène.
  const rScene = earth.def?.radius || 1;
  const mPerUnit = EARTH_RADIUS_M / rScene;
  // L'altitude de la caméra au-dessus de la sphère, en mètres (terrain non décompté).
  const altM = (Math.hypot(x, y, z) - rScene) * mPerUnit;
  // La latitude et la longitude en degrés.
  const [lon, lat] = toLonLat([x, y, z]);
  // L'orientation de la caméra, du monde vers le repère de la Terre.
  const qEarth = earth.mesh.getWorldQuaternion(new THREE.Quaternion());
  const qCam = cam.getWorldQuaternion(new THREE.Quaternion());
  const qLocal = qEarth.clone().invert().multiply(qCam);
  // Renvoie l'état complet : position, altitude et quaternion [x, y, z, w].
  return { lat, lon, altM, q: [qLocal.x, qLocal.y, qLocal.z, qLocal.w] };
// Fin de cameraEarthState.
}

/**
 * Le cadre LiDAR : visible, son adresse, et son masquage. `hide()` le ferme jusqu'à ce que la caméra quitte la
 * zone (altitude ou distance) et y revienne.
 */
// Déclare et exporte le crochet useLidarFrame : le moteur.
export function useLidarFrame(engine) {
  // L'état du cadre rendu au composant.
  const [frame, setFrame] = useState({ visible: false, url: null });
  // Le masquage demandé par le visiteur, remis à zéro quand la zone est quittée.
  const dismissed = useRef(false);
  // Le dernier état de caméra pour lequel l'adresse a été calculée.
  const last = useRef(null);
  // La date du dernier rechargement de l'iframe.
  const loadedAt = useRef(0);

  // Effet qui suit la caméra tant que le moteur vit.
  useEffect(() => {
    // Sans moteur : rien à suivre.
    if (!engine) return undefined;
    // La lecture périodique (début de la fonction).
    const tick = () => {
      // L'état de la caméra sur la Terre.
      const state = cameraEarthState(engine);
      // Ouverture du cadre pour cet état seulement.
      const inZone = Boolean(state && shouldShowFrame(state));
      // Hors de la zone : masquage annulé, cadre fermé, état oublié.
      if (!inZone) {
        // Remet le masquage pour la prochaine visite.
        dismissed.current = false;
        // Ferme le cadre une seule fois.
        setFrame((f) => (f.visible ? { visible: false, url: null } : f));
        // Oublie le dernier état.
        if (last.current) last.current = null;
        // Ici la lecture s'arrête.
        return undefined;
      // Fin du cas hors zone.
      }
      // Dans la zone mais masqué : rien à montrer.
      if (dismissed.current) return undefined;
      // L'adresse de la visionneuse pour cet état (toujours calculée, jamais gardée en mémoire avant usage).
      const url = lidarFrameUrl({ ...state, q: cameraEcefQuat(state.q) });
      // La date du moment.
      const now = Date.now();
      // Première ouverture, ou déplacement assez net et dernier rechargement assez ancien : nouvelle adresse.
      const reload = !last.current || (cameraMoved(last.current, state) && now - loadedAt.current >= LIDAR_FRAME_RELOAD_MS);
      // L'état devient la référence seulement s'il déclenche un rechargement.
      if (reload) last.current = state;
      // La date du rechargement, le cas échéant.
      if (reload) loadedAt.current = now;
      // Met à jour le rendu seulement quand l'adresse change.
      setFrame((f) => (reload && f.url === url) ? f : { visible: true, url: reload ? url : (f.url || url) });
    // Fin de la lecture.
    };
    // Lance une première lecture tout de suite.
    tick();
    // Puis à intervalle régulier.
    const timer = setInterval(tick, TICK_MS);
    // Nettoyage : arrête la lecture.
    return () => clearInterval(timer);
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // hide : ferme le cadre jusqu'à la prochaine entrée dans la zone.
  const hide = () => {
    // Note le masquage.
    dismissed.current = true;
    // Ferme le cadre.
    setFrame({ visible: false, url: null });
  // Fin de hide.
  };

  // Renvoie l'état du cadre et la fermeture.
  return { ...frame, hide };
// Fin de useLidarFrame.
}
