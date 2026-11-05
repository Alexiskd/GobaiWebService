import { useCallback, useEffect, useRef, useState } from 'react';
import { loadLidarCloud } from '@lidar/loadCloud.js';

// Nuages LAS / LAZ affichés sur le globe : chargement (worker), géoréférencement, couche three.js du moteur.
// La couche vit tant que le moteur existe, panneau ouvert ou non : les nuages restent posés sur la Terre.
// three.js est importé à la demande, comme le moteur (hors du bundle initial).

const EXTENSIONS = /\.(las|laz)$/i;
let sequence = 0;

export function useGlobeLidar({ engine, push }) {
  const layerRef = useRef(null);
  const pushRef = useRef(push); // référence stable : la couche ne dépend que du moteur
  pushRef.current = push;
  const jobsRef = useRef(new Map()); // id → { cancel }
  const [clouds, setClouds] = useState([]);
  const [pointSize, setPointSizeState] = useState(2);
  const [layerReady, setLayerReady] = useState(false);

  const patch = useCallback((id, values) => {
    setClouds((list) => list.map((c) => (c.id === id ? { ...c, ...(typeof values === 'function' ? values(c) : values) } : c)));
  }, []);

  // Couche créée avec le moteur, détruite avec lui (les nuages chargés y sont rattachés à nouveau).
  useEffect(() => {
    if (!engine?.earth?.mesh) return undefined;
    let cancelled = false;
    let layer = null;
    import('@lidar/GlobeLidarLayer.js').then(({ GlobeLidarLayer }) => {
      if (cancelled) return;
      layer = new GlobeLidarLayer(engine);
      layerRef.current = layer;
      setLayerReady(true);
    }).catch((error) => pushRef.current?.(`Couche LiDAR indisponible : ${error.message}`, 'warn'));
    return () => {
      cancelled = true;
      layer?.dispose();
      layerRef.current = null;
      setLayerReady(false);
      setClouds((list) => list.map((c) => (c.status === 'ready' ? { ...c, status: 'pending', attached: false } : c)));
    };
  }, [engine]);

  // Rattache à la couche les nuages chargés mais pas encore placés (couche prête après le chargement, moteur recréé).
  useEffect(() => {
    const layer = layerRef.current;
    if (!layerReady || !layer) return;
    for (const cloud of clouds) {
      if (cloud.status !== 'pending' || !cloud.result || cloud.attached) continue;
      if (!cloud.result.geo && !cloud.placement) {
        patch(cloud.id, { status: 'needs-position' });
        continue;
      }
      try {
        layer.add(cloud.result, { id: cloud.id, placement: cloud.placement, colorMode: cloud.colorMode, groundClamp: cloud.groundClamp });
        layer.setVisible(cloud.id, cloud.visible);
        const c = layer.get(cloud.id);
        patch(cloud.id, { status: 'ready', attached: true, colorMode: c.colorMode, lat: c.frame.lat, lon: c.frame.lon });
      } catch (error) {
        patch(cloud.id, { status: 'error', error: error.message });
      }
    }
  }, [clouds, layerReady, patch]);

  const addSource = useCallback((source, name) => {
    const id = `cloud-${++sequence}`;
    const label = name || source?.name || (typeof source === 'string' ? source.split('/').pop() : 'nuage');
    setClouds((list) => [...list, {
      id, name: label, source, status: 'loading', phase: 'Lecture du fichier', ratio: 0, error: '',
      result: null, info: null, placement: null, attached: false, visible: true, groundClamp: true, colorMode: null,
    }]);
    const job = loadLidarCloud(source, {
      name: label,
      onProgress: ({ phase, ratio }) => patch(id, { phase, ratio }),
      onHeader: (header) => patch(id, { crsLabel: header.crsLabel }),
    });
    jobsRef.current.set(id, job);
    job.promise.then((result) => {
      jobsRef.current.delete(id);
      const info = {
        pointCount: result.pointCount,
        filePointCount: result.filePointCount,
        stride: result.stride,
        hasRgb: result.hasRgb,
        crsLabel: result.header?.crsLabel,
        projection: result.geo?.label || null,
        classCounts: result.classCounts,
        sizeMeters: [0, 1, 2].map((i) => result.bounds.max[i] - result.bounds.min[i]),
      };
      patch(id, { status: result.geo ? 'pending' : 'needs-position', result, info, lat: result.geo?.lat, lon: result.geo?.lon });
      if (!result.geo) pushRef.current?.(`${label} : système de coordonnées non reconnu, indiquez sa position.`, 'warn');
    }).catch((error) => {
      jobsRef.current.delete(id);
      patch(id, { status: 'error', error: error.message });
    });
    return id;
  }, [patch]);

  const addFiles = useCallback((files) => {
    const list = [...(files || [])];
    const valid = list.filter((f) => EXTENSIONS.test(f.name));
    if (valid.length < list.length) pushRef.current?.('Seuls les fichiers .las et .laz sont pris en charge.', 'warn');
    return valid.map((file) => addSource(file, file.name));
  }, [addSource]);

  const addUrl = useCallback((url) => addSource(url), [addSource]);

  const remove = useCallback((id) => {
    jobsRef.current.get(id)?.cancel();
    jobsRef.current.delete(id);
    layerRef.current?.remove(id);
    setClouds((list) => list.filter((c) => c.id !== id));
  }, []);

  /** Position manuelle (fichier sans système de coordonnées, ou recalage). */
  const place = useCallback((id, lat, lon) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
    const layer = layerRef.current;
    if (layer?.get(id)) {
      layer.setPlacement(id, { lat, lon });
      patch(id, { placement: { lat, lon }, lat, lon });
    } else {
      patch(id, { placement: { lat, lon }, lat, lon, status: 'pending', attached: false });
    }
    return true;
  }, [patch]);

  const setColorMode = useCallback((id, mode) => {
    layerRef.current?.setColorMode(id, mode);
    patch(id, { colorMode: mode });
  }, [patch]);

  const setGroundClamp = useCallback((id, on) => {
    layerRef.current?.setGroundClamp(id, on);
    patch(id, { groundClamp: on });
  }, [patch]);

  const setVisible = useCallback((id, on) => {
    layerRef.current?.setVisible(id, on);
    patch(id, { visible: on });
  }, [patch]);

  const setPointSize = useCallback((px) => {
    layerRef.current?.setPointSize(px);
    setPointSizeState(px);
  }, []);

  /** Amène la caméra au-dessus du nuage (même mécanique que la recherche de lieu). */
  const flyTo = useCallback((id) => {
    const target = layerRef.current?.locate(id);
    if (!target || !engine) return;
    const cloud = layerRef.current.get(id);
    engine.goTo({ name: cloud?.name || 'Nuage LiDAR', lon: target.lon, lat: target.lat });
    // Altitude adaptée à l'emprise : tout le nuage dans le champ (≈ 2,5 × son rayon), entre 300 m et 60 km.
    const altitude = Math.min(60_000, Math.max(300, target.radiusMeters * 2.5));
    engine.distGoal = 1 + altitude / 6_371_000;
  }, [engine]);

  useEffect(() => () => { for (const job of jobsRef.current.values()) job.cancel(); }, []);

  return { clouds, pointSize, addFiles, addUrl, remove, place, setColorMode, setGroundClamp, setVisible, setPointSize, flyTo };
}
