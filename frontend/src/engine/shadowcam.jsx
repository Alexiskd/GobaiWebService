import * as THREE from 'three';
import { tileRadius } from './tiles/tileGeometry';
import { lonLatToXYZ } from './tiles/mercator';
import { buildMosaicGrid } from './shadowcamMath';

const vert = [
  '#include <common>', '#include <logdepthbuf_pars_vertex>', 'varying vec2 vUv;',
  'void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);', '#include <logdepthbuf_vertex>', '}',
].join('\n');
// Vision ShadowCam : le fond des cratères n'est éclairé que par la lumière renvoyée par les reliefs voisins ; on
// l'affiche tel que la caméra le voit (gris, légèrement froid), sans l'éclairage du Soleil du moteur. Les zones en
// plein Soleil (transparentes) laissent voir l'imagerie habituelle.
const frag = [
  '#include <logdepthbuf_pars_fragment>', 'uniform sampler2D map;uniform float opacity;varying vec2 vUv;',
  'void main(){', '#include <logdepthbuf_fragment>',
  'vec4 t=texture2D(map,vUv);if(t.a<.5)discard;gl_FragColor=vec4(t.r*vec3(.93,.97,1.05)*opacity,1.);}',
].join('\n');

/**
 * Pôles Nord et Sud vus par Danuri : mosaïques ShadowCam (NASA) des cratères en ombre permanente, posées sur la
 * Lune au-dessus des tuiles. Chargement à la demande : 20 m/pixel quand la caméra approche du pôle, 5 m/pixel
 * quand elle survole la mosaïque de près.
 */
export class ShadowCamLayer {
  constructor({ root, api, getGap }) {
    this.root = root;          // repère sphère unité de la Lune (celui des tuiles)
    this.api = api;            // { meta(id, res), imageUrl(id, res) }
    this.getGap = getGap;
    this.group = new THREE.Group();
    this.group.name = 'shadowcam';
    root.add(this.group);
    this.items = [];
    this.visible = true;
    this.loader = new THREE.TextureLoader();
    this.cam = new THREE.Vector3();
    this.inv = new THREE.Matrix4();
    this.loadingCount = 0;
  }

  setVisible(on) { this.visible = on; this.group.visible = on; }

  /** @param list réponse de GET /danuri/shadowcam (items) */
  setCatalog(list) {
    this.clear();
    this.items = list.map((m) => ({ ...m, dir: lonLatToXYZ(m.lon, m.lat), res: 0, want: 0, mesh: null, loading: false, failed: false }));
  }

  /** Appelé à chaque image : charge ou affine les mosaïques survolées. */
  update(cam) {
    if (!this.visible || !this.items.length) return;
    this.root.updateWorldMatrix(true, false); // repère seul : pas les centaines de tuiles de la Lune
    const c = this.cam.copy(cam.position).applyMatrix4(this.inv.copy(this.root.matrixWorld).invert());
    const alt = c.length() - 1;                       // en rayons lunaires
    const cl = c.length() || 1;
    const gap = this.getGap();
    for (const it of this.items) {
      const ang = Math.acos(Math.max(-1, Math.min(1, (c.x * it.dir[0] + c.y * it.dir[1] + c.z * it.dir[2]) / cl)));
      // 20 m/px à moins de ≈ 900 km d'altitude et 25° ; 5 m/px à moins de ≈ 90 km et au-dessus de la mosaïque.
      it.want = alt < 0.05 && ang < 0.06 ? 5 : alt < 0.5 && ang < 0.45 ? 20 : it.res;
      if (it.want && it.want !== it.res && !it.loading && !it.failed && this.loadingCount < 2) this.load(it, it.want);
      if (it.mesh) {
        const r = tileRadius(24, gap); // au-dessus de toutes les tuiles
        if (it.mesh.userData.r !== r) {
          it.mesh.userData.r = r;
          it.mesh.matrix.makeScale(r, r, r).setPosition(it.center[0] * r, it.center[1] * r, it.center[2] * r);
          it.mesh.matrixWorldNeedsUpdate = true;
        }
      }
    }
  }

  async load(it, res) {
    it.loading = true; this.loadingCount++;
    try {
      const meta = await this.api.meta(it.id, res);
      const tex = await this.loader.loadAsync(this.api.imageUrl(it.id, res));
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4;
      const g = buildMosaicGrid(meta);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
      geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
      const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, opacity: { value: 1 } }, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 2;
      if (it.mesh) this.disposeMesh(it.mesh);
      it.mesh = mesh; it.center = g.center; it.res = res; it.meta = meta;
      this.group.add(mesh);
    } catch (e) {
      it.failed = true; it.error = e.message || String(e);
      console.warn(`ShadowCam ${it.name} :`, it.error);
    } finally {
      it.loading = false; this.loadingCount--;
    }
  }

  /** État pour l'interface. */
  snapshot() {
    return this.items.map((it) => ({ id: it.id, name: it.name, pole: it.pole, lat: it.lat, lon: it.lon, season: it.season, res: it.res, loading: it.loading, error: it.error || null }));
  }

  disposeMesh(m) { this.group.remove(m); m.geometry.dispose(); m.material.uniforms.map.value?.dispose(); m.material.dispose(); }
  clear() { this.items.forEach((it) => it.mesh && this.disposeMesh(it.mesh)); this.items = []; }
  dispose() { this.clear(); this.root.remove(this.group); }
}
