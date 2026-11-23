/**
 * Globe CesiumJS de la Terre : créé à la première approche de la Terre (CesiumJS n'est téléchargé qu'à ce moment-là),
 * puis gardé et seulement masqué. Sans Cesium ion ni aucune clé : imagerie ouverte (cesium-earth.sources.js),
 * ellipsoïde WGS84, jour et nuit d'après l'heure réelle. Rendu à la demande (rien n'est dessiné quand rien ne bouge).
 */

// Importe la table des couches d'imagerie.
import { CESIUM_IMAGERY } from './cesium-earth.sources.js';

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
 * Crée le globe dans `container`. Renvoie { viewer, Cesium }.
 * @param {HTMLElement} container
 */
// Déclare et exporte createEarthViewer, asynchrone : le conteneur (début).
export async function createEarthViewer(container) {
  // Adresse des fichiers statiques, lue par CesiumJS avant son premier chargement de worker.
  globalThis.CESIUM_BASE_URL = CESIUM_BASE_URL;
  // Feuille de style des widgets (crédits).
  loadCss(`${CESIUM_BASE_URL}/Widgets/widgets.css`);
  // CesiumJS, chargé seulement maintenant (fichier séparé).
  const Cesium = await import('cesium');
  // Aucun jeton Cesium ion : aucune requête vers ion.
  Cesium.Ion.defaultAccessToken = '';
  // Le globe (début) :
  const viewer = new Cesium.Viewer(container, {
    // aucune couche par défaut (celle d'ion), ellipsoïde sans relief ;
    baseLayer: false, terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    // aucun widget : l'interface de l'app reste la seule ;
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, vrButton: false,
    // rendu à la demande : rien n'est dessiné quand rien ne bouge (téléphone : pas de chauffe) ;
    requestRenderMode: true, maximumRenderTimeChange: Infinity,
  // Fin du globe.
  });
  // Pour chaque couche de la table, dans l'ordre d'empilement (début).
  for (const s of CESIUM_IMAGERY) {
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
  // Le globe : jour et nuit d'après le Soleil à l'heure réelle, atmosphère.
  viewer.scene.globe.enableLighting = true;
  // Horloge du globe : l'heure réelle, qui avance.
  viewer.clock.currentTime = Cesium.JulianDate.now(); viewer.clock.shouldAnimate = true;
  // Renvoie le globe et la bibliothèque.
  return { viewer, Cesium };
// Fin de createEarthViewer.
}
