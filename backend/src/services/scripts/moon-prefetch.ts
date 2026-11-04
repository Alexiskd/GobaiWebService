/**
 * Préchargement complet de la Lune sur le disque, sans démarrer l'API.
 *   npm run moon:prefetch            → niveaux 0 à MOON_PREFETCH_MAX_ZOOM (4 par défaut)
 *   npm run moon:prefetch -- 6       → niveaux 0 à 6 (≈ 22 000 tuiles, quelques centaines de Mo)
 * Les tuiles déjà présentes sont sautées : on peut l'interrompre (Ctrl+C) et le relancer.
 */
import 'dotenv/config';
import { loadConfiguration } from '../../common/configuration';
import { MoonTileCacheService } from '../map-tiles/moon-tile-cache.service';

async function main() {
  const config = loadConfiguration();
  const arg = process.argv[2];
  const maxZoom = arg !== undefined ? Math.min(10, Math.max(0, Number.parseInt(arg, 10) || 0)) : Math.max(0, config.tiles.moonCache.prefetchMaxZoom);
  const service = new MoonTileCacheService(config);
  const total = MoonTileCacheService.countTiles(maxZoom);
  console.log(`Lune : niveaux 0 à ${maxZoom}, ${total} tuiles → ${config.tiles.moonCache.dir}`);
  if (maxZoom >= 8) console.log('Attention : plusieurs Go et de nombreuses heures de téléchargement.');

  let last = 0;
  const s = await service.prefetchAll(maxZoom, config.tiles.moonCache.prefetchConcurrency, (p) => {
    const now = Date.now();
    if (now - last > 1000 || p.done === p.total) {
      last = now;
      process.stdout.write(`\r  ${p.done}/${p.total} (${Math.floor((100 * p.done) / p.total)} %)${p.failed ? ` · ${p.failed} échecs` : ''}   `);
    }
  });
  console.log(`\nTerminé : ${s.done - s.failed}/${s.total} tuiles en cache${s.failed ? `, ${s.failed} échecs (relancer pour réessayer)` : ''}.`);
  process.exit(s.failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
