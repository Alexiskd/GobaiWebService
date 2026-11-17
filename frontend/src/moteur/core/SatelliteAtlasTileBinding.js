/**
 * Adaptateur expérimental entre les entrées de l'atlas multi-couches et les
 * uniforms déjà exposés par le shader TileLayer (r128 / GLSL1).
 * Aucun chargement ni ownership GPU n'est transféré à TileLayer.
 */

const CHANNEL_TO_UNIFORM = Object.freeze({
  color: 'map',
  elevation: 'hMap',
  night: 'ltMap',
});

function rect4(value, label) {
  if (!value || value.length !== 4) throw new TypeError(`${label} doit contenir [x, y, largeur, hauteur].`);
  const rect = Array.from(value, Number);
  if (!rect.every(Number.isFinite) || rect[2] <= 0 || rect[3] <= 0) {
    throw new RangeError(`${label} doit être un rectangle UV fini et positif.`);
  }
  return rect;
}

/** Compose un rectangle local de tuile avec le rectangle UV de l'entrée atlas. */
export function composeSatelliteAtlasUvRect(atlasRect, tileRect = [0, 0, 1, 1]) {
  const [ax, ay, aw, ah] = rect4(atlasRect, 'atlasRect');
  const [tx, ty, tw, th] = rect4(tileRect, 'tileRect');
  if (tx < 0 || ty < 0 || tx + tw > 1 + 1e-7 || ty + th > 1 + 1e-7) {
    throw new RangeError('tileRect doit rester dans le carré UV [0,1].');
  }
  return new Float32Array([ax + tx * aw, ay + ty * ah, tw * aw, th * ah]);
}

function setTexture(uniforms, name, texture) {
  const uniform = uniforms[name];
  if (!uniform || !('value' in uniform)) return false;
  uniform.value = texture;
  return true;
}

function setRect(uniforms, name, rect) {
  const uniform = uniforms[name];
  if (!uniform || !uniform.value) return false;
  if (typeof uniform.value.set === 'function') uniform.value.set(...rect);
  else uniform.value = new Float32Array(rect);
  return true;
}

function setFlag(uniforms, name, value) {
  if (uniforms[name] && 'value' in uniforms[name]) uniforms[name].value = value;
}

/**
 * Branche les canaux pris en charge par le shader TileLayer actuel.
 * Retourne les canaux appliqués et ceux qui restent en attente d'un shader.
 * `tileRect` permet de sélectionner une sous-région de l'image source.
 */
export function bindSatelliteAtlasEntryToTileUniforms(entry, uniforms, { tileRect = [0, 0, 1, 1] } = {}) {
  if (!entry || entry.status !== 'ready' || !entry.textures || !uniforms) {
    throw new TypeError('Une entrée atlas prête et les uniforms TileLayer sont requis.');
  }
  const atlasRect = rect4(entry.uv, 'entry.uv');
  const rect = composeSatelliteAtlasUvRect(atlasRect, tileRect);
  const applied = [];
  const pending = [];

  for (const channel of Object.keys(entry.textures)) {
    const uniformName = CHANNEL_TO_UNIFORM[channel];
    if (!uniformName) { pending.push(channel); continue; }
    if (!setTexture(uniforms, uniformName, entry.textures[channel])) { pending.push(channel); continue; }
    const rectName = channel === 'color' ? 'baseRect' : channel === 'elevation' ? 'hRect' : 'ltRect';
    if (!setRect(uniforms, rectName, rect)) { pending.push(channel); continue; }
    if (channel === 'elevation') setFlag(uniforms, 'hHas', 1);
    if (channel === 'night') setFlag(uniforms, 'ltHas', 1);
    applied.push(channel);
  }
  return Object.freeze({ applied: Object.freeze(applied), pending: Object.freeze(pending), rect });
}

export const SATELLITE_TILE_ATLAS_UNIFORM_MAP = CHANNEL_TO_UNIFORM;
