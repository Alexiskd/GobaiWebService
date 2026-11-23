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
// Déclare et exporte bodyEllipsoid : la bibliothèque et l'astre { id, radiusKm }.
export function bodyEllipsoid(Cesium, { id, radiusKm }) {
  // La Terre : WGS84 ; un autre astre : sphère de son rayon, en mètres.
  return id === 'earth' ? Cesium.Ellipsoid.WGS84 : new Cesium.Ellipsoid(radiusKm * 1000, radiusKm * 1000, radiusKm * 1000);
// Fin de bodyEllipsoid.
}

/**
 * Crée le globe d'un astre solide dans `container`. Renvoie { viewer, Cesium, ellipsoid }.
 * La Terre a ses couches d'imagerie ouvertes (astre-solide.sources.js) ; les autres astres reçoivent ensuite le fond
 * de carte de l'app (astre-solide.imagery.js, voir AstreSolideGlobe.syncImagery). Sans air (Lune, Mercure…) : ni
 * atmosphère autour du globe, ni voile au sol.
 * @param {HTMLElement} container
 * @param {{ id: string, radiusKm: number, airless?: boolean }} body
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
  // Fond de la scène transparent (début de l'espace : la scène three.js).
  viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
  // Ni Soleil ni Lune de CesiumJS (sans ciel étoilé, CesiumJS peut ne pas les créer) : ceux de la scène three.js se
  // voient par transparence (pas de doublon).
  if (viewer.scene.sun) viewer.scene.sun.show = false;
  // La Lune de CesiumJS, si elle existe : cachée.
  if (viewer.scene.moon) viewer.scene.moon.show = false;
  // Astre sans air : ni atmosphère autour du globe, ni voile au sol.
  if (body.airless) { if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false; viewer.scene.globe.showGroundAtmosphere = false; }
  // Lumière du Soleil : une lumière directionnelle, orientée à chaque image d'après la scène three.js (même Soleil
  // pour tous les astres, voir AstreSolideGlobe.syncSun) ; l'atmosphère suit cette lumière.
  viewer.scene.light = new Cesium.DirectionalLight({ direction: new Cesium.Cartesian3(-1, 0, 0) });
  // Atmosphère éclairée par cette lumière (et non par le Soleil calculé pour la Terre).
  viewer.scene.globe.dynamicAtmosphereLightingFromSun = false;
  // Le globe : jour et nuit d'après cette lumière.
  viewer.scene.globe.enableLighting = true;
  // Horloge du globe : l'heure de l'app, réglée à chaque image ; elle n'avance pas d'elle-même.
  viewer.clock.currentTime = Cesium.JulianDate.now(); viewer.clock.shouldAnimate = false;
  // Renvoie le globe, la bibliothèque et l'ellipsoïde.
  return { viewer, Cesium, ellipsoid };
// Fin de createSolidViewer.
}
