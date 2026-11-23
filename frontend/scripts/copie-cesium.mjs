// Copie les fichiers statiques de CesiumJS (Workers, ThirdParty, Assets, Widgets) dans public/cesium, avant le build :
// CesiumJS les charge à l'exécution depuis CESIUM_BASE_URL (« /cesium », voir engines/astre-solide). Sans le paquet
// installé, le script s'arrête sans erreur (le globe CesiumJS reste alors désactivé, la scène three.js garde la Terre).
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Dossier du frontend.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Fichiers compilés du paquet cesium.
const build = join(root, 'node_modules', 'cesium', 'Build', 'Cesium');
// Destination, servie telle quelle par Vite et par le serveur.
const dest = join(root, 'public', 'cesium');
// Paquet absent : rien à copier.
if (!existsSync(build)) { console.warn('cesium : paquet absent, copie sautée'); process.exit(0); }
// Repart d'un dossier vide (pas de fichiers d'une ancienne version).
rmSync(dest, { recursive: true, force: true });
// Copie des quatre dossiers.
for (const dir of ['Workers', 'ThirdParty', 'Assets', 'Widgets']) cpSync(join(build, dir), join(dest, dir), { recursive: true });
// Fin.
console.log('cesium : fichiers statiques copiés dans public/cesium');
