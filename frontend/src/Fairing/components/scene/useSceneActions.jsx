// Importe de React les crochets useCallback, useMemo et useState.
import { useCallback, useMemo, useState } from 'react';

/** Commandes envoyées au moteur 3D : focus, zoom, caméra, lieux et sites des astres. */
// Déclare et exporte le crochet useSceneActions : reçoit la référence du moteur et le réglage de la rotation automatique.
export function useSceneActions({ engineRef, setAuto }) {
  // `opts.planetOnly` : la planète seule (menu des satellites replié), sinon tout son système.
  // selectFocus : vise l'astre d'indice i, avec ses options.
  const selectFocus = useCallback((i, opts) => engineRef.current?.setFocus(i, opts), []);
  // zoom : applique un facteur de zoom.
  const zoom = useCallback((f) => engineRef.current?.zoom(f), []);
  // resetView : revient à la vue d'ensemble.
  const resetView = useCallback(() => engineRef.current?.resetView(), []);
  // Boussole : un appui verrouille le nord en haut (sud en bas), un second appui libère l'orientation.
  // État : nord verrouillé ou non.
  const [northLocked, setNorthLocked] = useState(false);
  // recalibrateNorth : bascule le verrouillage du nord ; début de la fonction mémorisée.
  const recalibrateNorth = useCallback(() => {
    // Récupère le moteur.
    const e = engineRef.current;
    // Sans moteur, rien à faire.
    if (!e) return;
    // Demande l'état inverse au moteur et garde l'état réellement appliqué.
    const on = e.setNorthLock(!e.northLock);
    // Met l'état à jour.
    setNorthLocked(on);
    // Si le nord est verrouillé, coupe la rotation automatique.
    if (on) setAuto(false);
  // Fin de recalibrateNorth ; dépendance : setAuto.
  }, [setAuto]);
  // pickCity : va à la ville d'indice donné.
  const pickCity = useCallback((index) => engineRef.current?.goCity(index), []);
  // pickPlace : va au lieu donné.
  const pickPlace = useCallback((place) => engineRef.current?.goTo(place), []);
  // Point bleu de la position de l'utilisateur ({ lat, lon, accuracyM, headingDeg }, ou null pour l'enlever).
  // showPosition : affiche ou enlève le point de la position de l'utilisateur.
  const showPosition = useCallback((position) => engineRef.current?.setUserPosition(position), []);
  // moonSide : montre la face demandée de la Lune.
  const moonSide = useCallback((side) => engineRef.current?.viewMoonSide(side), []);
  // Survol d'un lieu : une seule commande pour tous les astres tuilés (modèle commun, voir engine/tiledBodies.jsx).
  // goSite : survole un site d'un astre, à l'altitude donnée.
  const goSite = useCallback((id, site, altitudeKm) => engineRef.current?.goToSite(id, site, altitudeKm), []);
  // goMoonSite : la même commande pour la Lune.
  const goMoonSite = useCallback((site, altitudeKm) => goSite('moon', site, altitudeKm), [goSite]);
  // goMarsSite : la même commande pour Mars.
  const goMarsSite = useCallback((site) => goSite('mars', site), [goSite]);
  // goMercurySite : la même commande pour Mercure.
  const goMercurySite = useCallback((site) => goSite('mercury', site), [goSite]);
  // goVenusSite : la même commande pour Vénus.
  const goVenusSite = useCallback((site) => goSite('venus', site), [goSite]);

  // Objet mémorisé des rappels passés aux panneaux (début).
  const handlers = useMemo(() => ({
    // Changement de face de la Lune.
    onSide: moonSide,
    // Survol d'un site lunaire.
    onGoMoon: goMoonSite,
    // Aller à un lieu.
    onGoPlace: pickPlace,
    // Survol d'un site martien.
    onGoMars: goMarsSite,
    // Survol d'un site de Mercure.
    onGoMercury: goMercurySite,
    // Survol d'un site de Vénus.
    onGoVenus: goVenusSite,
    // Survol d'un site de n'importe quel astre.
    onGoSite: goSite,
  // Fin de l'objet ; recalculé seulement si l'une de ces fonctions change.
  }), [moonSide, goMoonSite, pickPlace, goMarsSite, goMercurySite, goVenusSite, goSite]);

  // Renvoie les commandes, le survol d'un lieu de la Lune, l'état du nord et les rappels.
  return { selectFocus, zoom, resetView, recalibrateNorth, northLocked, pickCity, pickPlace, goMoonSite, showPosition, handlers };
// Fin de useSceneActions.
}
