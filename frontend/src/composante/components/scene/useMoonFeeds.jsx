// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe les chargements des phases de la Lune, de son éphéméride et de celle des satellites.
import { fetchMoonEphemeris, fetchMoonPhases, fetchSatelliteEphemeris } from '@/moteur/api';

/** Données lunaires rafraîchies périodiquement : phases USNO (6 h), éphéméride JPL (6 h). */
// Déclare et exporte le crochet useMoonFeeds : reçoit le moteur.
export function useMoonFeeds(engine) {
  // État : les phases de la Lune, null tant qu'elles ne sont pas chargées.
  const [moonPhases, setMoonPhases] = useState(null);

  // Effet exécuté une seule fois : les phases.
  useEffect(() => {
    // Contrôleur d'annulation de la requête en cours.
    let ctrl = null;
    // Déclare load, qui charge les phases.
    const load = () => {
      // Annule la requête précédente, s'il y en a une.
      ctrl?.abort();
      // Crée un nouveau contrôleur.
      ctrl = new AbortController();
      // Charge les phases.
      fetchMoonPhases(ctrl.signal)
        // Réussite : les enregistre dans l'état.
        .then((r) => setMoonPhases(r))
        // Un échec est ignoré.
        .catch(() => {}); // rafraîchissement automatique : échec silencieux
    // Fin de load.
    };
    // Premier chargement immédiat.
    load();
    // Rechargement toutes les 6 heures.
    const timer = setInterval(load, 6 * 3600 * 1000);
    // Nettoyage : arrête la répétition et annule la requête en cours.
    return () => { clearInterval(timer); ctrl?.abort(); };
  // Fin de l'effet ; aucune dépendance.
  }, []);

  // Effet de l'éphéméride de la Lune.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Contrôleur d'annulation de la requête en cours.
    let ctrl = null;
    // Déclare load, qui charge l'éphéméride.
    const load = () => {
      // Annule la requête précédente, s'il y en a une.
      ctrl?.abort();
      // Crée un nouveau contrôleur.
      ctrl = new AbortController();
      // Charge l'éphéméride de la Lune.
      fetchMoonEphemeris(ctrl.signal)
        // Réussite : donne les points au moteur.
        .then((r) => engine.setMoonEphemeris(r.points))
        // Un échec est ignoré.
        .catch(() => {}); // rafraîchissement automatique : échec silencieux
    // Fin de load.
    };
    // Premier chargement immédiat.
    load();
    // Rechargement toutes les 6 heures.
    const timer = setInterval(load, 6 * 3600 * 1000);
    // Nettoyage : arrête la répétition et annule la requête en cours.
    return () => { clearInterval(timer); ctrl?.abort(); };
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // Satellites sphériques (Jupiter à Pluton) : même rythme que l'éphéméride de la Lune.
  // Effet de l'éphéméride des satellites.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Contrôleur d'annulation de la requête en cours.
    let ctrl = null;
    // Déclare load, qui charge l'éphéméride des satellites.
    const load = () => {
      // Annule la requête précédente, s'il y en a une.
      ctrl?.abort();
      // Crée un nouveau contrôleur.
      ctrl = new AbortController();
      // Charge l'éphéméride des satellites.
      fetchSatelliteEphemeris(ctrl.signal)
        // Réussite : donne les satellites au moteur.
        .then((r) => engine.setSatelliteEphemeris(r.satellites))
        // Un échec est ignoré.
        .catch(() => {}); // rafraîchissement automatique : échec silencieux
    // Fin de load.
    };
    // Premier chargement immédiat.
    load();
    // Rechargement toutes les 6 heures.
    const timer = setInterval(load, 6 * 3600 * 1000);
    // Nettoyage : arrête la répétition et annule la requête en cours.
    return () => { clearInterval(timer); ctrl?.abort(); };
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // Renvoie les phases de la Lune.
  return { moonPhases };
// Fin de useMoonFeeds.
}
