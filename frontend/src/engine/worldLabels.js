import * as THREE from 'three';
import { lonLatToXYZ } from './tiles/mercator';

const CELL = 64;                 // grille de l'écran pour tester les chevauchements rapidement
const MAX_LABEL_ALTITUDE = 24;   // au-delà (en rayons terrestres), la Terre est trop petite pour des noms
const v3 = new THREE.Vector3();
const inv = new THREE.Matrix4();

// Hiérarchie des noms de villes, à la manière des cartes de navigation : taille, graisse et point
// d'ancrage suivent l'importance du lieu. charW et h servent à réserver la place au sol dans la
// grille de chevauchement (voir styles.css pour le rendu).
const TIERS = [
  { minPop: 8e6, charW: 8.4, h: 20 },   // métropoles mondiales
  { minPop: 2e6, charW: 7.4, h: 18 },   // grandes villes
  { minPop: 3e5, charW: 6.7, h: 17 },   // villes moyennes
  { minPop: 0,   charW: 6.3, h: 17 },   // petites villes, visibles seulement de près
];
// Une capitale reste lisible même petite : jamais sous le niveau 1.
const tierOf = (c) => {
  const i = TIERS.findIndex((t) => (c.pop || 0) >= t.minPop);
  const tier = i < 0 ? TIERS.length - 1 : i;
  return c.capital ? Math.min(tier, 1) : tier;
};
const compactPop = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
// Largeur moyenne d'un caractère relative au latin : les idéogrammes ont une chasse pleine,
// l'arabe et l'hébreu sont plus compacts en raison des ligatures, le cyrillique est un peu plus large.
const SCRIPT_WIDTH = { japanese: 1.6, chinese: 1.6, korean: 1.6, arabic: 0.9, hebrew: 0.9, devanagari: 1, bengali: 1, cyrillic: 1.02 };

/** Nombre maximal de noms à l'écran selon l'altitude : peu de loin, beaucoup de près. */
const budgetFor = (altitude) => (altitude > 2 ? 40 : altitude > 0.5 ? 90 : 180);

/**
 * Noms des villes du monde entier posés sur la Terre (étiquettes HTML, comme celles des planètes).
 * Les villes arrivent triées par population : on les parcourt dans cet ordre et on garde chaque nom qui ne chevauche
 * pas un nom déjà placé. Résultat : les grandes villes de loin, puis de plus en plus de villes en zoomant.
 * Un clic sur un nom y emmène la caméra (`onPick`).
 */
export class WorldLabels {
  /**
   * Options (réutilisé pour les lieux de la Lune) : className, maxAltitude (rayons de l'astre), budget(altitude),
   * revealAltitude pour n'apparaître qu'en zoomant (avec fadeAltitude pour le fondu), decorate(el, item) pour le
   * texte, la couleur et l'infobulle, tooltip pour une fiche au survol (show(city, el) / hide() / sync()).
   */
  constructor({
    parent, onPick, className = 'l map-label', maxAltitude = MAX_LABEL_ALTITUDE, budget = budgetFor,
    revealAltitude = Infinity, fadeAltitude = 0, decorate = null, tiered = false, tooltip = null,
  }) {
    this.parent = parent;
    this.onPick = onPick;
    this.className = className;
    this.maxAltitude = maxAltitude;
    this.budget = budget;
    this.revealAltitude = revealAltitude;
    this.fadeAltitude = fadeAltitude;
    this.decorate = decorate;
    this.tiered = tiered;   // villes : hiérarchie de taille selon population / capitale
    this.tooltip = tooltip; // fiche au survol (CityCard), facultative
    this.items = [];
    this.pool = [];       // éléments DOM réutilisés
    this.visible = true;
    this.shownCount = 0;
  }

  get active() { return this.visible && this.items.length > 0; }

  /** @param {{ name, native?, script?, lon, lat, pop, capital }[]} cities  triées de la plus peuplée à la moins peuplée */
  setCities(cities) {
    this.items = cities.map((c) => {
      const p = lonLatToXYZ(c.lon, c.lat);
      const label = c.native || c.name;   // écriture locale quand Natural Earth la fournit
      const script = c.script || 'latin';
      const item = {
        ...c, label, script, x: p[0], y: p[1], z: p[2],
        w: 14 + (c.capital ? 7 : 6.2) * label.length, h: 16,
      };
      if (this.tiered) {
        const tier = c.tier ?? tierOf(c);
        const m = TIERS[tier];
        item.tier = tier;
        item.w = 16 + m.charW * label.length * (SCRIPT_WIDTH[script] || 1);
        item.h = m.h;
      }
      return item;
    });
  }

  setVisible(on) {
    this.visible = on;
    if (!on) {
      this.hideFrom(0);
      this.tooltip?.hide();
    }
  }

  element(i) {
    let el = this.pool[i];
    if (!el) {
      el = document.createElement('div');
      el.className = this.className;
      el.style.display = 'none';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tooltip?.hide();
        if (el.city) this.onPick?.(el.city);
      });
      if (this.tooltip) {
        el.addEventListener('mouseenter', () => { if (el.city) this.tooltip.show(el.city, el); });
        el.addEventListener('mouseleave', () => this.tooltip.hide());
      }
      this.parent.appendChild(el);
      this.pool[i] = el;
    }
    return el;
  }

  hideFrom(n) {
    for (let i = n; i < this.shownCount; i++) this.pool[i].style.display = 'none';
    this.shownCount = Math.min(this.shownCount, n);
  }

  /** @param {{ cam, W, H, earthMesh }} s  appelé à chaque image, après le placement de la caméra */
  update({ cam, W, H, earthMesh }) {
    if (!this.active) { this.tooltip?.hide(); return; }
    // Caméra dans le repère du maillage de la Terre (sphère unité, longitudes de lonLatToXYZ).
    earthMesh.updateWorldMatrix(true, false); // sans recalculer tout le sous-arbre (tuiles)
    const world = earthMesh.matrixWorld;
    v3.copy(cam.position).applyMatrix4(inv.copy(world).invert());
    const cx = v3.x, cy = v3.y, cz = v3.z;
    const altitude = Math.hypot(cx, cy, cz) - 1;
    if (!(altitude > 0) || altitude > this.maxAltitude) { this.hideFrom(0); this.tooltip?.hide(); return; }
    // De loin, seuls les pays sont nommés : les villes n'apparaissent qu'en zoomant, en fondu.
    if (altitude > this.revealAltitude) { this.hideFrom(0); this.tooltip?.hide(); return; }
    const alpha = this.fadeAltitude > 0
      ? Math.max(0, Math.min(1, (this.revealAltitude - altitude) / this.fadeAltitude))
      : 1;
    if (alpha <= 0.01) { this.hideFrom(0); this.tooltip?.hide(); return; }

    const budget = this.budget(altitude);
    const grid = this.grid || (this.grid = new Map());
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
      if (n >= budget) break;
      // Face visible : le point doit être devant l'horizon (p · cam > 1 sur la sphère unité), avec une petite marge.
      if (c.x * cx + c.y * cy + c.z * cz <= 1.0001) continue;
      v3.set(c.x, c.y, c.z).applyMatrix4(world).project(cam);
      if (v3.z > 1 || v3.x < -1.05 || v3.x > 1.05 || v3.y < -1.05 || v3.y > 1.05) continue;
      // Le point d'ancrage est sur la ville : boîte centrée dessus pour les villes hiérarchisées.
      const x = ((v3.x + 1) / 2) * W;
      const anchorY = ((1 - v3.y) / 2) * H;
      const tiered = c.tier !== undefined;
      const y = tiered ? anchorY - c.h / 2 : anchorY - 7;
      const box = tiered ? [x - 5, y - 2, x + c.w + 3, y + c.h] : [x - 4, y - 8, x + c.w + 4, y + 8];
      if (!fits(box[0], box[1], box[2], box[3])) continue;
      occupy(box);
      const el = this.element(n);
      if (el.city !== c) {
        el.city = c;
        if (this.decorate) this.decorate(el, c);
        else {
          el.textContent = c.label;
          el.dataset.script = c.script;
          if (this.tooltip) {
            // La fiche remplace l'infobulle native du navigateur.
            el.removeAttribute('title');
            el.setAttribute('aria-label', `${c.name}${c.country ? `, ${c.country}` : ''} — fiche de la ville`);
          } else {
            const pop = c.pop ? ` · ${compactPop.format(c.pop)} hab.` : '';
            const native = c.native ? ` · ${c.native}` : '';
            el.title = `${c.name}${native}${c.country ? ` (${c.country})` : ''}${pop} · cliquer pour y aller`;
          }
        }
        if (tiered) el.dataset.tier = c.tier;
      }
      // Écriture DOM seulement si l'étiquette a bougé (≥ 0,05 px) : souvent aucune quand la vue est immobile.
      if (el._x === undefined || Math.abs(el._x - x) > 0.05 || Math.abs(el._y - y) > 0.05) {
        el._x = x; el._y = y;
        el.style.transform = `translate(${x}px,${y}px)`;
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
    this.syncTooltip();
  }

  /** La fiche reste accrochée à sa ville quand les étiquettes sont recyclées ; elle se ferme si la ville disparaît. */
  syncTooltip() {
    const tip = this.tooltip;
    if (!tip || !tip.city) return;
    const anchor = this.pool.find((el, i) => i < this.shownCount && el.style.display !== 'none' && el.city === tip.city);
    if (!anchor) { tip.hide(); return; }
    tip.anchor = anchor;
    tip.sync();
  }

  dispose() {
    this.tooltip?.hide();
    this.pool.forEach((el) => el.remove());
    this.pool = [];
    this.items = [];
  }
}
