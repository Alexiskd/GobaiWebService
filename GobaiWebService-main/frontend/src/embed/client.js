const NS = 'gobai';
const VERSION = 1;
const DEFAULT_ORIGIN = 'https://www.gobaispace.com';

function resolveOrigin(baseUrl) {
  const parsed = new URL(baseUrl || DEFAULT_ORIGIN, window.location.href);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Gobai Embed doit être servi en HTTPS (sauf en développement local).');
  }
  return parsed.origin;
}

export class GobaiEmbedInstance extends EventTarget {
  constructor(iframe, origin) {
    super();
    this.iframe = iframe;
    this.origin = origin;
    this.destroyed = false;
    this._onMessage = (event) => {
      if (event.source !== this.iframe.contentWindow || event.origin !== this.origin) return;
      const message = event.data;
      if (!message || message.namespace !== NS || message.version !== VERSION || typeof message.type !== 'string') return;
      this.dispatchEvent(new CustomEvent(message.type, { detail: message.payload || {} }));
    };
    window.addEventListener('message', this._onMessage);
  }

  command(type, payload = {}) {
    if (this.destroyed) throw new Error('Cette instance Gobai est détruite.');
    if (!this.iframe.contentWindow) throw new Error('La fenêtre Gobai n’est pas disponible.');
    this.iframe.contentWindow.postMessage({ namespace: NS, version: VERSION, type, payload }, this.origin);
    return this;
  }

  focus(planet) { return this.command('camera.focus', { planet: String(planet) }); }
  setPlanet(planet) { return this.command('planet.change', { planet: String(planet) }); }
  zoom(factor) { return this.command('camera.zoom', { factor: Number(factor) }); }
  rotate(azimuth, elevation = 0) {
    return this.command('camera.rotate', { azimuth: Number(azimuth), elevation: Number(elevation) });
  }
  pause() { return this.command('engine.pause'); }
  resume() { return this.command('engine.resume'); }

  on(type, callback) {
    if (typeof callback !== 'function') throw new TypeError('Le callback doit être une fonction.');
    const listener = (event) => callback(event.detail);
    this.addEventListener(type, listener);
    return () => this.removeEventListener(type, listener);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('message', this._onMessage);
    this.iframe.src = 'about:blank';
    this.iframe.remove();
  }
}

export const Gobai = {
  render(planet, container, options = {}) {
    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if (!target || typeof target.appendChild !== 'function') {
      throw new Error(`Conteneur Gobai introuvable ou invalide : ${String(container)}`);
    }
    const baseUrl = (options.baseUrl || DEFAULT_ORIGIN).replace(/\/$/, '');
    const origin = resolveOrigin(baseUrl);
    const url = new URL(`${baseUrl}/embed.html`);
    url.searchParams.set('planet', planet || 'terre');
    url.searchParams.set('transparent', String(options.transparent !== false));
    url.searchParams.set('controls', String(options.controls !== false));
    url.searchParams.set('stars', String(options.stars === true));
    url.searchParams.set('parentOrigin', window.location.origin);
    if (options.dataUrl) url.searchParams.set('dataUrl', String(options.dataUrl));

    const iframe = document.createElement('iframe');
    iframe.title = options.title || `Gobai ${planet || 'terre'} interactif`;
    iframe.src = url.toString();
    iframe.allow = 'fullscreen';
    iframe.loading = options.loading || 'eager';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allowtransparency', 'true');
    Object.assign(iframe.style, {
      display: 'block',
      width: typeof options.width === 'number' ? `${options.width}px` : (options.width || '100%'),
      height: typeof options.height === 'number' ? `${options.height}px` : (options.height || '100%'),
      border: '0',
      background: 'transparent',
      overflow: 'hidden',
    });
    target.appendChild(iframe);
    return new GobaiEmbedInstance(iframe, origin);
  },
};

if (typeof window !== 'undefined') window.Gobai = Gobai;
export default Gobai;
