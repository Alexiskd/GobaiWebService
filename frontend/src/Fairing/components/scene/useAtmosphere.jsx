// Importe de React les crochets useCallback, useEffect, useRef et useState.
import { useCallback, useEffect, useRef, useState } from 'react';
// Importe les lectures du moteur atmosphérique du serveur.
import { aerosolForecastUrl, aerosolObservedUrl, fetchAtmosphereAerosols, fetchAtmosphereWinds, fetchAtmosphereCyclones, fetchAtmosphereFireTile, fetchAtmosphereFires, fetchAtmosphereLightning, fetchAtmosphereRadar, fetchAtmosphereStorms, lightningTileUrl, radarTileUrl } from '@/Car/api/scene';
// Importe l'assemblage d'une mosaïque de tuiles (le même que pour les nuages satellite).
import { loadCloudMosaic } from '@/Car/engine/earthCloudMosaic';
// Importe le rafraîchissement qui ne tourne pas onglet caché.
import { refreshWhileVisible } from './useMapFeeds.jsx';
// Importe les réglages (lecture, bornes, mémoire) et les textes d'aide.
import { aerosolHint, cycloneHint, fireHint, lightningHint, precipitationHint, rememberAtmosphere, sanitizeAtmosphere, stormHint, storedAtmosphere, windHint } from './atmosphereSettings.jsx';
// Importe le choix des images et des tuiles du radar.
import { RADAR_DETAIL_ALT, RADAR_DETAIL_RELEASE_ALT, RADAR_GLOBAL_ZOOM, detailBlock, framesToShow, normalizeFrames } from '@/Car/engine/atmosphere/radarMath';
// Importe le chargement d'un bloc de tuiles radar décodées.
import { loadImageCanvas, loadRadarBlock } from '@/Car/engine/atmosphere/radarTiles';
// Importe la lecture de la réponse des aérosols.
import { normalizeAerosols } from '@/Car/engine/atmosphere/aerosolMath';
// Importe le choix et la mise en forme des tuiles de détail des incendies.
import { FIRE_DETAIL_ALT, FIRE_KIND, mergeDetailTiles, normalizeFireColumns, tilesAround, viewRadiusDeg } from '@/Car/engine/atmosphere/fireMath';

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
// Radar : index relu toutes les 5 minutes (une image toutes les 10 minutes chez Rain Viewer) ; nouvel essai d'une
// image manquante au bout de 30 s ; contrôle de la vue pour le détail toutes les 2 s.
const RADAR_REFRESH_MS = 5 * 60_000, RADAR_RETRY_MS = 30_000, RADAR_CHECK_MS = 2_000;
// Radar : blocs de détail gardés en mémoire (images de deux blocs).
const RADAR_DETAIL_CACHE = 14;
// Orages : relus toutes les 3 minutes.
const STORMS_REFRESH_MS = 3 * 60_000;
// Aérosols : relus toutes les 30 minutes (images observées refaites au plus toutes les heures côté serveur).
const AEROSOLS_REFRESH_MS = 30 * 60_000;
// Vents : relus toutes les 30 minutes (le serveur interroge le modèle au plus toutes les 8 heures).
const WINDS_REFRESH_MS = 30 * 60_000;

/**
 * Moteur atmosphérique, côté interface : réglages des calques (gardés dans le navigateur), lectures du serveur à
 * leur rythme (jamais par image), détail des incendies et du radar autour du point visé, aérosols observés ou
 * prévus, vents par niveau, et textes d'aide.
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
  // État : dernière réponse du radar (null : pas encore ; 'erreur' : échec).
  const [radarInfo, setRadarInfo] = useState(null);
  // État : dernière réponse des orages (null : pas encore ; 'erreur' : échec).
  const [stormInfo, setStormInfo] = useState(null);
  // État : dernière réponse des aérosols (null : pas encore ; 'erreur' : échec).
  const [aerosolInfo, setAerosolInfo] = useState(null);
  // État : dernière réponse des vents (null : pas encore ; 'erreur' : échec).
  const [windInfo, setWindInfo] = useState(null);
  // Tuiles de détail en mémoire : clé « colonne,ligne » → { points, at }.
  const tiles = useRef(new Map());
  // Radar : images mondiales en mémoire (identifiant → { time, canvas }), images voulues, blocs de détail en mémoire.
  const radarGlobal = useRef(new Map()), radarFrames = useRef([]), radarDetail = useRef(new Map());
  // Aérosols : images de la prévision en mémoire (heure ISO → canevas).
  const aerosolForecast = useRef(new Map());

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
  // Transmet les réglages du radar au moteur.
  useEffect(() => { engine?.setAtmosphereLayer('precipitation', { visible: settings.precipitation.on, opacity: settings.precipitation.opacity, intensity: settings.precipitation.intensity, animate: settings.precipitation.animate, coverage: settings.precipitation.coverage }); }, [engine, settings.precipitation]);
  // Transmet les réglages des orages au moteur.
  useEffect(() => { engine?.setAtmosphereLayer('storms', { visible: settings.storms.on, opacity: settings.storms.opacity, intensity: settings.storms.intensity }); }, [engine, settings.storms]);
  // Transmet les réglages des aérosols au moteur.
  useEffect(() => { engine?.setAtmosphereLayer('aerosols', { visible: settings.aerosols.on, opacity: settings.aerosols.opacity, intensity: settings.aerosols.intensity, product: settings.aerosols.product, animate: settings.aerosols.animate }); }, [engine, settings.aerosols]);
  // Transmet les réglages des vents au moteur.
  useEffect(() => { engine?.setAtmosphereLayer('winds', { visible: settings.winds.on, opacity: settings.winds.opacity, intensity: settings.winds.intensity, level: settings.winds.level, jets: settings.winds.jets }); }, [engine, settings.winds]);
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

  // Radar allumé : index des images, puis images mondiales chargées une à une, la plus récente d'abord (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.precipitation.on) return undefined;
    // Contrôleur d'abandon.
    const controller = new AbortController();
    // Chargement en cours, nouvel essai programmé.
    let busy = false, retry = null;
    // push : pose dans le moteur les images voulues déjà chargées.
    const push = () => engine.setAtmosphereData('radarGlobal', radarFrames.current.filter((f) => radarGlobal.current.has(f.id)).map((f) => radarGlobal.current.get(f.id)));
    // loadFrames : charge les images manquantes (début).
    const loadFrames = async () => {
      // Déjà en cours : rien.
      if (busy) return;
      // Noté.
      busy = true;
      // Une image a échoué.
      let failed = false;
      // Images voulues, la plus récente d'abord (début).
      for (const f of [...radarFrames.current].reverse()) {
        // Déjà chargée : suivante.
        if (radarGlobal.current.has(f.id)) continue;
        // Essai (début).
        try {
          // Bloc mondial (2 × 2 tuiles du niveau 1).
          const canvas = await loadRadarBlock((z, x, y) => radarTileUrl(f.id, z, x, y), { z: RADAR_GLOBAL_ZOOM, x0: 0, y0: 0, n: 2 }, controller.signal);
          // Gardée et posée.
          radarGlobal.current.set(f.id, { time: f.time, canvas }); push();
        // Échec : abandon (calque éteint) → arrêt ; sinon noté, image suivante.
        } catch (err) { if (err?.name === 'AbortError') { busy = false; return; } failed = true; }
      // Fin des images.
      }
      // Terminé.
      busy = false;
      // Une image manque : nouvel essai dans 30 s.
      if (failed && !controller.signal.aborted) { clearTimeout(retry); retry = setTimeout(loadFrames, RADAR_RETRY_MS); }
    // Fin de loadFrames.
    };
    // load : lit l'index, choisit les images, oublie les anciennes, charge les nouvelles (début).
    const load = () => fetchAtmosphereRadar(controller.signal).then((data) => {
      // Réponse gardée pour le texte d'aide.
      setRadarInfo(data);
      // Images voulues : les dernières (animation) ou la dernière.
      radarFrames.current = framesToShow(normalizeFrames(data), settings.precipitation.animate);
      // Images mondiales qui ne sont plus voulues : oubliées.
      for (const id of [...radarGlobal.current.keys()]) if (!radarFrames.current.some((f) => f.id === id)) radarGlobal.current.delete(id);
      // Posées, puis chargement des manquantes.
      push(); loadFrames();
    // Échec (hors abandon) : noté ; les images déjà posées restent.
    }).catch((err) => { if (err?.name !== 'AbortError') setRadarInfo((prev) => (prev && prev !== 'erreur' ? prev : 'erreur')); });
    // Première lecture.
    load();
    // Lectures suivantes.
    const stop = refreshWhileVisible(load, RADAR_REFRESH_MS);
    // Nettoyage : abandon, arrêt, images retirées du moteur (gardées en mémoire pour un rallumage).
    return () => { controller.abort(); stop(); clearTimeout(retry); engine.setAtmosphereData('radarGlobal', []); };
  // Fin de l'effet.
  }, [engine, settings.precipitation.on, settings.precipitation.animate]);

  // Radar allumé : bloc de détail autour du point visé, contrôlé toutes les 2 s (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.precipitation.on) return undefined;
    // Contrôleur d'abandon.
    const controller = new AbortController();
    // Signature du bloc posé (bloc et images), chargement en cours.
    let shown = '', busy = false;
    // tick : contrôle de la vue (début).
    const tick = async () => {
      // Onglet caché ou chargement en cours : rien.
      if (document.hidden || busy) return;
      // Où regarde la caméra.
      const view = engine.atmosphereView?.();
      // Inconnu : rien.
      if (!view) return;
      // Trop haut : détail retiré.
      if (view.alt > RADAR_DETAIL_RELEASE_ALT) { if (shown) { shown = ''; engine.setAtmosphereData('radarDetail', null); } return; }
      // Entre les deux seuils : on garde ce qui est posé.
      if (view.alt > RADAR_DETAIL_ALT) return;
      // Images voulues.
      const frames = radarFrames.current;
      // Aucune encore : rien.
      if (!frames.length) return;
      // Bloc autour du point visé.
      const block = detailBlock(view.lon, view.lat);
      // Signature : bloc et images.
      const sig = `${block.key}|${frames.map((f) => f.id).join(',')}`;
      // Inchangée : rien.
      if (sig === shown) return;
      // Chargement noté.
      busy = true;
      // Images du bloc chargées.
      const list = [];
      // Images, la plus récente d'abord (début).
      for (const f of [...frames].reverse()) {
        // Clé en mémoire.
        const k = `${f.id}|${block.key}`;
        // Canevas en mémoire.
        let canvas = radarDetail.current.get(k);
        // Absent : chargé (échec : on s'arrête, nouvel essai au prochain contrôle).
        if (!canvas) { try { canvas = await loadRadarBlock((z, x, y) => radarTileUrl(f.id, z, x, y), block, controller.signal); } catch { busy = false; return; } radarDetail.current.set(k, canvas); while (radarDetail.current.size > RADAR_DETAIL_CACHE) radarDetail.current.delete(radarDetail.current.keys().next().value); }
        // Ajouté en tête (ordre chronologique).
        list.unshift({ time: f.time, canvas });
        // Posé au fur et à mesure.
        engine.setAtmosphereData('radarDetail', { box: block.box, frames: [...list] });
      // Fin des images.
      }
      // Bloc complet posé.
      shown = sig; busy = false;
    // Fin de tick.
    };
    // Contrôle régulier.
    const timer = setInterval(tick, RADAR_CHECK_MS);
    // Premier contrôle.
    tick();
    // Nettoyage : arrêt, abandon, détail retiré.
    return () => { clearInterval(timer); controller.abort(); engine.setAtmosphereData('radarDetail', null); };
  // Fin de l'effet.
  }, [engine, settings.precipitation.on]);

  // Orages allumés : lecture, puis toutes les 3 minutes onglet visible (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.storms.on) return undefined;
    // Contrôleur d'abandon.
    const controller = new AbortController();
    // load : lit la réponse et la pose dans le moteur.
    const load = () => fetchAtmosphereStorms(controller.signal)
      // Réponse reçue : posée et gardée pour le texte d'aide.
      .then((data) => { engine.setAtmosphereData('storms', data, Date.now()); setStormInfo(data); })
      // Échec (hors abandon) : noté ; les données déjà posées restent.
      .catch((err) => { if (err?.name !== 'AbortError') setStormInfo((prev) => (prev && prev !== 'erreur' ? prev : 'erreur')); });
    // Première lecture.
    load();
    // Lectures suivantes.
    const stop = refreshWhileVisible(load, STORMS_REFRESH_MS);
    // Nettoyage : abandon, arrêt, orages retirés.
    return () => { controller.abort(); stop(); engine.setAtmosphereData('storms', null); };
  // Fin de l'effet.
  }, [engine, settings.storms.on]);

  // Aérosols allumés : réponse relue toutes les 30 minutes ; image observée du produit choisi, ou images de la prévision
  // des poussières chargées une à une, de la plus proche à la plus lointaine (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.aerosols.on) return undefined;
    // Contrôleur d'abandon.
    const controller = new AbortController();
    // Produit choisi.
    const product = settings.aerosols.product;
    // Version de l'image observée posée, chargement en cours.
    let version = '', busy = false;
    // load : lit la réponse, puis l'image ou les images voulues (début).
    const load = () => fetchAtmosphereAerosols(controller.signal).then(async (data) => {
      // Réponse gardée pour le texte d'aide.
      setAerosolInfo(data);
      // Déjà en chargement : rien de plus.
      if (busy) return;
      // Mise en forme.
      const n = normalizeAerosols(data);
      // Chargement noté.
      busy = true;
      // Essai (début).
      try {
        // Produit observé (début).
        if (product !== 'dust') {
          // Indisponible : image retirée (aucune couleur sans mesure).
          if (!n.products[product]?.available) { version = ''; engine.setAtmosphereData('aerosolObserved', null); return; }
          // Version : le jour et l'heure (le serveur refait l'image au plus toutes les heures).
          const v = `${n.days?.today ?? ''}-${Math.floor(Date.now() / 3_600_000)}`;
          // Déjà posée : rien.
          if (v === version) return;
          // Image chargée puis posée.
          const canvas = await loadImageCanvas(aerosolObservedUrl(product, v), controller.signal);
          // Version notée.
          version = v;
          // Posée.
          engine.setAtmosphereData('aerosolObserved', { product, canvas });
          // Fin du produit observé.
          return;
        // Fin du cas.
        }
        // Prévision indisponible : images retirées.
        if (!n.forecast.available) { engine.setAtmosphereData('aerosolForecast', []); return; }
        // Images oubliées si leur heure n'est plus dans la liste.
        for (const k of [...aerosolForecast.current.keys()]) if (!n.forecast.times.some((t) => t.iso === k)) aerosolForecast.current.delete(k);
        // Images posées au fur et à mesure.
        const frames = [];
        // Heure par heure, la plus proche d'abord (début).
        for (const t of n.forecast.times) {
          // Canevas en mémoire.
          let canvas = aerosolForecast.current.get(t.iso);
          // Absent : chargé (échec : heure suivante ; abandon : arrêt).
          if (!canvas) { try { canvas = await loadImageCanvas(aerosolForecastUrl(t.iso), controller.signal); } catch (err) { if (err?.name === 'AbortError') return; continue; } aerosolForecast.current.set(t.iso, canvas); }
          // Ajouté.
          frames.push({ time: t.t, canvas });
          // Posées.
          engine.setAtmosphereData('aerosolForecast', [...frames]);
        // Fin des heures.
        }
      // Fin de l'essai : chargement terminé.
      } finally { busy = false; }
    // Échec (hors abandon) : noté ; les images déjà posées restent.
    }).catch((err) => { if (err?.name !== 'AbortError') setAerosolInfo((prev) => (prev && prev !== 'erreur' ? prev : 'erreur')); });
    // Première lecture.
    load();
    // Lectures suivantes.
    const stop = refreshWhileVisible(load, AEROSOLS_REFRESH_MS);
    // Nettoyage : abandon, arrêt, images retirées du moteur.
    return () => { controller.abort(); stop(); engine.setAtmosphereData('aerosolObserved', null); engine.setAtmosphereData('aerosolForecast', []); };
  // Fin de l'effet.
  }, [engine, settings.aerosols.on, settings.aerosols.product]);

  // Vents allumés : lecture, puis toutes les 30 minutes onglet visible (début de l'effet).
  useEffect(() => {
    // Sans moteur, ou calque éteint : rien.
    if (!engine || !settings.winds.on) return undefined;
    // Contrôleur d'abandon.
    const controller = new AbortController();
    // Heure de validité posée (on ne repose pas les mêmes vents : les particules repartiraient).
    let posed = null;
    // load : lit la réponse et la pose si elle a changé.
    const load = () => fetchAtmosphereWinds(controller.signal)
      // Réponse reçue : gardée pour le texte d'aide, posée si nouvelle.
      .then((data) => { setWindInfo(data); const key = `${data?.validAt}|${data?.source?.fetchedAt}`; if (key !== posed) { posed = key; engine.setAtmosphereData('winds', data, Date.now()); } })
      // Échec (hors abandon) : noté ; les vents déjà posés restent.
      .catch((err) => { if (err?.name !== 'AbortError') setWindInfo((prev) => (prev && prev !== 'erreur' ? prev : 'erreur')); });
    // Première lecture.
    load();
    // Lectures suivantes.
    const stop = refreshWhileVisible(load, WINDS_REFRESH_MS);
    // Nettoyage : abandon, arrêt, vents retirés.
    return () => { controller.abort(); stop(); engine.setAtmosphereData('winds', null); };
  // Fin de l'effet.
  }, [engine, settings.winds.on]);

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
    // Texte d'aide du radar.
    precipitationHint: precipitationHint(radarInfo),
    // Texte d'aide des orages.
    stormHint: stormHint(stormInfo),
    // Texte d'aide des aérosols, pour le produit choisi.
    aerosolHint: aerosolHint(aerosolInfo, settings.aerosols.product),
    // Texte d'aide des vents, pour le niveau choisi.
    windHint: windHint(windInfo, settings.winds.level),
    // Dernières réponses (pour la mention des sources).
    fireInfo, cycloneInfo, lightningInfo, radarInfo, stormInfo, aerosolInfo, windInfo,
  // Fin du retour.
  };
// Fin de useAtmosphere.
}
