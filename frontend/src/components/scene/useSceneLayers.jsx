import { useMemo } from 'react';

const isMoonLayer = (l) => l.body === 'moon';
const isMarsLayer = (l) => l.body === 'mars';
const isMercuryLayer = (l) => l.body === 'mercury';
const isVenusLayer = (l) => l.body === 'venus';
const isEarthLayer = (l) => !l.body || l.body === 'earth';

/** Calques de fond classés par astre ; repère les calques de « Lune réelle » (Kaguya, LOLA). */
export function useSceneLayers(layers) {
  const earthLayers = useMemo(() => layers.filter(isEarthLayer), [layers]);
  const moonLayers = useMemo(() => layers.filter(isMoonLayer), [layers]);
  const marsLayers = useMemo(() => layers.filter(isMarsLayer), [layers]);
  const mercuryLayers = useMemo(() => layers.filter(isMercuryLayer), [layers]);
  const venusLayers = useMemo(() => layers.filter(isVenusLayer), [layers]);
  const moonDetailLayer = moonLayers.find((l) => l.id.includes('kaguya')) || null;
  const moonShadeLayer = moonLayers.find((l) => l.id.includes('lola-shade')) || null;
  const moonRealAvailable = Boolean(moonShadeLayer || moonDetailLayer);

  return { earthLayers, moonLayers, marsLayers, mercuryLayers, venusLayers, moonDetailLayer, moonShadeLayer, moonRealAvailable };
}
