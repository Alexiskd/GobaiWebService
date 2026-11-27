// Importe de React les crochets useCallback, useEffect, useMemo, useRef, useState et useSyncExternalStore.
import { lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
// Adresse française de la page affichée, version anglaise (/en/…) comprise.
import { frenchSlugFromPath } from '@/Engine/shared/lib/app/englishPaths.js';
// Importe bodyId, qui donne l'identifiant d'un astre.
import { bodyId } from '@/Engine/AstreSolideEngine/LabelEngine/bodyPlaces';
// Importe les astres enlevés par défaut, la visibilité par défaut, le test de famille masquée et la famille d'une planète.
import { defaultVisibility, isKindHidden, planetKind } from '@/Engine/AstreSolideEngine/BodyEngine/bodyKinds';
// Importe le calcul et l'affichage en console des booléens de chaque astre.
// Importe la création du magasin du HUD et le crochet qui le lit.
import { createHudStore, useHud } from '@/Engine/AstreSolideEngine/hudStore';
// Importe le crochet du son des clics.
import { useBubbleSound } from '@/Fairing/hooks/useBubbleSound';
// Importe le crochet de la langue de l'interface.
import { useInterfaceLanguage } from '@/Fairing/hooks/useInterfaceLanguage';
// Importe le crochet qui crée le moteur 3D.
import { useSolarEngine } from '@/Fairing/hooks/useSolarEngine';
// Importe le lecteur et l'abonnement du mode économie d'énergie.
import { getPowerSaving, setPowerSaving, subscribePowerSaving } from '@/Engine/shared/lib/device/powerSaving';
// Importe le crochet des couches de tuiles.
import { useTileLayers } from '@/Fairing/hooks/useTileLayers';
// Importe le crochet des messages temporaires.
import { useToasts } from '@/Fairing/hooks/useToasts';
// Importe le crochet de la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe la navball de pilotage.
import { NavballPilote } from './hud/NavballPilote/index.js';
// Importe le cadre de la visionneuse LiDAR HD de l'IGN.
import { LidarFrame } from './hud/LidarFrame.jsx';
// Importe le bandeau du haut.
import { HudTop } from './hud/HudTop.jsx';
// Importe la fenêtre des paramètres.
import { Parametres } from './menus/Parametres/Parametres.jsx';
// Importe la bande de navigation entre les astres.
import { Navigator } from './hud/Navigator.jsx';
// Importe l'affichage des messages temporaires.
import { Toasts } from './hud/Toasts.jsx';
// Importe l'enveloppe des fenêtres chargées à la demande.
import { LazyWindow } from './ui/LazyWindow.jsx';
// Importe l'attribution du ciel.
import { SKY_ATTRIBUTION } from '@/Engine/StarEngine/SkyEngine/skyLayer';
// Importe le pavé de zoom.
import { ZoomPad } from './hud/ZoomPad.jsx';
// Importe le message plein écran.
import { FullScreenMessage } from './SolarSystem.jsx';
// Importe la barre d'outils.
import { Toolbar } from './toolbar/Toolbar.jsx';
// Importe le menu de l'assistant.
import { Assistant } from './menus/Assistant/Assistant.jsx';
// Importe la fenêtre de don.
import { Don } from './menus/Don/Don.jsx';
// Importe hasDonationReturn, le test du retour de la page de paiement.
import { hasDonationReturn } from './menus/Don/donationReturn.jsx';
// Importe le rappel des dons (à l'ouverture, puis toutes les dix minutes).
import { useDonationPrompt } from './menus/Don/useDonationPrompt.jsx';
// Importe le plateau tournant en ligne, posé dans le panneau d'informations (plus de fenêtre séparée).
import { PlateauInline } from './menus/Plateau/PlateauInline.jsx';
// Importe le panneau d'informations.
import { Informations } from './menus/Informations/Informations.jsx';
// Importe la fenêtre de recherche.
import { Rechercher } from './menus/Rechercher.jsx';
// Importe le crochet des nuages LiDAR sur le globe.
import { useLidarGlobe } from './scene/useLidarGlobe.jsx';
// Importe le texte d'aide des noms de villes.
import { cityNamesHintText } from './scene/layerHints.jsx';
// Importe le crochet des réglages de caméra et d'affichage.
import { useCameraToggles } from './scene/useCameraToggles.jsx';
// Importe le crochet du cadre de la visionneuse LiDAR HD de l'IGN (ouverture sous 0,22 km d'altitude).
import { useLidarFrame } from './scene/useLidarFrame.jsx';
// Importe le crochet qui expose la catégorie d'écran au CSS.
import { useDocumentViewport } from './scene/useDocumentViewport.jsx';
// Importe le crochet de l'affichage de la Terre.
import { useEarthDisplay } from './scene/useEarthDisplay.jsx';
// Importe le crochet des données de carte (villes, frontières).
import { useMapFeeds } from './scene/useMapFeeds.jsx';
// Importe le réglage de la pollution lumineuse de la Terre, pour sa mention dans les sources.
import { EARTH_NIGHT_LIGHTS } from '@/Engine/AstreSolideEngine/MapEngine/earth/nightLights';
// Importe le crochet des données lunaires.
import { useMoonFeeds } from './scene/useMoonFeeds.jsx';
// Importe le crochet des calques de la Lune.
import { useMoonLayers } from './scene/useMoonLayers.jsx';
// Importe le crochet des régions actives du Soleil.
import { useSunFeeds } from './scene/useSunFeeds.jsx';
// Importe le crochet des modèles 3D des astres irréguliers.
import { useBodyModels } from './scene/useBodyModels.jsx';
// Importe le crochet des panneaux ouverts.
import { usePanels } from './scene/usePanels.jsx';
// Importe le crochet de l'adresse du site.
import { useSiteAddress } from './scene/useSiteAddress.jsx';
// Importe la traduction des actions de l'assistant.
import { resolveAssistantAction } from './scene/assistantActions.jsx';
// Lieux nommés de la Lune (sites d'alunissage, mers, cratères, régions) : la liste que l'assistant peut survoler.
import { MOON_FEATURES } from '@/Engine/AstreSolideEngine/MoonEngine/moonFeatures';
// Importe le chargement de l'état des cartes des satellites.
// Importe la valeur « nuit », le lecteur, l'abonnement et la bascule jour/nuit.
import { NIGHT, getDayNight, subscribeDayNight, toggleDayNight } from '@/Engine/shared/lib/device/dayNight';
// Importe l'enrobage qui anime le changement de thème.
import { withThemeTransition } from '@/Fairing/theme/themeTransition';
// Importe le crochet des commandes envoyées au moteur.
import { useSceneActions } from './scene/useSceneActions.jsx';
// Importe le crochet « Ma position ».
import { useMyPosition } from './scene/useMyPosition.jsx';
// Importe le crochet qui classe les calques par astre.
import { useSceneLayers } from './scene/useSceneLayers.jsx';
// Importe le crochet qui suit la taille du conteneur.
import { useStageResize } from './scene/useStageResize.jsx';
// Importe le crochet des fonds de carte.
import { useTileBases } from './scene/useTileBases.jsx';
// Le bouton rond du kit d'interface, pour le don sur téléphone.
import { IconButton } from '@/Fairing/kit';
// Icône du bouton de don.
import { FavoriteIcon } from './ui/icons.jsx';
// Importe les deux zones de commandes du téléphone.
import { MobileDock, MobileTopBar } from './ui/MobileZones.jsx';

// Scène complète : moteur 3D, calques, panneaux et barre d’outils.
// La logique vit dans les hooks de `scene/` ; ce composant assemble et place les composantes.
// Fenêtres fermées au démarrage : leur code est chargé à la première ouverture (voir LazyWindow).
// La fenêtre des sources (Node).
const Attribution = lazy(() => import('./hud/node/Attribution.jsx').then((m) => ({ default: m.Attribution })));
// La fenêtre de temps de trajet entre deux positions (Terre, Lune).
const Trajet = lazy(() => import('./menus/Trajet/Trajet.jsx').then((m) => ({ default: m.Trajet })));
// La fenêtre Données (flux cognitif et théorie quantique).
const Donnees = lazy(() => import('./menus/Donnees/Donnees.jsx').then((m) => ({ default: m.Donnees })));

// Déclare et exporte le composant SolarScene : données, rappel « scène prête » et indicateur « couverte » (faux par défaut).
export function SolarScene({ data, onSettled, covered = false }) {
  // Lit la catégorie d'écran.
  const viewport = useViewport();
  // En extrait le mode compact.
  const { compact } = viewport;
  // Référence vers le conteneur du canvas 3D.
  const containerRef = useRef(null);
  // Référence vers le moteur.
  const engineRef = useRef(null);
  // Objet des étiquettes partagé avec le moteur, créé une seule fois.
  const labels = useMemo(() => ({ sun: null, planets: [], cities: [] }), []);
  // Magasin du HUD, créé une seule fois (début de l'appel).
  const hud = useMemo(
    // Ses valeurs de départ : textes vides, texte d'aide du zoom, et tout le reste à null ou à 0.
    () => createHudStore({ date: '', focusText: '', zoomText: 'Zoom · molette ou pincement', zoomShort: '', scaleText: '', viewLink: '', cityFocus: null, tiles: null, moonTiles: null, marsTiles: null, mercuryTiles: null, venusTiles: null, moonLive: null, bodyLive: null, compass: null, gps: null, viewLock: null, fps: 0, perf: null }),
    // Aucune dépendance.
    []
  // Fin de l'appel.
  );
  // Noms des astres, dans l'ordre des cibles du moteur (début de l'appel).
  const bodyNames = useMemo(
    // Même ordre que les cibles du moteur : Soleil, planètes, Lune, puis satellites sphériques (Jupiter à Pluton).
    // Le Soleil, les planètes, la Lune, puis les satellites (liste vide s'il n'y en a pas).
    () => [data.bodies.sun.name, ...data.bodies.planets.map((p) => p.name), data.bodies.moon.name, ...(data.bodies.satellites || []).map((s) => s.name)],
    // Recalculé si les données changent.
    [data]
  // Fin de l'appel.
  );
  // Ordre d'affichage : la Lune suit la Terre et porte son numéro « bis » ; `index` reste l'indice du moteur.
  // Liste des astres pour la navigation (début du calcul mémorisé).
  const navBodies = useMemo(() => {
    // Les planètes des données.
    const planets = data.bodies.planets;
    // Liste de départ (début du tableau).
    const list = [
      // Le Soleil : indice 0, son nom et sa couleur (jaune orangé par défaut).
      { index: 0, name: data.bodies.sun.name, color: data.bodies.sun.color || '#ffb300' },
      // Chaque planète : indice du moteur, nom, couleur (gris-bleu par défaut), famille et identifiant.
      ...planets.map((p, i) => ({ index: i + 1, name: p.name, color: p.color || '#8b97b3', kind: planetKind(p), id: bodyId(p) })),
    // Fin du tableau.
    ];
    // Numérote chaque astre sur deux chiffres : 01, 02…
    list.forEach((b, i) => { b.number = String(i + 1).padStart(2, '0'); });
    // Position de la Terre parmi les planètes (marquée earth ou nommée « Terre »).
    const earth = planets.findIndex((p) => p.earth || p.name === 'Terre');
    // Place de la Lune dans la liste : juste après la Terre, sinon à la fin.
    const at = earth >= 0 ? earth + 2 : list.length;
    // Insère la Lune à cette place (début de l'objet).
    list.splice(at, 0, {
      // Son indice du moteur (après les planètes), son nom et sa couleur grise.
      index: planets.length + 1, name: data.bodies.moon.name, color: '#aaa9a5',
      // Son numéro : celui de la Terre suivi de « bis », sinon le numéro suivant.
      number: earth >= 0 ? `${list[at - 1].number} bis` : String(list.length + 1).padStart(2, '0'),
      // C'est un satellite ; sa famille est celle de la Terre (« solid » à défaut) ; sa planète est la Terre, si elle existe.
      satellite: true, kind: earth >= 0 ? planetKind(planets[earth]) : 'solid', parent: earth >= 0 ? earth + 1 : null,
      // Son identifiant.
      id: 'moon',
    // Fin de l'insertion.
    });
    // Satellites sphériques (Jupiter à Pluton) : après leur planète, « 06 bis », « 06 ter »… (indices du moteur après la Lune).
    // Suffixes latins des numéros des satellites.
    const ORDINALS = ['bis', 'ter', 'quater', 'quinquies', 'sexies', 'septies', 'octies', 'nonies', 'decies'];
    // Les satellites des données, liste vide s'il n'y en a pas.
    const sats = data.bodies.satellites || [];
    // Compteur de satellites par planète.
    const perParent = {};
    // Parcourt les satellites (k : rang du satellite).
    sats.forEach((s, k) => {
      // Cherche la planète du satellite.
      const pi = planets.findIndex((p) => bodyId(p) === s.parent);
      // Planète inconnue : satellite ignoré.
      if (pi < 0) return;
      // Incrémente le compteur de cette planète et garde le rang du satellite autour d'elle.
      const n = perParent[s.parent] = (perParent[s.parent] || 0) + 1;
      // Position de la planète dans la liste.
      const host = list.findIndex((b) => b.index === pi + 1);
      // Place d'insertion : juste après la planète…
      let at2 = host + 1;
      // … puis après les satellites déjà placés.
      while (at2 < list.length && list[at2].satellite) at2++;
      // Insère le satellite (début de l'objet).
      list.splice(at2, 0, {
        // Son indice du moteur (après la Lune), son nom, sa couleur (grise par défaut), sa famille (celle de sa planète), sa planète et son identifiant.
        index: planets.length + 2 + k, name: s.name, color: s.color || '#9a9a9a', satellite: true, kind: planetKind(planets[pi]), parent: pi + 1, id: s.id,
        // Son numéro : celui de la planète suivi du suffixe latin, ou du rang s'il n'y a plus de suffixe.
        number: `${list[host].number} ${ORDINALS[n - 1] || n}`,
      // Fin de l'insertion.
      });
    // Fin du parcours.
    });
    // Renvoie la liste.
    return list;
  // Fin du calcul ; recalculé si les données changent.
  }, [data]);

  // Expose la catégorie d'écran au CSS.
  useDocumentViewport(viewport);
  // Le canvas suit la taille du conteneur.
  useStageResize(containerRef, engineRef);

  // Messages temporaires : liste, ajout et retrait.
  const { toasts, push, dismiss } = useToasts();
  // Son des clics : toujours actif (aucun bouton pour le couper).
  useBubbleSound();
  // Langue de l'interface : celle du navigateur, appliquée automatiquement.
  useInterfaceLanguage();
  // Fenêtres : une seule ouverte à la fois, gérées en un seul endroit (voir scene/usePanels).
  const panels = usePanels({ compact });
  // Fenêtre Données : ouverte ou non, et son ouverture.
  const galleryOpen = panels.panel === 'gallery'; const setGalleryOpen = (on) => panels.show('gallery', on);
  // Paramètres : ouverts ou non, et leur ouverture.
  const settingsOpen = panels.panel === 'settings'; const setSettingsOpen = (on) => panels.show('settings', on);
  // Affichage relativiste : les orbites suivent la métrique de Schwarzschild (rosette précessée, grille filaire).
  const [schwarzschild, setSchwarzschild] = useState(false);
  // Assistant : posé dans le HUD à la place de la navigation, indépendant des autres fenêtres (il reste ouvert quand il
  // en ouvre une) et jamais modal — la scène et le moteur restent utilisables pendant tout l'échange.
  // État : panneau de l'assistant affiché ou non ; affiché au départ, puisqu'il tient la place de la navigation.
  const [assistantOpen, setAssistantOpen] = useState(true);
  // Navigation : l'assistant tient sa place dans le HUD, l'arborescence des astres s'ouvre à la demande, par son bouton.
  // État : arborescence de navigation ouverte ou non, fermée au départ.
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  // Rail de navigation déplacé à la main (ordinateur) : l'assistant n'a plus à s'en écarter.
  const [navigatorMoved, setNavigatorMoved] = useState(false);
  // Touche P (Données), sauf pendant une saisie.
  // Effet exécuté une seule fois : un raccourci clavier.
  useEffect(() => {
    // Déclare onKey, appelé à chaque touche enfoncée.
    const onKey = (e) => {
      // La cible de la frappe.
      const t = e.target;
      // Pendant la saisie dans un champ, rien à faire.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Avec Ctrl, Cmd ou Alt, rien à faire.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // La touche, en minuscule.
      const k = e.key.toLowerCase();
      // P : ouvre ou ferme la fenêtre Données.
      if (k === 'p') panels.toggle('gallery');
    // Fin de onKey.
    };
    // Écoute les touches sur toute la fenêtre.
    window.addEventListener('keydown', onKey);
    // Nettoyage : retire l'écouteur.
    return () => window.removeEventListener('keydown', onKey);
  // Fin de l'effet ; aucune dépendance.
  }, []);
  // Crée le moteur 3D : renvoie le moteur, l'astre visé et l'éventuelle erreur.
  const { engine, focus, error } = useSolarEngine({ containerRef, data, labels, hud, engineRef });
  // Moteur prêt (ou en échec) : l'écran de chargement peut finir sa barre et s'effacer.
  // Dès que le moteur existe ou a échoué, prévient le parent.
  useEffect(() => { if (engine || error) onSettled?.(); }, [engine, error, onSettled]);
  // Sous l'écran de chargement, le moteur tourne au ralenti (voir SolarEngine.setCovered).
  // Transmet au moteur l'indicateur « couverte ».
  useEffect(() => { engine?.setCovered(covered); }, [engine, covered]);
  // Mode économie d'énergie des Paramètres, appliqué dès la création du moteur.
  // Lit le mode économie d'énergie et s'y abonne.
  const powerSaving = useSyncExternalStore(subscribePowerSaving, getPowerSaving, getPowerSaving);
  // Le transmet au moteur.
  useEffect(() => { engine?.setPowerSaving(powerSaving); }, [engine, powerSaving]);
  // Charge les couches de tuiles.
  const tileLayers = useTileLayers();
  // Les classe par astre.
  const layers = useSceneLayers(tileLayers.layers);
  // Gère les fonds de carte de chaque astre.
  const bases = useTileBases({ engine, engineRef, status: tileLayers.status, layers, allLayers: tileLayers.layers, push, trekStatus: data.satelliteStatus || [] });
  // Tous les astres du catalogue restent affichés par défaut, indépendamment de la présence d'un fond de carte.
  // Aucun astre n'est automatiquement décoché au chargement : les cases de Paramètres restent cochées.
  const camera = useCameraToggles(engine, defaultVisibility());
  const { setBodyShown, setKind } = camera;
  // La visionneuse LiDAR HD de l'IGN : visible quand la caméra survole la zone de référence sous 0,22 km.
  const lidarFrame = useLidarFrame(engine);
  // Aller à un astre enlevé (recherche) : on le remet d'abord, puis on s'y téléporte une fois le moteur à jour.
  // revealAndFocus : remet un astre enlevé, puis s'y rend ; début de la fonction mémorisée.
  const revealAndFocus = useCallback((index) => {
    // Cherche l'astre par son indice.
    const body = navBodies.find((b) => b.index === index);
    // S'il existe.
    if (body) {
      // Planète naine : réaffiche sa famille.
      if (body.kind === 'dwarf') setKind('dwarf', true);
      // Satellite : réaffiche sa famille.
      if (body.satellite) setKind('satellite', true);
      // S'il a une planète, la réaffiche.
      if (body.parent != null) setBodyShown(body.parent, true);
      // Réaffiche l'astre lui-même.
      setBodyShown(index, true);
    // Fin du cas.
    }
    // Après 80 ms, demande au moteur de viser l'astre.
    setTimeout(() => engineRef.current?.setFocus(index), 80);
  // Fin de revealAndFocus ; dépendances : la navigation et les deux fonctions.
  }, [navBodies, setBodyShown, setKind]);
  // Astres des familles affichées (Paramètres) : les autres disparaissent aussi des listes de navigation.
  // `bodyStates` : tous les astres avec leur état, pour les cases de Paramètres (un astre enlevé doit pouvoir être remis).
  //   shown = sa case est cochée ; locked = enlevé par sa famille ou par sa planète (case grisée).
  // État de chaque astre (début du calcul mémorisé).
  const bodyStates = useMemo(() => {
    // Ensemble des familles masquées.
    const hidden = new Set(Object.keys(camera.kinds).filter((k) => !camera.kinds[k]));
    // Ensemble des astres enlevés un par un.
    const own = camera.hiddenBodies;
    // Pour chaque astre de la navigation.
    return navBodies.map((b) => {
      // Verrouillé si sa famille est masquée ou si sa planète est enlevée.
      const locked = isKindHidden(hidden, b.kind, b.satellite) || (b.parent != null && own.has(b.parent));
      // Affiché s'il n'est ni verrouillé ni enlevé.
      return { ...b, locked, shown: !locked && !own.has(b.index) };
    // Fin du parcours.
    });
  // Fin du calcul ; dépendances : la navigation, les familles et les astres enlevés.
  }, [navBodies, camera.kinds, camera.hiddenBodies]);
  // Les astres affichés seulement.
  const shownBodies = useMemo(() => bodyStates.filter((b) => b.shown), [bodyStates]);
  // Affichage de la Terre : ombrage, frontières, noms, rues.
  const earth = useEarthDisplay({ engine, push });
  // Bouton Jour / Nuit : le thème de l'interface (App.jsx lit la même valeur) et l'ombre des astres vont ensemble.
  // Nuit : face opposée au Soleil dans l'ombre. Jour : astres éclairés sur toute leur surface.
  // Vrai si le réglage jour/nuit est sur « nuit ».
  const night = useSyncExternalStore(subscribeDayNight, getDayNight, getDayNight) === NIGHT;
  // Extrait la fonction de l'ombrage.
  const { setShade } = earth;
  // L'ombrage suit le réglage jour/nuit.
  useEffect(() => { setShade(night); }, [night, setShade]);

  // Indice de la Lune : juste après les planètes.
  const moonIndex = data.bodies.planets.length + 1;
  // Satellites : indices après la Lune (voir SolarEngine.initFocusTargets).
  // Le satellite visé, s'il y en a un.
  const satellite = (data.bodies.satellites || [])[focus - moonIndex - 1];
  // La planète visée, s'il y en a une.
  const planet = data.bodies.planets[focus - 1];
  // Identifiant de l'astre visé : aucun pour le Soleil…
  const currentBodyId = focus === 0 ? null
    // … « moon » pour la Lune…
    : focus === moonIndex ? 'moon'
      // … celui du satellite…
      : satellite ? satellite.id
        // … ou celui de la planète ; null sinon.
        : planet ? bodyId(planet) : null;
  // Nom de l'astre visé, null pour le Soleil.
  const currentBodyName = focus === 0 ? null : bodyNames[focus];
  // Lit dans le HUD la ville survolée.
  const cityFocus = useHud(hud, (s) => s.cityFocus);

  // Calques de la Lune.
  const moon = useMoonLayers({ engine, focus, moonIndex, push });
  // Modèles 3D des astres irréguliers.
  useBodyModels({ engine, currentBodyId, push });
  // Phases de la Lune.
  const { moonPhases } = useMoonFeeds(engine);
  // Régions actives du Soleil : les éruptions en 3D partent des vraies régions.
  useSunFeeds(engine);
  // Villes, frontières et liste des villes du monde.
  const { cityInfo, bordersInfo, worldCities } = useMapFeeds({ engine, push });
  // Commandes envoyées au moteur.
  const actions = useSceneActions({ engineRef, setAuto: camera.setAuto });
  // Ma position : suivie en direct (point bleu) et zoom d'arrivée, depuis l'icône ⌖ de la navball ou les paramètres.
  // « Ma position » : suivi et zoom d'arrivée.
  const myPosition = useMyPosition({ showPosition: actions.showPosition, goPlace: actions.pickPlace, push });
  // Nuages LiDAR sur le globe.
  const lidarGlobe = useLidarGlobe(engine);
  // Retour de Stripe : rouvre la fenêtre pour confirmer le don ou signaler son annulation.
  useEffect(() => { if (hasDonationReturn()) panels.setPanel('donate'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Rappel des dons : la fenêtre « Dons » s'ouvre à l'ouverture de l'application (une fois l'écran de chargement
  // levé), puis toutes les dix minutes ; jamais par-dessus une autre fenêtre, en pause quand l'onglet est caché
  // (voir menus/Don/donationPrompt.js).
  useDonationPrompt({ ready: Boolean(engine) && !covered, panel: panels.panel, openDonate: () => panels.setPanel('donate') });
  // Adresse d'une fenêtre (https://www.gobaispace.com/galerie, /node) : ouverte dès l'arrivée.
  // Même liste que WINDOW_PAGES dans backend/src/services/core/data/body-pages.ts.
  // Effet exécuté une seule fois : ouvre la fenêtre demandée par l'adresse.
  useEffect(() => {
    // Lit le chemin de l'adresse, sans barres obliques, en minuscules.
    // Version anglaise comprise (/en/gallery → galerie).
    const slug = frenchSlugFromPath(window.location.pathname).toLowerCase();
    // Adresse /donnees : ouvre la fenêtre Données.
    if (slug === 'donnees' || slug === 'galerie') setGalleryOpen(true); // « /galerie » : l'adresse du sitemap et de index.html
    // Adresse /node : ouvre la fenêtre des sources.
    else if (slug === 'node') panels.setPanel('sources');
    // Adresse /faire-un-don : ouvre la fenêtre de don.
    else if (slug === 'faire-un-don') panels.setPanel('donate');
  // Fin de l'effet ; aucune dépendance (règle ESLint désactivée sur cette ligne).
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Assistant : exécute une action demandée par le modèle, avec les mêmes fonctions que les boutons de l'interface.
  // L'action est d'abord validée (liste fermée, voir scene/assistantActions.jsx) ; renvoie son libellé, ou null si
  // elle est refusée. Rien d'autre que ces boutons et réglages n'est accessible à l'assistant.
  // Déclare runAssistantAction : exécute une action demandée par l'assistant.
  const runAssistantAction = (action) => {
    // Valide l'action et la traduit en commande, avec les astres et les deux listes de lieux : les villes du monde (lieux de la Terre) et les lieux nommés de la Lune.
    const cmd = resolveAssistantAction(action, navBodies, {
      // les villes du monde, reçues avec les données de la scène ;
      earthPlaces: data.cities,
      // les lieux nommés de la Lune, portés par le moteur.
      moonPlaces: MOON_FEATURES,
    // Fin des listes.
    });
    // Action refusée : rien n'est fait.
    if (!cmd) return null;
    // Selon le type de la commande.
    switch (cmd.type) {
      // focus : remet l'astre s'il était enlevé, puis s'y rend.
      case 'focus': revealAndFocus(cmd.index); break;
      // window : table des fenêtres que l'assistant peut ouvrir (début).
      case 'window': ({
        // La galerie.
        galerie: () => setGalleryOpen(true),
        // Les paramètres.
        parametres: () => setSettingsOpen(true),
        // La recherche.
        recherche: () => panels.setPanel('search'),
        // Les sources.
        node: () => panels.setPanel('sources'),
        // Les informations.
        informations: () => panels.setPanel('layers'),
      // Appelle l'ouverture de la fenêtre demandée, si elle est dans la table.
      })[cmd.window]?.(); break;
      // setting : table des réglages que l'assistant peut changer — un par interrupteur de Paramètres (début).
      case 'setting': ({
        // Les lignes d'orbite.
        orbites: camera.setOrbits,
        // Les repères des planètes.
        noms_planetes: camera.setMarkers,
        // Les repères des satellites.
        noms_satellites: camera.setSatellites,
        // Les étoiles.
        etoiles: camera.setSky,
        // Les lieux de la Lune.
        lieux_lune: moon.setMoonFeatures,
        // L'atmosphère de Vénus et de Mars.
        atmospheres: camera.setAtmospheres,
        // Les nuages et l'atmosphère de la Terre.
        atmosphere_terre: camera.setEarthAtmosphere,
        // La rotation automatique.
        rotation_automatique: camera.setAuto,
        // La vue 3/4.
        vue_3_4: camera.setTilt,
        // L'ombre des planètes.
        ombre: earth.setShade,
        // Les noms des villes.
        noms_villes: earth.setCityNames,
        // Les noms des pays.
        noms_pays: earth.setCountryNames,
        // Les contours : frontières et littoraux ensemble, comme l'interrupteur de Paramètres.
        frontieres_et_littoraux: (on) => { earth.setBorders(on); earth.setCoasts(on); },
        // Les rues et routes d'OpenStreetMap.
        rues: earth.setStreets,
        // Les volcans en éruption.
        volcans: earth.setVolcanoes,
        // Les coordonnées GPS des coins de l'écran.
        coordonnees_gps: earth.setGps,
        // Le relief 3D du globe.
        relief_3d: camera.setRelief,
        // L'économie d'énergie (plus d'interrupteur de Paramètres, mais l'assistant peut toujours la régler).
        economie_energie: setPowerSaving,
      // Applique l'état demandé au réglage, s'il est dans la table.
      })[cmd.setting]?.(cmd.on); break;
      // kind : affiche ou enlève une famille d'astres.
      case 'kind': camera.setKind(cmd.kind, cmd.on); break;
      // body : affiche ou enlève un astre.
      case 'body': camera.setBodyShown(cmd.index, cmd.on); break;
      // speed : règle la vitesse de rotation.
      case 'speed': camera.setRotateSpeed(cmd.speed); break;
      // earthPlace : survole un lieu nommé de la Terre, en vol ; l'altitude est celle du moteur.
      case 'earthPlace': actions.pickPlace({ name: cmd.place.name, lon: cmd.place.lon, lat: cmd.place.lat, fly: true }); break;
      // moonPlace : survole un lieu nommé de la Lune ; goToSite cible la Lune et choisit son altitude de survol.
      case 'moonPlace': actions.goMoonSite(cmd.place); break;
      // zoom : applique le facteur de zoom.
      case 'zoom': actions.zoom(cmd.factor); break;
      // reset : revient à la vue d'ensemble.
      case 'reset': actions.resetView(); break;
      // Tout autre type : rien n'est fait.
      default: return null;
    // Fin du choix.
    }
    // Renvoie le libellé de l'action exécutée.
    return cmd.label;
  // Fin de runAssistantAction.
  };
  // À chaque clic (astre, galerie, Node), la barre d'adresse prend l'adresse de la page.
  // Tient la barre d'adresse à jour selon la fenêtre ouverte et l'astre visé.
  useSiteAddress({ ready: Boolean(engine), galleryOpen, panel: panels.panel, bodyName: bodyNames[focus] });

  // Éléments du HUD posés différemment selon l'écran : sur ordinateur, chacun à sa place fixe ; sur téléphone,
  // rangés dans les deux zones de l'écran (MobileTopBar, MobileDock), où rien ne se recouvre (voir theme/layout).
  // Le bandeau du haut (le moniteur de performance a été retiré de l'interface).
  const hudTopEl = <HudTop hud={hud} />;
  // Le panneau d'informations (début de la balise).
  const informationsEl = (
      <Informations
        // Le magasin du HUD.
        hud={hud}
        // Les données de la scène.
        data={data}
        // Les villes du monde.
        worldCities={worldCities}
        // Les phases de la Lune.
        phases={moonPhases}
        // La recherche de lieux et le plateau tournant de l'astre visé sont intégrés au panneau d'informations.
        plateau={engine ? <PlateauInline engine={engine} bodyId={currentBodyId} baseKey={bases.bases[currentBodyId || 'earth'] ?? null} /> : null}
        // Les rappels de navigation vers les lieux.
        handlers={actions.handlers}
        // Panneau ouvert ou non.
        layersOpen={panels.layersOpen}
        // Fermeture du panneau.
        onCloseLayers={panels.closePanel}
        // Vrai si le moteur existe et que le Soleil est visé.
        sunFocused={Boolean(engine) && focus === 0}
        // Identifiant de l'astre visé.
        bodyId={currentBodyId}
        // Nom de l'astre visé.
        bodyName={currentBodyName}
        // Disponibilité de la « Lune réelle ».
        moonRealAvailable={layers.moonRealAvailable}
        // État des couleurs naturelles de la Lune.
        moonColorOk={moon.moonColorOk}
        // Calques de la Lune.
        moonLayers={layers.moonLayers}
        // Fond choisi pour la Lune.
        moonBaseId={bases.moonBaseId}
        // Choix du fond de la Lune.
        onMoonBase={bases.chooseMoonBase}
        // Calques de Mars.
        marsLayers={layers.marsLayers}
        // Fond choisi pour Mars.
        marsBaseId={bases.marsBaseId}
        // Choix du fond de Mars.
        onMarsBase={bases.chooseMarsBase}
        // Calques de Mercure.
        mercuryLayers={layers.mercuryLayers}
        // Fond choisi pour Mercure.
        mercuryBaseId={bases.mercuryBaseId}
        // Choix du fond de Mercure.
        onMercuryBase={bases.chooseMercuryBase}
        // Calques de Vénus.
        venusLayers={layers.venusLayers}
        // Fond choisi pour Vénus.
        venusBaseId={bases.venusBaseId}
        // Choix du fond de Vénus.
        onVenusBase={bases.chooseVenusBase}
        // Fonds choisis pour tous les astres.
        bodyBases={bases.bases}
        // Choix du fond d'un astre quelconque.
        onBodyBase={bases.chooseBodyBase}
        // Statut de la liste des couches.
        listStatus={tileLayers.status}
        // Erreur de la liste des couches.
        listError={tileLayers.error}
        // Ombrage actif ou non.
        shade={earth.shade}
        // Réglage de l'ombrage.
        onShade={earth.setShade}
        // Réglages liés à l'astre affiché.
        rotateSpeed={camera.rotateSpeed}
        onRotateSpeed={camera.setRotateSpeed}
        rotating={camera.auto}
        onGoPlace={actions.pickPlace}
        onDone={panels.closePanel}
        venusAtmosphere={camera.venusAtmosphere}
        onVenusAtmosphere={camera.setVenusAtmosphere}
        marsAtmosphere={camera.marsAtmosphere}
        onMarsAtmosphere={camera.setMarsAtmosphere}
        atmospheres={camera.atmospheres}
        onAtmospheres={camera.setAtmospheres}
        relief={camera.relief}
        onRelief={camera.setRelief}
        atmosphereLayers={{
          earthAtmosphere: camera.earthAtmosphere,
          onEarthAtmosphere: camera.setEarthAtmosphere,
        }}
        earthLayers={{
          earthLayer: bases.baseLayer,
          cityNames: earth.cityNames,
          onCityNames: earth.setCityNames,
          cityNamesHint: cityNamesHintText(cityInfo),
          countryNames: earth.countryNames,
          onCountryNames: earth.setCountryNames,
          outlines: earth.borders || earth.coasts,
          onOutlines: (on) => { earth.setBorders(on); earth.setCoasts(on); },
          outlinesHint: bordersInfo ? 'Frontières des pays, bord de mer, océans et Caspienne · Natural Earth 1:50m' : 'Chargement…',
          streets: earth.streets,
          onStreets: earth.setStreets,
          volcanoes: earth.volcanoes,
          onVolcanoes: earth.setVolcanoes,
          nightLights: camera.nightLights,
          onNightLights: camera.setNightLights,
          lightView: camera.lightView,
          onLightView: camera.setLightView,
          volcanoesHint: earth.volcanoCount === null ? 'En direct · NASA EONET' : `${earth.volcanoCount} en cours dans le monde · NASA EONET`,
        }}
        moonPlaces={moon.moonFeatures}
        onMoonPlaces={moon.setMoonFeatures}
      // Fin du panneau d'informations.
      />
  // Fin de la constante.
  );
  // L'assistant à la place de la navigation : on lui demande d'aller sur un astre, et il agit sur la scène pendant que
  // l'utilisateur continue de la manipuler (le panneau n'est jamais modal).
  const assistantEl = (
      <Assistant
        // Affiché ou non : le bouton « Assistant » de la barre d'outils le montre et le masque.
        open={assistantOpen}
        // Aucun ancrage : le panneau est posé dans le HUD, pas déroulé sous un bouton.
        anchorEl={null}
        // À la place de la navigation.
        placement="hud"
        // La croix le masque ; il revient par le bouton de la barre d'outils.
        onClose={() => setAssistantOpen(false)}
        // La pastille « Astres » ouvre et ferme l'arborescence.
        onNavigator={() => setNavigatorOpen((v) => !v)}
        // Écarté quand l'arborescence est ouverte : elle occupe la même place dans le HUD.
        shifted={navigatorOpen && !navigatorMoved}
        // Exécution des actions demandées.
        onAction={runAssistantAction}
      // Fin du panneau de l'assistant.
      />
  // Fin de la constante.
  );
  // L'arborescence des astres, ouverte par son bouton : elle garde son pilotage du zoom par le menu des satellites
  // (planète seule quand il est fermé, système complet quand il est ouvert).
  const navigatorEl = navigatorOpen ? <Navigator bodies={shownBodies} focus={focus} onSelect={actions.selectFocus} onMovedChange={setNavigatorMoved} /> : null;
  // La barre d'outils (début de la balise).
  const toolbarEl = (
      <Toolbar
        // Le magasin du HUD.
        hud={hud}
        // Rotation automatique active ou non.
        auto={camera.auto}
        // Vue 3/4 active ou non.
        tilt={camera.tilt}
        // Rechercher : ouvre la fenêtre de recherche.
        onSearch={() => panels.setPanel('search')}
        // Assistant : ouvre ou ferme le menu (connexion d'abord, si aucune clé n'est validée).
        onAssistant={() => setAssistantOpen((v) => !v)}
        // Menu de l'assistant ouvert ou non.
        assistantOpen={assistantOpen}
        // Astres : ouvre ou ferme l'arborescence (bande des astres sur téléphone, rail sur ordinateur).
        onNavigator={() => setNavigatorOpen((v) => !v)}
        // Arborescence ouverte ou non.
        navigatorOpen={navigatorOpen}
        // Mode nuit actif ou non.
        night={night}
        // Ombre : bascule jour/nuit, avec la transition de thème.
        onToggleDayNight={() => withThemeTransition(toggleDayNight)}
        // E = mc² : bascule l'affichage de Schwarzschild (orbites en rosette, grille filaire de courbure).
        schwarzschild={schwarzschild}
        // Le moteur est réglé hors de la mise à jour d'état (un seul appel), et le bouton suit l'état réel du
        // moteur : tant que le moteur n'est pas prêt, il reste relâché au lieu de s'allumer sans effet.
        onToggleSchwarzschild={() => {
          const moteur = engineRef.current;
          setSchwarzschild(moteur ? Boolean(moteur.setSchwarzschild(!schwarzschild)) : false);
        }}
        // Rotation : inverse l'état.
        onToggleAuto={() => camera.setAuto((v) => !v)}
        // Vue 3/4 : inverse l'état.
        onToggleTilt={() => camera.setTilt((v) => !v)}
        // Verrouillage : transmis au moteur.
        onToggleLock={(on) => engine?.setViewLock(on)}
        // Sources : ouvre la fenêtre.
        onSources={() => panels.setPanel('sources')}
        // Dons : ouvre la fenêtre.
        onDonate={() => panels.setPanel('donate')}
        // Trajet : ouvre ou ferme la fenêtre de temps de trajet.
        onTrip={() => panels.toggle('trip')}
        tripOpen={panels.panel === 'trip'}
        // Informations : ouvre ou ferme la fiche de l'astre focus.
        onInfos={() => panels.toggle('layers')}
        infosOpen={panels.layersOpen}
        // Galerie : ouvre la fenêtre.
        onGallery={() => setGalleryOpen(true)}
      // Fin de la barre d'outils.
      />
  // Fin de la constante.
  );

  // Début du rendu.
  return (
    // Conteneur racine, qui couvre la fenêtre et porte la taille d'écran en attribut.
    <div data-vp={viewport.size} className="fixed inset-0">
      {/* Scène 3D : le moteur y ajoute son canvas WebGL, plein écran sous tout le HUD. */}
      {/* Le conteneur de la scène 3D (début de la balise). */}
      <div
        // Référence donnée au moteur.
        ref={containerRef}
        // Marqueur data-scene.
        data-scene
        // Début du style.
        className="absolute inset-0 [&_>_canvas]:block [&_>_canvas]:fixed [&_>_canvas]:inset-0 [&_>_canvas]:w-full [&_>_canvas]:h-full [&_>_canvas]:touch-none [&_>_canvas]:cursor-grab [&_>_canvas:active]:cursor-grabbing"
      // Fin du conteneur de la scène.
      />

      {/* La visionneuse LiDAR HD de l'IGN : un cadre en bas de la scène, ouvert quand la caméra de Gobai survole
          la zone de référence de Paris sous 0,22 km d'altitude ; fermé par le visiteur, puis rouvert à la
          prochaine entrée dans la zone. */}
      {lidarFrame.visible && <LidarFrame url={lidarFrame.url} onClose={lidarFrame.hide} />}
   


      {/* Le bandeau du haut (ordinateur ; sur téléphone, dans la zone du titre). */}
      {!compact && hudTopEl}
      {/* Le panneau d'informations (ordinateur ; sur téléphone, dans le dock). */}
      {!compact && informationsEl}
      {/* Assistant (ordinateur ; sur téléphone, dans le dock). */}
      {!compact && assistantEl}
      {/* L'arborescence des astres (ordinateur ; sur téléphone, bande du dock). */}
      {!compact && navigatorEl}
      {/* La navball de pilotage : nord verrouillé, recalibrage, arrêt de la rotation automatique, messages, et
          « Ma position » en icône sous la boule (suivi en cours, attente, et action). */}
      <NavballPilote
        // Le magasin du HUD, le moteur, l'état du nord verrouillé et son recalibrage.
        hud={hud} engine={engine} locked={actions.northLocked} onRecalibrate={actions.recalibrateNorth}
        // Arrêt de la rotation automatique et messages temporaires.
        onStopAuto={() => camera.setAuto(false)} push={push}
        // « Ma position » : suivi en cours, attente et action.
        positionLive={myPosition.live} positionWaiting={myPosition.waiting} onMyPosition={myPosition.goToMe}
      // Fin de la navball.
      />
      {/* Le pavé de zoom. */}
      <ZoomPad onZoom={actions.zoom} />
      {/* La barre d'outils (ordinateur). */}
      {!compact && toolbarEl}
      {/* Téléphone : les deux zones de commandes, où chaque élément a sa place et rien ne se recouvre. */}
      {/* En mode compact (début). */}
      {compact && (
        // Fragment : zone du titre et dock.
        <>
          {/* Zone du titre : bandeau, bouton de don à droite, indicateurs dessous. */}
          <MobileTopBar
            // Bouton de don : icône seule, cible tactile de 44 px ; aussi dans la feuille « Menu ».
            actions={(
              // Bouton (début de la balise).
              <IconButton
                // Au clic : ouvre la fenêtre de don.
                onClick={() => panels.setPanel('donate')}
                // Nom pour les lecteurs d'écran et infobulle.
                aria-label="Faire un don à Gobai Space"
                // Style : rond de 44 px, fond bleu sombre, bordure claire, cœur blanc.
                className="w-11 h-11 text-white bg-[rgba(26,38,61,.92)] border border-[rgba(255,255,255,.22)] backdrop-blur-[14px] hover:bg-[rgba(48,65,96,.98)]"
              // Fin de la balise ouvrante.
              >
                {/* Le cœur. */}
                <FavoriteIcon fontSize="small" />
              {/* Fin du bouton. */}
              </IconButton>
            // Fin des boutons.
            )}
            // Indicateur : aucun.
            status={null}
          // Fin de la balise ouvrante.
          >
            {/* Le bandeau titre. */}
            {hudTopEl}
          {/* Fin de la zone du titre. */}
          </MobileTopBar>
          {/* Dock du bas : tiroir Informations et assistant, puis bande des astres et navigation. */}
          <MobileDock surfaces={<>{informationsEl}{assistantEl}</>} base={<>{navigatorEl}{toolbarEl}</>} />
        {/* Fin du fragment. */}
        </>
      // Fin du mode compact.
      )}
      {/* La fenêtre des sources, chargée à sa première ouverture (début de la balise). */}
      <LazyWindow open={panels.panel === 'sources' || settingsOpen}><Attribution
        // Le magasin du HUD.
        hud={hud}
        // Vrai si la Lune est en mode « Lune réelle ».
        moonReal={bases.moonBaseId === 'real'}
        // Attributions supplémentaires (début du tableau).
        extra={[
          // Celle des frontières, si les contours sont affichés et qu'elle est connue.
          (earth.borders || earth.coasts) && bordersInfo ? bordersInfo.attribution : '',
          // Celle des villes, si leurs noms sont affichés et qu'elle est connue.
          earth.showCityNames && cityInfo ? cityInfo.attribution : '',
          // Celle du ciel, s'il est affiché.
          camera.sky ? SKY_ATTRIBUTION : '',
          // Celle de la pollution lumineuse, si elle est allumée (lumières de la nuit ou vue de toute la Terre).
          camera.nightLights || camera.lightView ? EARTH_NIGHT_LIGHTS.attribution : '',
        // Sans les entrées vides, jointes par un point médian.
        ].filter(Boolean).join(' · ')}
        // Ouverte si le panneau courant est celui des sources ou des paramètres.
        open={panels.panel === 'sources' || settingsOpen}
        // Onglet demandé : « Paramètres » quand ils sont ouverts (bouton de l'assistant), sinon les sources.
        view={settingsOpen ? 'settings' : ''}
        // L'onglet « Paramètres » de la fenêtre : le contenu des paramètres, sans fenêtre propre (début de la balise).
        settings={(
          <Parametres
            // Fermeture : referme la fenêtre Node.
            onClose={() => panels.closePanel()}
            // Référence du moteur, utilisée par le catalogue extrasolaire.
            engineRef={engineRef}
            // Tous les astres, avec leur état.
            bodies={bodyStates}
            // Affichage d'un astre.
            onBodyShown={camera.setBodyShown}
            // Astre visé.
            focus={focus}
            // Sélection d'un astre.
            onSelect={actions.selectFocus}
            // Familles affichées.
            kinds={camera.kinds}
            // Affichage d'une famille.
            onKind={camera.setKind}
            // Lignes d'orbite.
            orbits={camera.orbits}
            // Réglage des orbites.
            onOrbits={camera.setOrbits}
            // Repères des planètes.
            markers={camera.markers}
            // Réglage des repères des planètes.
            onMarkers={camera.setMarkers}
            // Repères des satellites.
            satellites={camera.satellites}
            // Réglage des repères des satellites.
            onSatellites={camera.setSatellites}
            // Ciel.
            sky={camera.sky}
            // Réglage du ciel.
            onSky={camera.setSky}
          />
        )}
        // Fermeture.
        onClose={panels.closePanel}
      // Fin de la fenêtre des sources.
      /></LazyWindow>
      {/* Les messages temporaires. */}
      <Toasts toasts={toasts} onDismiss={dismiss} />

      {/* La fenêtre de recherche (début de la balise). */}
      <Rechercher
        // Ouverte si le panneau courant est celui de la recherche.
        open={panels.panel === 'search'}
        // Fermeture.
        onClose={panels.closePanel}
        // Les villes des données.
        cities={data.cities}
        // Les villes du monde.
        worldCities={worldCities}
        // Les noms des astres.
        bodyNames={bodyNames}
        // Choix d'une ville.
        onPickCity={actions.pickCity}
        // Choix d'un lieu.
        onPickPlace={actions.pickPlace}
        // Recherche mondiale disponible ou non.
        worldSearch={tileLayers.placeSearch}
        // Choix d'un astre : il est remis s'il était enlevé.
        onPickBody={revealAndFocus}
      // Fin de la fenêtre de recherche.
      />
      {/* La fenêtre de don. */}
      <Don open={panels.panel === 'donate'} onClose={panels.closePanel} />
      {/* La fenêtre de temps de trajet : se connecte à l'assistant (clé de l'utilisateur) pour les trajets hors Apollo. */}
      <LazyWindow open={panels.panel === 'trip'}><Trajet open={panels.panel === 'trip'} onClose={panels.closePanel} onOpenAssistant={() => setAssistantOpen(true)} /></LazyWindow>
      {/* La galerie. */}
      <LazyWindow open={galleryOpen}><Donnees open={galleryOpen} onClose={() => setGalleryOpen(false)} /></LazyWindow>

      {/* Pendant le chargement, l'écran Artemis II (SolarSystem) couvre la scène ; ici, seulement l'échec du moteur. */}
      {/* Si le moteur n'existe pas et qu'il y a une erreur (début). */}
      {!engine && error && (
        // Message plein écran.
        <FullScreenMessage>
          {/* Le texte de l'erreur, en rouge. */}
          <p className="t-body1 text-error">{error}</p>
        {/* Fin du message. */}
        </FullScreenMessage>
      // Fin du cas d'erreur.
      )}
    {/* Fin du conteneur racine. */}
    </div>
  // Fin du rendu.
  );
// Fin de SolarScene.
}
