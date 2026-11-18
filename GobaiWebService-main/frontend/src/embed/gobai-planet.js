import Gobai from './client.js';

const STYLE = `:host{display:block;position:relative;width:100%;height:100%;min-width:1px;min-height:1px;overflow:hidden;background:transparent} .mount{width:100%;height:100%;overflow:hidden;background:transparent}`;

class GobaiPlanetElement extends HTMLElement {
  static get observedAttributes() { return ['planet', 'base-url', 'transparent', 'controls', 'stars', 'title']; }

  constructor() {
    super();
    this._instance = null;
    this._shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    this._mount = document.createElement('div');
    this._mount.className = 'mount';
    this._shadow.append(style, this._mount);
  }

  connectedCallback() { this._mountInstance(); }

  disconnectedCallback() {
    this._instance?.destroy();
    this._instance = null;
  }

  attributeChangedCallback() {
    if (this.isConnected) this._mountInstance();
  }

  _mountInstance() {
    this._instance?.destroy();
    this._mount.replaceChildren();
    const options = {
      baseUrl: this.getAttribute('base-url') || undefined,
      transparent: this.getAttribute('transparent') !== 'false',
      controls: this.getAttribute('controls') !== 'false',
      stars: this.getAttribute('stars') === 'true',
      title: this.getAttribute('title') || undefined,
      width: '100%',
      height: '100%',
    };
    this._instance = Gobai.render(this.getAttribute('planet') || 'terre', this._mount, options);
    for (const type of ['embed.ready', 'embed.error', 'planet.change']) {
      this._instance.on(type, (detail) => {
        this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
      });
    }
  }

  focus(planet) { this._instance?.focus(planet); return this; }
  setPlanet(planet) { this._instance?.setPlanet(planet); return this; }
  zoom(factor) { this._instance?.zoom(factor); return this; }
  rotate(azimuth, elevation = 0) { this._instance?.rotate(azimuth, elevation); return this; }
  pause() { this._instance?.pause(); return this; }
  resume() { this._instance?.resume(); return this; }
}

if (!customElements.get('gobai-planet')) customElements.define('gobai-planet', GobaiPlanetElement);

export { GobaiPlanetElement };
