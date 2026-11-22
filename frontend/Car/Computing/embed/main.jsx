// Point d'entrée de la page d'embarquement : un seul globe interactif, sans interface ni fond,
// affiché dans une iframe transparente posée par le SDK (public/embed-sdk.js).
// Importe createRoot, pour monter les styles des éléments créés par le moteur (étiquettes, fiches).
import { createRoot } from 'react-dom/client';
// Importe SceneStyles, qui habille les divs posés par le moteur dans la page.
import { SceneStyles } from '@/Fairing/theme/SceneStyles.jsx';
// Importe la feuille de style des éléments que le moteur pose dans la page.
import '@/Fairing/theme/scene.css';
// Importe createHudStore : le magasin minimal que le moteur écrit en continu (rien ne le lit à l'écran).
import { createHudStore } from '@/Engine/AstreSolideEngine/hudStore';
// Importe fetchSceneData et tilesApi, les mêmes sources que l'application principale.
import { fetchSceneData, tilesApi } from '@/Computing/api';
// Importe renderLoop, la boucle de rendu partagée : le moteur s'y enregistre à sa création, elle doit être démarrée.
import { renderLoop } from '@/Engine/SystemeEngine/core/render/RenderLoop.js';
// Importe createEmbedBridge, le pont postMessage avec le site hôte.
import { createEmbedBridge } from './bridge.js';

// Paramètres de l'adresse, posés par le SDK : ?planet=…, et éventuellement ?lon=…&lat=… pour viser un lieu.
const params = new URLSearchParams(window.location.search);
// L'astre demandé (« terre » par défaut) ; focusBySlug accepte le nom français sans accent ni majuscule.
const planet = params.get('planet') || 'terre';
// Coordonnées optionnelles du lieu visé dès l'ouverture.
const lon = Number(params.get('lon'));
const lat = Number(params.get('lat'));

// Les styles des éléments du moteur, montés dans une racine React dédiée (aucune autre interface dans la page).
createRoot(document.getElementById('styles')).render(<SceneStyles />);

// Le conteneur du canevas.
const container = document.getElementById('globe');
// Le moteur, gardé pour l'arrêt propre de la page.
let engine = null;
// Le pont postMessage, créé après le moteur.
let bridge = null;

// Démarre : données, moteur, boucle de rendu, puis pont postMessage.
(async () => {
  // Les données du système, comme l'application principale.
  const data = await fetchSceneData();
  // Chargé à la demande : three.js reste hors du bundle initial.
  const { SolarEngine } = await import('@/Engine/AstreSolideEngine/engine');
  // Crée le moteur, en mode embarqué : canevas alpha, espace transparent, ciel masqué.
  engine = new SolarEngine({
    container,
    data,
    // Étiquettes vides : le moteur crée alors les siennes (divs posées dans la page).
    labels: { sun: null, planets: [], cities: [] },
    hud: createHudStore({}),
    tilesApi,
    // À chaque changement d'astre visé, l'hôte est prévenu (le pont n'existe pas encore au premier focus).
    onFocusChange: () => bridge?.notifyPlanet(),
    // Rendu embarqué.
    embed: true,
  });
  // Vise l'astre demandé (équivalent des pages /terre, /mars… de l'application).
  engine.focusBySlug(planet);
  // Lieu visé par l'adresse, s'il est complet.
  if (Number.isFinite(lon) && Number.isFinite(lat)) engine.goTo({ lon, lat, name: '' });
  // La boucle tourne pour toute la page : start() ne redémarre rien si elle est déjà en route.
  renderLoop.start();
  // À chaque changement de taille de l'iframe : recadre le canevas.
  window.addEventListener('resize', () => engine.resize());
  // Le pont postMessage : commandes de l'hôte, événements vers l'hôte.
  bridge = createEmbedBridge({ engine });
  // L'hôte sait que le globe est prêt.
  bridge.sendReady();
// Toute erreur d'ouverture est signalée à l'hôte (aucun log en console).
})().catch((e) => {
  // Le message lisible de l'erreur.
  const message = e?.message || String(e);
  // L'hôte peut afficher sa propre erreur ; le pont n'existe peut-être pas encore, on poste à froid.
  window.parent?.postMessage({ source: 'gobai-embed', type: 'gobai:error', message }, '*');
// Fin du démarrage.
});

// Arrêt propre à la fermeture de l'iframe : plus une seule image, puis libération des ressources WebGL.
window.addEventListener('pagehide', () => {
  // Stoppe la boucle.
  renderLoop.stop();
  // Libère le moteur.
  engine?.dispose();
  // Le pont n'écoute plus.
  bridge?.detach();
// Une seule fois.
}, { once: true });
