/**
 * Rendu 2D de l'itinéraire (canvas) : carte simple (quadrillage de latitudes et longitudes) où les tracés sont dessinés
 * avec le style de leur moteur (couleur, épaisseur, pointillés, arrêts) et le véhicule se déplace avec son pictogramme.
 * Les étapes aériennes, dans la vue d'ensemble, sont tracées en arc pointillé léger : leur modélisation 3D a sa propre vue.
 */
import { fitProjection, pointAt, unwrapLongitudes } from './geo.js';
import { locate } from './modes.js';

/** Couleurs du rendu, reprises du thème de l'interface par l'appelant. */
const DEFAULT_COLORS = { background: '#0b1220', grid: 'rgba(255,255,255,.08)', text: '#e8eefc', start: '#43a047', end: '#e53935' };

/**
 * Crée le rendu d'un canvas. `draw(tracks, u, options)` dessine les tracés et le véhicule à la fraction u (0 à 1).
 * `options` : { colors, highlight (index de l'étape mise en avant, ou null pour tout) }.
 */
export function createRenderer2D(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, ratio = 1;

  /** Adapte la taille du canvas à son affichage (écrans à haute densité compris). */
  function resize() {
    ratio = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(120, Math.round(rect.width || canvas.clientWidth || 320));
    height = Math.max(120, Math.round(rect.height || canvas.clientHeight || 240));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw(tracks, u = 0, options = {}) {
    const colors = { ...DEFAULT_COLORS, ...(options.colors ?? {}) };
    if (!width) resize();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    if (!tracks.length) return;

    // Longitudes continues sur l'ensemble du tracé, puis projection qui fait tout tenir dans le cadre.
    const all = unwrapLongitudes(tracks.flatMap((t) => t.points));
    const { project, scale } = fitProjection(all, width, height, 36);
    let offset = 0;
    const flat = tracks.map((t) => { const pts = all.slice(offset, offset + t.points.length); offset += t.points.length; return { track: t, pts }; });

    drawGraticule(ctx, all, project, scale, width, height, colors);
    flat.forEach(({ track, pts }, i) => {
      const dim = options.highlight != null && options.highlight !== i;
      drawTrack(ctx, track, pts, project, dim);
    });
    // Départ (A) et arrivée (B).
    const first = flat[0].pts[0], last = flat[flat.length - 1].pts.at(-1);
    drawMarker(ctx, project(first), 'A', colors.start);
    drawMarker(ctx, project(last), 'B', colors.end);

    // Véhicule : sur l'étape choisie, ou sur l'ensemble selon le temps.
    const spot = options.highlight != null ? { track: tracks[options.highlight], local: u, index: options.highlight } : locate(tracks, u);
    if (spot) {
      const pts = flat[spot.index].pts;
      const p = pointAt(pts, spot.local);
      drawVehicle(ctx, project(p), spot.track);
    }
  }

  return { resize, draw, get size() { return { width, height }; } };
}

/** Quadrillage : un pas « rond » de degrés selon l'échelle, avec quelques graduations. */
function drawGraticule(ctx, pts, project, scale, width, height, colors) {
  const degPerPx = 1 / scale;
  const target = degPerPx * 90;
  const steps = [0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30];
  const step = steps.find((s) => s >= target) ?? 30;
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats) - step * 6, maxLat = Math.max(...lats) + step * 6, minLon = Math.min(...lons) - step * 6, maxLon = Math.max(...lons) + step * 6;
  ctx.save();
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let lat = Math.ceil(minLat / step) * step; lat <= maxLat; lat += step) { const y = Math.round(project({ lat, lon: lons[0] })[1]) + 0.5; if (y >= 0 && y <= height) { ctx.moveTo(0, y); ctx.lineTo(width, y); } }
  for (let lon = Math.ceil(minLon / step) * step; lon <= maxLon; lon += step) { const x = Math.round(project({ lat: lats[0], lon })[0]) + 0.5; if (x >= 0 && x <= width) { ctx.moveTo(x, 0); ctx.lineTo(x, height); } }
  ctx.stroke();
  ctx.restore();
}

/** Un tracé : trait du moteur ; arc léger pour une étape aérienne ; points d'arrêt pour les transports à arrêts. */
function drawTrack(ctx, track, pts, project, dim) {
  ctx.save();
  ctx.globalAlpha = dim ? 0.25 : 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = track.color;
  ctx.lineWidth = track.dimension === '3d' ? 2 : track.width;
  ctx.setLineDash(track.dimension === '3d' ? [3, 7] : track.dash);
  ctx.beginPath();
  pts.forEach((p, i) => { const [x, y] = project(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = track.color; ctx.lineWidth = 2;
  for (const s of track.stops ?? []) {
    const [x, y] = project(nearest(pts, s));
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/** Point du tracé le plus proche d'un arrêt (le tracé lissé ne passe pas exactement par les points d'origine). */
function nearest(pts, s) {
  let best = pts[0], bd = Infinity;
  for (const p of pts) { const d = (p.lat - s.lat) ** 2 + (p.lon - s.lon) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}

/** Repère rond avec une lettre (A, B). */
function drawMarker(ctx, [x, y], letter, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y + 0.5);
  ctx.restore();
}

/** Véhicule : pastille à la couleur du moteur avec son pictogramme. */
function drawVehicle(ctx, [x, y], track) {
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = track.color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.font = '16px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(track.glyph, x, y + 1);
  ctx.restore();
}
