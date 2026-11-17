// Importe useEffect de React.
import { useEffect } from 'react';
// Importe la boucle de rendu de l'application complète.
import { renderLoop } from '@/Car/SystemeEngine/core/RenderLoop.js';

/**
 * RenderLoopRoot : possède la boucle de rendu de l'application complète.
 * Monté à la racine de App, il démarre la boucle au montage et l'arrête au démontage.
 * Chaque moteur (AstreSolideEngine…) s'y enregistre comme variable du rendu.
 */
// Déclare et exporte le composant RenderLoopRoot : reçoit les enfants de l'app.
export function RenderLoopRoot({ children }) {
  // Effet de montage : démarre la boucle ; retour : l'arrête.
  useEffect(() => {
    // Démarre la boucle de rendu de l'application complète.
    renderLoop.start();
    // Nettoyage : arrête la boucle au démontage.
    return () => renderLoop.stop();
  // Une seule fois.
  }, []);
  // Rend les enfants : toute l'app tourne sous la boucle.
  return children;
// Fin de RenderLoopRoot.
}
