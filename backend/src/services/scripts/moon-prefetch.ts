/**
 * Préchargement complet de la Lune sur le disque, sans démarrer l'API.
 *   npm run moon:prefetch            → niveaux 0 à MOON_PREFETCH_MAX_ZOOM (4 par défaut)
 *   npm run moon:prefetch -- 6       → niveaux 0 à 6 (≈ 22 000 tuiles, quelques centaines de Mo)
 * Les tuiles déjà présentes sont sautées : on peut l'interrompre (Ctrl+C) et le relancer.
 */
// Charge le fichier .env dans process.env.
import 'dotenv/config';
// Lecture de la configuration.
import { loadConfiguration } from '../../common/configuration';
// Service du cache disque des tuiles de la Lune.
import { MoonTileCacheService } from '../map-tiles/moon-tile-cache.service';

// Fonction principale du script.
async function main() {
  // Lit la configuration.
  const config = loadConfiguration();
  // Premier argument de la ligne de commande, s'il y en a un.
  const arg = process.argv[2];
  // Niveau maximal : l'argument converti en entier et borné entre 0 et 10 s'il est donné, sinon la valeur de la configuration (jamais négative).
  const maxZoom = arg !== undefined ? Math.min(10, Math.max(0, Number.parseInt(arg, 10) || 0)) : Math.max(0, config.tiles.moonCache.prefetchMaxZoom);
  // Crée le service du cache, sans démarrer l'API.
  const service = new MoonTileCacheService(config);
  // Nombre de tuiles des niveaux 0 au niveau maximal.
  const total = MoonTileCacheService.countTiles(maxZoom);
  // Annonce ce qui va être téléchargé, et dans quel dossier.
  console.log(`Lune : niveaux 0 à ${maxZoom}, ${total} tuiles → ${config.tiles.moonCache.dir}`);
  // À partir du niveau 8 : prévient du volume et de la durée.
  if (maxZoom >= 8) console.log('Attention : plusieurs Go et de nombreuses heures de téléchargement.');

  // Instant du dernier affichage de l'avancement.
  let last = 0;
  // Lance le préchargement et attend sa fin ; la fonction donnée est appelée à chaque progrès :
  const s = await service.prefetchAll(maxZoom, config.tiles.moonCache.prefetchConcurrency, (p) => {
    // instant présent ;
    const now = Date.now();
    // au plus un affichage par seconde, et toujours le dernier ;
    if (now - last > 1000 || p.done === p.total) {
      // on note l'instant ;
      last = now;
      // réécrit la même ligne du terminal (\r) : tuiles faites sur le total, pourcentage, et échecs s'il y en a.
      process.stdout.write(`\r  ${p.done}/${p.total} (${Math.floor((100 * p.done) / p.total)} %)${p.failed ? ` · ${p.failed} échecs` : ''}   `);
    // Fin de l'affichage.
    }
  // Fin de la fonction d'avancement et de l'appel.
  });
  // Bilan : tuiles en cache, et échecs s'il y en a.
  console.log(`\nTerminé : ${s.done - s.failed}/${s.total} tuiles en cache${s.failed ? `, ${s.failed} échecs (relancer pour réessayer)` : ''}.`);
  // Termine le processus : code 1 s'il y a eu des échecs, 0 sinon.
  process.exit(s.failed ? 1 : 0);
// Fin de main.
}

// Lance le script ; toute erreur est affichée et le processus se termine avec le code 1.
main().catch((e) => { console.error(e); process.exit(1); });
