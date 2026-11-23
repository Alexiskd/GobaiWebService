# cesium-earth — la Terre de près en CesiumJS

Le système solaire reste en three.js. Quand la Terre est ciblée et que la caméra descend sous 20 000 km, le globe
CesiumJS prend la main au même endroit ; au-dessus de 30 000 km dans le globe, retour à three.js. Un seul moteur
dessine à la fois.

| Fichier | Rôle |
|---|---|
| `cesium-earth.module.js` | Passage three.js ↔ CesiumJS, conteneur du globe, mise en attente de la scène three.js. |
| `cesium-earth.viewer.js` | Crée le globe (CesiumJS chargé seulement à la première approche de la Terre). |
| `cesium-earth.camera.js` | Caméra du globe pilotée par les commandes de three.js : navball, +/−, verrou du nord, vue 3/4, pilotage au téléphone, lieux, villes, position ; HUD (distance, échelle, boussole). |
| `cesium-earth.camera-math.js` | Calculs purs de cette caméra (zoom, tangage, déplacement, cap). |
| `cesium-earth.handoff.js` | Règles du passage (altitudes d'entrée, de sortie, de retour, réarmement). |
| `cesium-earth.sources.js` | Imagerie ouverte, sans clé : NASA GIBS, Sentinel-2 cloudless (EOX), orthophotos IGN. |

Terre toujours en CesiumJS : même quand la scène three.js a la main (au-dessus de 20 000 km), la Terre est dessinée
par le globe CesiumJS, par-dessus la scène three.js. À chaque image three.js, la caméra du globe suit la caméra
three.js (`engine.earthCameraView` → `CesiumEarth.overlayFrame` → `threeViewToCesium`), la Terre de three.js et ses
tuiles sont cachées, puis le globe dessine une image (`drawOverlay`). Terre hors de l'écran ou sous 1 pixel : three.js
la dessine. Les tuiles three.js de la Terre ne sont plus demandées tant que le globe la dessine.

Fond spatial transparent : le globe CesiumJS n'a ni ciel étoilé, ni Soleil, ni Lune, et son canevas a un canal alpha.
Après chaque image du globe, la scène three.js (étoiles, Soleil, Lune, planètes) est redessinée dessous, sans la Terre,
vue de la caméra du globe (`CesiumEarth.drawBackdrop` → `engine.renderCesiumBackdrop`, repère ECEF traduit par
`ecefToTilesLocal`).

Sans Cesium ion ni aucune clé. Fichiers statiques de CesiumJS copiés dans `public/cesium` au build
(`scripts/copie-cesium.mjs`).
