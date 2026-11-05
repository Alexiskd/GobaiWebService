import { useCallback, useMemo } from 'react';

/** Commandes envoyées au moteur 3D : focus, zoom, caméra, lieux et sites des astres. */
export function useSceneActions({ engineRef, setAuto }) {
  const selectFocus = useCallback((i) => engineRef.current?.setFocus(i), []);
  const zoom = useCallback((f) => engineRef.current?.zoom(f), []);
  const resetView = useCallback(() => engineRef.current?.resetView(), []);
  const recalibrateNorth = useCallback(() => {
    if (engineRef.current?.recalibrateNorth()) setAuto(false);
  }, [setAuto]);
  const pickCity = useCallback((index) => engineRef.current?.goCity(index), []);
  const pickPlace = useCallback((place) => engineRef.current?.goTo(place), []);
  const moonSide = useCallback((side) => engineRef.current?.viewMoonSide(side), []);
  const selectOrbiter = useCallback((id) => engineRef.current?.selectOrbiter(id), []);
  // Survol d'un lieu : une seule commande pour tous les astres tuilés (modèle commun, voir engine/tiledBodies.jsx).
  const goSite = useCallback((id, site, altitudeKm) => engineRef.current?.goToSite(id, site, altitudeKm), []);
  const goMoonSite = useCallback((site, altitudeKm) => goSite('moon', site, altitudeKm), [goSite]);
  const goMarsSite = useCallback((site) => goSite('mars', site), [goSite]);
  const goMercurySite = useCallback((site) => goSite('mercury', site), [goSite]);
  const goVenusSite = useCallback((site) => goSite('venus', site), [goSite]);

  const handlers = useMemo(() => ({
    onSide: moonSide,
    onSelectOrbiter: selectOrbiter,
    onGoMoon: goMoonSite,
    onGoPlace: pickPlace,
    onGoMars: goMarsSite,
    onGoMercury: goMercurySite,
    onGoVenus: goVenusSite,
    onGoSite: goSite,
  }), [moonSide, selectOrbiter, goMoonSite, pickPlace, goMarsSite, goMercurySite, goVenusSite, goSite]);

  return { selectFocus, zoom, resetView, recalibrateNorth, pickCity, pickPlace, handlers };
}
