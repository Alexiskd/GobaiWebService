// Fenêtre chargée à la demande : son code n'est téléchargé et monté qu'à sa première ouverture.
import { Suspense, useRef } from 'react';

/**
 * Enveloppe d'une fenêtre importée avec `lazy()`. Tant que `open` n'a jamais été vrai, rien n'est rendu : le
 * fichier de la fenêtre n'est pas demandé au serveur et ses effets ne tournent pas. Dès la première ouverture, la
 * fenêtre reste montée (ouverte ou fermée), comme avant : son état et son animation de fermeture sont gardés.
 */
// Déclare et exporte le composant LazyWindow.
export function LazyWindow({ open, children }) {
  // Référence : la fenêtre a-t-elle déjà été ouverte ?
  const opened = useRef(false);
  // Première ouverture : on s'en souvient.
  if (open) opened.current = true;
  // Jamais ouverte : rien à rendre.
  if (!opened.current) return null;
  // Déjà ouverte : la fenêtre, sans rien afficher pendant le téléchargement de son fichier.
  return <Suspense fallback={null}>{children}</Suspense>;
// Fin de LazyWindow.
}
