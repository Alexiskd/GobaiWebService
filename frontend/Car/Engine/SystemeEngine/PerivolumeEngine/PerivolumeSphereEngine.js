import { LOAD_STATE } from './PerivolumeManager.js';

/**
 * PerivolumeSphereEngine (ancien PerivolumeRenderingEngine) : c'est lui qui dessine les sphères translucides en fil
 * de fer autour des astres et des systèmes (celles vues autour du Soleil et de Mercure). Rangé avec les autres
 * moteurs de périvolume dans SystemeEngine/PerivolumeEngine.
 * Moteur de rendu des périverolumes : représente en 3D, dans la scène, le périverolume
 * de chaque système planétaire et solaire sous la forme d'une bulle de verre translucide,
 * avec une enveloppe fantôme pour la zone d'arrière-plan (BACKGROUND).
 * Le moteur ne décide rien : il suit les volumes enregistrés et les états effectifs
 * calculés par le PerivolumeManager / SystemManager.
 */

// Apparence par état : visibilité, opacité du verre, opacité du fil de fer et teinte.
const APPEARANCE_BY_STATE = {
  ACTIVE: { visible: true, glassOpacity: 0.12, wireOpacity: 0.26, color: 0x9fdcff },
  BACKGROUND: { visible: true, glassOpacity: 0.04, wireOpacity: 0.08, color: 0x9fdcff },
  UNLOADED: { visible: false, glassOpacity: 0, wireOpacity: 0, color: 0x9fdcff },
};

// Apparence d'un périvolume hors de portée quand l'affichage les révèle tous (mode Schwarzschild, E = mc²) :
// très estompé, pour situer chaque astre sans masquer la scène.
const REVEALED_UNLOADED = { visible: true, glassOpacity: 0.02, wireOpacity: 0.06, color: 0x9fdcff };

// En dessous de cette opacité d'ensemble, les périvolumes sont retirés du rendu (plus rien à dessiner).
const DISPLAY_EPSILON = 0.002;

// Vérifie qu'un vecteur est un tableau 3D de nombres finis.
const finiteVector = (v) => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite);

// Déclare et exporte le moteur de rendu des périverolumes.
export class PerivolumeSphereEngine {
  // Moteur Three.js injecté : le cœur du moteur reste indépendant de toute importation directe.
  #THREE;
  // Scène Three.js rattachée : peut être nulle tant qu'attachScene n'a pas été appelé.
  #scene = null;
  // Entrées de rendu par identifiant de périverolume.
  #entries = new Map();

  // Constructeur : exige THREE, accepte les opacités de base et la densité des sphères.
  constructor({ THREE, opacity = 0.12, wireOpacity = 0.26, segments = 48 } = {}) {
    if (!THREE) throw new TypeError('THREE est requis.');
    this.#THREE = THREE;
    this.opacity = opacity;
    this.wireOpacity = wireOpacity;
    this.segments = Math.max(8, Math.trunc(segments) || 48);
    // Opacité d'ensemble (0 = tout masqué, 1 = apparence normale) : le moteur Schwarzschild la fait suivre son fondu.
    this.displayAlpha = 1;
    // Vrai : les périvolumes hors de portée (UNLOADED) restent visibles, très estompés.
    this.revealUnloaded = false;
  }

  /**
   * Règle l'affichage d'ensemble : `alpha` de 0 (tout masqué) à 1 (apparence normale), appliqué aussitôt à tous
   * les périvolumes. `revealUnloaded` : montre aussi, estompés, ceux qui sont hors de portée.
   * C'est par ici que le moteur Schwarzschild (bouton E = mc²) allume et éteint les périvolumes en fondu.
   */
  setDisplay(alpha, { revealUnloaded = this.revealUnloaded } = {}) {
    if (!Number.isFinite(alpha)) throw new TypeError('alpha doit être un nombre fini.');
    this.displayAlpha = Math.min(1, Math.max(0, alpha));
    this.revealUnloaded = Boolean(revealUnloaded);
    for (const entry of this.#entries.values()) this.#apply(entry);
    return this.displayAlpha;
  }

  // Rattache la scène Three.js : les bulles déjà enregistrées y sont ajoutées.
  attachScene(scene) {
    if (!scene) throw new TypeError('scene est requise.');
    this.#scene = scene;
    for (const entry of this.#entries.values()) if (!entry.group.parent) scene.add(entry.group);
  }

  // Enregistre un périverolume à représenter : une bulle de verre par système.
  /**
   * `variant` : « system » (défaut) = bulle de verre, fil de fer et enveloppe d'arrière-plan ; « body » = simple
   * sphère en fil de fer, légère, pour le périvolume de chaque astre (des dizaines à l'écran).
   */
  register({ id, center = [0, 0, 0], radius, backgroundRadius = radius * 3, metadata = {}, variant = 'system' } = {}) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('id requis.');
    if (!finiteVector(center)) throw new TypeError(`Centre invalide pour ${id}.`);
    if (!Number.isFinite(radius) || radius <= 0) throw new RangeError(`Rayon invalide pour ${id}.`);
    if (!Number.isFinite(backgroundRadius) || backgroundRadius < radius) {
      throw new RangeError(`backgroundRadius doit être supérieur ou égal au rayon pour ${id}.`);
    }
    if (this.#entries.has(id)) this.unregister(id);
    const entry = variant === 'body'
      ? this.#buildBodyEntry(id, radius, backgroundRadius, metadata)
      : this.#buildEntry(id, radius, backgroundRadius, metadata);
    entry.group.position.set(center[0], center[1], center[2]);
    this.#entries.set(id, entry);
    if (this.#scene) this.#scene.add(entry.group);
    this.setState(id, LOAD_STATE.UNLOADED);
    return this.get(id);
  }

  // Construit le groupe Three.js d'un périverolume : verre, fil de fer et enveloppe d'arrière-plan.
  // Périvolume d'un astre : une seule sphère en fil de fer, à peu de segments (pas de verre : la transmission
  // coûte une passe de rendu, intenable pour chaque planète et chaque satellite).
  #buildBodyEntry(id, radius, backgroundRadius, metadata) {
    const T = this.#THREE;
    const group = new T.Group();
    group.name = `perivolume:${id}`;
    const segments = Math.max(8, Math.round(this.segments / 2));
    const geometry = new T.SphereGeometry(radius, segments, Math.max(6, Math.round(segments / 2)));
    const wireMaterial = new T.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: this.wireOpacity, wireframe: true, depthWrite: false });
    const wire = new T.Mesh(geometry, wireMaterial);
    wire.renderOrder = 6;
    group.add(wire);
    return { id, group, glass: null, wire, background: null, radius, backgroundRadius, metadata, variant: 'body', state: LOAD_STATE.UNLOADED };
  }

  #buildEntry(id, radius, backgroundRadius, metadata) {
    const T = this.#THREE;
    const group = new T.Group();
    // Nom lisible du groupe dans la scène.
    group.name = `perivolume:${id}`;
    // Sphère de verre : frontière ACTIVE du périverolume.
    const activeGeometry = new T.SphereGeometry(radius, this.segments, Math.max(6, Math.round(this.segments / 2)));
    // Voile translucide de la bulle : un matériau simple, sans éclairage ni transmission. Le verre physique
    // d'origine (transmission) obligeait le moteur de rendu à redessiner toute la scène une seconde fois à chaque
    // image tant qu'une bulle était visible ; à 4 à 12 % d'opacité, la différence ne se voit pas.
    const glassMaterial = new T.MeshBasicMaterial({
      color: APPEARANCE_BY_STATE.ACTIVE.color,
      transparent: true,
      opacity: this.opacity,
      side: T.DoubleSide,
      depthWrite: false,
    });
    const glass = new T.Mesh(activeGeometry, glassMaterial);
    // Ordre de rendu : après les astres opaques, avant les étiquettes.
    glass.renderOrder = 5;
    group.add(glass);
    // Fil de fer : souligne la frontière ACTIVE exacte.
    const wireMaterial = new T.MeshBasicMaterial({
      color: 0xbfe9ff,
      transparent: true,
      opacity: this.wireOpacity,
      wireframe: true,
      depthWrite: false,
    });
    const wire = new T.Mesh(activeGeometry, wireMaterial);
    // Léger surdimensionnement pour éviter le z-fighting avec le verre.
    wire.scale.setScalar(1.002);
    wire.renderOrder = 6;
    group.add(wire);
    // Enveloppe fantôme : frontière d'arrière-plan (BACKGROUND), fil de fer très discret.
    const backgroundGeometry = new T.SphereGeometry(backgroundRadius, Math.max(16, Math.round(this.segments / 2)), Math.max(8, Math.round(this.segments / 4)));
    const backgroundMaterial = new T.MeshBasicMaterial({
      color: 0x9fdcff,
      transparent: true,
      opacity: this.wireOpacity * 0.4,
      wireframe: true,
      depthWrite: false,
    });
    const background = new T.Mesh(backgroundGeometry, backgroundMaterial);
    background.renderOrder = 4;
    group.add(background);
    return { id, group, glass, wire, background, radius, backgroundRadius, metadata, variant: 'system', state: LOAD_STATE.UNLOADED };
  }

  // Met à jour le centre d'une bulle (les astres et systèmes se déplacent avec les éphémérides).
  updateCenter(id, center) {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    if (!finiteVector(center)) throw new TypeError(`Centre invalide pour ${id}.`);
    entry.group.position.set(center[0], center[1], center[2]);
    return true;
  }

  // Applique l'apparence d'un état effectif à une bulle.
  setState(id, state) {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    // État inchangé : rien à refaire. Les décisions arrivent à chaque image pour chaque périvolume ; sans ce garde,
    // l'apparence de toutes les sphères était réécrite à chaque image, même masquées.
    if (entry.state === state && entry.applied) return true;
    entry.state = state;
    entry.group.userData.perivolumeState = state;
    this.#apply(entry);
    return true;
  }

  // Applique à un périvolume l'apparence de son état, multipliée par l'opacité d'ensemble.
  #apply(entry) {
    const known = APPEARANCE_BY_STATE[entry.state] ?? APPEARANCE_BY_STATE.UNLOADED;
    const look = !known.visible && this.revealUnloaded ? REVEALED_UNLOADED : known;
    const alpha = this.displayAlpha;
    entry.applied = true;
    entry.group.visible = look.visible && alpha > DISPLAY_EPSILON;
    entry.wire.material.opacity = look.wireOpacity * alpha;
    if (entry.glass) {
      entry.glass.material.opacity = look.glassOpacity * alpha;
      entry.glass.material.color.setHex(look.color);
    }
    if (entry.background) entry.background.material.opacity = look.wireOpacity * 0.4 * alpha;
  }

  // Applique en bloc les décisions du SystemManager : un état par identifiant.
  sync(decisions = []) {
    if (!Array.isArray(decisions)) throw new TypeError('decisions doit être un tableau.');
    let applied = 0;
    for (const decision of decisions) {
      if (decision && this.setState(decision.id, decision.state)) applied += 1;
    }
    return applied;
  }

  // Renvoie l'instantané d'une bulle, ou null si l'identifiant est inconnu.
  get(id) {
    const entry = this.#entries.get(id);
    if (!entry) return null;
    const p = entry.group.position;
    return { id, center: [p.x, p.y, p.z], radius: entry.radius, backgroundRadius: entry.backgroundRadius, state: entry.state, metadata: entry.metadata, variant: entry.variant, visible: entry.group.visible };
  }

  // Retire une bulle de la scène et libère ses géométries et matériaux.
  unregister(id) {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    entry.group.parent?.remove(entry.group);
    // Le fil de fer partage la géométrie de la bulle quand il y en a une ; sinon (astre) il a la sienne.
    (entry.glass ?? entry.wire).geometry.dispose();
    entry.background?.geometry.dispose();
    entry.glass?.material.dispose();
    entry.wire.material.dispose();
    entry.background?.material.dispose();
    return this.#entries.delete(id);
  }

  // Compte les bulles par état : utile pour le HUD et les diagnostics.
  stats() {
    const byState = { ACTIVE: 0, BACKGROUND: 0, UNLOADED: 0 };
    for (const entry of this.#entries.values()) byState[entry.state] += 1;
    return { count: this.#entries.size, byState };
  }

  // Vide toutes les bulles.
  clear() {
    for (const id of [...this.#entries.keys()]) this.unregister(id);
  }
}

// Fin du moteur de rendu des périverolumes.
