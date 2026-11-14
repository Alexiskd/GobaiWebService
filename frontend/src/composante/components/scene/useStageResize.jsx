// Importe useEffect de React.
import { useEffect } from 'react';

/** Le canvas WebGL suit la taille réelle du conteneur (rotation d’écran, barre d’adresse mobile, fenêtre redimensionnée). */
// Déclare et exporte le crochet useStageResize : reçoit les références du conteneur et du moteur.
export function useStageResize(containerRef, engineRef) {
  // Effet qui surveille la taille du conteneur.
  useEffect(() => {
    // Récupère le conteneur.
    const el = containerRef.current;
    // Sans conteneur, ou sans ResizeObserver dans le navigateur, rien à faire.
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    // Identifiant de l'image d'animation en attente.
    let raf = 0;
    // Crée l'observateur de taille (début du rappel).
    const ro = new ResizeObserver(() => {
      // Annule le redimensionnement en attente : un seul par image.
      cancelAnimationFrame(raf);
      // Programme le redimensionnement à la prochaine image.
      raf = requestAnimationFrame(() => {
        // Si le moteur a une méthode resize, on l'appelle.
        if (typeof engineRef.current?.resize === 'function') engineRef.current.resize();
        // Sinon, on émet un événement resize sur la fenêtre.
        else window.dispatchEvent(new Event('resize'));
      // Fin du redimensionnement programmé.
      });
    // Fin du rappel de l'observateur.
    });
    // Commence à observer le conteneur.
    ro.observe(el);
    // Nettoyage : annule l'image en attente et arrête l'observateur.
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  // Fin de l'effet ; dépendances : les deux références.
  }, [containerRef, engineRef]);
// Fin de useStageResize.
}
