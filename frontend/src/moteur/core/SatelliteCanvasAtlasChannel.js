/**
 * Fabrique un canal CanvasTexture pour l'atlas expérimental. THREE et le document
 * sont injectés afin de garder le module testable sans navigateur.
 */
export function createSatelliteCanvasAtlasChannel(THREE, { documentRef = globalThis.document, anisotropy = 1 } = {}) {
  if (!THREE || typeof THREE.CanvasTexture !== 'function') throw new TypeError('THREE.CanvasTexture est requis.');
  if (!documentRef || typeof documentRef.createElement !== 'function') throw new Error('Canvas indisponible : canal atlas désactivé.');
  return {
    createPage({ pageSize }) {
      const canvas = documentRef.createElement('canvas');
      canvas.width = pageSize;
      canvas.height = pageSize;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Impossible de créer le contexte 2D de l’atlas.');
      const texture = new THREE.CanvasTexture(canvas);
      texture.flipY = true; // v=1 correspond au nord, comme les textures historiques de TileLayer.
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = Math.max(1, Math.floor(Number(anisotropy) || 1));
      return { canvas, context, texture };
    },
    blit(page, source, allocation) {
      const { context } = page;
      const { x, y, width, height, gutter } = allocation;
      const sw = Number(source.naturalWidth || source.videoWidth || source.width);
      const sh = Number(source.naturalHeight || source.videoHeight || source.height);
      if (!(sw > 0 && sh > 0)) throw new TypeError('Image source invalide pour l’atlas.');
      context.drawImage(source, 0, 0, sw, sh, x, y, width, height);
      if (gutter > 0) {
        // Extrusion des quatre bords et des coins pour limiter le bleeding mipmap.
        context.drawImage(source, 0, 0, sw, 1, x, y - gutter, width, gutter);
        context.drawImage(source, 0, sh - 1, sw, 1, x, y + height, width, gutter);
        context.drawImage(source, 0, 0, 1, sh, x - gutter, y, gutter, height);
        context.drawImage(source, sw - 1, 0, 1, sh, x + width, y, gutter, height);
        context.drawImage(source, 0, 0, 1, 1, x - gutter, y - gutter, gutter, gutter);
        context.drawImage(source, sw - 1, 0, 1, 1, x + width, y - gutter, gutter, gutter);
        context.drawImage(source, 0, sh - 1, 1, 1, x - gutter, y + height, gutter, gutter);
        context.drawImage(source, sw - 1, sh - 1, 1, 1, x + width, y + height, gutter, gutter);
      }
    },
  };
}
