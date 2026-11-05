# Moteur LiDAR (LAS / LAZ)

Moteur WebGL 2 de nuages de points, sans three.js, pour les fichiers `.las` et `.laz` (LAS 1.0 à 1.4, formats de point 0 à 10),
et couche three.js qui pose ces nuages sur le globe terrestre de Gobai Space.

## Intégration (déjà faite dans `frontend/`)

- Alias Vite `@lidar` → `frontend/lidar`, `worker: { format: 'es' }`, `optimizeDeps.exclude: ['laz-perf']` (`vite.config.js`).
- Bouton **LiDAR** de la barre d'outils → panneau `src/components/menus/LidarGlobe/LidarGlobe.jsx`.
- État et couche 3D : `src/components/scene/useGlobeLidar.jsx` (les nuages restent sur la Terre panneau fermé).

## Sur le globe

```js
import { loadLidarCloud } from '@lidar/loadCloud.js';
const { GlobeLidarLayer } = await import('@lidar/GlobeLidarLayer.js'); // three.js chargé à la demande

const layer = new GlobeLidarLayer(engine);              // SolarEngine : earth.mesh, cam, renderer
const result = await loadLidarCloud(fichierOuUrl).promise; // points en mètres Est-Nord-Haut autour du centre
const id = layer.add(result);                           // position lue dans le système de coordonnées du fichier
layer.add(result, { placement: { lat, lon } });         // fichier sans système reconnu : placement manuel
layer.setColorMode(id, 'classification');               // rgb | elevation | intensity | classification | returns
layer.setGroundClamp(id, false);                        // altitude du fichier au lieu du sol posé sur la sphère
```

Systèmes reconnus (`georef.js`) : Lambert-93 (2154), CC42 à CC50 (3942 à 3950), UTM WGS84 / ETRS89 / outre-mer,
Web Mercator (3857), géographique (4326, 4171, 4258…). Systèmes composés (ex. LiDAR HD IGN 2154 + NGF-IGN69) lus via le WKT.
Le globe n'ayant pas de relief, le sol du nuage est posé sur la sphère par défaut (« Poser au sol »).

## Utilisation

Visionneuse complète (React + MUI) :

```jsx
import { LidarViewer } from '@/lidar';

<div style={{ height: '100vh' }}>
  <LidarViewer />                                   {/* glisser-déposer ou bouton Ouvrir */}
  {/* ou : <LidarViewer source="/data/dalle.laz" /> */}
</div>
```

Moteur seul :

```js
import { LidarEngine } from '@/lidar';

const engine = new LidarEngine(div);
engine.on('progress', ({ phase, ratio }) => console.log(phase, ratio));
const info = await engine.load(fichier);   // File, ArrayBuffer ou URL
engine.setColorMode('classification');     // rgb | elevation | intensity | classification | returns
engine.setTool('measure');
engine.dispose();
```

## Tests

```bash
npm run test:lidar
```

## Commandes

Souris : glisser pour tourner, clic droit ou Maj pour déplacer, molette pour zoomer vers le curseur, double-clic pour
recentrer. Tactile : un doigt tourne, deux doigts zooment et déplacent, double tape recentre.
Clavier (canvas actif) : flèches, + / −, R vue globale, T vue de dessus, M mesure, Échap efface.
