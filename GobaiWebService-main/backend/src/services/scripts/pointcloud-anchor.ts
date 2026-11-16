/**
 * Calage GPS d'un nuage LiDAR — outil serveur, sans route HTTP ni interface utilisateur.
 * La coordonnée GPS est posée au centre du nuage, en bas de la projection (centre de l'emprise X/Y, Z minimal).
 *
 *   npm run pointcloud:anchor -- <nom> <lat> <lon> [alt] [cap]   → écrit POINTCLOUD_DIR/anchors/<nom>.json
 *   npm run pointcloud:anchor -- <nom>                            → affiche le calage actuel et l'emprise placée
 *   npm run pointcloud:anchor -- <nom> --remove                   → retire le calage
 *
 *   alt : altitude ellipsoïdale du bas du nuage en mètres (0 par défaut)
 *   cap : angle de l'axe +Y du nuage par rapport au nord vrai, degrés, sens horaire (0 par défaut)
 */
// Charge le fichier .env dans process.env.
import 'dotenv/config';
// Lecture de la configuration.
import { loadConfiguration } from '../../common/configuration';
// Service des nuages de points.
import { PointCloudsService } from '../pointclouds/pointclouds.service';
// Fonctions du calage : normaliser, calculer les coins placés, lire, retirer, écrire.
import { normalizeAnchor, placedFootprint, readAnchor, removeAnchor, writeAnchor } from '../pointclouds/lidar-anchor';

// Fonction fmt : écrit une position en texte, latitude et longitude à 7 décimales, altitude à 2 décimales.
const fmt = (g: { lat: number; lon: number; alt: number }) => `${g.lat.toFixed(7)}, ${g.lon.toFixed(7)}, ${g.alt.toFixed(2)} m`;

// Fonction principale du script.
async function main() {
  // Arguments de la ligne de commande : le nom du nuage, puis le reste.
  const [name, ...rest] = process.argv.slice(2);
  // Sans nom : erreur qui rappelle l'usage.
  if (!name) throw new Error('Usage : npm run pointcloud:anchor -- <nom> [<lat> <lon> [alt] [cap] | --remove]');

  // Crée le service, sans démarrer l'API.
  const service = new PointCloudsService(loadConfiguration());
  // Vérifie que le nom est acceptable (pas de chemin, extension connue).
  service.assertName(name);
  // Lit la description du nuage.
  const cloud = await service.get(name);
  // Dossier des nuages.
  const dir = service.directory;

  // Option --remove :
  if (rest[0] === '--remove') {
    // retire le calage ;
    await removeAnchor(dir, name);
    // le dit ;
    console.log(`Calage retiré : ${name}`);
    // et s'arrête.
    return;
  // Fin du cas.
  }

  // Si au moins une latitude et une longitude sont données :
  if (rest.length >= 2) {
    // convertit les arguments en nombres : latitude, longitude, altitude, cap ;
    const [lat, lon, alt, heading] = rest.map(Number);
    // vérifie le calage et l'écrit dans son fichier ;
    const path = await writeAnchor(dir, name, normalizeAnchor({ lat, lon, alt, heading }));
    // indique où.
    console.log(`Calage écrit : ${path}`);
  // Fin du cas.
  }

  // Relit le calage enregistré.
  const anchor = await readAnchor(dir, name);
  // Aucun calage : le dit et s'arrête.
  if (!anchor) { console.log(`${name} : aucun calage.`); return; }
  // Affiche la position GPS et le cap.
  console.log(`${name} : GPS ${fmt(anchor)}, cap ${anchor.heading}°`);
  // En-tête LAS illisible : le dit et s'arrête, l'emprise est inconnue.
  if (!cloud.header) { console.log('En-tête LAS illisible : emprise inconnue.'); return; }
  // Point d'ancrage dans les coordonnées du fichier : centre de l'emprise, tout en bas.
  const o = PointCloudsService.anchorOrigin(cloud.header);
  // L'affiche.
  console.log(`Point d'ancrage natif (centre, bas) : ${o.x}, ${o.y}, ${o.z}`);
  // Si le système de coordonnées est géographique (en degrés) et non projeté (en mètres) :
  if (cloud.header.coordinateSystemWkt?.includes('GEOGCS') && !cloud.header.coordinateSystemWkt.includes('PROJCS')) {
    // avertit que le calage suppose des mètres.
    console.log('Attention : CRS géographique (degrés). Le calage suppose des coordonnées natives en mètres.');
  // Fin de l'avertissement.
  }
  // Annonce les coins.
  console.log('Coins du bas placés :');
  // Affiche la position GPS de chacun des coins du bas de l'emprise, une fois le nuage placé.
  for (const c of placedFootprint(cloud.header.bounds, anchor)) console.log(`  ${fmt(c)}`);
// Fin de main.
}

// Lance le script ; une erreur affiche son message et termine le processus avec le code 1.
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
