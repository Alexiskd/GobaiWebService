import { useEffect, useState } from 'react';
import { fetchShadowCam, fetchShadowCamMeta, resolveApiUrl } from '@/api';

/** Calques propres à la Lune : lieux, sondes, modèle 3D NASA, ShadowCam et couleurs naturelles. */
export function useMoonLayers({ engine, focus, moonIndex, push }) {
  const [moonFeatures, setMoonFeatures] = useState(false);
  const [moonOrbiters, setMoonOrbiters] = useState(false);
  const [moonModel, setMoonModel] = useState(false);
  const [shadowcam, setShadowcam] = useState(false);
  const [shadowcamInfo, setShadowcamInfo] = useState(null);
  const [moonModelInfo, setMoonModelInfo] = useState(null);
  const [moonColorOk, setMoonColorOk] = useState(null);

  useEffect(() => { engine?.setMoonFeatureTypes(moonFeatures ? ['landing', 'mare', 'crater', 'region'] : []); }, [engine, moonFeatures]);
  useEffect(() => { engine?.setMoonOrbitersVisible(moonOrbiters); }, [engine, moonOrbiters]);
  useEffect(() => { engine?.setMoonModelVisible(moonModel); }, [engine, moonModel]);
  useEffect(() => { engine?.setShadowCamVisible(shadowcam); }, [engine, shadowcam]);

  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchShadowCam(ctrl.signal)
      .then((r) => {
        engine.setShadowCam(r.items, {
          meta: (id, res) => fetchShadowCamMeta(id, res),
          imageUrl: (id, res) => resolveApiUrl(`/api/v1/danuri/shadowcam/${encodeURIComponent(id)}/${res}/image.png`),
        });
        setShadowcamInfo({ count: r.items.length, source: r.source });
      })
      .catch((e) => { if (e.name !== 'AbortError') setShadowcamInfo({ error: e.message }); });
    return () => ctrl.abort();
  }, [engine]);

  // Modèle 3D : chargé seulement quand la Lune est ciblée et le calque activé.
  useEffect(() => {
    if (!engine || focus !== moonIndex || !moonModel || moonModelInfo) return;
    setMoonModelInfo('loading');
    engine.loadMoonModel(resolveApiUrl('/api/v1/tiles/moon-model.glb'))
      .then((info) => setMoonModelInfo(info || {}))
      .catch((err) => {
        setMoonModelInfo({ error: err.message || String(err) });
        push(`Modèle 3D de la Lune indisponible : ${err.message || err}`, 'warn', 9000);
      });
  }, [engine, focus, moonIndex, moonModel, moonModelInfo, push]);

  useEffect(() => {
    if (!engine) return undefined;
    let alive = true;
    engine.loadMoonColor(resolveApiUrl('/api/v1/tiles/moon-color.jpg'))
      .then(() => { if (alive) setMoonColorOk(true); })
      .catch((err) => {
        if (!alive) return;
        setMoonColorOk(false);
        push(`Couleurs de la Lune indisponibles : ${err.message}`, 'warn', 9000);
      });
    return () => { alive = false; };
  }, [engine, push]);

  return {
    moonFeatures, setMoonFeatures, moonOrbiters, setMoonOrbiters, moonModel, setMoonModel,
    shadowcam, setShadowcam, shadowcamInfo, moonModelInfo, moonColorOk,
  };
}
