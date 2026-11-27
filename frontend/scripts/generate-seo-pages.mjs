/**
 * Génère les pages SEO statiques, le sitemap et llms-full à partir de la source backend.
 * Le backend doit être compilé avant le frontend (commande build à la racine).
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(here, '..');
const dist = join(frontendRoot, 'dist');
const backendModule = join(frontendRoot, '..', 'backend', 'dist', 'services', 'core', 'data', 'body-pages.js');
const require = createRequire(import.meta.url);
const { BODY_PAGES, WINDOW_PAGES, SITE_URL, renderBodyPage, renderBodyMarkdown } = require(backendModule);
const allPages = [...BODY_PAGES, ...WINDOW_PAGES];
const template = await readFile(join(dist, 'index.html'), 'utf8');
let lastmod = process.env.SEO_LASTMOD;
if (!lastmod) {
  try { lastmod = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: join(frontendRoot, '..'), encoding: 'utf8' }).trim(); }
  catch { lastmod = new Date().toISOString().slice(0, 10); }
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) throw new Error(`SEO_LASTMOD invalide : ${lastmod}`);

for (const page of allPages) {
  const pageHtml = renderBodyPage(template, page);
  const target = join(dist, page.slug, 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, pageHtml, 'utf8');
}

const urls = [
  { loc: `${SITE_URL}/`, priority: '1.0' },
  ...allPages.map((page) => ({ loc: `${SITE_URL}/${page.slug}`, priority: page.kind === 'fenêtre' ? '0.5' : '0.8' })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(({ loc, priority }) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>${priority}</priority></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(dist, 'sitemap.xml'), sitemap, 'utf8');

const llms = await readFile(join(frontendRoot, 'public', 'llms.txt'), 'utf8');
const full = [llms.trim(), ...allPages.map((page) => renderBodyMarkdown(page).trim())].join('\n\n---\n\n') + '\n';
await writeFile(join(dist, 'llms-full.txt'), full, 'utf8');

console.log(`[SEO] ${allPages.length} pages HTML pré-générées, sitemap (${urls.length} URL) et llms-full.txt créés.`);
