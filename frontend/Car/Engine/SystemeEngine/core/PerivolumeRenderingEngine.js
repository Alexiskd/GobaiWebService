import { LOAD_STATE } from './PerivolumeManager.js';

/**
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

// Vérifie qu'un vecteur est un tableau 3D de nombres finis.
const finiteVector = (v) => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite);

// Déclare et exporte le moteur de rendu des périverolumes.
export class PerivolumeRenderingEngine {
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
  }

  // Rattache la scène Three.js : les bulles déjà enregistrées y sont ajoutées.
  attachScene(scene) {
    if (!scene) throw new TypeError('scene est requise.');
    this.#scene = scene;
    for (const entry of this.#entries.values()) if (!entry.group.parent) scene.add(entry.group);
  }

  // Enregistre un périverolume à représenter : une bulle de verre par système.
  register({ id, center = [0, 0, 0], radius, backgroundRadius = radius * 3, metadata = {} } = {}) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('id requis.');
    if (!finiteVector(center)) throw new TypeError(`Centre invalide pour ${id}.`);
    if (!Number.isFinite(radius) || radius <= 0) throw new RangeError(`Rayon invalide pour ${id}.`);
    if (!Number.isFinite(backgroundRadius) || backgroundRadius < radius) {
      throw new RangeError(`backgroundRadius doit être supérieur ou égal au rayon pour ${id}.`);
    }
    if (this.#entries.has(id)) this.unregister(id);
    const entry = this.#buildEntry(id, radius, backgroundRadius, metadata);
    entry.group.position.set(center[0], center[1], center[2]);
    this.#entries.set(id, entry);
    if (this.#scene) this.#scene.add(entry.group);
    this.setState(id, LOAD_STATE.UNLOADED);
    return this.get(id);
  }

  // Construit le groupe Three.js d'un périverolume : verre, fil de fer et enveloppe d'arrière-plan.
  #buildEntry(id, radius, backgroundRadius, metadata) {
    const T = this.#THREE;
    const group = new T.Group();
    // Nom lisible du groupe dans la scène.
    group.name = `perivolume:${id}`;
    // Sphère de verre : frontière ACTIVE du périverolume.
    const activeGeometry = new T.SphereGeometry(radius, this.segments, Math.max(6, Math.round(this.segments / 2)));
    // Matériau verre : transmission, faible rugosité, vernis, sans écriture de profondeur.
    const glassMaterial = new T.MeshPhysicalMaterial({
      color: APPEARANCE_BY_STATE.ACTIVE.color,
      transparent: true,
      opacity: this.opacity,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.9,
      thickness: radius * 0.25,
      ior: 1.45,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
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
    return { id, group, glass, wire, background, radius, backgroundRadius, metadata, state: LOAD_STATE.UNLOADED };
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
    const look = APPEARANCE_BY_STATE[state] ?? APPEARANCE_BY_STATE.UNLOADED;
    entry.group.visible = look.visible;
    entry.glass.material.opacity = look.glassOpacity;
    entry.glass.material.color.setHex(look.color);
    entry.wire.material.opacity = look.wireOpacity;
    entry.background.material.opacity = look.wireOpacity * 0.4;
    entry.state = state;
    entry.group.userData.perivolumeState = state;
    return true;
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
    return { id, center: [p.x, p.y, p.z], radius: entry.radius, backgroundRadius: entry.backgroundRadius, state: entry.state, metadata: entry.metadata };
  }

  // Retire une bulle de la scène et libère ses géométries et matériaux.
  unregister(id) {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    entry.group.parent?.remove(entry.group);
    entry.glass.geometry.dispose();
    entry.background.geometry.dispose();
    entry.glass.material.dispose();
    entry.wire.material.dispose();
    entry.background.material.dispose();
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
