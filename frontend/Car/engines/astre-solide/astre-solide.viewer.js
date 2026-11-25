/**
 * Globe CesiumJS d'un astre solide (la Terre, la Lune, Mars, Mercure, les satellites à carte) : créé à la première
 * image (CesiumJS n'est téléchargé qu'à ce moment-là), recréé quand l'astre visé change. Sans Cesium ion ni aucune
 * clé. Rendu à la demande (rien n'est dessiné quand rien ne bouge).
 */

// Importe la table des couches d'imagerie.
import { CESIUM_IMAGERY } from './astre-solide.sources.js';

// Adresse des fichiers statiques de CesiumJS (Workers, Assets, Widgets), copiés dans public/cesium au build.
export const CESIUM_BASE_URL = '/cesium';

// loadCss : ajoute une feuille de style une seule fois (début).
function loadCss(href) {
  // Déjà présente : rien.
  if (document.querySelector(`link[data-cesium-css="${href}"]`)) return;
  // Nouvelle balise link.
  const link = document.createElement('link');
  // Feuille de style, son adresse et sa marque.
  link.rel = 'stylesheet'; link.href = href; link.dataset.cesiumCss = href;
  // Ajoutée à l'en-tête.
  document.head.appendChild(link);
// Fin de loadCss.
}

/**
 * Ellipsoïde d'un astre solide : WGS84 pour la Terre, sphère de son rayon moyen pour les autres. Doit être posé comme
 * ellipsoïde par défaut de CesiumJS avant la création du globe (caméra, cartographie, découpage des tuiles).
 */
/**
 * Couleur du sol d'un astre là où ses tuiles ne sont pas encore arrivées (ou absentes : Vénus n'a pas de fond de
 * carte) : sa teinte moyenne, au lieu du bleu par défaut de CesiumJS (« écran bleu »).
 */
export const BODY_BASE_COLORS = { earth: '#0d1b2a', moon: '#8a8580', mars: '#9a5b3e', mercury: '#8b8580', venus: '#c8b27f' };
// Teinte des autres astres solides (satellites naturels…).
export const DEFAULT_BASE_COLOR = '#7d7873';
// Déclare et exporte baseColorOf : l'identifiant de l'astre et sa couleur dans l'interface (fiche d'information), en
// repli pour les astres sans teinte réglée ici (satellites sans fond de carte : leur sphère gardait cette couleur).
export const baseColorOf = (id, color = null) => BODY_BASE_COLORS[id] ?? color ?? DEFAULT_BASE_COLOR;

/**
 * Échelle de rendu du globe CesiumJS pour qu'il ait la même définition que la scène three.js : CesiumJS dessine à
 * `devicePixelRatio × resolutionScale` pixels par pixel CSS ; three.js à `dpr` (densité de l'app, baissée par le
 * réglage d'énergie et la surchauffe). Bornée entre 0,25 et 1 (jamais plus fin que l'écran). Fonction pure.
 */
// Déclare et exporte cesiumResolutionScale : la densité de l'app et celle de l'écran.
export const cesiumResolutionScale = (dpr, deviceRatio) => {
  // Densité de l'écran (1 si illisible) et de l'app (celle de l'écran si illisible).
  const dev = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1, app = Number.isFinite(dpr) && dpr > 0 ? dpr : dev;
  // Rapport borné, arrondi au centième (pas de changement pour un écart imperceptible).
  return Math.round(Math.max(0.25, Math.min(1, app / dev)) * 100) / 100;
// Fin de cesiumResolutionScale.
};

// Déclare et exporte bodyEllipsoid : la bibliothèque et l'astre { id, radiusKm }.
export function bodyEllipsoid(Cesium, { id, radiusKm }) {
  // La Terre : WGS84 ; un autre astre : sphère de son rayon, en mètres.
  return id === 'earth' ? Cesium.Ellipsoid.WGS84 : new Cesium.Ellipsoid(radiusKm * 1000, radiusKm * 1000, radiusKm * 1000);
// Fin de bodyEllipsoid.
}

/**
 * Crée le globe d'un astre solide dans `container`. Renvoie { viewer, Cesium, ellipsoid }.
 * La Terre a ses couches d'imagerie ouvertes (astre-solide.sources.js) ; les autres astres reçoivent ensuite le fond
 * de carte de l'app (astre-solide.imagery.js, voir AstreSolideGlobe.syncImagery). Seul le globe est dessiné ici :
 * l'atmosphère vient de la scène three.js.
 * @param {HTMLElement} container
 * @param {{ id: string, radiusKm: number, airless?: boolean, color?: string|null }} body (rayon de la fiche d'information)
 */
// Déclare et exporte createSolidViewer, asynchrone : le conteneur et l'astre (début).
export async function createSolidViewer(container, body) {
  // Adresse des fichiers statiques, lue par CesiumJS avant son premier chargement de worker.
  globalThis.CESIUM_BASE_URL = CESIUM_BASE_URL;
  // Feuille de style des widgets (crédits).
  loadCss(`${CESIUM_BASE_URL}/Widgets/widgets.css`);
  // CesiumJS, chargé seulement maintenant (fichier séparé).
  const Cesium = await import('cesium');
  // Aucun jeton Cesium ion : aucune requête vers ion.
  Cesium.Ion.defaultAccessToken = '';
  // Ellipsoïde de l'astre.
  const ellipsoid = bodyEllipsoid(Cesium, body);
  // Ellipsoïde par défaut de CesiumJS (caméra, cartographie) : celui de l'astre, si cette version le permet.
  try { if ('default' in Cesium.Ellipsoid) Cesium.Ellipsoid.default = ellipsoid; } catch { /* version sans ellipsoïde par défaut */ }
  // Le globe (début) :
  const viewer = new Cesium.Viewer(container, {
    // ellipsoïde de l'astre, aucune couche par défaut (celle d'ion), sol sans relief ;
    ellipsoid, baseLayer: false, terrainProvider: new Cesium.EllipsoidTerrainProvider({ ellipsoid }),
    // aucun widget : l'interface de l'app reste la seule ;
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, vrButton: false,
    // rendu à la demande : rien n'est dessiné quand rien ne bouge (téléphone : pas de chauffe) ;
    requestRenderMode: true, maximumRenderTimeChange: Infinity,
    // définition réglée par l'app (AstreSolideGlobe.syncResolution) : même densité de pixels que la scène three.js,
    // au lieu de la définition « recommandée » du navigateur (1 pixel par pixel CSS, flou sur écran Retina) ;
    useBrowserRecommendedResolution: false,
    // fond spatial transparent : canevas WebGL avec canal alpha et pas de ciel étoilé de CesiumJS ; l'espace visible
    // autour du globe est celui de la scène three.js (étoiles, Soleil, Lune, planètes), dessinée dessous.
    contextOptions: { webgl: { alpha: true } }, skyBox: false,
  // Fin du globe.
  });
  // La Terre : ses couches d'imagerie ouvertes, dans l'ordre d'empilement (début).
  if (body.id === 'earth') for (const s of CESIUM_IMAGERY) {
    // Source de tuiles Web Mercator (début) :
    const provider = new Cesium.UrlTemplateImageryProvider({
      // l'adresse, le niveau le plus fin et la mention ;
      url: s.url, maximumLevel: s.maximumLevel, credit: new Cesium.Credit(s.credit),
      // l'emprise, s'il y en a une.
      ...(s.bbox ? { rectangle: Cesium.Rectangle.fromDegrees(...s.bbox) } : {}),
    // Fin de la source.
    });
    // Couche, avec son niveau de terrain minimal s'il y en a un.
    viewer.imageryLayers.add(new Cesium.ImageryLayer(provider, s.minimumTerrainLevel ? { minimumTerrainLevel: s.minimumTerrainLevel } : {}));
  // Fin de la boucle.
  }
  // Sol à la teinte de l'astre tant que ses tuiles arrivent (pas le bleu par défaut de CesiumJS).
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(baseColorOf(body.id, body.color));
  // Fond de la scène transparent (début de l'espace : la scène three.js).
  viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
  // Ni Soleil ni Lune de CesiumJS (sans ciel étoilé, CesiumJS peut ne pas les créer) : ceux de la scène three.js se
  // voient par transparence (pas de doublon).
  if (viewer.scene.sun) viewer.scene.sun.show = false;
  // La Lune de CesiumJS, si elle existe : cachée.
  if (viewer.scene.moon) viewer.scene.moon.show = false;
  // Seul le globe (le sol, ses tuiles) est dessiné par CesiumJS : ni atmosphère autour du globe, ni voile au sol, ni
  // brouillard. L'atmosphère est celle de la scène three.js (moteur d'atmosphère), posée par-dessus le globe sur une
  // couche à part (engine.renderAtmosphereOverlay).
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
  // Pas de voile au sol.
  viewer.scene.globe.showGroundAtmosphere = false;
  // Pas de brouillard.
  viewer.scene.fog.enabled = false;
  // Lumière du Soleil : une lumière directionnelle, orientée à chaque image d'après la scène three.js (même Soleil
  // pour tous les astres, voir AstreSolideGlobe.syncSun).
  viewer.scene.light = new Cesium.DirectionalLight({ direction: new Cesium.Cartesian3(-1, 0, 0) });
  // Le globe : jour et nuit d'après cette lumière.
  viewer.scene.globe.enableLighting = true;
  // Horloge du globe : l'heure de l'app, réglée à chaque image ; elle n'avance pas d'elle-même.
  viewer.clock.currentTime = Cesium.JulianDate.now(); viewer.clock.shouldAnimate = false;
  // Renvoie le globe, la bibliothèque et l'ellipsoïde.
  return { viewer, Cesium, ellipsoid };
// Fin de createSolidViewer.
}
