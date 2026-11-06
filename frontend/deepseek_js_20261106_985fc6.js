/**
 * satelliteCapture.js
 * Capture satellite exacte d'une emprise (4 coins GPS) depuis google.com/maps
 * sans clé API, via Playwright + recalage affine (méthodologie Web Mercator).
 *
 *  1. Web Mercator : zoom fractionnaire pour que |TL→TR| = width px CSS.
 *  2. Ouverture de /maps/@lat,lng,Zz/data=!3m1!1e3 (satellite) dans un viewport
 *     = emprise englobante (gère la rotation / coins non orthogonaux).
 *  3. Masquage UI, attente des tuiles, screenshot.
 *  4. Recalage affine en canvas 2D → PNG au ratio exact de l'appareil.
 *
 * Install : npm i playwright && npx playwright install chromium
 */
import { chromium } from 'playwright';

const TILE = 256;

// ─── Projection Web Mercator ───────────────────────────────────────────────
export function latLngToWorld({ lat, lng }, zoom) {
  const size = TILE * 2 ** zoom;
  const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size,
  };
}
export function worldToLatLng({ x, y }, zoom) {
  const size = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / size;
  return { lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI, lng: (x / size) * 360 - 180 };
}
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// ─── Fonction principale ───────────────────────────────────────────────────
/**
 * @param {{topLeft:{lat,lng}, topRight:{lat,lng}, bottomRight:{lat,lng}, bottomLeft:{lat,lng}}} corners
 * @param {object} opts
 * @param {number} opts.width       largeur écran cible (px CSS)
 * @param {number} opts.height      hauteur écran cible (px CSS)
 * @param {number} [opts.dpr=2]     device pixel ratio (PNG = width·dpr × height·dpr)
 * @param {boolean} [opts.labels=false] conserver routes/libellés (hybride)
 * @param {boolean} [opts.headless=true]
 * @param {number} [opts.settleMs=4000] délai de stabilisation des tuiles
 * @param {number} [opts.tolerance=0.02] tolérance géométrie (2%)
 * @param {number} [opts.maxViewport=4096] garde-fou taille de capture
 */
export async function captureSatelliteFromCorners(corners, opts) {
  const {
    width, height, dpr = 2, labels = false, headless = true,
    settleMs = 4000, tolerance = 0.02, maxViewport = 4096,
  } = opts;

  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  for (const [k, c] of Object.entries(corners))
    if (typeof c?.lat !== 'number' || typeof c?.lng !== 'number')
      throw new Error(`Coin invalide : ${k}`);
  const warnings = [];

  // 1. Zoom fractionnaire : |TL→TR| doit mesurer `width` px CSS
  const zoom = Math.log2(width / dist(latLngToWorld(topLeft, 0), latLngToWorld(topRight, 0)));
  if (zoom > 21) warnings.push(`Zoom ${zoom.toFixed(2)} > 21 : imagerie probablement floue`);

  const P = {
    tl: latLngToWorld(topLeft, zoom),
    tr: latLngToWorld(topRight, zoom),
    br: latLngToWorld(bottomRight, zoom),
    bl: latLngToWorld(bottomLeft, zoom),
  };

  // Contrôles géométriques
  const geoRatio = dist(P.tl, P.tr) / dist(P.tl, P.bl);
  if (Math.abs(geoRatio / (width / height) - 1) > tolerance)
    warnings.push(`Ratio emprise ${geoRatio.toFixed(3)} ≠ ratio écran ${(width / height).toFixed(3)} → image étirée`);

  const expBR = { x: P.tr.x + P.bl.x - P.tl.x, y: P.tr.y + P.bl.y - P.tl.y };
  if (dist(expBR, P.br) / dist(P.tl, P.br) > tolerance)
    warnings.push('Coins non parallélogramme : BR ignoré (recalage sur TL/TR/BL)');

  // 2. Emprise englobante → viewport de capture (centré)
  const xs = Object.values(P).map(p => p.x), ys = Object.values(P).map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const vw = Math.ceil(maxX - minX) + 2;
  const vh = Math.ceil(maxY - minY) + 2;
  if (vw > maxViewport || vh > maxViewport)
    throw new Error(`Viewport ${vw}×${vh} > ${maxViewport} : réduis width/height ou le zoom`);
  const center = worldToLatLng({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, zoom);

  const url = `https://www.google.com/maps/@${center.lat.toFixed(7)},${center.lng.toFixed(7)},${zoom.toFixed(2)}z/data=!3m1!1e3?hl=fr`;

  const browser = await chromium.launch({
    headless,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  try {
    const ctx = await browser.newContext({
      viewport: { width: vw, height: vh },
      deviceScaleFactor: dpr,
      locale: 'fr-FR',
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Consentement cookies UE (best effort)
    for (const name of ['Tout refuser', 'Reject all', 'Tout accepter', 'Accept all']) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await btn.click();
        await page.waitForURL(/google\.[a-z.]+\/maps/, { timeout: 30000 }).catch(() => {});
        break;
      }
    }

    await page.waitForSelector('canvas', { timeout: 30000 });

    if (!labels) {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b =>
          /libell|labels/i.test(b.getAttribute('aria-label') || b.textContent));
        btn?.click();
      }).catch(() => {});
    }

    // Masquage : seul le <canvas> WebGL reste visible
    await page.addStyleTag({ content: `
      html, body { background:#000 !important; }
      body * { visibility:hidden !important; }
      canvas { visibility:visible !important; }
    ` });

    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(settleMs);

    const raw = await page.screenshot({ type: 'png' });

    // 3. Recalage affine : écran cible ← capture
    const off = { x: (minX + maxX) / 2 - vw / 2, y: (minY + maxY) / 2 - vh / 2 };
    const toS = p => ({ x: (p.x - off.x) * dpr, y: (p.y - off.y) * dpr });
    const tl = toS(P.tl), tr = toS(P.tr), bl = toS(P.bl);
    const W = Math.round(width * dpr), H = Math.round(height * dpr);

    const a = (tr.x - tl.x) / W, b = (tr.y - tl.y) / W;
    const c = (bl.x - tl.x) / H, d = (bl.y - tl.y) / H;
    const det = a * d - b * c;
    const M = [d / det, -b / det, -c / det, a / det];
    M.push(-(M[0] * tl.x + M[2] * tl.y), -(M[1] * tl.x + M[3] * tl.y));

    const outB64 = await page.evaluate(async ({ src, W, H, M }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
      const g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.setTransform(...M);
      g.drawImage(img, 0, 0);
      return cv.toDataURL('image/png').split(',')[1];
    }, { src: `data:image/png;base64,${raw.toString('base64')}`, W, H, M });

    return { png: Buffer.from(outB64, 'base64'), zoom, center, url, warnings };
  } finally {
    await browser.close();
  }
}