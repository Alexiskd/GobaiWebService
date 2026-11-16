// Importe de React les crochets useEffect et useRef.
import { useEffect, useRef } from 'react';
// Importe les deux fonctions pures de l'adresse du site.
import { siteHeadFor, sitePathFor } from './siteAddress';

// Les réexporte, pour les modules qui les importent d'ici.
export { siteHeadFor, sitePathFor };

/**
 * Tient la barre d'adresse à jour à chaque clic : /mars en allant sur Mars, /galerie en ouvrant la galerie, puis
 * retour à l'adresse de l'astre à la fermeture. L'adresse d'arrivée n'est pas touchée tant que rien n'a changé
 * (l'accueil reste « / »). L'historique n'est pas allongé : le bouton Retour quitte le site comme avant.
 */
// Déclare et exporte le crochet useSiteAddress : état prêt, galerie ouverte, panneau ouvert et nom de l'astre.
export function useSiteAddress({ ready, galleryOpen, panel, bodyName }) {
  // Référence : la dernière adresse traitée, null au départ.
  const last = useRef(null);
  // Adresse de ce qui est affiché.
  const path = sitePathFor({ galleryOpen, panel, bodyName });
  // Effet relancé quand l'adresse change.
  useEffect(() => {
    // Tant que l'application n'est pas prête, rien à faire.
    if (!ready) return;
    // Première exécution : mémorise l'adresse sans toucher à la barre d'adresse.
    if (last.current === null) { last.current = path; return; }
    // Adresse inchangée : rien à faire.
    if (path === last.current) return;
    // Mémorise la nouvelle adresse.
    last.current = path;
    // Début du bloc protégé : le navigateur peut refuser.
    try {
      // Remplace l'adresse sans ajouter d'entrée à l'historique, en gardant les paramètres et l'ancre.
      window.history.replaceState(window.history.state, '', `${path}${window.location.search}${window.location.hash}`);
    // Un refus est ignoré.
    } catch { /* adresse inchangée (navigateur qui refuse) : sans conséquence pour l'app */ }
    // Calcule le titre et l'adresse canonique.
    const head = siteHeadFor(path, bodyName);
    // Met à jour le titre de l'onglet.
    document.title = head.title;
    // Met à jour la balise link canonique, si elle existe.
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', head.canonical);
  // Fin de l'effet ; dépendances : l'état prêt et l'adresse (règle ESLint désactivée sur cette ligne).
  }, [ready, path]); // eslint-disable-line react-hooks/exhaustive-deps
// Fin de useSiteAddress.
}
