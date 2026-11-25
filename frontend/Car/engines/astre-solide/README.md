# astre-solide — les astres solides en CesiumJS

Le système solaire reste en three.js ; les astres solides sont dessinés par un globe CesiumJS, avec la même méthode
pour chacun : la Terre, la Lune, Mars, Mercure et les satellites qui ont un fond de carte (Io, Europe, Ganymède,
Callisto, Titan, Encelade…). Les géantes gazeuses et Vénus (sans fond de carte) restent en three.js.

Un seul globe à la fois : celui de l'astre solide ciblé, ou la Terre si la cible n'en est pas un
(`engine.solidGlobeTarget`). Chaque astre solide est découpé en tuiles par CesiumJS, avec ou sans fond de carte, d'après
les données de la composante « Caractéristiques et informations » (`astre-solide.facts.js`) : rayon de la fiche
(ellipsoïde et découpage), type (« Géante… » : pas de globe), épaisseur d'atmosphère (« Aucune » : sans air) et couleur
de l'interface (sol tant que le fond de carte n'est pas là). Restent en three.js : les géantes, Vénus (nuages opaques)
et les satellites irréguliers (Phobos, Deimos : modèle 3D). Quand l'astre visé change, le globe est recréé avec l'ellipsoïde de l'astre (WGS84 pour
la Terre, sphère de son rayon pour les autres).

Deux régimes :
- **Superposition** : three.js a la main. À chaque image, la caméra du globe suit la caméra three.js
  (`engine.solidBodyView` → `AstreSolideGlobe.overlayFrame` → `threeViewToCesium`), l'astre de three.js (sphère,
  modèle, tuiles, atmosphère ; tout le groupe pour la Terre) est caché, puis le globe dessine une image
  (`drawOverlay`). Astre hors de l'écran ou sous 1 pixel : three.js le dessine. Ses tuiles three.js ne sont plus
  demandées tant que le globe le dessine.
- **De près** : astre ciblé et caméra sous 3,14 rayons (20 000 km pour la Terre, 5 455 km pour la Lune), le globe
  prend la main sans saut ; au-dessus de 4,71 rayons, retour à three.js. La scène three.js redessine l'espace derrière
  le globe (`drawBackdrop` → `engine.renderCesiumBackdrop`).

Imagerie : la Terre a ses couches ouvertes (`astre-solide.sources.js`) ; les autres astres reprennent le fond de carte
choisi dans l'app (`engine.solidImagery` → `astre-solide.imagery.js`), lu tel quel dans sa source de tuiles three.js,
avec le même découpage (plate carrée NASA Trek ou Web Mercator). Lumière : même Soleil que la scène three.js
(`syncSun`). Ombre, rotation automatique et gestes : comme dans three.js.

| Fichier | Rôle |
|---|---|
| `astre-solide.module.js` | Astre visé, superposition, passage three.js ↔ CesiumJS, Soleil, ombre, imagerie. |
| `astre-solide.viewer.js` | Crée le globe d'un astre (ellipsoïde, fond transparent, atmosphère selon l'air). |
| `astre-solide.imagery.js` | Fond de carte de l'app lu par CesiumJS (découpage, niveaux). |
| `astre-solide.camera.js` | Caméra du globe pilotée par les commandes de three.js, réglée sur le rayon de l'astre ; HUD. |
| `astre-solide.camera-math.js` | Calculs purs de cette caméra (zoom, tangage, déplacement, repères, vue three.js). |
| `astre-solide.handoff.js` | Règles du passage : altitudes de la Terre ramenées au rayon de chaque astre. |
| `astre-solide.facts.js` | Données du globe lues comme dans la fiche d'information (rayon, type, air, couleur). |
| `astre-solide.sources.js` | Imagerie ouverte de la Terre, sans clé : NASA GIBS, Sentinel-2 cloudless (EOX), IGN. |

Sans Cesium ion ni aucune clé. Fichiers statiques de CesiumJS copiés dans `public/cesium` au build
(`scripts/copie-cesium.mjs`).
