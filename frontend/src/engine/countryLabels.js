import * as THREE from 'three';
import { lonLatToXYZ } from './tiles/mercator';
import { COUNTRY_LABEL_POINTS } from './countryLabelPoints';
import { nativeCountryLabel } from './countryNativeNames';
import { countryLabelOpacity } from './countryLabelsMath';

// Noms des pays en étiquettes HTML à plat sur l'écran (comme les villes), ancrées sur le globe.
// Le texte reste horizontal, net et accentué : plus de déformation par la texture équirectangulaire.
// Les pays dont l'écriture n'est pas latine sont affichés dans leur alphabet local (countryNativeNames.js).
const CELL = 64;              // grille d'écran pour écarter les noms qui se chevauchent

const v3 = new THREE.Vector3();
const inv = new THREE.Matrix4();

/**
 * Noms des pays posés à plat sur l'écran, dans l'ordre d'importance de countryLabelPoints.js.
 * Ils apparaissent quand le globe devient lisible et s'effacent quand on descend au niveau des villes.
 */
export class CountryLabels {
  constructor({ parent, earthMesh }) {
    this.parent = parent;
    this.earthMesh = earthMesh;
    this.enabled = true;
    this.opacity = 0;
    this.shownCount = 0;
    this.items = COUNTRY_LABEL_POINTS.map((p) => {
      const [x, y, z] = lonLatToXYZ(p.lon, p.lat);
      const el = document.createElement('div');
      el.className = 'l country-label';
      el.dataset.rank = String(p.rank);
      const native = nativeCountryLabel(p.name);
      el.textContent = native ? native.text : p.name;
      el.lang = native ? native.lang : 'fr';
      // dir=auto suit le premier caractère fort : arabe et hébreu se composent de droite à gauche.
      el.dir = 'auto';
      if (native) el.dataset.script = native.script;
      el.style.display = 'none';
      this.parent.appendChild(el);
      return { ...p, x, y, z, el, w: 0, h: 0 };
    });
    this.measure();
    // Les polices système peuvent arriver après le premier rendu : on remesure une fois prêtes.
    if (document.fonts?.ready) document.fonts.ready.then(() => this.measure()).catch(() => {});
  }

  measure() {
    // Tout afficher puis tout mesurer : un seul calcul de mise en page au démarrage, pas 170.
    for (const c of this.items) {
      c.el.style.display = 'block';
      c.el.style.opacity = '0';
    }
    for (const c of this.items) {
      const r = c.el.getBoundingClientRect();
      c.w = r.width;
      c.h = r.height;
    }
    for (const c of this.items) {
      c.el.style.display = 'none';
      c.el.style.opacity = '';
    }
  }

  hideFrom(n) {
    for (let i = n; i < this.shownCount; i++) this.items[i].el.style.display = 'none';
    this.shownCount = Math.min(this.shownCount, n);
  }

  /** @param {{ cam, W, H, earthMesh }} s  appelé à chaque image, après le placement de la caméra */
  update({ cam, W, H, earthMesh }) {
    if (!this.enabled) { this.hideFrom(0); this.opacity = 0; return; }
    // Caméra dans le repère du maillage de la Terre (sphère unité, longitudes de lonLatToXYZ).
    earthMesh.updateWorldMatrix(true, false);
    const world = earthMesh.matrixWorld;
    v3.copy(cam.position).applyMatrix4(inv.copy(world).invert());
    const cx = v3.x, cy = v3.y, cz = v3.z;
    const altitude = Math.hypot(cx, cy, cz) - 1;
    const alpha = countryLabelOpacity(altitude);
    if (alpha <= 0.01) { this.hideFrom(0); this.opacity = 0; return; }
    this.opacity = alpha;

    const grid = this.countryGrid || (this.countryGrid = new Map());
    grid.clear();
    const fits = (x0, y0, x1, y1) => {
      for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
        for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
          const cell = grid.get(gx * 4096 + gy);
          if (cell && cell.some((b) => x0 < b[2] && b[0] < x1 && y0 < b[3] && b[1] < y1)) return false;
        }
      }
      return true;
    };
    const occupy = (box) => {
      for (let gx = Math.floor(box[0] / CELL); gx <= Math.floor(box[2] / CELL); gx++) {
        for (let gy = Math.floor(box[1] / CELL); gy <= Math.floor(box[3] / CELL); gy++) {
          const k = gx * 4096 + gy;
          (grid.get(k) || grid.set(k, []).get(k)).push(box);
        }
      }
    };

    let n = 0;
    for (const c of this.items) {
      // Face visible : le point doit être devant l'horizon (p · cam > 1 sur la sphère unité), avec une petite marge.
      if (c.x * cx + c.y * cy + c.z * cz <= 1.0001) continue;
      v3.set(c.x, c.y, c.z).applyMatrix4(world).project(cam);
      if (v3.z > 1 || v3.x < -1.05 || v3.x > 1.05 || v3.y < -1.05 || v3.y > 1.05) continue;
      const x = ((v3.x + 1) / 2) * W;
      const y = ((1 - v3.y) / 2) * H;
      const left = x - c.w / 2;
      const top = y - c.h / 2;
      if (!fits(left, top, left + c.w, top + c.h)) continue;
      occupy([left, top, left + c.w, top + c.h]);

      const el = c.el;
      // Écriture DOM seulement si l'étiquette a bougé (≥ 0,05 px) : souvent aucune quand la vue est immobile.
      if (el._x === undefined || Math.abs(el._x - left) > 0.05 || Math.abs(el._y - top) > 0.05) {
        el._x = left; el._y = top;
        el.style.transform = `translate(${left}px,${top}px)`;
      }
      if (alpha < 1) {
        if (el._alpha !== alpha) {
          el.style.opacity = alpha;
          el._alpha = alpha;
        }
      } else if (el._alpha !== undefined) {
        el.style.opacity = '';
        el._alpha = undefined;
      }
      if (n >= this.shownCount) el.style.display = 'block';
      n++;
    }
    this.hideFrom(n);
    this.shownCount = n;
  }

  setVisible(on) {
    this.enabled = Boolean(on);
    if (!this.enabled) this.hideFrom(0);
  }

  dispose() {
    this.items.forEach((c) => c.el.remove());
    this.items = [];
  }
}
