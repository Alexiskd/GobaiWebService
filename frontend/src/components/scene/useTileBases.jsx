import { useCallback, useEffect, useRef, useState } from 'react';
import { TILED_BODY_BY_ID } from '@/engine/tiledBodies';

/**
 * Fond par défaut de chaque astre au premier chargement des calques (modèle commun, voir engine/tiledBodies.jsx).
 * La Lune a son propre choix (« Lune réelle » composite) : voir chooseMoonBase.
 */
const DEFAULT_BASE = {
  earth: (ls) => ls.find((l) => l.id === 'google-satellite')
    || ls.find((l) => l.kind === 'hybrid') || ls.find((l) => l.kind === 'imagery'),
  mars: (ls) => ls.find((l) => l.kind === 'imagery'),
  mercury: (ls) => ls.find((l) => l.provider === 'mercury-trek-wmts')
    || ls.find((l) => l.provider === 'mercury-quickmap')
    || ls.find((l) => l.kind === 'imagery'),
  venus: (ls) => ls.find((l) => l.id === 'venus-magellan-c3') || ls.find((l) => l.kind === 'imagery'),
};

/**
 * Fond de carte par astre, avec une seule logique pour tous : choix, erreur affichée, et une requête plus récente
 * qui rend obsolète le résultat d'une requête précédente (par astre).
 * Renvoie l'API générique (bases, chooseBodyBase) et les noms historiques utilisés par les menus.
 */
export function useTileBases({ engine, engineRef, status, layers, push }) {
  const { earthLayers, marsLayers, mercuryLayers, venusLayers, moonDetailLayer, moonShadeLayer, moonRealAvailable } = layers;
  const [bases, setBases] = useState({}); // id de l'astre → id de la couche choisie (ou 'real' pour la Lune)
  const requests = useRef({});
  const autoChosen = useRef(false);

  /** Lance une demande pour un astre : renvoie une fonction qui dit si elle est toujours la plus récente. */
  const begin = (id, value) => {
    const n = (requests.current[id] || 0) + 1;
    requests.current[id] = n;
    setBases((b) => ({ ...b, [id]: value }));
    return () => requests.current[id] === n;
  };
  const fail = (id, err) => {
    setBases((b) => ({ ...b, [id]: null }));
    push(`${TILED_BODY_BY_ID[id]?.mapLabel || id} indisponible : ${err.message}.`, 'error', 9000);
  };

  const chooseBodyBase = useCallback(async (id, layerId) => {
    const e = engineRef.current;
    if (!e) return;
    const current = begin(id, layerId);
    try {
      await e.setBodyTileBase(id, layerId);
    } catch (err) {
      if (current()) fail(id, err);
    }
  }, [push]);

  // Lune : « réelle » = composite (couleurs naturelles + détail Kaguya + relief LOLA), sinon une couche simple.
  const chooseMoonBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const current = begin('moon', id);
    const real = id === 'real';
    try {
      e.setBodyComposite('moon', real, { pan: real && Boolean(moonDetailLayer) });
      await Promise.all([
        e.setBodyTileBase('moon', real ? (moonDetailLayer || moonShadeLayer).id : id),
        e.setBodyTileOverlay('moon', null),
      ]);
    } catch (err) {
      if (current()) fail('moon', err);
    }
  }, [push, moonShadeLayer, moonDetailLayer]);

  const chooseBase = useCallback((id) => chooseBodyBase('earth', id), [chooseBodyBase]);
  const chooseMarsBase = useCallback((id) => chooseBodyBase('mars', id), [chooseBodyBase]);
  const chooseMercuryBase = useCallback((id) => chooseBodyBase('mercury', id), [chooseBodyBase]);
  const chooseVenusBase = useCallback((id) => chooseBodyBase('venus', id), [chooseBodyBase]);

  useEffect(() => {
    if (!engine || status !== 'ready' || autoChosen.current) return;
    autoChosen.current = true;
    const layersOf = { earth: earthLayers, mars: marsLayers, mercury: mercuryLayers, venus: venusLayers };
    for (const [id, pick] of Object.entries(DEFAULT_BASE)) {
      const first = pick(layersOf[id] || []);
      if (first) chooseBodyBase(id, first.id);
    }
    if (moonRealAvailable) chooseMoonBase('real');
  }, [engine, status, earthLayers, marsLayers, mercuryLayers, venusLayers, moonRealAvailable, chooseBodyBase, chooseMoonBase]);

  return {
    bases, chooseBodyBase,
    baseId: bases.earth ?? null, moonBaseId: bases.moon ?? null, marsBaseId: bases.mars ?? null,
    mercuryBaseId: bases.mercury ?? null, venusBaseId: bases.venus ?? null,
    chooseBase, chooseMoonBase, chooseMarsBase, chooseMercuryBase, chooseVenusBase,
    baseLayer: earthLayers.find((l) => l.id === bases.earth) || null,
    overlayLayer: earthLayers.find((l) => l.kind === 'overlay') || null,
  };
}
