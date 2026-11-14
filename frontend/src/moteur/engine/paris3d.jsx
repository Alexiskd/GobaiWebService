// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe EARTH_RADIUS_M, le rayon de la Terre en mètres, depuis gps.
import { EARTH_RADIUS_M } from './gps';
// Importe xyzToLonLat, la longitude et la latitude d'un point de la sphère, depuis mercator.
import { xyzToLonLat } from './tiles/mercator';
// Importe les constantes et les calculs de Paris en 3D, depuis paris3dMath.
import { PARIS_BOUNDS, SHOW_ALTITUDE_M, extrudeBuildings, groundDistance, tileBounds, tileCorners, tileFrame, tilesAround, viewRange, wfsUrl } from './paris3dMath';

// Paris en 3D, sur le modèle du TP iTowns de l'IGN (github.com/IGNF/TP_iTowns) : les bâtiments de la BD TOPO v3
// (service WFS de la Géoplateforme, couche BDTOPO_V3:batiment), extrudés à leur hauteur et posés sur le globe.
// Remplace les dalles LiDAR en points 3D.
//
// Chargement : Paris est découpée selon les tuiles de la carte (Web Mercator, niveau 16, ≈ 400 m ; voir
// paris3dMath.jsx). Sous 4 km d'altitude, au-dessus de Paris, seules les tuiles dans le champ de la caméra sont
// demandées au WFS, celles de l'axe de visée d'abord, quelques-unes à la fois ; un téléchargement est abandonné dès
// que sa tuile sort du champ. Une tuile reçue est allégée (contours simplifiés à 1 m, bâtiments et cours de moins de
// 25 m² écartés) puis extrudée en un seul maillage (un appel de dessin par tuile). Les tuiles déjà reçues restent en
// mémoire, masquées, pour revenir sans attente ; au-delà du plafond, les plus anciennes sortent.
//
// Pose : les bâtiments sont rattachés au groupe de la Terre et recopient sa rotation propre, comme les tuiles. Carte à
// plat : leur pied est posé sur la carte (le sol des tuiles, légèrement soulevé selon le niveau affiché). Relief en
// volume : chaque carreau est posé à l'altitude de son sol, et chaque bâtiment à celle du sien.
//
// Éclairage : même Soleil et même réglage « Ombre » que les tuiles de la Terre ; murs et toits éclairés selon leur
// orientation, nuit bleutée comme les cartes.

/** Réglages selon l'appareil : carreaux téléchargés à la fois, carreaux gardés en mémoire. */
// Réglages sur ordinateur : 4 téléchargements à la fois, 90 carreaux gardés.
const DESKTOP = { parallel: 4, keep: 90 };
// Réglages sur téléphone ou tablette : 2 téléchargements à la fois, 40 carreaux gardés.
const HANDHELD = { parallel: 2, keep: 40 };
// Délai avant un nouvel essai après un échec : 30 secondes.
const RETRY_AFTER_MS = 30_000;
// Délai entre deux choix des carreaux voulus : 150 ms.
const SELECT_EVERY_MS = 150;
// Écart de hauteur (m) au-delà duquel les carreaux sont reposés.
const REPLACE_M = 0.25;

// Programme de sommets, en GLSL (début).
const vertexShader = [
  // Inclut les définitions communes et celles du tampon de profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Attributs propres : la teinte du bâtiment et l'altitude de son sol au-dessus de celui du carreau.
  'attribute vec3 tint;attribute float lift;',
  // Variable uniforme : 1 avec le relief en volume (chaque bâtiment à l'altitude de son sol), 0 sur une carte à plat.
  'uniform float uRelief;',
  // Valeurs transmises au programme de fragments : la normale, la verticale du lieu et la teinte.
  'varying vec3 vN;varying vec3 vU;varying vec3 vC;',
  // Début du programme : la position, soulevée en relief.
  'void main(){vec3 p=position;p.z+=lift*uRelief;',
  // Normale et verticale dans le repère de la caméra, teinte transmise.
  'vN=normalize(normalMatrix*normal);vU=normalize(normalMatrix*vec3(0.,0.,1.));vC=tint;',
  // Position à l'écran.
  'gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);',
  // Écrit la profondeur logarithmique ; fin du programme.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Programme de fragments, en GLSL (début).
const fragmentShader = [
  // Inclut les définitions du tampon de profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : la direction du Soleil (repère de la caméra) et le réglage « Ombre ».
  'uniform vec3 sunV;uniform float shade;',
  // Valeurs reçues du programme de sommets.
  'varying vec3 vN;varying vec3 vU;varying vec3 vC;',
  // Début du programme ; écrit la profondeur logarithmique.
  'void main(){', '#include <logdepthbuf_fragment>',
  // Normale et verticale normalisées.
  'vec3 N=normalize(vN),U=normalize(vU);',
  // Jour ou nuit : hauteur du Soleil au-dessus de l'horizon du lieu, même terminateur doux que les cartes.
  'float day=smoothstep(-.12,.22,dot(U,sunV));',
  // Éclairement de la face : ambiant plus direct ; les toits un peu plus clairs que les murs à l'ombre.
  'float m0=max(dot(N,sunV),0.);vec3 lit=vC*(.42+.62*m0+.06*max(dot(N,U),0.));',
  // Nuit : bleutée, comme les cartes.
  'vec3 night=vC*vec3(.05,.06,.1);',
  // Couleur finale : éclairage doux si l'ombre est coupée, jour / nuit sinon.
  'gl_FragColor=vec4(mix(vC*(.7+.3*max(dot(N,U),0.)),mix(night,lit,day),shade),1.);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Déclare et exporte la classe Paris3D (début).
export class Paris3D {
  /** @param {{ earth: { group?: THREE.Object3D, mesh: THREE.Mesh, def: { radius: number } }, power?: { handheld?: boolean } }} engine */
  // Constructeur : le moteur et, pour les tests, la fonction de téléchargement (début).
  constructor(engine, { fetchJson = defaultFetchJson } = {}) {
    // Garde le moteur.
    this.engine = engine;
    // Garde la fonction de téléchargement.
    this.fetchJson = fetchJson;
    // Réglages selon l'appareil.
    this.profile = engine.power?.handheld ? HANDHELD : DESKTOP;
    // Rayon de la Terre dans la scène, ou 1.
    this.radius = engine.earth.def.radius || 1;
    // Repère des bâtiments.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'paris-3d';
    // Masqué au départ.
    this.root.visible = false;
    // Parent : le groupe de la Terre, sinon le parent du maillage, sinon le maillage.
    this.parent = engine.earth.group || engine.earth.mesh.parent || engine.earth.mesh;
    // Y ajoute le repère.
    this.parent.add(this.root);
    // Affichage actif.
    this.enabled = true;
    // Carte à plat au départ.
    this.flat = true;
    // Soulèvement du sol des tuiles (m), sur une carte à plat.
    this.groundLiftM = 0;
    // Carreaux, par clé.
    this.tiles = new Map(); // clé « 16/x/y » → { key, x, y, bounds, state, mesh, groundM, usedAt, retryAt, abort }
    // Carreaux reçus, en attente d'extrusion (un par image, pour ne pas faire chuter l'affichage).
    this.arrived = [];
    // Téléchargements en cours : 0.
    this.active = 0;
    // Instant du dernier choix des carreaux.
    this.selectAt = 0;
    // Choix à refaire.
    this.dirty = true;
    // État pour l'interface : carreaux affichés, en cours, bâtiments affichés.
    this.status = { shown: 0, loading: 0, buildings: 0 };
    // Matériau partagé par tous les carreaux (début).
    this.material = new THREE.ShaderMaterial({
      // Ses variables uniformes : Soleil et ombre (reliés à ceux de la Terre à la première image), relief.
      uniforms: { sunV: { value: new THREE.Vector3(1, 0, 0) }, shade: { value: 1 }, uRelief: { value: 0 } },
      // Ses programmes.
      vertexShader, fragmentShader,
    // Fin du matériau.
    });
    // Uniformes de la Terre pas encore reliés.
    this.linked = false;
    // Vecteur de travail.
    this.tmpV = new THREE.Vector3();
    // Matrice de travail.
    this.tmpM = new THREE.Matrix4();
    // Matrice de travail : de la sphère unité de la Terre à l'écran.
    this.viewM = new THREE.Matrix4();
    // Champ de vision de travail, dans le repère de la sphère unité.
    this.frustum = new THREE.Frustum();
    // Boîte de travail.
    this.box = new THREE.Box3();
    // Vecteurs de travail : direction de visée et centre d'une tuile.
    this.fwd = new THREE.Vector3(); this.tc = new THREE.Vector3();
    // Position de la caméra dans le repère de la sphère unité.
    this.camL = new THREE.Vector3();
  // Fin du constructeur.
  }

  /** Affiche ou masque Paris en 3D (les carreaux déjà reçus restent en mémoire). */
  // setEnabled : affiche ou masque (début).
  setEnabled(on) {
    // Garde le choix, en booléen.
    this.enabled = Boolean(on);
    // Coupé : le repère est masqué.
    if (!this.enabled) this.root.visible = false;
    // Choix à refaire.
    this.dirty = true;
  // Fin de setEnabled.
  }

  /** Pose un carreau sur le globe, d'après l'état de la carte (à plat ou en relief). */
  // place : pose un carreau (début).
  place(tile) {
    // Sans maillage : rien à faire.
    if (!tile.mesh) return;
    // Altitude du sol du carreau : celle de la carte à plat, ou son altitude réelle en relief.
    const alt = this.flat ? this.groundLiftM : tile.groundM;
    // Repère local du carreau et rayon de la Terre dans la scène.
    const f = tileFrame(tile.bounds.lon, tile.bounds.lat, alt), R = this.radius;
    // Écrit la matrice du maillage (début) :
    tile.mesh.matrix.set(
      // première ligne : les composantes x des trois axes et de l'origine ;
      f.ex[0] * R, f.ey[0] * R, f.ez[0] * R, f.origin[0] * R,
      // deuxième ligne : les composantes y ;
      f.ex[1] * R, f.ey[1] * R, f.ez[1] * R, f.origin[1] * R,
      // troisième ligne : les composantes z ;
      f.ex[2] * R, f.ey[2] * R, f.ez[2] * R, f.origin[2] * R,
      // dernière ligne : 0, 0, 0, 1.
      0, 0, 0, 1,
    );
    // Matrice dans la scène à recalculer.
    tile.mesh.matrixWorldNeedsUpdate = true;
    // Note l'altitude de pose.
    tile.placedAt = alt;
  // Fin de place.
  }

  /** Télécharge les bâtiments d'un carreau. */
  // load : lance le téléchargement d'un carreau (début).
  load(tile) {
    // Contrôleur d'annulation.
    const abort = new AbortController();
    // Carreau en chargement.
    tile.state = 'loading';
    // Garde le contrôleur.
    tile.abort = abort;
    // Un téléchargement de plus.
    this.active++;
    // Télécharge le GeoJSON (début).
    this.fetchJson(wfsUrl(tile.bounds), abort.signal)
      // Reçu : mis en attente d'extrusion.
      .then((json) => { if (tile.state === 'loading') { tile.state = 'arrived'; this.arrived.push({ tile, features: Array.isArray(json?.features) ? json.features : [] }); } })
      // Échec (hors annulation) : nouvel essai plus tard ; annulé : redevient à charger.
      .catch((e) => { if (tile.state !== 'loading') return; tile.state = e?.name === 'AbortError' ? 'idle' : 'failed'; tile.retryAt = performance.now() + RETRY_AFTER_MS; if (e?.name === 'AbortError') tile.retryAt = 0; })
      // Dans tous les cas : un téléchargement de moins.
      .finally(() => { this.active--; tile.abort = null; this.dirty = true; });
  // Fin de load.
  }

  /** Extrusion d'un carreau reçu : un maillage pour tous ses bâtiments. */
  // build : crée le maillage d'un carreau reçu (début).
  build({ tile, features }) {
    // Carreau retiré entre-temps : rien.
    if (!this.tiles.has(tile.key)) return;
    // Extrusion des bâtiments, avec la triangulation des toits de three.js.
    // three.js attend de vrais THREE.Vector2 (il appelle leur méthode `equals`) : les points { x, y } sont convertis.
    // toV2 : convertit un contour en THREE.Vector2.
    const toV2 = (ring) => ring.map((q) => new THREE.Vector2(q.x, q.y));
    // Extrusion, avec la triangulation des toits de three.js sur des THREE.Vector2.
    const m = extrudeBuildings(features, tile.bounds.lon, tile.bounds.lat, (shape, holes) => THREE.ShapeUtils.triangulateShape(toV2(shape), holes.map(toV2)));
    // Carreau prêt.
    tile.state = 'ready';
    // Altitude de son sol.
    tile.groundM = m.groundM;
    // Nombre de bâtiments.
    tile.buildings = m.buildings;
    // Aucun bâtiment (Seine, bois) : pas de maillage.
    if (!m.count) return;
    // Géométrie.
    const geo = new THREE.BufferGeometry();
    // Positions.
    geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    // Normales.
    geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    // Teintes.
    geo.setAttribute('tint', new THREE.BufferAttribute(m.colors, 3));
    // Soulèvements en relief.
    geo.setAttribute('lift', new THREE.BufferAttribute(m.lifts, 1));
    // Sphère englobante (pour l'écarter quand il est hors du champ), relief comprise.
    geo.computeBoundingSphere();
    // Marge pour le relief : 150 m.
    geo.boundingSphere.radius += 150;
    // Maillage.
    const mesh = new THREE.Mesh(geo, this.material);
    // Son nom.
    mesh.name = `paris-3d:${tile.key}`;
    // Matrice fixée à la main.
    mesh.matrixAutoUpdate = false;
    // Masqué jusqu'au prochain choix.
    mesh.visible = false;
    // Le garde sur le carreau.
    tile.mesh = mesh;
    // Le pose.
    this.place(tile);
    // L'ajoute au repère.
    this.root.add(mesh);
  // Fin de build.
  }

  /** Libère un carreau. */
  // drop : retire un carreau (début).
  drop(tile) {
    // Téléchargement en cours : abandonné.
    tile.abort?.abort();
    // Maillage : retiré et libéré.
    if (tile.mesh) { this.root.remove(tile.mesh); tile.mesh.geometry.dispose(); tile.mesh = null; }
    // Retire le carreau.
    this.tiles.delete(tile.key);
  // Fin de drop.
  }

  /**
   * À chaque image : visibilité, pose, choix des carreaux autour du point survolé, téléchargements et extrusion.
   * @param groundLiftM soulèvement du sol des tuiles au-dessus de la sphère (m), sur une carte à plat
   */
  // update : à chaque image (début).
  update({ cam, hidden = false, flat = true, groundLiftM = 0, now = performance.now() }) {
    // Relie à la première image le Soleil et l'ombre des tuiles de la Terre.
    if (!this.linked && this.engine.tiles?.uniforms?.sunV) {
      // Uniformes des tuiles de la Terre.
      const u = this.engine.tiles.uniforms;
      // Même Soleil et même ombre que la carte.
      this.material.uniforms.sunV = u.sunV; this.material.uniforms.shade = u.shade;
      // C'est fait.
      this.linked = true;
    // Fin de ce cas.
    }
    // Un bâtiment reçu par image est extrudé.
    // Une tuile qui échoue (géométrie inattendue) est notée en échec et réessayée plus tard : elle ne doit jamais
    // interrompre la boucle d'affichage du moteur.
    if (this.arrived.length) {
      // La tuile reçue la plus ancienne.
      const a = this.arrived.shift();
      // Extrusion protégée ; en cas d'erreur : échec, nouvel essai dans 30 s.
      try { this.build(a); } catch { a.tile.state = 'failed'; a.tile.retryAt = now + RETRY_AFTER_MS; }
    // Fin de ce cas.
    }
    // Le repère suit la rotation propre de la Terre (le maillage peut être masqué, pas ce repère).
    // Le maillage de la Terre et le repère.
    const mesh = this.engine.earth.mesh, frame = this.root;
    // Recopie la rotation propre, si le parent n'est pas le maillage.
    if (this.parent !== mesh) frame.rotation.y = mesh.rotation.y;
    // Met à jour la matrice du repère.
    frame.updateMatrix();
    // Et sa matrice dans la scène.
    frame.updateWorldMatrix(true, false);
    // Caméra dans le repère de la Terre, ramenée à la sphère unité.
    const local = this.camL.copy(cam.position).applyMatrix4(this.tmpM.copy(frame.matrixWorld).invert()).divideScalar(this.radius);
    // Altitude de la caméra (m).
    const altitude = (local.length() - 1) * EARTH_RADIUS_M;
    // Longitude et latitude du point survolé.
    const [lon, lat] = xyzToLonLat([local.x, local.y, local.z]);
    // Distance de ce point à Paris (0 dedans).
    const away = groundDistance(lon, lat, Math.min(Math.max(lon, PARIS_BOUNDS.west), PARIS_BOUNDS.east), Math.min(Math.max(lat, PARIS_BOUNDS.south), PARIS_BOUNDS.north));
    // Portée de la recherche des tuiles.
    const radiusM = viewRange(altitude);
    // Actif : permis, Terre visible, sous l'altitude d'affichage et assez près de Paris.
    const on = this.enabled && !hidden && altitude > 0 && altitude < SHOW_ALTITUDE_M && away < radiusM;
    // Inactif : masque le repère et s'arrête.
    if (!on) { if (this.root.visible) this.root.visible = false; this.setStatus(0, this.active, 0); return; }
    // Repère visible.
    this.root.visible = true;
    // Relief en volume : chaque bâtiment à l'altitude de son sol.
    this.material.uniforms.uRelief.value = flat ? 0 : 1;
    // État de la carte changé, ou soulèvement du sol modifié : les carreaux sont reposés.
    if (flat !== this.flat || Math.abs(groundLiftM - this.groundLiftM) > REPLACE_M) {
      // Garde l'état et le soulèvement.
      this.flat = flat; this.groundLiftM = groundLiftM;
      // Repose chaque carreau.
      for (const t of this.tiles.values()) this.place(t);
    // Fin de ce cas.
    }
    // Choix des carreaux : seulement à intervalle, ou s'il est demandé.
    if (!this.dirty && now - this.selectAt < SELECT_EVERY_MS) return;
    // C'est fait.
    this.dirty = false;
    // Instant du choix.
    this.selectAt = now;
    // Champ de la caméra dans le repère de la sphère unité : projection × vue × repère de la Terre × rayon.
    this.viewM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(frame.matrixWorld).multiply(this.tmpM.makeScale(this.radius, this.radius, this.radius));
    // Plans du champ.
    this.frustum.setFromProjectionMatrix(this.viewM);
    // Direction de visée dans le repère de la sphère unité.
    const fwd = cam.getWorldDirection(this.fwd).transformDirection(this.tmpM.copy(frame.matrixWorld).invert());
    // Tuiles voulues : à portée, et dans le champ de la caméra (boîte élargie d'un quart pour ne pas les voir apparaître au bord).
    const wanted = tilesAround(lon, lat, radiusM).filter((w) => {
      // Boîte de la tuile, du sol à 120 m.
      this.box.setFromPoints(tileCorners(tileBounds(w.x, w.y)).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      // Élargie d'un quart de sa taille.
      this.box.expandByScalar(this.box.min.distanceTo(this.box.max) * 0.25);
      // Hors du champ : écartée.
      if (!this.frustum.intersectsBox(this.box)) return false;
      // Centre de la tuile.
      this.box.getCenter(this.tc);
      // Écart angulaire à l'axe de visée : 0 au centre de l'écran.
      const off = Math.acos(Math.max(-1, Math.min(1, this.tc.sub(local).normalize().dot(fwd))));
      // Priorité : distance, allongée pour les tuiles loin de l'axe.
      w.p = (w.d + 50) * (1 + 2 * off);
      // Gardée.
      return true;
    // Fin du filtre ; tri par priorité, l'axe de visée d'abord.
    }).sort((a, b) => a.p - b.p);
    // Clés voulues.
    const keys = new Set(wanted.map((w) => w.key));
    // Pour chaque carreau voulu (début).
    for (const w of wanted) {
      // Le carreau, créé s'il manque.
      let t = this.tiles.get(w.key);
      // S'il manque : créé, à charger.
      if (!t) { t = { key: w.key, x: w.x, y: w.y, bounds: tileBounds(w.x, w.y), state: 'idle', mesh: null, groundM: 0, buildings: 0, usedAt: 0, retryAt: 0, abort: null }; this.tiles.set(w.key, t); }
      // Utilisé maintenant.
      t.usedAt = now;
      // À charger et de la place : lancé (celle de l'axe de visée d'abord).
      if ((t.state === 'idle' || (t.state === 'failed' && now >= t.retryAt)) && this.active < this.profile.parallel) this.load(t);
    // Fin des carreaux voulus.
    }
    // Compteurs pour l'interface.
    let shown = 0, buildings = 0;
    // Pour chaque carreau en mémoire (début).
    for (const t of [...this.tiles.values()]) {
      // Voulu ?
      const want = keys.has(t.key);
      // Téléchargement d'un carreau qui n'est plus voulu : abandonné.
      if (!want && t.state === 'loading') t.abort?.abort();
      // Visible s'il est voulu et prêt.
      if (t.mesh) t.mesh.visible = want;
      // Compte ce qui est affiché.
      if (want && t.state === 'ready') { shown++; buildings += t.buildings; }
    // Fin des carreaux.
    }
    // Plafond dépassé : les plus anciennement utilisés, hors carreaux voulus, sortent.
    if (this.tiles.size > this.profile.keep) {
      // Carreaux libérables, du plus ancien au plus récent.
      const idle = [...this.tiles.values()].filter((t) => !keys.has(t.key)).sort((a, b) => a.usedAt - b.usedAt);
      // Les libère jusqu'à repasser sous le plafond.
      for (const t of idle) { if (this.tiles.size <= this.profile.keep) break; this.drop(t); }
    // Fin du plafond.
    }
    // État pour l'interface.
    this.setStatus(shown, this.active, buildings);
  // Fin de update.
  }

  /** État pour l'interface : objet remplacé seulement quand une valeur change (le HUD ne se redessine pas pour rien). */
  // setStatus : les carreaux affichés, en cours, et les bâtiments affichés (début).
  setStatus(shown, loading, buildings) {
    // L'état actuel.
    const s = this.status;
    // Inchangé : rien à faire.
    if (s.shown === shown && s.loading === loading && s.buildings === buildings) return;
    // Nouvel état.
    this.status = { shown, loading, buildings };
  // Fin de setStatus.
  }

  /** Libère tout. */
  // dispose : libère les carreaux, le matériau et le repère (début).
  dispose() {
    // Libère chaque carreau.
    for (const t of [...this.tiles.values()]) this.drop(t);
    // Libère le matériau.
    this.material.dispose();
    // Retire le repère.
    this.parent.remove(this.root);
  // Fin de dispose.
  }
// Fin de la classe Paris3D.
}

/** Téléchargement d'un GeoJSON ; une réponse en erreur lève une exception. */
// defaultFetchJson : l'adresse et le signal d'annulation (début).
async function defaultFetchJson(url, signal) {
  // Requête, annulable.
  const res = await fetch(url, { signal });
  // Réponse en erreur : exception.
  if (!res.ok) throw new Error(`WFS ${res.status}`);
  // Renvoie le JSON.
  return res.json();
// Fin de defaultFetchJson.
}
