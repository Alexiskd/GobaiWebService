import { useEffect, useState } from 'react';

/** Affichage de la Terre (ombrage, frontières, littoraux, noms, routes) et son envoi au moteur. */
export function useEarthDisplay({ engine, baseLayer, overlayLayer, push }) {
  const [roads, setRoads] = useState(true);
  const [shade, setShade] = useState(true);
  const [borders, setBorders] = useState(true);
  const [coasts, setCoasts] = useState(true);
  const [countryNames, setCountryNames] = useState(false);
  const [cityNames, setCityNames] = useState(false);
  const [gps, setGps] = useState(true); // coordonnées GPS des coins de l'écran

  // Le fond « hybride » inclut déjà les routes et les noms : on ne les superpose pas.
  const roadsIncluded = Boolean(baseLayer && baseLayer.kind !== 'imagery');
  const roadsUnavailable = baseLayer?.kind === 'imagery' && !overlayLayer;
  const roadsHint = roadsIncluded ? 'Déjà inclus dans ce fond' : roadsUnavailable ? 'Non proposé par ce fournisseur' : undefined;
  const namesIncluded = Boolean(baseLayer && baseLayer.kind !== 'imagery');
  const showCityNames = cityNames && !namesIncluded;

  useEffect(() => { engine?.setTileShade(shade); }, [engine, shade]);
  useEffect(() => { engine?.setBordersVisible(borders); }, [engine, borders]);
  useEffect(() => { engine?.setCoastsVisible(coasts); }, [engine, coasts]);
  useEffect(() => { engine?.setCountryLabelsVisible(countryNames); }, [engine, countryNames]);
  useEffect(() => { engine?.setCityLabelsVisible(showCityNames); }, [engine, showCityNames]);
  useEffect(() => { engine?.setGpsVisible?.(gps); }, [engine, gps]);

  // Touche G : afficher ou masquer les coordonnées GPS (hors saisie de texte).
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'g') return;
      setGps((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!engine) return;
    const wanted = roads && baseLayer?.kind === 'imagery' && overlayLayer ? overlayLayer.id : null;
    engine.setBodyTileOverlay('earth', wanted).catch((err) => push(`Routes indisponibles : ${err.message}`, 'warn'));
  }, [engine, roads, baseLayer, overlayLayer, push]);

  return {
    roads, setRoads, roadsIncluded, roadsUnavailable, roadsHint,
    shade, setShade, borders, setBorders, coasts, setCoasts,
    countryNames, setCountryNames, cityNames, setCityNames, namesIncluded, showCityNames, gps, setGps,
  };
}
