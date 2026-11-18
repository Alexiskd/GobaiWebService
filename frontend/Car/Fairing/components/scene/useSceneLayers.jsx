// Importe useMemo de React.
import { useMemo } from 'react';

// Vrai pour un calque de la Lune.
const isMoonLayer = (l) => l.body === 'moon';
// Vrai pour un calque de Mars.
const isMarsLayer = (l) => l.body === 'mars';
// Vrai pour un calque de Mercure.
const isMercuryLayer = (l) => l.body === 'mercury';
// Vrai pour un calque de Vénus.
const isVenusLayer = (l) => l.body === 'venus';
// Vrai pour un calque de la Terre (astre absent ou « earth »).
const isEarthLayer = (l) => !l.body || l.body === 'earth';

/** Calques de fond classés par astre ; repère les calques de « Lune réelle » (Kaguya, LOLA). */
// Déclare et exporte le crochet useSceneLayers : reçoit tous les calques.
export function useSceneLayers(layers) {
  // Calques de la Terre, recalculés seulement si la liste change.
  const earthLayers = useMemo(() => layers.filter(isEarthLayer), [layers]);
  // Calques de la Lune.
  const moonLayers = useMemo(() => layers.filter(isMoonLayer), [layers]);
  // Calques de Mars.
  const marsLayers = useMemo(() => layers.filter(isMarsLayer), [layers]);
  // Calques de Mercure.
  const mercuryLayers = useMemo(() => layers.filter(isMercuryLayer), [layers]);
  // Calques de Vénus.
  const venusLayers = useMemo(() => layers.filter(isVenusLayer), [layers]);
  // Calque lunaire de détail : le premier dont l'identifiant contient « kaguya », null sinon.
  const moonDetailLayer = moonLayers.find((l) => l.id.includes('kaguya')) || null;
  // Calque lunaire d'ombrage : le premier dont l'identifiant contient « lola-shade », null sinon.
  const moonShadeLayer = moonLayers.find((l) => l.id.includes('lola-shade')) || null;
  // « Lune réelle » disponible si l'un des deux existe.
  const moonRealAvailable = Boolean(moonShadeLayer || moonDetailLayer);

  // Renvoie les cinq listes, les deux calques lunaires et la disponibilité.
  return { earthLayers, moonLayers, marsLayers, mercuryLayers, venusLayers, moonDetailLayer, moonShadeLayer, moonRealAvailable };
// Fin de useSceneLayers.
}
