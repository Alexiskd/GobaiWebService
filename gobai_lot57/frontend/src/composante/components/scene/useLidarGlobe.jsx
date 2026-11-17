// Importe de React les crochets useCallback, useEffect et useRef.
import { useCallback, useEffect, useRef } from 'react';
// Importe fetchPointClouds, qui charge le catalogue des nuages de points.
import { fetchPointClouds } from '@/moteur/api';

// Nuages LiDAR calés par GPS, affichés sur le globe dès le démarrage. `update(item)` remplace un nuage
// (après une nouvelle position validée) sans recharger tout le catalogue.
// Déclare et exporte le crochet useLidarGlobe : reçoit le moteur.
export function useLidarGlobe(engine) {
  // Référence : la liste des nuages affichés.
  const items = useRef([]);

  // Effet qui charge le catalogue.
  useEffect(() => {
    // Sans moteur, ou sans module LiDAR dans le moteur, rien à faire.
    if (!engine?.lidar) return undefined;
    // Crée un contrôleur d'annulation.
    const controller = new AbortController();
    // Charge le catalogue, avec le signal d'annulation.
    fetchPointClouds(controller.signal)
      // Réponse reçue : extrait la liste (début).
      .then(({ items: list }) => {
        // Garde la liste, vide si ce n'est pas un tableau.
        items.current = Array.isArray(list) ? list : [];
        // Donne les nuages au moteur.
        engine.lidar.setClouds(items.current);
      // Fin du traitement de la réponse.
      })
      // Un échec est ignoré.
      .catch(() => {}); // pas de catalogue : rien sur le globe
    // Nettoyage : annule la requête en cours.
    return () => controller.abort();
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // update : remplace ou ajoute un nuage ; début de la fonction mémorisée.
  const update = useCallback((item) => {
    // Sans nuage, rien à faire.
    if (!item) return;
    // Si un nuage du même nom existe déjà…
    const list = items.current.some((i) => i.name === item.name)
      // … il est remplacé par le nouveau…
      ? items.current.map((i) => (i.name === item.name ? item : i))
      // … sinon le nouveau est ajouté à la fin.
      : [...items.current, item];
    // Garde la nouvelle liste.
    items.current = list;
    // Donne la nouvelle liste au moteur, s'il a un module LiDAR.
    engine?.lidar?.setClouds(list);
  // Fin de update ; dépendance : le moteur.
  }, [engine]);

  // Renvoie la fonction de mise à jour.
  return { update };
// Fin de useLidarGlobe.
}
