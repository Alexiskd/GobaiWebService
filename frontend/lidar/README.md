# Moteur LiDAR (LAS / LAZ)

Moteur WebGL 2 de nuages de points, sans three.js, pour les fichiers `.las` et `.laz` (LAS 1.0 à 1.4, formats de point 0 à 10).

## Installation (dans `frontend/`)

```bash
cp -r lidar src/lidar
npm install laz-perf          # décompression LAZ (WebAssembly)
```

Dans `vite.config.js` :

```js
export default defineConfig({
  // …
  worker: { format: 'es' },                  // le worker charge laz-perf à la demande
  optimizeDeps: { exclude: ['laz-perf'] },   // garde laz-perf.wasm à côté de son module
});
```

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
node --test src/lidar/lidar.test.mjs
```

## Commandes

Souris : glisser pour tourner, clic droit ou Maj pour déplacer, molette pour zoomer vers le curseur, double-clic pour
recentrer. Tactile : un doigt tourne, deux doigts zooment et déplacent, double tape recentre.
Clavier (canvas actif) : flèches, + / −, R vue globale, T vue de dessus, M mesure, Échap efface.
