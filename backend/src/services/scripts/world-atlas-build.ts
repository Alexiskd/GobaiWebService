/**
 * Refabrique le TopoJSON des pays de World Atlas — outil serveur, sans route HTTP ni interface utilisateur.
 *
 *   npm run world-atlas:build                          → Natural Earth importé → backend/data/vendor/world-atlas/countries-50m.json
 *   npm run world-atlas:build -- <geojson> <topojson>  → autre source (fichier ou adresse http) et autre fichier de sortie
 */
// Charge le fichier .env dans process.env.
import 'dotenv/config';
// writeFile : écrit un fichier en entier, de façon asynchrone.
import { writeFile } from 'node:fs/promises';
// Lecture de la configuration.
import { loadConfiguration } from '../../common/configuration';
// Chemins du GeoJSON Natural Earth et du TopoJSON produit, et service World Atlas.
import { NATURAL_EARTH_COUNTRIES, WORLD_ATLAS_COUNTRIES, WorldAtlasService } from '../world-atlas/world-atlas.service';

// Fonction principale du script.
async function main() {
  // Arguments de la ligne de commande : la source et le fichier de sortie, avec les chemins du projet par défaut.
  const [source = NATURAL_EARTH_COUNTRIES, target = WORLD_ATLAS_COUNTRIES] = process.argv.slice(2);
  // Crée le service et fabrique la topologie des pays à partir de la source.
  const { topology, stats } = await new WorldAtlasService(loadConfiguration()).build(source);
  // Écrit la topologie en JSON compact, en UTF-8.
  await writeFile(target, JSON.stringify(topology), 'utf8');
  // Affiche le bilan : pays, anneaux, arcs, jonctions, et le fichier écrit.
  console.log(`${stats.countries} pays, ${stats.rings} anneaux, ${stats.arcs} arcs, ${stats.junctions} jonctions → ${target}`);
// Fin de main.
}

// Lance le script ; en cas d'erreur :
main().catch((e) => {
  // affiche son message ;
  console.error((e as Error).message);
  // et fixe le code de sortie à 1, sans couper le processus.
  process.exitCode = 1;
// Fin du traitement d'erreur.
});
