import * as THREE from 'three';
import { eclToScene, EARTH_RADIUS_KM, orbiterStateAt } from './moonLive';

const COLORS = { lro: '#ffb347', 'chandrayaan-2': '#ff7eb6', danuri: '#7ee0ff', capstone: '#b6ff7e' };
const v3 = new THREE.Vector3();
const toUnits = (km) => km / EARTH_RADIUS_KM; // la scène est en rayons terrestres

/**
 * Sondes en orbite lunaire (positions réelles JPL Horizons) : point lumineux, trajectoire sur la fenêtre de la table
 * et étiquette HTML cliquable. Le repère suit le centre de la Lune sans tourner avec elle (écliptique J2000).
 */
export class MoonOrbiters {
  constructor({ scene, parentEl, onPick }) {
    this.group = new THREE.Group();
    this.group.name = 'moon-orbiters';
    scene.add(this.group);
    this.parentEl = parentEl;
    this.onPick = onPick;
    this.items = [];
    this.visible = true;
    this.selected = null;
  }

  setVisible(on) {
    this.visible = on;
    this.group.visible = on;
    if (!on) this.items.forEach((it) => setDisplay(it.el, false));
  }

  select(id) {
    this.selected = id;
    this.items.forEach((it) => {
      const on = it.id === id;
      it.line.material.opacity = on ? 0.95 : 0.45;
      it.el.classList.toggle('selected', on);
    });
  }

  /** @param items réponse de GET /ephemeris/moon/orbiters (items) */
  setData(items) {
    this.clear();
    for (const o of items) {
      const color = new THREE.Color(COLORS[o.id] || '#ffffff');
      const el = document.createElement('div');
      el.className = 'l orbiter-label';
      el.style.setProperty('--c', `#${color.getHexString()}`);
      el.textContent = o.name;
      el.title = `${o.name} (${o.agency}) · cliquer pour le détail`;
      el.style.display = 'none';
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onPick?.(o.id); });
      this.parentEl.appendChild(el);

      const ok = o.status === 'ok' && o.points.length >= 4;
      const pos = new Float32Array(ok ? o.points.length * 3 : 3);
      if (ok) o.points.forEach((p, i) => pos.set(eclToScene([toUnits(p.x), toUnits(p.y), toUnits(p.z)]), i * 3));
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }));
      line.visible = ok;
      const dotGeo = new THREE.BufferGeometry();
      dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
      const dot = new THREE.Points(dotGeo, new THREE.PointsMaterial({ color, size: 7, sizeAttenuation: false, depthWrite: false }));
      dot.visible = false;
      this.group.add(line, dot);
      this.items.push({ ...o, ok, el, line, dot, state: null });
    }
    if (this.selected) this.select(this.selected);
  }

  /**
   * @param t        instant simulé (ms UTC)
   * @param moonPos  position du centre de la Lune dans la scène ; moonRadius en unités de la scène
   */
  update({ t, moonPos, moonRadius, cam, W, H }) {
    this.group.position.copy(moonPos);
    // Sondes masquées : rien à calculer (les étiquettes ont déjà été cachées une fois).
    if (!this.visible) {
      for (const it of this.items) { it.dot.visible = false; setDisplay(it.el, false); }
      return;
    }
    const camRel = v3.copy(cam.position).sub(moonPos);
    const camRelArr = [camRel.x, camRel.y, camRel.z];
    for (const it of this.items) {
      it.state = it.ok ? orbiterStateAt(it.points, t) : null;
      if (!it.state) { it.dot.visible = false; setDisplay(it.el, false); continue; }
      const s = eclToScene(it.state.r.map(toUnits));
      it.dot.geometry.attributes.position.array.set(s);
      it.dot.geometry.attributes.position.needsUpdate = true;
      it.dot.geometry.computeBoundingSphere();
      it.dot.visible = true;
      // Étiquette : cachée si la Lune est entre la caméra et la sonde.
      const hidden = segmentHitsSphere(camRelArr, s, moonRadius);
      v3.set(s[0], s[1], s[2]).add(moonPos).project(cam);
      if (hidden || v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) { setDisplay(it.el, false); continue; }
      setDisplay(it.el, true);
      const x = ((v3.x + 1) / 2) * W + 6, y = ((1 - v3.y) / 2) * H - 7;
      if (it.el._x === undefined || Math.abs(it.el._x - x) > 0.05 || Math.abs(it.el._y - y) > 0.05) {
        it.el._x = x; it.el._y = y;
        it.el.style.transform = `translate(${x}px,${y}px)`;
      }
    }
  }

  clear() {
    this.items.forEach((it) => {
      it.el.remove();
      this.group.remove(it.line, it.dot);
      it.line.geometry.dispose(); it.line.material.dispose();
      it.dot.geometry.dispose(); it.dot.material.dispose();
    });
    this.items = [];
  }

  dispose() {
    this.clear();
    this.group.parent?.remove(this.group);
  }
}

/** Le segment a → b (centre de la sphère à l'origine) traverse-t-il la sphère de rayon r ? */
export function segmentHitsSphere(a, b, r) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  if (dd === 0) return false;
  const t = Math.max(0, Math.min(1, -(a[0] * d[0] + a[1] * d[1] + a[2] * d[2]) / dd));
  const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  return t > 0 && t < 1 && Math.hypot(p[0], p[1], p[2]) < r * 0.999;
}

/** N'écrit `display` que s'il change (une écriture de style par image et par étiquette coûte un recalcul). */
function setDisplay(el, on) {
  if (el._shown === on) return;
  el._shown = on;
  el.style.display = on ? 'block' : 'none';
}
