/**
 * Méthodes du moteur SolarEngine (engine.jsx) : astres tuilés (modèle commun).
 * Installées sur SolarEngine.prototype par installMethods : `this` est le moteur.
 */
import * as THREE from 'three';
import { pickEarthAt } from '../LidarEngine/lidarGlobe.jsx';
import { MAX_TILED_BODIES, apparentPx, bodyLevel, planTiledBodies, satelliteShown, sphereInView, viewConeHalfAngle } from '../BodyEngine/bodyLoading.jsx';
import { nearestIndex, saveCamera } from '../CameraEngine/viewLock.jsx';
import { D, centuriesTT } from '../OrbitEngine/ephemeris.jsx';
import { BORDER_STYLE, COAST_STYLE, buildBorderSegments } from '../LabelEngine/bordersGeometry.jsx';
import { outsideSystem } from '../CameraEngine/systemView.jsx';
import { SCHWARZSCHILD_FADE_MS, easeInOutCubic, layOrbitOnWell, schwarzschildGeodesic, schwarzschildGridSegments } from '../../SystemeEngine/astronomy/orbits/orbitSchwarzschildMath.jsx';
import { loadMoonModel } from '../MoonEngine/moonModel.jsx';
import { PLANETS } from '../../SystemeEngine/astronomy/data/bodies.data.ts';
import { isKindHidden } from '../BodyEngine/bodyKinds.jsx';
import { sitesFromRegions } from '../../EruptionEngine/sunSurfaceMath.jsx';
import { pickSystem } from '../../SystemeEngine/PerivolumeEngine/systemPick.js';
import { WELL_LINE_OPACITY, MODEL_POLAR_LIMIT, AMBIENT_SHADED, SUN_LIGHT, SHADE_FADE_MS, ORBIT_POINTS } from './constants.jsx';

// Méthodes : astres tuilés (modèle commun).
export const tiledBodyMethods = {
  // ------------------------------------------------- astres tuilés (modèle commun)

  /**
   * Modèle 3D (glTF) d'un astre pour la vue d'ensemble ; les tuiles prennent le relais en zoomant.
   * Même éclairage et mêmes couleurs que ses tuiles (uniforms partagés). Aujourd'hui : la Lune (NASA SVS).
   */
  // loadBodyModel, asynchrone : charge le modèle 3D d'un astre (début).
  async loadBodyModel(id, url) {
    // L'astre.
    const tb = this.tiledById[id];
    // Inconnu : null.
    if (!tb) return null;
    // Déjà chargé ou en chargement : la promesse en cours.
    if (tb.model || tb.modelLoading) return tb.modelLoading;
    // Charge le modèle ; à l'arrivée (début).
    tb.modelLoading = loadMoonModel(url, tb.radius, tb.tiles.uniforms, { maxRms: tb.cfg.modelMaxRms }).then(({ object, info }) => {
      // Moteur arrêté : rien de plus.
      if (this.stopped) return info;
      // Garde le modèle.
      tb.model = object;
      // Masqué au départ.
      object.visible = false;
      // L'ajoute au groupe.
      tb.group.add(object);
      // Renvoie ses informations.
      return info;
    // Dans tous les cas : plus de chargement en cours.
    }).finally(() => { tb.modelLoading = null; });
    // Renvoie la promesse.
    return tb.modelLoading;
  // Fin de loadBodyModel.
  },
  // setBodyModelVisible : note si le modèle d'un astre est voulu.
  setBodyModelVisible(id, on) { const tb = this.tiledById[id]; if (tb) tb.modelWanted = on; },
  // loadMoonModel : charge le modèle de la Lune.
  loadMoonModel(url) { return this.loadBodyModel('moon', url); },
  // setMoonModelVisible : note si le modèle de la Lune est voulu.
  setMoonModelVisible(on) { this.setBodyModelVisible('moon', on); },
  /** Après la mise à jour des tuiles : modèle de loin, tuiles de près (pour chaque astre qui a un modèle). */
  // updateBodyModel : choisit entre le modèle et les tuiles (début).
  updateBodyModel(tb) {
    // Le modèle.
    const m = tb.model;
    // Aucun : rien.
    if (!m) return;
    // Planètes : le modèle tourne avec la planète, comme ses tuiles (la Lune est orientée par son groupe).
    if (tb.syncMesh) m.rotation.y = tb.mesh.rotation.y;
    // Les pôles des modèles sont pincés (défaut connu des modèles NASA SVS) : vue polaire → tuiles, toujours nettes.
    const rel = this.tmpV.copy(this.cam.position).sub(tb.group.position);
    // Distance de la caméra à l'astre.
    const dist = rel.length();
    // Sinus de la latitude survolée.
    const localUp = rel.applyQuaternion(this.moonQInv.copy(tb.group.quaternion).invert()).y / (dist || 1);
    // Astre irrégulier (Phobos) : le modèle est sa vraie forme, il reste affiché de près et sous tous les angles.
    const far = tb.modelWanted && (tb.cfg.modelAlways
      // ou de loin, hors vue polaire.
      || (dist > tb.radius * (tb.cfg.modelSwitchRadii ?? 2.2) && Math.abs(localUp) < MODEL_POLAR_LIMIT));
    // Modèle visible de loin.
    m.visible = far;
    // Tuiles visibles de près.
    tb.tiles.root.visible = !far;
    // De loin : la sphère de fond est masquée.
    if (far) tb.mesh.visible = false;
  // Fin de updateBodyModel.
  },
  /**
   * Satellites selon le zoom : un satellite n'est dessiné (sphère, repère, clic) que si le rayon de son orbite est
   * assez grand à l'écran pour qu'il se détache de sa planète, ou s'il est l'astre ciblé. Vu de loin, un système
   * planétaire se réduit ainsi à sa planète. Le réglage « masqué » de Paramètres reste prioritaire.
   */
  // updateSatelliteLod : applique le niveau de zoom aux satellites (début).
  updateSatelliteLod(pxScale) {
    // Position de la caméra.
    const cp = this.cam.position;
    // Pour chaque satellite (début).
    for (const s of this.satellites.list) {
      // Rayon apparent de son orbite, vu depuis la caméra.
      const orbitPx = apparentPx(s.rel.length(), cp.distanceTo(s.parent.group.position), pxScale);
      // Dessiné ou non, d'après ce rayon, l'astre ciblé et son état à l'image précédente.
      const shown = satelliteShown({ orbitPx, focused: s.focus === this.focus, shown: !s.lodHidden });
      // Garde l'état pour l'image suivante, les repères et les clics.
      s.lodHidden = !shown;
      // Règle son groupe : dessiné, et non masqué dans Paramètres.
      s.group.visible = shown && !s.hidden;
    // Fin de la boucle.
    }
  // Fin de updateSatelliteLod.
  },
  /**
   * Plan des tuiles de cette image : identifiants des astres dont les tuiles sont mises à jour. Un astre masqué,
   * hors du champ de la caméra ou trop petit à l'écran n'en fait pas partie ; l'astre ciblé en fait toujours partie.
   * Le nombre d'astres servis à la fois est borné (trois, plus un à tour de rôle).
   */
  // planTiles : calcule le plan des tuiles (début).
  planTiles(pxScale) {
    // Direction de visée de la caméra.
    const fwd = this.cam.getWorldDirection(this.tmpV);
    // La même, en tableau de trois nombres.
    const dir = [fwd.x, fwd.y, fwd.z];
    // Demi-angle du cône qui contient tout le champ de la caméra.
    const half = viewConeHalfAngle(this.cam.fov * D, this.cam.aspect);
    // Position de la caméra.
    const cp = this.cam.position;
    // Candidats.
    const candidates = [];
    // Pour chaque astre tuilé (début).
    for (const tb of this.tiledBodies) {
      // Ciblé ou non.
      const focused = tb.focus === this.focus;
      // Masqué (Paramètres, ou satellite trop près de sa planète) et non ciblé : ignoré.
      if (!focused && !tb.group.visible) continue;
      // Sa position.
      const p = tb.group.position;
      // Sa position par rapport à la caméra.
      const rel = [p.x - cp.x, p.y - cp.y, p.z - cp.z];
      // Son rayon apparent en pixels.
      const px = apparentPx(tb.radius, Math.hypot(rel[0], rel[1], rel[2]), pxScale);
      // L'ajoute aux candidats, avec son niveau de détail.
      candidates.push({ id: tb.id, px, focused, level: bodyLevel({ px, inView: sphereInView(rel, dir, tb.radius, half), focused }) });
    // Fin de la boucle.
    }
    // Numéro de l'image, pour le tour de rôle.
    this.loadTick = (this.loadTick || 0) + 1;
    // Renvoie le plan, avec le budget d'astres.
    const maxTiledBodies = this.coreRenderBudgetPolicy?.snapshot().maxTiledBodies ?? MAX_TILED_BODIES;
    return planTiledBodies(candidates, maxTiledBodies, this.loadTick);
  // Fin de planTiles.
  },
  /** Fond cartographique d'un astre (id de couche `body: <id>` de l'API) ; null = aucun (sphère de fond seule). */
  // setBodyTileBase, asynchrone : choisit le fond de carte d'un astre (début).
  async setBodyTileBase(id, layerId) {
    // L'astre.
    const tb = this.tiledById[id];
    // Inconnu : null.
    if (!tb) return null;
    // Essai (début).
    try {
      // Change le fond.
      return await tb.tiles.setBase(layerId);
    // Dans tous les cas (début).
    } finally {
      // Sans carte, l'altitude minimale remonte : on recale le zoom si l'astre est ciblé.
      if (tb.tiles.active === false && this.focus === tb.focus) this.zoom(1);
    // Fin de l'essai.
    }
  // Fin de setBodyTileBase.
  },
  /** Source de tuiles du fond actif d'un astre (TileSource), ou null : sert au globe du plateau tournant. */
  // bodyBaseSource : la source du fond actif d'un astre, ou null.
  bodyBaseSource(id) { return this.tiledById?.[id]?.tiles.base?.source ?? null; },
  /** Calque optionnel (routes et noms pour la Terre, teinte d'un autre relief en mode composite), ou null. */
  // setBodyTileOverlay : choisit le calque d'un astre.
  setBodyTileOverlay(id, layerId) { return this.tiledById[id]?.tiles.setOverlay(layerId) ?? Promise.resolve(); },
  /** Mode composite : couleurs naturelles (texture globale) + détail en gris (si `pan`) + ombrage du relief. */
  // setBodyComposite : active ou coupe le mode composite d'un astre.
  setBodyComposite(id, on, opts) { this.tiledById[id]?.tiles.setComposite(on, opts); },
  /** Texture globale des couleurs naturelles (2:1 équirectangulaire) : tuiles, sphère de fond et modèle 3D. */
  // loadBodyColor : charge la texture globale des couleurs d'un astre (début).
  loadBodyColor(id, url) {
    // L'astre.
    const tb = this.tiledById[id];
    // Inconnu : promesse rejetée.
    if (!tb) return Promise.reject(new Error(`astre inconnu : ${id}`));
    // Renvoie une promesse (début).
    return new Promise((resolve, reject) => {
      // Chargeur de textures.
      const loader = new THREE.TextureLoader();
      // Sans identifiants.
      loader.setCrossOrigin('anonymous');
      // Charge l'image ; à l'arrivée (début).
      loader.load(url, (tex) => {
        // Moteur arrêté : la texture est libérée.
        if (this.stopped) { tex.dispose(); return; }
        // Répétition horizontale.
        tex.wrapS = THREE.RepeatWrapping; // continuité au méridien ±180°
        // Filtrage anisotrope, borné par la carte graphique.
        tex.anisotropy = Math.min(this.power.anisotropy, this.renderer.capabilities.getMaxAnisotropy());
        // La donne aux tuiles.
        tb.tiles.setColorTexture(tex);
        // Tient la promesse.
        resolve(tex);
      // En cas d'échec : promesse rejetée.
      }, undefined, () => reject(new Error(`texture des couleurs introuvable (${tb.cfg.mapLabel})`)));
    // Fin de la promesse.
    });
  // Fin de loadBodyColor.
  },
  // loadMoonColor : charge la texture des couleurs de la Lune.
  loadMoonColor(url) { return this.loadBodyColor('moon', url); },
  /** Détail simulé au-delà de la résolution des images (géantes gazeuses, satellites) : activé par défaut. */
  // setTileDetail : active ou coupe le détail simulé de tous les astres.
  setTileDetail(on) { for (const tb of this.tiledBodies) tb.tiles.setDetail(on); },
  /** Éclairage jour/nuit sur les cartes de tous les astres. */
  // setTileShade : active ou coupe l'ombre jour/nuit (début).
  setTileShade(on) {
    // Valeur visée : 1 ou 0.
    this.shadeGoal = on ? 1 : 0;
    // Premier réglage (ouverture de l'app) ou mouvement réduit demandé au système : immédiat. Ensuite, l'ombre
    // apparaît ou s'efface en fondu, image par image (voir updateShadeFade), en même temps que le thème de l'interface.
    const instant = this.shadeNow === undefined
      // ou animations réduites.
      || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    // Immédiat : applique la valeur.
    if (instant) this.applyShade(this.shadeGoal);
  // Fin de setTileShade.
  },
  /** Intensité de l'ombre jour/nuit (0 = astres entièrement éclairés, 1 = face nuit dans l'ombre) sur toutes les cartes. */
  // applyShade : applique une intensité d'ombre (début).
  applyShade(value) {
    // La garde.
    this.shadeNow = value;
    // La transmet aux tuiles de chaque astre.
    for (const tb of this.tiledBodies) tb.tiles.uniforms.shade.value = value;
    // Anneaux de Saturne : même réglage (ombre de la planète sur les anneaux, face éclairée ou non).
    for (const u of this.ringShades || []) u.value = value;
    // Objets éclairés par les lumières de la scène (astres sans carte ni réglage propre) : ombre coupée = lumière
    // d'ambiance pleine et Soleil éteint, donc éclairés partout ; ombre activée = Soleil seul.
    if (this.ambientLight) this.ambientLight.intensity = AMBIENT_SHADED + (1 - AMBIENT_SHADED) * (1 - value);
    // Lumière du Soleil : proportionnelle à l'ombre.
    if (this.sunLight) this.sunLight.intensity = SUN_LIGHT * value;
  // Fin de applyShade.
  },
  /** Fondu linéaire de l'ombre vers sa valeur visée, sur SHADE_FADE_MS (même durée que le fondu du thème). */
  // updateShadeFade : avance le fondu de l'ombre (début).
  updateShadeFade(dt) {
    // Pas d'ombre réglée, ou valeur atteinte : rien.
    if (this.shadeNow === undefined || this.shadeNow === this.shadeGoal) return;
    // Pas de cette image.
    const step = dt / SHADE_FADE_MS;
    // Valeur suivante : en montant,
    const next = this.shadeGoal > this.shadeNow
      // sans dépasser la valeur visée ;
      ? Math.min(this.shadeGoal, this.shadeNow + step)
      // ou en descendant, sans passer dessous.
      : Math.max(this.shadeGoal, this.shadeNow - step);
    // L'applique.
    this.applyShade(next);
  // Fin de updateShadeFade.
  },
  /**
   * Affichage Schwarzschild : bascule les orbites (ellipse de Kepler ↔ rosette précessée) en fondu, et montre ou
   * masque la grille filaire de la courbure posée autour du Soleil ; le tout avance image par image (voir
   * updateSchwarzschildFade, appelé à chaque image par frame).
   * @param {boolean} on vrai pour afficher la rosette et la grille
   * @returns {boolean} l'état demandé, tel qu'appliqué
   */
  // setSchwarzschild : vrai ou faux (début).
  setSchwarzschild(on) {
    // Note l'activité.
    this.markActive?.();
    // HUD à mettre à jour.
    this.hudAt = 0;
    // Le but du fondu.
    const goal = on ? 1 : 0;
    // Déjà réglé : rien de plus.
    if (this.schwarzschild.goal === goal) return Boolean(on);
    // Garde le réglage demandé dans l'état du mode ; le fondu le rattrapera image par image.
    this.schwarzschild.goal = goal;
    // Activation : la caméra dézoome sur l'ensemble du système solaire, pour voir toute la grille de courbure.
    if (goal === 1) this.systemOverview();
    // Vrai.
    return Boolean(on);
  // Fin de setSchwarzschild.
  },
  /** État du mode Schwarzschild (lisible depuis l'interface). */
  // schwarzschildOn : la valeur (début).
  get schwarzschildOn() {
    // Vrai si la cible du fondu est l'affichage Schwarzschild.
    return this.schwarzschild?.goal === 1;
  // Fin de schwarzschildOn.
  },
  /**
   * Pose les objets Schwarzschild de la scène : la grille filaire de la courbure (anneaux et rayons du
   * paraboloïde de Flamm, centré sur le Soleil) et, pour chaque planète, la rosette précessée de son orbite
   * (le tracé cible de la transition, l'autre étant la copie intacte de l'ellipse de Kepler).
   */
  // initSchwarzschild : les objets de la scène (début).
  initSchwarzschild() {
    // Le siècle courant de Temps terrestre, pour les éléments d'orbite.
    const orbitT = centuriesTT(Date.now());
    // L'état du mode : progression (0 = Kepler, 1 = Schwarzschild), but et dernier mélange dessiné.
    this.schwarzschild = { progress: 0, goal: 0, lastDrawn: -1, eased: 0, outerAu: 0 };
    // La géométrie filaire (segments d'anneaux et de rayons).
    const gridGeometry = new THREE.BufferGeometry();
    // Les segments, calculés par le module mathématique. Le disque est borné par l'aphélie de la planète naine la
    // plus lointaine du catalogue (Éris, a·(1+e) ≈ 97,7 UA, arrondi au-dessus) : la grille englobe tous les astres
    // du système, où qu'ils soient sur leur orbite, et le Soleil en reste exactement le centre.
    const outerAu = Math.ceil(Math.max(...PLANETS.map((b) => b.elements[0] * (1 + b.elements[2]))));
    // Gardé pour faire descendre les planètes sur cette même grille (voir sunWellDrop).
    this.schwarzschild.outerAu = outerAu;
    gridGeometry.setAttribute('position', new THREE.BufferAttribute(schwarzschildGridSegments({ outerAu }), 3));
    // Le maillage de la grille, en lignes, sans écriture de profondeur ni éclairage : un fil de courbure.
    const grid = new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({
      color: 0x6f86b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    // Dessiné après les tracés d'orbite.
    grid.renderOrder = 3;
    // Jamais écarté du rendu : la grille suit le Soleil, loin du centre de la scène.
    grid.frustumCulled = false;
    // Son nom.
    grid.name = 'schwarzschild-grid';
    // L'ajoute à la scène.
    this.scene.add(grid);
    // La garde.
    this.schwarzschild.grid = grid;
    // Pour chaque planète : sa rosette (le tracé cible du fondu), au même format que les rubans, et l'image
    // miroir de son ruban (le double affichage symétrique, collé sous forme de toupie).
    for (const p of this.planets) {
      // La géodésique de Schwarzschild (points de la rosette, sans point de fermeture).
      const rosette = schwarzschildGeodesic(p.def.elements, orbitT, ORBIT_POINTS, 3);
      // Le tracé cible, au format des rubans (le premier point répété à la fin) : un point de plus.
      const rosetteLoop = new Float32Array(rosette.length + 3);
      // Les points de la rosette.
      rosetteLoop.set(rosette);
      // Le premier, répété à la fin.
      rosetteLoop.set(rosette.subarray(0, 3), rosette.length);
      // La rosette descend dans le cône du bas de la toupie du Soleil : chaque point prend la hauteur de la grille
      // à sa distance du Soleil. Le mélange Kepler → rosette fait ainsi glisser l'orbite dans la toupie.
      // Planète naine : son orbite est couchée sur la grille, sans l'inclinaison de Kepler (voir layOrbitOnWell).
      layOrbitOnWell(rosetteLoop, outerAu, { flatten: Boolean(p.def.dwarf) });
      // Le garde.
      p.rosetteOrbit = rosetteLoop;
      // La copie intacte de Kepler : le point de retour du fondu.
      p.keplerOrbit = p.orbitTrail.points.slice();
    // Fin des planètes.
    }
  // Fin de initSchwarzschild.
  },
  /**
   * Avance le fondu Schwarzschild : la progression tend vers son but (0 ou 1) à vitesse constante, l'avancement
   * étant amorti (easeInOutCubic) pour un mélange sans à-coup des tracés ; la grille suit dans le même fondu.
   * @param {number} dt temps écoulé depuis la dernière image, en millisecondes
   */
  // updateSchwarzschildFade : le temps écoulé (début).
  updateSchwarzschildFade(dt) {
    // L'état du mode.
    const s = this.schwarzschild;
    // Pas encore créé, ou valeur atteinte et dessinée : rien.
    if (!s || (s.progress === s.goal && s.progress === s.lastDrawn)) return;
    // Pas de cette image.
    const step = dt / SCHWARZSCHILD_FADE_MS;
    // Valeur suivante : en montant,
    const next = s.goal > s.progress
      // sans dépasser la valeur visée ;
      ? Math.min(s.goal, s.progress + step)
      // ou en descendant, sans passer dessous.
      : Math.max(s.goal, s.progress - step);
    // La garde.
    s.progress = next;
    // L'avancement amorti, côté dessin.
    const eased = easeInOutCubic(next);
    // Gardé : les astres descendent dans leur toupie au même rythme (updateBodies, updateMoon, satellites).
    s.eased = eased;
    // Pour chaque planète : le mélange des deux tracés, sur place, dans le ruban dessiné.
    // Les orbites des planètes ne sont remélangées ici que si elles sont à l'écran ; les autres le seront quand
    // elles réapparaîtront (voir mixPlanetOrbit, appelé au placement). Pendant le fondu, cela évite de recalculer
    // et de renvoyer à la carte graphique 2 048 points par planète pour des tracés invisibles.
    for (const p of this.planets) if (p.orbit.visible) this.mixPlanetOrbit(p);
    // Le mélange dessiné est à jour.
    s.lastDrawn = next;
    // La grille : visible en fondu avec les orbites, posée sur le Soleil (le centre de la courbure).
    const grid = s.grid;
    // Son opacité, au maximum à fond de fondu.
    grid.material.opacity = WELL_LINE_OPACITY * eased;
    // Visible dès que le fondu commence, cachée et hors rendu une fois effacée.
    grid.visible = eased > 0.002;
    // Les périvolumes (chaque astre, chaque système) font partie de cet affichage : même fondu que la grille.
    this.perivolumeSpheres?.setDisplay(eased);
    // Les orbites des satellites naturels passent elles aussi du cercle de Kepler à leur rosette de Schwarzschild.
    this.satellites?.setSchwarzschildMix(eased, (sat) => this.satelliteRsOverA(sat));
    // Les toupies des astres : même opacité et même fondu que la grille du Soleil.
    if (this.systemWellMaterial) this.systemWellMaterial.opacity = WELL_LINE_OPACITY * eased;
    this.systemWellsOn = grid.visible;
    // Bouton relâché, fondu terminé : toutes les toupies sortent du rendu d'un coup.
    if (!this.systemWellsOn) for (const system of this.systemWells || []) system.well.visible = false;
    // Si elle est visible, elle suit le Soleil, exactement au centre du puits de courbure (représentation de la
    // métrique de Schwarzschild) — et pas seulement pendant le fondu.
    // Le bord de la grille reste dans le plan de l'écliptique, à l'origine du repère : c'est le Soleil qui descend.
    if (grid.visible) grid.position.copy(this.target).negate();
  // Fin de updateSchwarzschildFade.
  },
  /** Indice (focusTargets) de l'astre affiché le plus proche de l'astre focus, ou −1. */
  // nearestToFocus : l'astre affiché le plus proche de la cible (début).
  nearestToFocus() {
    // Cherche parmi les positions des astres non masqués.
    return nearestIndex(this.focusTargets.map((t) => (this.isTargetHidden(t) ? null : t.get())), this.focus);
  // Fin de nearestToFocus.
  },
  /**
   * Verrouille la vue sur l'astre le plus proche de l'astre focus (true), ou la rend (false).
   * Verrouiller : possible que cet astre soit ou non dans le champ de la caméra. La caméra tourne aussitôt son
   * regard vers lui ; elle reste autour de l'astre focus, vers lequel le zoom continue d'avancer.
   * Rendre : la caméra retrouve aussitôt la position et le zoom qu'elle avait au moment du verrouillage.
   */
  // setViewLock : verrouille la vue sur l'astre le plus proche, ou la rend (début).
  setViewLock(on) {
    // Globe CesiumJS actif : le verrouillage sur l'astre le plus proche se fait dans la scène three.js.
    if (on) this.solidGlobe?.leave();
    // Note l'activité.
    this.markActive?.();
    // HUD à mettre à jour.
    this.hudAt = 0;
    // Pour rendre la vue (début).
    if (!on) {
      // Le verrou en place.
      const lock = this.viewLock;
      // Plus de verrou.
      this.viewLock = null;
      // Même cible qu'au verrouillage : la caméra reprend sa position sauvegardée.
      if (lock && lock.focus === this.focus) { this.zoomFlight = null; Object.assign(this, lock.saved); }
      // Faux.
      return false;
    // Fin de ce cas.
    }
    // Déjà verrouillée : vrai.
    if (this.viewLock) return true;
    // Astre le plus proche.
    const index = this.nearestToFocus();
    // Aucun : faux.
    if (index < 0) return false;
    // Verrou : l'astre, la cible et la caméra sauvegardée.
    this.viewLock = { index, focus: this.focus, saved: saveCamera(this) };
    // Vrai.
    return true;
  // Fin de setViewLock.
  },
  /** État du verrouillage pour l'interface : { on, name (astre verrouillé ou à verrouiller), focusName }. */
  // viewLockState : l'état du verrouillage pour l'interface (début).
  viewLockState() {
    // Verrouillée ?
    const on = Boolean(this.viewLock);
    // Astre verrouillé, ou à verrouiller.
    const index = on ? this.viewLock.index : this.nearestToFocus();
    // Sa cible.
    const t = this.focusTargets[index];
    // Aucune : null.
    if (!t) return null;
    // Renvoie l'état, son nom et celui de la cible.
    return { on, name: t.name, focusName: this.focusTarget().name };
  // Fin de viewLockState.
  },
  /** Vue 3/4 automatique : inclinaison progressive près du sol (true par défaut), ou regard vertical (false). */
  // setTilt : active ou coupe la vue inclinée automatique.
  setTilt(on) { this.tiltOn = on; this.pilotTilt = null; if (this.cesiumHold) this.solidGlobe.camera.setTilt(on); },
  /** Frontières et littoraux : polylignes [lon, lat, …] de GET /borders (remplacent les précédentes). */
  // setBorders : reçoit les frontières, les littoraux et les pays (début).
  setBorders({ lines = [], coastlines = [], countries = [] }) {
    // Gardées telles quelles : le globe CesiumJS redessine les mêmes lignes (engines/astre-solide/astre-solide.overlays.js).
    this.borderData = { lines, coastlines, countries };
    // build : remplace un jeu de lignes par de nouvelles, dans son style (début).
    const build = (old, polylines, style) => {
      // S'il y a un ancien jeu (début).
      if (old) {
        // Le retire du repère.
        this.bordersRoot.remove(old);
        // Libère sa géométrie.
        old.geometry.dispose();
        // Libère son matériau.
        old.material.dispose();
      // Fin de ce cas.
      }
      // Géométrie.
      const geometry = new THREE.BufferGeometry();
      // Positions : les segments des lignes.
      geometry.setAttribute('position', new THREE.BufferAttribute(buildBorderSegments(polylines), 3));
      // Segments de ligne (début) :
      const obj = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        // Couleur et opacité du style (frontières ou littoraux), sans écriture de profondeur.
        color: style.color, transparent: true, opacity: style.opacity, depthWrite: false,
      // Fin des segments.
      }));
      // Jamais écartés par le champ de vision.
      obj.frustumCulled = false;
      // Les ajoute au repère.
      this.bordersRoot.add(obj);
      // Les renvoie.
      return obj;
    // Fin de build.
    };
    // Frontières.
    this.borders = build(this.borders, lines, BORDER_STYLE);
    // Littoraux.
    this.coasts = build(this.coasts, coastlines, COAST_STYLE);
    // Milieu de chaque pays calculé depuis ses frontières : les noms s'y posent.
    this.countryLabels.setCountries(countries);
    // Applique la visibilité.
    this.applyBorders();
  // Fin de setBorders.
  },
  // setBordersVisible : affiche ou masque les frontières.
  setBordersVisible(on) { this.bordersOn = on; this.applyBorders(); },
  /** Noms des villes du monde : [{ name, lon, lat, pop, capital }] triés par population. */
  // setCityLabels : reçoit les villes du monde.
  // Gardées aussi pour le nom du lieu sous la caméra du globe de près (HUD).
  setCityLabels(cities) { this.worldCities = Array.isArray(cities) ? cities : []; this.worldLabels.setCities(cities); },
  // setCityLabelsVisible : affiche ou masque les noms des villes.
  setCityLabelsVisible(on) { this.worldLabels.setVisible(on); },
  // setCountryLabelsVisible : affiche ou masque les noms des pays.
  setCountryLabelsVisible(on) { this.countryLabels.setVisible(on); },
  /** Lignes d'orbite (planètes et Lune). */
  // setOrbitsVisible : affiche ou masque les orbites.
  setOrbitsVisible(on) { this.orbitsOn = Boolean(on); },
  /**
   * Cible de téléportation masquée par sa famille (le Soleil ne l'est jamais), ou hors du système affiché sur
   * téléphone. `settingsOnly` : seulement le masquage des Paramètres.
   */
  // isTargetHidden : la cible est-elle masquée (début).
  isTargetHidden(t, { settingsOnly = false } = {}) {
    // Sans cible : faux.
    if (!t) return false;
    // Planète : son état.
    if (t.body) return Boolean(settingsOnly ? t.body.settingsHidden : t.body.hidden);
    // Lune : son état.
    if (t.moon) return settingsOnly ? this.moonSettingsHidden : this.moonHidden;
    // Satellite : son état.
    if (t.satellite) return Boolean(settingsOnly ? t.satellite.settingsHidden : t.satellite.hidden);
    // Soleil : jamais.
    return false;
  // Fin de isTargetHidden.
  },
  /**
   * Affiche ou masque une famille d'astres : 'solid' (Mercure, Vénus, Terre, Mars), 'gas' (Jupiter à Neptune),
   * 'dwarf' (Pluton) ou 'satellite' (la Lune et tous les satellites naturels). Un satellite suit aussi sa planète.
   * Masqué : ni astre, ni anneaux, ni carte, ni orbite, ni repère, et il n'est plus cliquable. Si l'astre ciblé
   * disparaît, la vue revient sur le Soleil.
   */
  // setBodyKindVisible : affiche ou masque une famille d'astres (début).
  setBodyKindVisible(kind, on) {
    // Retire la famille des masquées, ou l'y ajoute.
    if (on) this.hiddenKinds.delete(kind); else this.hiddenKinds.add(kind);
    // Applique la visibilité.
    this.applyBodyVisibility();
  // Fin de setBodyKindVisible.
  },
  /**
   * Astres masqués un par un (cases de la fenêtre Paramètres) : indices de téléportation (1 = première planète…).
   * Le Soleil (0) ne se masque pas. Masquer une planète masque aussi ses satellites.
   */
  // setHiddenBodies : reçoit les astres masqués un par un (début).
  setHiddenBodies(indices = []) {
    // Garde leurs indices, sans le Soleil.
    this.hiddenTargets = new Set([...indices].filter((i) => i > 0));
    // Applique la visibilité.
    this.applyBodyVisibility();
  // Fin de setHiddenBodies.
  },
  /** Applique les deux réglages : familles masquées et astres masqués un par un. */
  // applyBodyVisibility : applique les familles et les astres masqués (début).
  applyBodyVisibility() {
    // Les deux réglages, et la planète du système affiché sur téléphone (les autres systèmes ne sont pas dessinés).
    const h = this.hiddenKinds, own = this.hiddenTargets, host = this.systemHost;
    // Pour chaque planète (début).
    this.planets.forEach((p, j) => {
      // Masquée par sa famille ou une par une (Paramètres).
      p.settingsHidden = isKindHidden(h, p.kind) || own.has(j + 1);
      // Masquée aussi hors du système affiché.
      p.hidden = p.settingsHidden || outsideSystem(host, p);
      // Règle son groupe.
      p.group.visible = !p.hidden;
    // Fin de la boucle.
    });
    // Lune masquée (Paramètres) : par la famille des satellites ou celle de la Terre, avec la Terre, ou une par une.
    this.moonSettingsHidden = isKindHidden(h, this.earth.kind, true) || this.earth.settingsHidden || own.has(this.moonFocus);
    // Masquée aussi hors du système de la Terre.
    this.moonHidden = this.moonSettingsHidden || outsideSystem(host, this.earth);
    // Règle son groupe.
    this.moonGroup.visible = !this.moonHidden;
    // Pour chaque satellite (début).
    for (const s of this.satellites.list) {
      // Masqué (Paramètres) : par la famille des satellites ou celle de sa planète, avec sa planète, ou un par un.
      s.settingsHidden = isKindHidden(h, s.parent.kind, true) || s.parent.settingsHidden || own.has(s.focus);
      // Masqué aussi hors du système de sa planète.
      s.hidden = s.settingsHidden || outsideSystem(host, s.parent);
      // Règle son groupe : ni masqué, ni trop près de sa planète à l'écran (voir updateSatelliteLod).
      s.group.visible = !s.hidden && !s.lodHidden;
    // Fin de la boucle.
    }
    // Cible masquée dans les Paramètres : retour au Soleil.
    if (this.isTargetHidden(this.focusTarget(), { settingsOnly: true })) this.setFocus(0);
    // HUD à mettre à jour.
    this.hudAt = 0;
  // Fin de applyBodyVisibility.
  },
  /** Ciel lointain : étoiles, Voie lactée et galaxies proches (décoché : fond noir pur). */
  // setSkyVisible : affiche ou masque le ciel lointain.
  setSkyVisible(on) { this.sky.setVisible(on); },
  /**
   * Affiche ou masque l'atmosphère dessinée des planètes solides (Vénus, Terre, Mars) ; masquée, il reste le globe nu.
   * `ids` : les astres concernés (tous si absent). La Terre a son propre interrupteur (nuages et atmosphère).
   */
  // setAtmospheresVisible : affiche ou masque les atmosphères demandées (début).
  setAtmospheresVisible(on, ids = null) {
    // Règle chacune de celles demandées.
    for (const [id, atmosphere] of Object.entries(this.atmospheres || {})) if (!ids || ids.includes(id)) atmosphere.visible = Boolean(on);
  // Fin de setAtmospheresVisible.
  },
  /** Points et noms du Soleil et des planètes. */
  // setBodyMarkersVisible : affiche ou masque les repères du Soleil et des planètes.
  setBodyMarkersVisible(on) { this.bodyMarkersOn = Boolean(on); },
  /** Points et noms des satellites naturels (la Lune). */
  // setSatelliteMarkersVisible : affiche ou masque les repères des satellites.
  setSatelliteMarkersVisible(on) { this.satelliteMarkersOn = Boolean(on); },
  // setCoastsVisible : affiche ou masque les littoraux.
  setCoastsVisible(on) { this.coastsOn = on; this.applyBorders(); },
  // setCoastsFromTiles : les littoraux du globe cèdent la place à ceux des tuiles quand le calque des rues est affiché.
  setCoastsFromTiles(on) { this.coastsFromTiles = Boolean(on); this.applyBorders(); },
  /**
   * Régions actives du Soleil : garde la réponse de /api/v1/sun/regions et la pose aussitôt. Les positions sont
   * recalculées ensuite toutes les REGIONS_REPLACE_MS, parce que la longitude d'une région avance avec la rotation
   * du Soleil et que la rotation du maillage (un tour en 25 jours) n'est pas exactement celle du Soleil réel : les
   * reposer régulièrement les remet en place au lieu de laisser l'écart s'accumuler. Une réponse vide ramène les
   * régions simulées.
   */
  // setSolarRegions : garde les régions actives reçues du serveur et les pose.
  setSolarRegions(data) {
    // Garde la réponse, ou null si elle est vide.
    this.solarRegionsData = data?.regions?.length || data?.flares?.length ? data : null;
    // Sans données : revient aux régions simulées et s'arrête là.
    if (!this.solarRegionsData) { this.sunMesh?.userData.setEruptionSites?.(null); return; }
    // Avec des données : les pose tout de suite.
    this.applySolarRegions();
  // Fin de setSolarRegions.
  },
  // applySolarRegions : convertit les régions gardées en régions du moteur et les pose sur le Soleil.
  applySolarRegions() {
    // Sans Soleil, sans Terre ou sans données, rien à faire.
    if (!this.sunMesh || !this.earth?.group || !this.solarRegionsData) return;
    // Note l'instant de la pose, pour ne pas la refaire à chaque image.
    this.solarRegionsAt = performance.now();
    // Direction du Soleil vers la Terre, dans le repère du monde.
    const toEarth = this.sunToEarth.copy(this.earth.group.position).sub(this.sunMesh.position);
    // Tant que la scène n'est pas placée (première image), la direction est nulle : on attend la suivante.
    if (toEarth.lengthSq() === 0) { this.solarRegionsAt = 0; return; }
    // La même direction dans le repère propre du Soleil : on annule la rotation du maillage.
    toEarth.applyQuaternion(this.sunSpin.copy(this.sunMesh.quaternion).invert());
    // Longitude, dans ce repère, du méridien qui fait face à la Terre : c'est l'origine des longitudes publiées.
    const earthLongitude = Math.atan2(toEarth.z, toEarth.x);
    // Les régions du moteur, au plus le budget du maillage, replacées à l'instant présent.
    const sites = sitesFromRegions(this.solarRegionsData, { nowMs: Date.now(), earthLongitude });
    // Les pose : une liste vide ramène les régions simulées.
    this.sunMesh.userData.setEruptionSites?.(sites);
  // Fin de applySolarRegions.
  },
  // applyBorders : applique la visibilité des lignes (début).
  applyBorders() {
    // Frontières.
    if (this.borders) this.borders.visible = this.bordersOn;
    // Littoraux.
    if (this.coasts) this.coasts.visible = this.coastsOn && !this.coastsFromTiles;
    // Lignes voulues : s'il y en a et qu'un des deux jeux est affiché.
    this.bordersWanted = Boolean(this.borders) && (this.bordersOn || this.coastsOn);
    // Règle le repère.
    this.bordersRoot.visible = this.bordersWanted;
  // Fin de applyBorders.
  },
  // resize : au changement de taille de la fenêtre (début).
  resize() {
    // Nouvelle largeur.
    this.W = innerWidth;
    // Nouvelle hauteur.
    this.H = innerHeight;
    // Règle le moteur de rendu.
    this.renderer.setSize(this.W, this.H);
    // Règle le format de la caméra.
    this.cam.aspect = this.W / this.H;
    // Recalcule sa projection.
    this.cam.updateProjectionMatrix();
  // Fin de resize.
  },
  // Sélection d'un astre au clic : d'abord par rayon, puis par proximité de l'écran
  // (à l'échelle réelle, les planètes font souvent moins d'un pixel).
  /** Point de la Terre sous un pixel de l'écran : { lat, lon } ou null. */
  // pickEarth : le point de la Terre sous un pixel.
  pickEarth(x, y) { return pickEarthAt(this, x, y); },
  // selectAt : choisit l'astre sous un clic (début).
  selectAt(x, y) {
    // Globe CesiumJS actif : la scène three.js n'est pas à l'écran, un clic n'y choisit rien.
    if (this.cesiumHold) return false;
    // Placement d'un nuage LiDAR en cours : le clic donne la coordonnée GPS au lieu de choisir un astre.
    if (this.lidar?.handleClick(x, y)) return true;
    // Rectangle du canevas.
    const rect = this.canvas.getBoundingClientRect();
    // Abscisse du pointeur, de −1 à 1.
    this.pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    // Ordonnée du pointeur, de −1 à 1.
    this.pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    // Met à jour la matrice de la caméra.
    this.cam.updateMatrixWorld(true);
    // Met à jour celles de la scène.
    this.scene.updateMatrixWorld(true);
    // Lance le rayon depuis la caméra.
    this.raycaster.setFromCamera(this.pointer, this.cam);

    // Les astres des familles masquées ne se cliquent pas.
    const pickables = [
      // le Soleil,
      this.sunMesh,
      // les planètes non masquées,
      ...this.planets.filter((p) => !p.hidden).map((p) => p.mesh),
      // la Lune si elle ne l'est pas,
      ...(this.moonHidden ? [] : [this.moon]),
      // les satellites dessinés (ni masqués, ni trop près de leur planète à l'écran).
      ...this.satellites.list.filter((sat) => !sat.hidden && !sat.lodHidden).map((sat) => sat.mesh),
      // Batches instanciés enregistrés : instanceId est résolu vers l'identifiant du satellite.
      ...this.satellites.getInstancedPickables(),
    // Fin des astres cliquables.
    ];
    // Objets touchés par le rayon.
    const hits = this.raycaster.intersectObjects(pickables, true);
    // S'il y en a (début).
    if (hits.length) {
      // Le premier touché.
      const hit = hits[0].object;
      // Le Soleil : cible 0.
      if (hit === this.sunMesh) { this.setFocus(0); return true; }
      // La Lune : sa cible.
      if (hit === this.moon) { this.setFocus(this.moonFocus); return true; }
      // Satellite instancié (instanceId) ou maillage historique.
      const sat = this.satellites.resolvePickHit(hits[0]) || this.satellites.list.find((sv) => sv.mesh === hit);
      // S'il y en a un : sa cible.
      if (sat) { this.setFocus(sat.focus); return true; }
      // Pour chaque planète (début).
      for (let j = 0; j < this.planets.length; j++) {
        // En partant de l'objet touché.
        let node = hit;
        // Remonte jusqu'au groupe ou au maillage de la planète.
        while (node && node !== this.planets[j].group && node !== this.planets[j].mesh) node = node.parent;
        // Trouvé : sa cible.
        if (node) { this.setFocus(j + 1); return true; }
      // Fin de la boucle.
      }
    // Fin de ce cas.
    }

    // Candidats par proximité à l'écran (début) :
    const candidates = [
      // le Soleil,
      { index: 0, pos: this.sunMesh.position },
      // les planètes,
      ...this.planets.map((p, j) => ({ index: j + 1, pos: p.group.position })),
      // la Lune,
      { index: this.moonFocus, pos: this.moonGroup.position },
      // les satellites,
      ...this.satellites.list.map((sat) => ({ index: sat.focus, pos: sat.group.position })),
    // sans les cibles masquées.
    ].filter((c) => !this.isTargetHidden(this.focusTargets[c.index]));
    // Meilleur candidat, à moins de 34 px.
    let best = null, bestD = 34;
    // Pour chaque candidat (début).
    candidates.forEach((c) => {
      // Sa position à l'écran.
      const v = c.pos.clone().project(this.cam);
      // Hors de la profondeur visible : ignoré.
      if (v.z < -1 || v.z > 1) return;
      // Abscisse en pixels.
      const sx = rect.left + (v.x + 1) * 0.5 * rect.width;
      // Ordonnée en pixels.
      const sy = rect.top + (1 - v.y) * 0.5 * rect.height;
      // Distance au clic.
      const d = Math.hypot(sx - x, sy - y);
      // Plus proche : retenu.
      if (d < bestD) { bestD = d; best = c; }
    // Fin de la boucle.
    });
    // S'il y en a un : sa cible.
    if (best) { this.setFocus(best.index); return true; }
    // Clic sur un système : dans l'affichage Schwarzschild, chaque astre est un système (sa sphère d'influence et sa
    // toupie). Un clic qui n'a touché aucun astre mais traverse une de ces sphères vise l'astre principal du système.
    // Sinon rien sous le clic : faux.
    return this.selectSystemAt();
  // Fin de selectAt.
  },
  /**
   * Vise l'astre principal du système sous le pointeur (le rayon de `this.raycaster`, déjà réglé par selectAt).
   * Seulement quand les systèmes sont à l'écran (bouton E = mc² enfoncé). Les sphères sont exprimées dans le repère
   * de la scène : position de l'astre moins la cible, comme tout ce qui est dessiné. Renvoie vrai si un astre est visé.
   */
  selectSystemAt() {
    if (!this.schwarzschildOn || !this.systemWells?.length) return false;
    const ray = this.raycaster.ray;
    const systems = [];
    for (const system of this.systemWells) {
      if (this.isTargetHidden(system.target)) continue;
      const p = system.target.get();
      systems.push({ focusIndex: system.focusIndex, radius: system.radius, center: [p.x - this.target.x, p.y - this.target.y, p.z - this.target.z] });
    }
    const hit = pickSystem(ray.origin.toArray(), ray.direction.toArray(), systems);
    if (!hit) return false;
    this.setFocus(hit.focusIndex);
    return true;
  },
// Fin des méthodes.
};
