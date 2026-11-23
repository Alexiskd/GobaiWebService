# cesium-earth — la Terre de près en CesiumJS

Le système solaire reste en three.js. Quand la Terre est ciblée et que la caméra descend sous 20 000 km, le globe
CesiumJS prend la main au même endroit ; au-dessus de 30 000 km dans le globe, retour à three.js. Un seul moteur
dessine à la fois.

| Fichier | Rôle |
|---|---|
| `cesium-earth.module.js` | Passage three.js ↔ CesiumJS, conteneur du globe, mise en attente de la scène three.js. |
| `cesium-earth.viewer.js` | Crée le globe (CesiumJS chargé seulement à la première approche de la Terre). |
| `cesium-earth.handoff.js` | Règles du passage (altitudes d'entrée, de sortie, de retour, réarmement). |
| `cesium-earth.sources.js` | Imagerie ouverte, sans clé : NASA GIBS, Sentinel-2 cloudless (EOX), orthophotos IGN. |

Sans Cesium ion ni aucune clé. Fichiers statiques de CesiumJS copiés dans `public/cesium` au build
(`scripts/copie-cesium.mjs`).
