// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe tileRadius, le rayon d'une tuile d'un niveau donné, depuis tiles/tileGeometry.
import { tileRadius } from './tiles/tileGeometry';
// Importe lonLatToXYZ, la conversion d'une longitude et d'une latitude en point de la sphère, depuis tiles/mercator.
import { lonLatToXYZ } from './tiles/mercator';
// Importe buildMosaicGrid, le maillage d'une mosaïque, depuis shadowcamMath.
import { buildMosaicGrid } from './shadowcamMath';

// Code GLSL du shader de sommets (début).
const vert = [
  // Inclusions de three.js, et coordonnées de texture transmises au shader de fragments.
  '#include <common>', '#include <logdepthbuf_pars_vertex>', 'varying vec2 vUv;',
  // Fonction principale : transmet les coordonnées de texture et calcule la position à l'écran, avec la profondeur logarithmique.
  'void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);', '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
// Vision ShadowCam : le fond des cratères n'est éclairé que par la lumière renvoyée par les reliefs voisins ; on
// l'affiche tel que la caméra le voit (gris, légèrement froid), sans l'éclairage du Soleil du moteur. Les zones en
// plein Soleil (transparentes) laissent voir l'imagerie habituelle.
// Code GLSL du shader de fragments (début).
const frag = [
  // Inclusion de three.js, puis la texture, l'opacité et les coordonnées de texture reçues.
  '#include <logdepthbuf_pars_fragment>', 'uniform sampler2D map;uniform float opacity;varying vec2 vUv;',
  // Début de la fonction principale et inclusion de la profondeur logarithmique.
  'void main(){', '#include <logdepthbuf_fragment>',
  // Lit la texture ; un pixel transparent n'est pas dessiné ; sinon le gris du canal rouge, légèrement bleuté, multiplié par l'opacité. Fin de la fonction principale.
  'vec4 t=texture2D(map,vUv);if(t.a<.5)discard;gl_FragColor=vec4(t.r*vec3(.93,.97,1.05)*opacity,1.);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Pôles Nord et Sud vus par Danuri : mosaïques ShadowCam (NASA) des cratères en ombre permanente, posées sur la
 * Lune au-dessus des tuiles. Chargement à la demande : 20 m/pixel quand la caméra approche du pôle, 5 m/pixel
 * quand elle survole la mosaïque de près.
 */
// Déclare et exporte la classe ShadowCamLayer (début).
export class ShadowCamLayer {
  // Constructeur : le repère de la Lune, l'accès à l'API et la fonction qui donne l'écart entre niveaux de tuiles (début).
  constructor({ root, api, getGap }) {
    // Garde le repère.
    this.root = root;          // repère sphère unité de la Lune (celui des tuiles)
    // Garde l'accès à l'API.
    this.api = api;            // { meta(id, res), imageUrl(id, res) }
    // Garde la fonction de l'écart.
    this.getGap = getGap;
    // Groupe qui contient les mosaïques.
    this.group = new THREE.Group();
    // Son nom : « shadowcam ».
    this.group.name = 'shadowcam';
    // L'ajoute au repère de la Lune.
    root.add(this.group);
    // Liste des mosaïques : vide au départ.
    this.items = [];
    // Couche visible.
    this.visible = true;
    // Chargeur de textures de three.js.
    this.loader = new THREE.TextureLoader();
    // Vecteur de travail pour la position de la caméra.
    this.cam = new THREE.Vector3();
    // Matrice de travail pour l'inverse de la matrice du repère.
    this.inv = new THREE.Matrix4();
    // Nombre de chargements en cours : 0.
    this.loadingCount = 0;
  // Fin du constructeur.
  }

  // setVisible : garde l'état et l'applique au groupe.
  setVisible(on) { this.visible = on; this.group.visible = on; }

  /** @param list réponse de GET /danuri/shadowcam (items) */
  // setCatalog : reçoit la liste des mosaïques (début).
  setCatalog(list) {
    // Vide les mosaïques précédentes.
    this.clear();
    // Une entrée par mosaïque : ses champs, sa direction sur la sphère, et un état de chargement vide.
    this.items = list.map((m) => ({ ...m, dir: lonLatToXYZ(m.lon, m.lat), res: 0, want: 0, mesh: null, loading: false, failed: false }));
  // Fin de setCatalog.
  }

  /** Appelé à chaque image : charge ou affine les mosaïques survolées. */
  // update : reçoit la caméra (début).
  update(cam) {
    // Couche masquée ou sans mosaïque : rien à faire.
    if (!this.visible || !this.items.length) return;
    // Met à jour la matrice du repère.
    this.root.updateWorldMatrix(true, false); // repère seul : pas les centaines de tuiles de la Lune
    // Position de la caméra dans le repère de la Lune.
    const c = this.cam.copy(cam.position).applyMatrix4(this.inv.copy(this.root.matrixWorld).invert());
    // Altitude de la caméra, en rayons lunaires.
    const alt = c.length() - 1;                       // en rayons lunaires
    // Distance de la caméra au centre, ou 1 si elle est nulle.
    const cl = c.length() || 1;
    // Écart actuel entre niveaux de tuiles.
    const gap = this.getGap();
    // Pour chaque mosaïque (début).
    for (const it of this.items) {
      // Angle entre la direction de la caméra et celle de la mosaïque.
      const ang = Math.acos(Math.max(-1, Math.min(1, (c.x * it.dir[0] + c.y * it.dir[1] + c.z * it.dir[2]) / cl)));
      // 20 m/px à moins de ≈ 900 km d'altitude et 25° ; 5 m/px à moins de ≈ 90 km et au-dessus de la mosaïque.
      // Résolution voulue : 5 m très près et au-dessus de la mosaïque, 20 m à l'approche, sinon celle déjà chargée.
      it.want = alt < 0.05 && ang < 0.06 ? 5 : alt < 0.5 && ang < 0.45 ? 20 : it.res;
      // Si elle diffère de la résolution chargée, sans chargement ni échec pour cette mosaïque, et avec moins de deux chargements en cours : la charge.
      if (it.want && it.want !== it.res && !it.loading && !it.failed && this.loadingCount < 2) this.load(it, it.want);
      // Si la mosaïque a un maillage (début).
      if (it.mesh) {
        // Rayon où la poser : celui d'une tuile de niveau 24.
        const r = tileRadius(24, gap); // au-dessus de toutes les tuiles
        // Si ce rayon a changé (début).
        if (it.mesh.userData.r !== r) {
          // Mémorise le rayon.
          it.mesh.userData.r = r;
          // Matrice du maillage : mise à l'échelle par le rayon et placement au centre de la mosaïque.
          it.mesh.matrix.makeScale(r, r, r).setPosition(it.center[0] * r, it.center[1] * r, it.center[2] * r);
          // Signale à three.js que la matrice a changé.
          it.mesh.matrixWorldNeedsUpdate = true;
        // Fin du changement de rayon.
        }
      // Fin du cas avec maillage.
      }
    // Fin de la boucle.
    }
  // Fin de update.
  }

  // load : charge une mosaïque à une résolution, de façon asynchrone (début).
  async load(it, res) {
    // Note le chargement en cours, pour la mosaïque et pour la couche.
    it.loading = true; this.loadingCount++;
    // Essai (début).
    try {
      // Attend les métadonnées de la mosaïque.
      const meta = await this.api.meta(it.id, res);
      // Attend son image.
      const tex = await this.loader.loadAsync(this.api.imageUrl(it.id, res));
      // Filtres de la texture et anisotropie de 4.
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4;
      // Tableaux du maillage.
      const g = buildMosaicGrid(meta);
      // Géométrie.
      const geo = new THREE.BufferGeometry();
      // Son attribut de positions.
      geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      // Son attribut de normales.
      geo.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
      // Son attribut de coordonnées de texture.
      geo.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
      // Ses indices de triangles.
      geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
      // Matériau à shader : la texture et l'opacité, les deux shaders, les deux faces dessinées.
      const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, opacity: { value: 1 } }, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
      // Le maillage.
      const mesh = new THREE.Mesh(geo, mat);
      // Sa matrice n'est pas recalculée automatiquement.
      mesh.matrixAutoUpdate = false;
      // Ordre de dessin : 2.
      mesh.renderOrder = 2;
      // Libère le maillage précédent, s'il y en avait un.
      if (it.mesh) this.disposeMesh(it.mesh);
      // Garde le maillage, son centre, la résolution et les métadonnées.
      it.mesh = mesh; it.center = g.center; it.res = res; it.meta = meta;
      // Ajoute le maillage au groupe.
      this.group.add(mesh);
    // En cas d'erreur (début).
    } catch (e) {
      // Note l'échec et son message.
      it.failed = true; it.error = e.message || String(e);
    // Dans tous les cas (début).
    } finally {
      // Le chargement est terminé, pour la mosaïque et pour la couche.
      it.loading = false; this.loadingCount--;
    // Fin de l'essai.
    }
  // Fin de load.
  }

  /** État pour l'interface. */
  // snapshot : l'état de la couche (début).
  snapshot() {
    // Renvoie, pour chaque mosaïque, ses informations, sa résolution, son chargement et son erreur éventuelle.
    return this.items.map((it) => ({ id: it.id, name: it.name, pole: it.pole, lat: it.lat, lon: it.lon, season: it.season, res: it.res, loading: it.loading, error: it.error || null }));
  // Fin de snapshot.
  }

  // disposeMesh : retire un maillage du groupe et libère sa géométrie, sa texture et son matériau.
  disposeMesh(m) { this.group.remove(m); m.geometry.dispose(); m.material.uniforms.map.value?.dispose(); m.material.dispose(); }
  // clear : libère le maillage de chaque mosaïque et vide la liste.
  clear() { this.items.forEach((it) => it.mesh && this.disposeMesh(it.mesh)); this.items = []; }
  // dispose : vide la couche et retire le groupe du repère.
  dispose() { this.clear(); this.root.remove(this.group); }
// Fin de la classe ShadowCamLayer.
}
