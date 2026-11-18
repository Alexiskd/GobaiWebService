// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe tilesApi, le client de l'API des tuiles, transmis au moteur.
import { tilesApi } from '@/moteur/api';

/**
 * Crée le moteur 3D et le détruit au démontage.
 * Retourne l'instance (état, pour déclencher les effets) ; `engineRef` est fourni par l'appelant.
 */
// Déclare et exporte le crochet useSolarEngine : reçoit la référence du conteneur, les données, les étiquettes, le HUD et la référence du moteur.
export function useSolarEngine({ containerRef, data, labels, hud, engineRef }) {
  // État : l'instance du moteur 3D (null tant qu'elle n'est pas créée).
  const [engine, setEngine] = useState(null);
  // État : l'astre visé, valeur transmise par le moteur (0 au départ).
  const [focus, setFocus] = useState(0);
  // État : le message d'erreur d'initialisation, null s'il n'y en a pas.
  const [error, setError] = useState(null);

  // Effet qui crée le moteur, et le détruit au nettoyage.
  useEffect(() => {
    // Drapeau : passe à vrai si l'effet est nettoyé avant la fin du chargement.
    let cancelled = false;
    // L'instance créée par cet effet, gardée pour la détruire au nettoyage.
    let instance = null;

    // Fonction asynchrone appelée tout de suite (un effet ne peut pas être lui-même asynchrone).
    (async () => {
      // Début du bloc protégé : toute erreur d'initialisation est rattrapée plus bas.
      try {
        // Chargé à la demande : three.js reste hors du bundle initial.
        // Importe dynamiquement le module du moteur et en extrait la classe SolarEngine.
        const { SolarEngine } = await import('@/moteur/engine/engine');
        // Si l'effet a été nettoyé pendant le chargement, on s'arrête là.
        if (cancelled) return;
        // Crée le moteur avec le conteneur, les données, les étiquettes, le HUD, l'API des tuiles et le rappel de changement d'astre visé.
        instance = new SolarEngine({ container: containerRef.current, data, labels, hud, tilesApi, onFocusChange: setFocus });
        // Adresse d'un astre (https://www.gobaispace.com/mars) : on s'y téléporte dès l'ouverture.
        // Lit le chemin de l'adresse, sans les barres obliques de début et de fin.
        let slug = window.location.pathname.replace(/^\/+|\/+$/g, '');
        // Décode les caractères encodés de l'adresse ; si le décodage échoue, on ignore l'adresse.
        try { slug = decodeURIComponent(slug); } catch { slug = ''; }
        // S'il reste un nom simple (sans barre oblique), le moteur vise l'astre correspondant.
        if (slug && !slug.includes('/')) instance.focusBySlug(slug);
        // Range l'instance dans la référence fournie par l'appelant.
        engineRef.current = instance;
        // Enregistre l'instance dans l'état, ce qui déclenche un nouveau rendu.
        setEngine(instance);
      // En cas d'erreur pendant le chargement ou la création du moteur.
      } catch (e) {
        // Si l'effet est toujours actif, enregistre un message d'erreur lisible (message de l'erreur, ou l'erreur elle-même).
        if (!cancelled) setError(`Impossible d’initialiser la scène 3D : ${e?.message || e}`);
      // Fin du bloc try/catch.
      }
    // Fin de la fonction asynchrone, appelée immédiatement.
    })();

    // Fonction de nettoyage de l'effet (démontage ou changement d'une dépendance).
    return () => {
      // Signale au chargement en cours qu'il ne doit plus rien faire.
      cancelled = true;
      // Vide la référence du moteur.
      engineRef.current = null;
      // Si un moteur a été créé, libère ses ressources.
      if (instance) instance.dispose();
      // Remet l'état du moteur à null.
      setEngine(null);
    // Fin de la fonction de nettoyage.
    };
  // Fin de l'effet ; il est relancé si le conteneur, les données, les étiquettes, le HUD ou la référence changent.
  }, [containerRef, data, labels, hud, engineRef]);

  // Renvoie le moteur, l'astre visé et l'éventuelle erreur.
  return { engine, focus, error };
// Fin de useSolarEngine.
}
