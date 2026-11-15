// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe l'adresse des tuiles de nuages et les chargements de la couverture nuageuse, des frontières, des villes et du vent.
import { earthCloudTileUrl, fetchEarthCloudCover, fetchBorders, fetchCityLabels, fetchEarthWind } from '@/moteur/api';
// Importe loadCloudMosaic, qui assemble la mosaïque de nuages.
import { loadCloudMosaic } from '@/moteur/engine/earthCloudMosaic';

/**
 * Mention des nuages de la Terre dans les sources, selon ce qui est affiché : image satellite, couverture calculée par
 * les modèles météo, ou nuages simulés quand aucune donnée réelle n'est arrivée (ce ne sont pas les nuages du jour).
 */
// Déclare et exporte les mentions des trois sources de nuages (début).
export const CLOUD_SOURCE_TEXT = {
  // Image satellite.
  satellite: 'Nuages : images satellite du moment (Xweather)',
  // Couverture nuageuse des modèles météo.
  model: 'Nuages : couverture nuageuse calculée par les modèles météo (Open-Meteo)',
  // Nuages simulés.
  simulated: 'Nuages : simulés, aucune donnée réelle reçue (ce ne sont pas les nuages du jour)',
// Fin des mentions.
};

// Rafraîchissement des nuages : toutes les heures.
const CLOUDS_REFRESH_MS = 60 * 60_000; // les nuages réels changent d'heure en heure
// Rafraîchissement du vent : toutes les 3 heures.
const WIND_REFRESH_MS = 3 * 60 * 60_000; // le vent à grande échelle change lentement

/** Noms des villes et frontières (Natural Earth), avec leur attribution. */
/**
 * Rafraîchissement périodique qui ne tourne pas en arrière-plan : une échéance passée onglet caché est reportée
 * au retour de l'utilisateur. Renvoie la fonction d'arrêt.
 */
// Déclare et exporte refreshWhileVisible (servi aussi au moteur atmosphérique) : la fonction de chargement et la période.
export function refreshWhileVisible(load, everyMs) {
  // Drapeau : une échéance a été manquée pendant que l'onglet était caché.
  let missed = false;
  // À chaque échéance : si l'onglet est caché, on note l'échéance manquée ; sinon on charge.
  const tick = () => { if (document.hidden) missed = true; else load(); };
  // Au retour sur l'onglet : s'il y a une échéance manquée, on charge une fois.
  const onVisible = () => { if (!document.hidden && missed) { missed = false; load(); } };
  // Lance la répétition.
  const timer = setInterval(tick, everyMs);
  // Écoute les changements de visibilité de l'onglet.
  document.addEventListener('visibilitychange', onVisible);
  // Renvoie la fonction d'arrêt : coupe la répétition et retire l'écouteur.
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
// Fin de refreshWhileVisible.
}

// Déclare et exporte le crochet useMapFeeds : reçoit le moteur et la fonction de messages.
export function useMapFeeds({ engine, push }) {
  // État : informations sur les villes (attribution et nombre).
  const [cityInfo, setCityInfo] = useState(null);
  // État : source des nuages affichés (« satellite », « model » ou « simulated »), simulés tant que rien n'est arrivé.
  const [cloudSource, setCloudSource] = useState('simulated');
  // État : la liste des villes.
  const [worldCities, setWorldCities] = useState([]); // ≈ 7 300 villes Natural Earth, aussi pour la recherche
  // État : informations sur les frontières (attribution).
  const [bordersInfo, setBordersInfo] = useState(null);

  // Effet qui charge les villes.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Charge les noms des villes.
    fetchCityLabels(ctrl.signal)
      // Réussite : donne les villes au moteur, les garde pour la recherche et note l'attribution et le nombre.
      .then((r) => { engine.setCityLabels(r.items); setWorldCities(r.items || []); setCityInfo({ attribution: r.attribution, count: r.count }); })
      // Un échec est ignoré.
      .catch(() => {}); // chargement automatique : échec silencieux
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendances : le moteur et push.
  }, [engine, push]);

  // Effet qui charge les frontières.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Charge les frontières.
    fetchBorders(ctrl.signal)
      // Réussite : les donne au moteur et note l'attribution.
      .then((r) => { engine.setBorders(r); setBordersInfo({ attribution: r.attribution }); })
      // Un échec est ignoré.
      .catch(() => {}); // chargement automatique : échec silencieux
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendances : le moteur et push.
  }, [engine, push]);

  // Nuages réels de la Terre, relayés par l'API. Première source : image satellite Xweather (avec identifiants).
  // Seconde source, si la première manque : couverture nuageuse du moment calculée par les modèles météo (Open-Meteo,
  // sans clé), que le vent réel déplace ensuite. Sans aucune des deux, les nuages simulés restent.
  // Effet des nuages réels.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // load : assemble la mosaïque de nuages à partir des tuiles.
    const load = () => loadCloudMosaic(earthCloudTileUrl, ctrl.signal)
      // Réussite : donne l'image au moteur ; acceptée, elle devient la source des nuages.
      .then((canvas) => { if (engine.setEarthCloudMosaic(canvas)) setCloudSource('satellite'); })
      // Échec : charge à la place la couverture nuageuse et la donne au moteur ; acceptée, elle devient la source.
      .catch(() => fetchEarthCloudCover(ctrl.signal).then((grid) => { if (engine.setEarthCloudCover(grid)) setCloudSource('model'); }))
      // Si cela échoue aussi, rien.
      .catch(() => {}); // chargement automatique : échec silencieux
    // Premier chargement immédiat.
    load();
    // Rafraîchissement périodique, seulement quand l'onglet est visible.
    const stop = refreshWhileVisible(load, CLOUDS_REFRESH_MS);
    // Nettoyage : arrête le rafraîchissement et annule les requêtes.
    return () => { stop(); ctrl.abort(); };
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // Vents réels du moment : ils entraînent les nuages (moteur de mouvement de la météo). Sans eux, le moteur garde
  // son modèle de circulation générale.
  // Effet du vent réel.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // load : charge le vent et le donne au moteur ; un échec est ignoré.
    const load = () => fetchEarthWind(ctrl.signal).then((r) => engine.setEarthWind(r)).catch(() => {});
    // Premier chargement immédiat.
    load();
    // Rafraîchissement périodique, seulement quand l'onglet est visible.
    const stop = refreshWhileVisible(load, WIND_REFRESH_MS);
    // Nettoyage : arrête le rafraîchissement et annule la requête.
    return () => { stop(); ctrl.abort(); };
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // Renvoie les informations sur les villes et les frontières, et la liste des villes.
  return { cityInfo, bordersInfo, worldCities, cloudSource };
// Fin de useMapFeeds.
}
