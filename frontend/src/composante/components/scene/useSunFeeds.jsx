// Importe de React le crochet useEffect.
import { useEffect } from 'react';
// Importe le chargement des régions actives du Soleil.
import { fetchSolarRegions } from '@/moteur/api/scene';

/** Délai entre deux lectures des régions actives, en millisecondes : 15 minutes, comme le cache du serveur. */
// Déclare REGIONS_REFRESH_MS.
const REGIONS_REFRESH_MS = 15 * 60 * 1000;

/**
 * Régions actives du Soleil, lues au démarrage puis toutes les quinze minutes et posées dans le moteur : les
 * éruptions du Soleil en 3D partent alors des vraies régions actives (NOAA SWPC) et des éruptions réellement
 * observées (NASA DONKI), au lieu de régions tirées au hasard. Un échec est silencieux : le moteur garde ses
 * régions simulées, et la lecture suivante réessaie.
 */
// Déclare et exporte le crochet useSunFeeds : reçoit le moteur.
export function useSunFeeds(engine) {
  // Effet des régions actives.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Contrôleur d'annulation de la requête en cours.
    let ctrl = null;
    // Déclare load, qui lit les régions actives et les pose dans le moteur.
    const load = () => {
      // Annule la requête précédente, s'il y en a une.
      ctrl?.abort();
      // Crée un nouveau contrôleur.
      ctrl = new AbortController();
      // Lit les régions actives.
      fetchSolarRegions(ctrl.signal)
        // Réussite : les pose dans le moteur.
        .then((data) => engine.setSolarRegions(data))
        // Un échec est ignoré.
        .catch(() => {}); // rafraîchissement automatique : échec silencieux, les régions simulées restent
    // Fin de load.
    };
    // Première lecture immédiate.
    load();
    // Lectures suivantes.
    const timer = setInterval(load, REGIONS_REFRESH_MS);
    // Nettoyage : arrête la répétition et annule la requête en cours.
    return () => { clearInterval(timer); ctrl?.abort(); };
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);
// Fin de useSunFeeds.
}
