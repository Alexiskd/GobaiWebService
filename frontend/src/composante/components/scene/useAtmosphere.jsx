// Importe de React les crochets useCallback, useEffect, useRef et useState.
import { useCallback, useEffect, useRef, useState } from 'react';
// Importe les lectures du moteur atmosphérique du serveur.
import { fetchAtmosphereCyclones, fetchAtmosphereFireTile, fetchAtmosphereFires, fetchAtmosphereLightning, lightningTileUrl } from '@/moteur/api/scene';
// Importe l'assemblage d'une mosaïque de tuiles (le même que pour les nuages satellite).
import { loadCloudMosaic } from '@/moteur/engine/earthCloudMosaic';
// Importe le rafraîchissement qui ne tourne pas onglet caché.
import { refreshWhileVisible } from './useMapFeeds';
// Importe les réglages (lecture, bornes, mémoire) et les textes d'aide.
import { cycloneHint, fireHint, lightningHint, rememberAtmosphere, sanitizeAtmosphere, storedAtmosphere } from './atmosphereSettings';
// Importe le choix et la mise en forme des tuiles de détail des incendies.
import { FIRE_DETAIL_ALT, FIRE_KIND, mergeDetailTiles, normalizeFireColumns, tilesAround, viewRadiusDeg } from '@/moteur/engine/atmosphere/fireMath';

// Rafraîchissement des incendies : toutes les 30 minutes (rythme des fichiers FIRMS côté serveur).
const FIRES_REFRESH_MS = 30 * 60_000;
// Rafraîchissement des cyclones : toutes les 15 minutes.
const CYCLONES_REFRESH_MS = 15 * 60_000;
// Contrôle de la vue pour le détail des incendies : toutes les 1,5 s (jamais à chaque image).
const DETAIL_CHECK_MS = 1_500;
// Durée de vie d'une tuile de détail en mémoire : 30 minutes.
const TILE_TTL_MS = 30 * 60_000;
// Nombre maximal de tuiles gardées en mémoire.
const TILE_CACHE_MAX = 48;
// Nombre maximal de tuiles lues en même temps.
const TILE_PARALLEL = 4;
// Altitude (rayons terrestres) au-dessus de laquelle le détail est libéré.
const DETAIL_RELEASE_ALT = 0.7;
// Foudre : couche mondiale relue toutes les 2 minutes (niveau 2 : 16 tuiles).
const LIGHTNING_MAP_REFRESH_MS = 2 * 60_000;
// Foudre : impacts relus toutes les minutes (rythme du fournisseur), contrôle de la vue toutes les 5 s.
const LIGHTNING_REFRESH_MS = 60_000, LIGHTNING_CHECK_MS = 5_000;
// Foudre : altitude (rayons terrestres) au-delà de laquelle les impacts un par un ne sont pas demandés (≈ 6 000 km).
const LIGHTNING_MAX_ALT = 0.95;

/**
 * Moteur atmosphérique, côté interface : réglages des calques (gardés dans le navigateur), lectures du serveur à
 * leur rythme (jamais par image), détail des incendies par tuile autour du point visé, et textes d'aide.
 */
// Déclare et exporte le crochet useAtmosphere : reçoit le moteur.
export function useAtmosphere({ engine }) {
  // État : réglages des calques, lus dans le navigateur.
  const [settings, setSettings] = useState(storedAtmosphere);
  // État : dernière réponse des incendies (null : pas encore ; 'erreur' : échec).
  const [fireInfo, setFireInfo] = useState(null);
  // État : dernière réponse des cyclones (null : pas encore ; 'erreur' : échec).
  const [cycloneInfo, setCycloneInfo] = useState(null);
  // État : dernière réponse de la foudre (null : pas encore ; 'erreur' : échec) et point visé trop lointain.
  const [lightningInfo, setLightningInfo] = useState(null);
  // État : point visé trop lointain pour les impacts un par un.
  const [lightningFar, setLightningFar] = useState(false);
  // Tuiles de détail en mémoire : clé « colonne,ligne » → { points, at }.
  const tiles = useRef(new Map());

  // update : modifie le réglage d'un calque et le garde ; début de la fonction mémorisée.
  const update = useCallback((layer, patch) => {
    // Nouveaux réglages, bornés (début).
    setSettings((prev) => {
      // Réglages fusionnés puis bornés.
      const next = sanitizeAtmosphere({ ...prev, [layer]: { ...prev[layer], ...patch } });
      // Gardés dans le navigateur.
      rememberAtmosphere(next);
      // Rendus.
      return next;
    // Fin de la mise à jour.
    });
  // Fin de update ; fonction stable.
  }, []);

  // Transmet les réglages des incendies au moteur.
  useEffect(() => { engine?.setAtmosphereLayer('fires', { visible: settings.fires.on, opacity: settings.fires.opacity, intensity: settings.fires.intensity, windowHours: settings.fires.windowHours }); }, [engine, settings.fires]);
  // Transmet les réglages de la foudre au moteur.
  useEffect(() => { engine?.setAtmosphereLayer('lightning', { visible: settings.lightning.on, opacity: settings.lightning.opacity, intensity: settings.lightning.intensity }); }, [engine, settings.lightning]);
  // Transmet les réglages des cyclones au moteur.
  useEffect(() => { engine?.setAtmosphereLayer('cyclones', { visible: settings.cyclones.on, opacity: settings.cyclones.opacity, intensity: settings.cyclones.intensity }); }, [engine, settings.cyclones]);

  // Incendies allumés : lecture, puis toutes les 30 minutes onglet visible (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.fires.on) return undefined;
    // Contrôleur d'abandon des lectures.
    const controller = new AbortController();
    // load : lit la réponse et la pose dans le moteur.
    const load = () => fetchAtmosphereFires(controller.signal)
      // Réponse reçue : posée, avec l'instant de réception, et gardée pour les textes d'aide.
      .then((data) => { engine.setAtmosphereData('fires', data, Date.now()); setFireInfo(data); })
      // Échec (hors abandon) : noté ; les données déjà posées restent.
      .catch((err) => { if (err?.name !== 'AbortError') setFireInfo((prev) => (prev && prev !== 'erreur' ? prev : 'erreur')); });
    // Première lecture.
    load();
    // Lectures suivantes.
    const stop = refreshWhileVisible(load, FIRES_REFRESH_MS);
    // Nettoyage : abandon et arrêt.
    return () => { controller.abort(); stop(); };
  // Fin de l'effet.
  }, [engine, settings.fires.on]);

  // Incendies allumés : détail par tuile autour du point visé, contrôlé toutes les 1,5 s (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.fires.on) return undefined;
    // Contrôleur d'abandon des lectures.
    const controller = new AbortController();
    // Lectures en cours, par clé.
    const pending = new Set();
    // Clés des tuiles posées dans le moteur (dans l'ordre), pour ne reposer qu'en cas de changement.
    let shown = '';
    // show : pose dans le moteur les tuiles voulues déjà en mémoire, si l'ensemble a changé.
    const show = (wanted) => {
      // Instant courant.
      const now = Date.now();
      // Tuiles voulues présentes et fraîches.
      const ready = wanted.filter((t) => { const e = tiles.current.get(t.key); return e && now - e.at < TILE_TTL_MS; });
      // Signature de l'ensemble.
      const sig = ready.map((t) => t.key).join(';');
      // Inchangé : rien.
      if (sig === shown) return;
      // Noté.
      shown = sig;
      // Points réunis, âges ramenés à l'instant présent (chaque tuile a été reçue à son heure).
      const points = mergeDetailTiles(ready.map((t) => { const e = tiles.current.get(t.key); const late = Math.round((now - e.at) / 60_000); return late ? e.points.map((p) => ({ ...p, ageMin: p.ageMin + late })) : e.points; }));
      // Posés dans le moteur.
      engine.setAtmosphereData('fireDetail', points, now);
    // Fin de show.
    };
    // tick : contrôle de la vue (début).
    const tick = () => {
      // Onglet caché : rien.
      if (document.hidden) return;
      // Où regarde la caméra.
      const view = engine.atmosphereView?.();
      // Inconnu : rien.
      if (!view) return;
      // Trop haut : détail libéré (le shader l'efface déjà bien avant).
      if (view.alt > DETAIL_RELEASE_ALT) { if (shown) { shown = ''; engine.setAtmosphereData('fireDetail', [], Date.now()); } return; }
      // Au-dessus du seuil du détail : on garde ce qui est posé.
      if (view.alt > FIRE_DETAIL_ALT) return;
      // Tuiles utiles autour du point visé, les plus proches d'abord.
      const wanted = tilesAround(view.lon, view.lat, viewRadiusDeg(view.alt), 16);
      // Instant courant.
      const now = Date.now();
      // Tuiles manquantes ou périmées, ni déjà en lecture.
      const missing = wanted.filter((t) => { const e = tiles.current.get(t.key); return (!e || now - e.at >= TILE_TTL_MS) && !pending.has(t.key); });
      // Pour les premières, dans la limite des lectures simultanées (début).
      for (const t of missing.slice(0, Math.max(0, TILE_PARALLEL - pending.size))) {
        // Lecture notée.
        pending.add(t.key);
        // Lecture de la tuile (début).
        fetchAtmosphereFireTile(t.tx, t.ty, controller.signal)
          // Reçue : points mis en forme, gardés en mémoire (les plus anciennes tuiles retirées au-delà du maximum).
          .then((data) => { tiles.current.delete(t.key); tiles.current.set(t.key, { points: normalizeFireColumns(data?.detail, FIRE_KIND.hotspot), at: Date.now() }); while (tiles.current.size > TILE_CACHE_MAX) tiles.current.delete(tiles.current.keys().next().value); show(wanted); })
          // Échec : ignoré (la tuile sera redemandée au prochain contrôle).
          .catch(() => {})
          // Dans tous les cas : lecture terminée.
          .finally(() => pending.delete(t.key));
      // Fin des lectures.
      }
      // Pose ce qui est déjà en mémoire.
      show(wanted);
    // Fin de tick.
    };
    // Contrôle régulier.
    const timer = setInterval(tick, DETAIL_CHECK_MS);
    // Premier contrôle.
    tick();
    // Nettoyage : arrêt, abandon des lectures, détail retiré du moteur.
    return () => { clearInterval(timer); controller.abort(); engine.setAtmosphereData('fireDetail', [], Date.now()); };
  // Fin de l'effet.
  }, [engine, settings.fires.on]);

  // Cyclones allumés : lecture, puis toutes les 15 minutes onglet visible (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.cyclones.on) return undefined;
    // Contrôleur d'abandon des lectures.
    const controller = new AbortController();
    // load : lit la réponse et la pose dans le moteur.
    const load = () => fetchAtmosphereCyclones(controller.signal)
      // Réponse reçue : posée et gardée pour les textes d'aide.
      .then((data) => { engine.setAtmosphereData('cyclones', data, Date.now()); setCycloneInfo(data); })
      // Échec (hors abandon) : noté ; les données déjà posées restent.
      .catch((err) => { if (err?.name !== 'AbortError') setCycloneInfo((prev) => (prev && prev !== 'erreur' ? prev : 'erreur')); });
    // Première lecture.
    load();
    // Lectures suivantes.
    const stop = refreshWhileVisible(load, CYCLONES_REFRESH_MS);
    // Nettoyage : abandon et arrêt.
    return () => { controller.abort(); stop(); };
  // Fin de l'effet.
  }, [engine, settings.cyclones.on]);

  // Foudre allumée : couche mondiale, puis toutes les 2 minutes onglet visible (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.lightning.on) return undefined;
    // Contrôleur d'abandon.
    const controller = new AbortController();
    // load : assemble la mosaïque des tuiles relayées et la pose ; échec : la couche reste vide.
    const load = () => loadCloudMosaic(lightningTileUrl, controller.signal, 2).then((canvas) => engine.setAtmosphereData('lightningMap', canvas)).catch(() => {});
    // Première lecture.
    load();
    // Lectures suivantes.
    const stop = refreshWhileVisible(load, LIGHTNING_MAP_REFRESH_MS);
    // Nettoyage : abandon, arrêt, couche retirée.
    return () => { controller.abort(); stop(); engine.setAtmosphereData('lightningMap', null); };
  // Fin de l'effet.
  }, [engine, settings.lightning.on]);

  // Foudre allumée : impacts un par un autour du point visé, à la minute ou quand le point visé change (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.lightning.on) return undefined;
    // Contrôleur d'abandon.
    const controller = new AbortController();
    // Dernière cellule demandée et heure de la demande.
    let lastKey = '', lastAt = 0, busy = false;
    // tick : contrôle de la vue (début).
    const tick = () => {
      // Onglet caché ou lecture en cours : rien.
      if (document.hidden || busy) return;
      // Où regarde la caméra.
      const view = engine.atmosphereView?.();
      // Inconnu : rien.
      if (!view) return;
      // Trop haut : impacts retirés, couche mondiale seule.
      if (view.alt > LIGHTNING_MAX_ALT) { setLightningFar(true); if (lastKey) { lastKey = ''; engine.setAtmosphereData('lightning', null, Date.now()); } return; }
      // Assez près.
      setLightningFar(false);
      // Cellule d'un demi-degré du point visé (comme le serveur).
      const key = `${Math.round(view.lon * 2) / 2},${Math.round(view.lat * 2) / 2}`;
      // Même cellule, lue il y a moins d'une minute : rien.
      if (key === lastKey && Date.now() - lastAt < LIGHTNING_REFRESH_MS) return;
      // Demande notée.
      lastKey = key; lastAt = Date.now(); busy = true;
      // Lecture (début).
      fetchAtmosphereLightning(view.lon, view.lat, controller.signal)
        // Reçue : posée et gardée pour le texte d'aide.
        .then((data) => { engine.setAtmosphereData('lightning', data, Date.now()); setLightningInfo(data); })
        // Échec (hors abandon) : noté.
        .catch((err) => { if (err?.name !== 'AbortError') setLightningInfo((prev) => (prev && prev !== 'erreur' ? prev : 'erreur')); })
        // Lecture terminée.
        .finally(() => { busy = false; });
    // Fin de tick.
    };
    // Contrôle régulier.
    const timer = setInterval(tick, LIGHTNING_CHECK_MS);
    // Premier contrôle.
    tick();
    // Nettoyage : arrêt, abandon, impacts retirés.
    return () => { clearInterval(timer); controller.abort(); engine.setAtmosphereData('lightning', null, Date.now()); };
  // Fin de l'effet.
  }, [engine, settings.lightning.on]);

  // Renvoie les réglages, leur modification, les textes d'aide et les réponses (début).
  return {
    // Réglages des calques.
    settings,
    // Modification d'un réglage.
    update,
    // Texte d'aide des incendies.
    fireHint: fireHint(fireInfo),
    // Texte d'aide des cyclones.
    cycloneHint: cycloneHint(cycloneInfo),
    // Texte d'aide de la foudre.
    lightningHint: lightningHint(lightningInfo, lightningFar),
    // Dernières réponses (pour la mention des sources).
    fireInfo, cycloneInfo, lightningInfo,
  // Fin du retour.
  };
// Fin de useAtmosphere.
}
