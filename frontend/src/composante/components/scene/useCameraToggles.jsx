// Importe de React les crochets useCallback, useEffect et useState.
import { useCallback, useEffect, useState } from 'react';
// Importe la table « toutes les familles affichées » et la liste des familles d'astres.
import { ALL_KINDS_SHOWN, BODY_KINDS } from '@/moteur/engine/bodyKinds';

/** Rotation automatique, vue 3/4, repères du système solaire (orbites, points des planètes) et ciel lointain, envoyés au moteur. */
/**
 * `initial` (lu une seule fois) : familles affichées au départ et astres enlevés au départ (indices du moteur).
 */
/** L'appareil demande moins d'animations (réglage d'accessibilité du système). */
// prefersReducedMotion : vrai si le système demande moins d'animations (faux hors navigateur).
const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Relief en volume de la Terre (« gobai:relief-3d », voir TileManager) : « 0 » ou absent = coupé, nombre = exagération.
// storedRelief : valeur enregistrée du relief, null si elle manque ou si le stockage est inaccessible.
const storedRelief = () => { try { return globalThis.localStorage?.getItem('gobai:relief-3d') ?? null; } catch { return null; } };

// Déclare et exporte le crochet useCameraToggles : reçoit le moteur et les réglages de départ.
export function useCameraToggles(engine, initial = {}) {
  // Rotation automatique : lancée au départ, sauf si l'appareil demande moins d'animations (le bouton « Rotation »
  // permet toujours de la lancer).
  // État : rotation automatique, lancée sauf si le système demande moins d'animations.
  const [auto, setAuto] = useState(() => !prefersReducedMotion());
  // État : vue 3/4 automatique, active au départ.
  const [tilt, setTilt] = useState(true);
  // État : vitesse de la rotation, 1 au départ.
  const [rotateSpeed, setRotateSpeed] = useState(1); // multiplicateur de la rotation automatique
  // État : lignes d'orbite, affichées au départ.
  const [orbits, setOrbits] = useState(true);
  // État : points et noms des planètes, affichés au départ.
  const [markers, setMarkers] = useState(true);
  // État : points et noms des satellites, masqués au départ.
  const [satellites, setSatellites] = useState(false);
  // État : ciel lointain, affiché au départ.
  const [sky, setSky] = useState(true);
  // État : atmosphères, affichées au départ.
  const [atmospheres, setAtmospheres] = useState(true); // atmosphère des planètes solides (Vénus, Terre, Mars)
  // Relief en volume de la Terre (vraies altitudes) : coupé par défaut — carte à plat, affichée plus vite. Le choix
  // est gardé dans le navigateur par le moteur.
  // État : relief affiché si la valeur enregistrée est un nombre positif.
  const [relief, setReliefShown] = useState(() => Number(storedRelief()) > 0);
  // setRelief : active ou coupe le relief ; début de la fonction mémorisée.
  const setRelief = useCallback((on) => {
    // Met l'état à jour.
    setReliefShown(Boolean(on));
    // Relit l'exagération enregistrée.
    const kept = Number(storedRelief());
    // Transmet au moteur l'état et l'exagération (1 par défaut).
    engine?.setRelief(Boolean(on), kept > 0 ? kept : 1); // garde l'exagération déjà choisie
  // Fin de setRelief ; dépendance : le moteur.
  }, [engine]);
  // Familles d'astres affichées (planètes solides, gazeuses, naines, satellites naturels) : toutes au départ.
  // État : familles affichées, toutes au départ, corrigées par les réglages de départ.
  const [kinds, setKinds] = useState(() => ({ ...ALL_KINDS_SHOWN, ...initial.kinds }));
  // setKind : affiche ou enlève une famille, sans toucher aux autres ; fonction stable.
  const setKind = useCallback((id, on) => setKinds((k) => ({ ...k, [id]: Boolean(on) })), []);
  // Astres enlevés un par un (cases de Paramètres) : indices de téléportation du moteur.
  // État : ensemble des indices d'astres enlevés, d'après les réglages de départ.
  const [hiddenBodies, setHiddenBodies] = useState(() => new Set(initial.hiddenBodies || []));
  // setBodyShown : affiche ou enlève un astre ; début de la fonction mémorisée.
  const setBodyShown = useCallback((index, on) => setHiddenBodies((prev) => {
    // Copie l'ensemble, pour ne pas modifier l'ancien.
    const next = new Set(prev);
    // Retire l'indice si l'astre est affiché, l'ajoute sinon.
    if (on) next.delete(index); else next.add(index);
    // Renvoie le nouvel ensemble.
    return next;
  // Fin de setBodyShown ; fonction stable.
  }), []);

  // Transmet la rotation automatique au moteur.
  useEffect(() => { engine?.setAutoRotate(auto); }, [engine, auto]);
  // Transmet la vue 3/4 au moteur.
  useEffect(() => { engine?.setTilt(tilt); }, [engine, tilt]);
  // Transmet la vitesse de rotation au moteur.
  useEffect(() => { engine?.setRotateSpeed(rotateSpeed); }, [engine, rotateSpeed]);
  // Transmet l'affichage des orbites au moteur.
  useEffect(() => { engine?.setOrbitsVisible(orbits); }, [engine, orbits]);
  // Transmet l'affichage des repères des planètes au moteur.
  useEffect(() => { engine?.setBodyMarkersVisible(markers); }, [engine, markers]);
  // Transmet l'affichage des repères des satellites au moteur.
  useEffect(() => { engine?.setSatelliteMarkersVisible(satellites); }, [engine, satellites]);
  // Transmet l'affichage du ciel au moteur.
  useEffect(() => { engine?.setSkyVisible(sky); }, [engine, sky]);
  // Transmet l'affichage des atmosphères au moteur.
  useEffect(() => { engine?.setAtmospheresVisible(atmospheres); }, [engine, atmospheres]);
  // Transmet au moteur l'affichage de chaque famille d'astres.
  useEffect(() => { if (engine) for (const k of BODY_KINDS) engine.setBodyKindVisible(k.id, kinds[k.id]); }, [engine, kinds]);
  // Transmet au moteur l'ensemble des astres enlevés.
  useEffect(() => { engine?.setHiddenBodies(hiddenBodies); }, [engine, hiddenBodies]);

  // Renvoie tous les états et leurs fonctions de mise à jour.
  return { auto, setAuto, tilt, setTilt, orbits, setOrbits, markers, setMarkers, satellites, setSatellites, sky, setSky, atmospheres, setAtmospheres, relief, setRelief, kinds, setKind, hiddenBodies, setBodyShown, setHiddenBodies, rotateSpeed, setRotateSpeed };
// Fin de useCameraToggles.
}
