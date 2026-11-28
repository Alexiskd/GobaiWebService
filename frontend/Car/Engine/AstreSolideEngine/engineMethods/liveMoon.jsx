/**
 * Méthodes du moteur SolarEngine (engine.jsx) : Lune en direct.
 * Installées sur SolarEngine.prototype par installMethods : `this` est le moteur.
 */
import { lonLatToVec } from '../OrbitEngine/ephemeris.jsx';
import { MOON_FEATURES } from '../MoonEngine/moonFeatures.jsx';
import { TILED_BODY_BY_ID } from '../BodyEngine/tiledBodies.jsx';
import { clamp } from './constants.jsx';

// Méthodes : Lune en direct.
export const liveMoonMethods = {
  // ------------------------------------------------------------ Lune en direct

  /**
   * Lien de vue (#vue=lat,lon,altitude,cap,inclinaison) sur l'astre ciblé : la caméra y va ; quand le globe de près
   * a pris la main et fini son zoom, il prend exactement la vue du lien (CesiumCamera.applyView).
   */
  // openViewLink : la vue lue dans l'adresse (début).
  openViewLink(v) {
    // Astre tuilé ciblé.
    const tb = Object.values(this.tiledById ?? {}).find((t) => t.focus === this.focus);
    // Vue illisible ou astre sans carte : rien.
    if (!v || !tb) return false;
    // Vue en attente du globe de près, pendant 20 s au plus (si le globe ne prend pas la main, elle est oubliée).
    this.pendingView = { ...v, until: performance.now() + 20000 };
    // Vol jusqu'au lieu, à l'altitude du lien.
    this.goToSite(tb.cfg.id, { lon: v.lon, lat: v.lat }, v.altM / 1000);
    // Vrai.
    return true;
  // Fin de openViewLink.
  },
  /**
   * Survole un lieu d'un astre tuilé (clic sur un nom, repère du catalogue). Altitude par défaut : `siteAltitudeKm`
   * du modèle (≈ 50 km pour la Lune, 200 à 300 km pour les planètes).
   */
  // goToSite : survole un lieu d'un astre tuilé (début).
  goToSite(id, { lon, lat }, altitudeKm) {
    // Globe CesiumJS de près sur cet astre : sa caméra vole jusqu'au site.
    if (this.cesiumHold && id === this.solidGlobe.bodyId) return this.solidGlobe.camera.flyTo({ lon, lat, altitudeM: (altitudeKm ?? TILED_BODY_BY_ID[id]?.siteAltitudeKm ?? 300) * 1000 });
    // L'astre.
    const tb = this.tiledById[id];
    // Inconnu ou sans cible : rien.
    if (!tb || tb.focus < 0) return;
    // Le cible.
    this.setFocus(tb.focus);
    // Altitude : celle demandée, sinon celle de l'astre.
    const km = altitudeKm ?? tb.cfg.siteAltitudeKm;
    // Distance voulue : cette altitude avec une carte, sinon 1,15 rayon.
    this.distGoal = tb.radius * (tb.tiles.active ? 1 + km / tb.cfg.radiusKm : 1.15);
    // Suit le lieu.
    tb.lock = { lon, lat, lv: lonLatToVec([lon, lat]) };
  // Fin de goToSite.
  },
  /** Libère la caméra de tout lieu suivi (ville de la Terre, lieu survolé d'un astre). */
  // releaseLocks : lâche tout lieu suivi (début).
  releaseLocks() {
    // Plus de ville suivie.
    this.lockCity = null;
    // Plus de lieu suivi sur les astres tuilés.
    for (const tb of this.tiledBodies) tb.lock = null;
  // Fin de releaseLocks.
  },
  /** Face visible (tournée vers la Terre) ou face cachée. */
  // viewMoonSide : montre la face visible ou la face cachée de la Lune (début).
  viewMoonSide(side = 'near') {
    // Cible la Lune si besoin.
    if (this.focus !== this.moonFocus) this.setFocus(this.moonFocus);
    // Lâche le lieu suivi.
    this.tiledById.moon.lock = null;
    // Met à jour la matrice de la Lune.
    this.moonGroup.updateMatrixWorld(true);
    // Direction du centre de la face, dans la scène.
    const n = lonLatToVec([side === 'far' ? 180 : 0, 0]).applyQuaternion(this.moonGroup.quaternion).normalize();
    // Élévation correspondante.
    this.el = Math.asin(clamp(n.y, -1, 1));
    // Azimut correspondant.
    this.az = Math.atan2(n.x, n.z);
    // Rayon de la Lune.
    const r = this.data.bodies.moon.radius;
    // Trop près : recule à 3,2 rayons.
    if (this.distGoal < r * 2.5) this.distGoal = r * 3.2;
  // Fin de viewMoonSide.
  },
  // setMoonFeatureTypes : choisit les types de lieux affichés.
  setMoonFeatureTypes(types) { this.moonFeatureTypes = new Set(types); this.applyMoonFeatures(); },
  /** Pays de la Lune (frontières et noms d'après les alunissages, voir MoonEngine/moonCountries.jsx) : affichés ou non. */
  setMoonCountriesVisible(on) { this.moonCountriesOn = Boolean(on); },
  // applyMoonFeatures : applique ce choix (début).
  applyMoonFeatures() {
    // Lieux des types choisis.
    const items = MOON_FEATURES.filter((f) => this.moonFeatureTypes.has(f.type));
    // Les donne aux étiquettes.
    this.moonLabels.setCities(items);
    // Aucun : cache les étiquettes.
    if (!items.length) this.moonLabels.hideFrom(0);
  // Fin de applyMoonFeatures.
  },
  /** Danuri / ShadowCam : catalogue (GET /danuri/shadowcam) et accès aux images. */
  // setShadowCam : reçoit le catalogue ShadowCam et l'accès aux images.
  setShadowCam(items, api) { this.shadowcam.api = api; this.shadowcam.setCatalog(items || []); this.hudAt = 0; },
  // setShadowCamVisible : affiche ou masque les mosaïques.
  setShadowCamVisible(on) { this.shadowcam.setVisible(on); },
  /** Sondes en orbite : réponse de GET /ephemeris/moon/orbiters. */
  // setMoonOrbiters : reçoit les sondes.
  setMoonOrbiters(data) { this.orbiterData = data; this.orbiters.setData(data?.items || []); },
  // setMoonOrbitersVisible : affiche ou masque les sondes.
  setMoonOrbitersVisible(on) { this.orbiters.setVisible(on); },
  // selectOrbiter : sélectionne ou désélectionne une sonde (début).
  selectOrbiter(id) {
    // La même sonde une seconde fois : désélection.
    this.selectedOrbiter = this.selectedOrbiter === id ? null : id;
    // Transmet la sélection.
    this.orbiters.select(this.selectedOrbiter);
    // HUD à mettre à jour.
    this.hudAt = 0;
  // Fin de selectOrbiter.
  },
// Fin des méthodes.
};
