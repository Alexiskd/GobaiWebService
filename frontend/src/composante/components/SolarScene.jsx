// Importe de React les crochets useCallback, useEffect, useMemo, useRef, useState et useSyncExternalStore.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
// Importe de MUI Box (conteneur), Button (bouton) et Typography (texte).
import { Box, Button, Typography } from '@mui/material';
// Importe safe, la marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';
// Importe bodyId, qui donne l'identifiant d'un astre.
import { bodyId } from '@/moteur/engine/bodyPlaces';
// Importe les astres enlevés par défaut, la visibilité par défaut, le test de famille masquée et la famille d'une planète.
import { defaultHiddenBodies, defaultVisibility, isKindHidden, planetKind } from '@/moteur/engine/bodyKinds';
// Importe le calcul et l'affichage en console des booléens de chaque astre.
import { bodyBooleans, logBodyBooleans } from '@/moteur/engine/bodyBooleans';
// Importe la création du magasin du HUD et le crochet qui le lit.
import { createHudStore, useHud } from '@/moteur/engine/hudStore';
// Importe le crochet du son des clics.
import { useBubbleSound } from '@/composante/hooks/useBubbleSound';
// Importe le crochet de la langue de l'interface.
import { useInterfaceLanguage } from '@/composante/hooks/useInterfaceLanguage';
// Importe le crochet qui crée le moteur 3D.
import { useSolarEngine } from '@/composante/hooks/useSolarEngine';
// Importe le lecteur et l'abonnement du mode économie d'énergie.
import { getPowerSaving, setPowerSaving, subscribePowerSaving } from '@/moteur/lib/powerSaving';
// Réglage du noir pur, actionnable par l'assistant comme par l'interrupteur de Paramètres.
import { setOledBlack } from '@/moteur/lib/oledBlack';
// Importe la préparation et l'exécution du partage de la vue.
import { shareData, shareView } from '@/moteur/lib/share';
// Importe le crochet des couches de tuiles.
import { useTileLayers } from '@/composante/hooks/useTileLayers';
// Importe le crochet des messages temporaires.
import { useToasts } from '@/composante/hooks/useToasts';
// Importe le crochet de la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la navball de pilotage.
import { NavballPilote } from './hud/NavballPilote';
// Importe le cadre des coordonnées GPS.
import { GpsFrame } from './hud/GpsFrame';
// Importe la jauge LiDAR.
import { LidarJauge } from './hud/LidarJauge';
// Importe l'indicateur de chargement des tuiles.
import { TuilesLoader } from './hud/TuilesLoader';
// Importe le compteur d'images par seconde.
import { FpsCounter } from './hud/FpsCounter';
// Importe le moniteur de performance.
import { PerfMonitor } from './hud/PerfMonitor';
// Importe le bandeau du haut.
import { HudTop } from './hud/HudTop';
// Importe la fenêtre des paramètres.
import { Parametres } from './menus/Parametres/Parametres';
// Importe la bande de navigation entre les astres.
import { Navigator } from './hud/Navigator';
// Importe l'affichage des messages temporaires.
import { Toasts } from './hud/Toasts';
// Importe la fenêtre des sources.
import { Attribution } from './hud/Attribution';
// Importe l'attribution du ciel.
import { SKY_ATTRIBUTION } from '@/moteur/engine/sky/skyLayer';
// Importe le pavé de zoom.
import { ZoomPad } from './hud/ZoomPad';
// Importe le message plein écran.
import { FullScreenMessage } from './SolarSystem';
// Importe la barre d'outils.
import { Toolbar } from './toolbar/Toolbar';
// Importe la fenêtre d'aide.
import { Aide } from './menus/Aide';
// Importe la fenêtre de don.
import { Don } from './menus/Don/Don';
// Importe hasDonationReturn, le test du retour de la page de paiement.
import { hasDonationReturn } from './menus/Don/donationReturn';
// Importe le menu de l'assistant.
import { Assistant } from './menus/Assistant/Assistant';
// Importe la fenêtre de la langue.
import { Langue } from './menus/Langue';
// Importe la fenêtre du plateau tournant.
import { Plateau } from './menus/Plateau/Plateau';
// Importe la galerie.
import { Galerie } from './menus/Galerie/Galerie';
// Importe la composante Boutique : exports payants.
import { Boutique } from './menus/Boutique/Boutique';
// Importe le test du retour de la page de paiement d'un export.
import { hasPurchaseReturn } from '@/moteur/api/store';
// Importe le panneau d'informations.
import { Informations } from './menus/Informations/Informations';
// Importe la fenêtre de recherche.
import { Rechercher } from './menus/Rechercher';
// Importe le crochet des nuages LiDAR sur le globe.
import { useLidarGlobe } from './scene/useLidarGlobe';
// Importe le crochet des dalles LiDAR en points 3D.
import { useLidarPoints } from './scene/useLidarPoints';
// Importe le texte d'aide des noms de villes.
import { cityNamesHintText } from './scene/layerHints';
// Importe le crochet des réglages de caméra et d'affichage.
import { useCameraToggles } from './scene/useCameraToggles';
// Importe le crochet qui expose la catégorie d'écran au CSS.
import { useDocumentViewport } from './scene/useDocumentViewport';
// Importe le crochet de l'affichage de la Terre.
import { useEarthDisplay } from './scene/useEarthDisplay';
// Importe le crochet des données de carte (villes, frontières, nuages, vent).
import { useMapFeeds } from './scene/useMapFeeds';
// Importe le crochet des données lunaires.
import { useMoonFeeds } from './scene/useMoonFeeds';
// Importe le crochet des calques de la Lune.
import { useMoonLayers } from './scene/useMoonLayers';
// Importe le crochet des régions actives du Soleil.
import { useSunFeeds } from './scene/useSunFeeds';
// Importe le crochet des modèles 3D des astres irréguliers.
import { useBodyModels } from './scene/useBodyModels';
// Importe le crochet des panneaux ouverts.
import { usePanels } from './scene/usePanels';
// Importe le crochet de l'adresse du site.
import { useSiteAddress } from './scene/useSiteAddress';
// Importe la traduction des actions de l'assistant.
import { resolveAssistantAction } from './scene/assistantActions';
// Lieux nommés de la Lune (sites d'alunissage, mers, cratères, régions) : la liste que l'assistant peut survoler.
import { MOON_FEATURES } from '@/moteur/engine/moonFeatures';
// Importe le chargement de l'état des cartes des satellites.
import { fetchSatelliteStatus } from '@/moteur/api/scene';
// Importe la valeur « nuit », le lecteur, l'abonnement et la bascule jour/nuit.
import { NIGHT, getDayNight, subscribeDayNight, toggleDayNight } from '@/moteur/lib/dayNight';
// Importe l'enrobage qui anime le changement de thème.
import { withThemeTransition } from '@/composante/theme/themeTransition';
// Importe le crochet des commandes envoyées au moteur.
import { useSceneActions } from './scene/useSceneActions';
// Importe le crochet « Ma position ».
import { useMyPosition } from './scene/useMyPosition';
// Importe le crochet qui classe les calques par astre.
import { useSceneLayers } from './scene/useSceneLayers';
// Importe le crochet qui suit la taille du conteneur.
import { useStageResize } from './scene/useStageResize';
// Importe le crochet des fonds de carte.
import { useTileBases } from './scene/useTileBases';
// Icône du bouton de don.
import { FavoriteIcon } from './ui/icons';

// Scène complète : moteur 3D, calques, panneaux et barre d’outils.
// La logique vit dans les hooks de `scene/` ; ce composant assemble et place les composantes.
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
    () => createHudStore({ date: '', focusText: '', zoomText: 'Zoom · molette ou pincement', zoomShort: '', scaleText: '', cityFocus: null, tiles: null, moonTiles: null, marsTiles: null, mercuryTiles: null, venusTiles: null, moonLive: null, bodyLive: null, compass: null, gps: null, lidarPoints: null, viewLock: null, fps: 0, perf: null }),
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
  // Son des clics : état et bascule.
  const [sound, toggleSound] = useBubbleSound();
  // Langue de l'interface.
  const language = useInterfaceLanguage();
  // État : fenêtre de la langue ouverte ou non.
  const [languageOpen, setLanguageOpen] = useState(false);
  // État : galerie ouverte ou non.
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Fenêtre « Boutique » ouverte ou non ; elle s'ouvre seule au retour d'un paiement.
  const [storeOpen, setStoreOpen] = useState(hasPurchaseReturn);
  // État : paramètres ouverts ou non.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Moniteur de performance masqué par défaut ; activable depuis les paramètres.
  const [performanceMonitorVisible, setPerformanceMonitorVisible] = useState(false);
  // Claude : posé dans le HUD à la place de la navigation, indépendant des autres fenêtres (il reste ouvert quand il
  // en ouvre une) et jamais modal — la scène et le moteur restent utilisables pendant tout l'échange.
  // État : panneau de Claude affiché ou non ; affiché au départ, puisqu'il tient la place de la navigation.
  const [assistantOpen, setAssistantOpen] = useState(true);
  // Navigation : Claude tient sa place dans le HUD, l'arborescence des astres s'ouvre à la demande, par son bouton.
  // État : arborescence de navigation ouverte ou non, fermée au départ.
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  // État : plateau tournant ouvert ou non.
  const [plateauOpen, setPlateauOpen] = useState(false);
  // Touches P (galerie) et T (plateau tournant), sauf pendant une saisie.
  // Effet exécuté une seule fois : deux raccourcis clavier.
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
      // P : ouvre ou ferme la galerie.
      if (k === 'p') setGalleryOpen((v) => !v);
      // T : ouvre ou ferme le plateau tournant.
      else if (k === 't') setPlateauOpen((v) => !v);
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
  // Au premier instant tout est affiché ; dès que la liste des couches de cartes arrive, les astres sans couche
  // sont décochés (voir plus bas, defaultHiddenBodies).
  // Réglages de caméra et d'affichage, avec la visibilité par défaut.
  const camera = useCameraToggles(engine, defaultVisibility());
  // Affichage par défaut selon les fonds de carte : appliqué une seule fois, quand on connaît la liste des couches
  // et le nombre réel de fonds des satellites et des géantes (le même que dans leur fiche d'information). Un astre
  // sans fond de carte est décoché dans Paramètres (voir shownByDefault). Liste injoignable : on n'enlève rien.
  // État : état des cartes des satellites.
  const [mapStatus, setMapStatus] = useState(null); // null = pas encore reçu ; [] = injoignable
  // Effet exécuté une seule fois : charge cet état.
  useEffect(() => {
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Lance le chargement.
    fetchSatelliteStatus(ctrl.signal)
      // Réussite : garde les lignes reçues, liste vide si ce n'est pas un tableau.
      .then((rows) => setMapStatus(Array.isArray(rows) ? rows : []))
      // Échec, sauf annulation volontaire : liste vide.
      .catch((e) => { if (e?.name !== 'AbortError') setMapStatus([]); });
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; aucune dépendance.
  }, []);
  // Référence : vrai une fois les réglages par défaut appliqués.
  const defaultsApplied = useRef(false);
  // Extrait la fonction qui fixe les astres enlevés.
  const { setHiddenBodies } = camera;
  // Effet qui applique l'affichage par défaut.
  useEffect(() => {
    // Une seule fois, et seulement quand les couches et l'état des cartes sont connus.
    if (defaultsApplied.current || tileLayers.status !== 'ready' || mapStatus === null) return;
    // Note que c'est fait.
    defaultsApplied.current = true;
    // Calcule les astres à enlever d'après la navigation, les couches, l'adresse de la page et l'état des cartes.
    const hidden = defaultHiddenBodies(navBodies, tileLayers.layers, window.location.pathname, mapStatus);
    // Les enregistre.
    setHiddenBodies(new Set(hidden));
    // Console : la fonction booléenne NASA JPL / Trek de chaque astre, une seule fois à l'ouverture.
    // Écrit dans la console les booléens de chaque astre.
    logBodyBooleans(bodyBooleans(navBodies, data.satelliteStatus, hidden));
  // Fin de l'effet ; dépendances : les couches, l'état des cartes, la navigation, la fonction et l'état des satellites.
  }, [tileLayers.status, tileLayers.layers, mapStatus, navBodies, setHiddenBodies, data.satelliteStatus]);
  // Aller à un astre enlevé (recherche) : on le remet d'abord, puis on s'y téléporte une fois le moteur à jour.
  // Extrait les fonctions d'affichage d'un astre et d'une famille.
  const { setBodyShown, setKind } = camera;
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
  // Affichage de la Terre : ombrage, frontières, noms, routes, LiDAR HD.
  const earth = useEarthDisplay({ engine, baseLayer: bases.baseLayer, overlayLayer: bases.overlayLayer, lidarLayers: bases.lidarLayers, push });
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
  // Partager la vue : l'adresse de la page suit déjà l'astre affiché (useSiteAddress).
  // shareCurrentView : partage la vue ; début de la fonction asynchrone mémorisée.
  const shareCurrentView = useCallback(async () => {
    // Lance le partage avec le nom de l'astre et l'adresse de la page.
    const result = await shareView(shareData({ bodyName: currentBodyName, url: window.location.href }));
    // Lien copié : le dit pendant 4 secondes.
    if (result === 'copied') push('Lien copié dans le presse-papiers.', 'info', 4000);
    // Échec : le dit pendant 6 secondes.
    else if (result === 'failed') push('Partage impossible sur ce navigateur.', 'error', 6000);
  // Fin de shareCurrentView ; dépendances : le nom de l'astre et push.
  }, [currentBodyName, push]);
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
  // Dalles LiDAR en vrais points 3D (Paris) : chargées par le moteur à l'approche, interrupteur dans Paramètres.
  // Dalles LiDAR en points 3D.
  const lidarPoints = useLidarPoints(engine);
  // Panneaux ouverts et raccourcis clavier.
  const panels = usePanels({ compact });
  // Retour de Stripe : rouvre la fenêtre pour confirmer le don ou signaler son annulation.
  useEffect(() => { if (hasDonationReturn()) panels.setPanel('donate'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Adresse d'une fenêtre (https://www.gobaispace.com/galerie, /node) : ouverte dès l'arrivée.
  // Même liste que WINDOW_PAGES dans backend/src/services/data/body-pages.ts.
  // Effet exécuté une seule fois : ouvre la fenêtre demandée par l'adresse.
  useEffect(() => {
    // Lit le chemin de l'adresse, sans barres obliques, en minuscules.
    const slug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    // Adresse /galerie : ouvre la galerie.
    if (slug === 'galerie') setGalleryOpen(true);
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
    // Valide l'action et la traduit en commande, avec les astres et les trois listes de lieux : les villes du
    // LiDAR HD, les villes du monde (lieux de la Terre) et les lieux nommés de la Lune.
    const cmd = resolveAssistantAction(action, navBodies, {
      // les villes de France où le LiDAR HD est proposé ;
      lidarCities: earth.lidarCities,
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
        // La langue.
        langue: () => setLanguageOpen(true),
        // La recherche.
        recherche: () => panels.setPanel('search'),
        // L'aide.
        aide: () => panels.setPanel('help'),
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
        // L'atmosphère des planètes solides.
        atmospheres: camera.setAtmospheres,
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
        // Les routes du fond de carte.
        routes: earth.setRoads,
        // Les volcans en éruption.
        volcans: earth.setVolcanoes,
        // Les coordonnées GPS des coins de l'écran.
        coordonnees_gps: earth.setGps,
        // Le relief 3D du globe.
        relief_3d: camera.setRelief,
        // Le calque LiDAR HD : allumé sur le premier modèle proposé, éteint sinon.
        lidar_hd: (on) => earth.setLidar(on ? (bases.lidarLayers[0]?.id ?? null) : null),
        // Les points LiDAR 3D.
        points_lidar: lidarPoints.setOn,
        // Le noir pur de l'interface.
        noir_pur: setOledBlack,
        // L'économie d'énergie.
        economie_energie: setPowerSaving,
        // Le moniteur de performance.
        moniteur_performance: setPerformanceMonitorVisible,
      // Applique l'état demandé au réglage, s'il est dans la table.
      })[cmd.setting]?.(cmd.on); break;
      // kind : affiche ou enlève une famille d'astres.
      case 'kind': camera.setKind(cmd.kind, cmd.on); break;
      // body : affiche ou enlève un astre.
      case 'body': camera.setBodyShown(cmd.index, cmd.on); break;
      // speed : règle la vitesse de rotation.
      case 'speed': camera.setRotateSpeed(cmd.speed); break;
      // lidar : choisit le modèle LiDAR HD affiché (et allume le calque).
      case 'lidar': earth.setLidar(cmd.layerId); break;
      // lidarCity : allume le calque LiDAR HD et se rend au-dessus de la ville.
      case 'lidarCity':
        // Allume le calque sur le premier modèle proposé s'il est éteint.
        if (!earth.lidarId) earth.setLidar(bases.lidarLayers[0]?.id ?? null);
        // Se rend au-dessus de la ville, à l'altitude où l'ombrage se lit, en vol.
        actions.pickPlace({ name: cmd.city.name, lat: cmd.city.lat, lon: cmd.city.lon, altitudeM: earth.lidarCityAltitudeM, fly: true });
        // Fin de la commande.
        break;
      // lidarColor : choisit la couleur des points LiDAR 3D.
      case 'lidarColor': lidarPoints.setColor(cmd.mode); break;
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

  // Début du rendu.
  return (
    // Conteneur racine, qui couvre la fenêtre et porte la taille d'écran en attribut.
    <Box data-vp={viewport.size} sx={{ position: 'fixed', inset: 0 }}>
      {/* Scène 3D : le moteur y ajoute son canvas WebGL, plein écran sous tout le HUD. */}
      {/* Le conteneur de la scène 3D (début de la balise). */}
      <Box
        // Référence donnée au moteur.
        ref={containerRef}
        // Marqueur data-scene.
        data-scene
        // Début du style.
        sx={{
          // Couvre tout le conteneur racine.
          position: 'absolute', inset: 0,
          // Le canvas du moteur : plein écran, sans geste tactile du navigateur, curseur en main ouverte.
          '& > canvas': { display: 'block', position: 'fixed', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' },
          // Pendant l'appui : curseur en main fermée.
          '& > canvas:active': { cursor: 'grabbing' },
        // Fin du style.
        }}
      // Fin du conteneur de la scène.
      />
   


      {/* Le bandeau du haut. */}
      <HudTop hud={hud} />
      {/* Le panneau d'informations (début de la balise). */}
      <Informations
        // Le magasin du HUD.
        hud={hud}
        // Les données de la scène.
        data={data}
        // Les villes du monde.
        worldCities={worldCities}
        // Les phases de la Lune.
        phases={moonPhases}
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
        // Calques de la Terre.
        layers={layers.earthLayers}
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
        // Fonds choisis pour tous les astres.
        bodyBases={bases.bases}
        // Choix du fond d'un astre quelconque.
        onBodyBase={bases.chooseBodyBase}
        // Fournisseur des tuiles.
        provider={tileLayers.provider}
        // Statut de la liste des couches.
        listStatus={tileLayers.status}
        // Erreur de la liste des couches.
        listError={tileLayers.error}
        // Fond choisi pour la Terre.
        baseId={bases.baseId}
        // Choix du fond de la Terre.
        onBase={bases.chooseBase}
        // Ombrage actif ou non.
        shade={earth.shade}
        // Réglage de l'ombrage.
        onShade={earth.setShade}
      // Fin du panneau d'informations.
      />
      {/* Claude à la place de la navigation : on lui demande d'aller sur un astre, et il agit sur la scène pendant
          que l'utilisateur continue de la manipuler (le panneau n'est jamais modal). */}
      <Assistant
        // Affiché ou non : le bouton « Claude » de la barre d'outils le montre et le masque.
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
        shifted={navigatorOpen}
        // Exécution des actions demandées.
        onAction={runAssistantAction}
      // Fin du panneau de Claude.
      />
      {/* L'arborescence des astres, ouverte par son bouton : elle garde son pilotage du zoom par le menu des
          satellites (planète seule quand il est fermé, système complet quand il est ouvert). */}
      {navigatorOpen && <Navigator bodies={shownBodies} focus={focus} onSelect={actions.selectFocus} />}
      {/* La navball de pilotage : nord verrouillé, recalibrage, arrêt de la rotation automatique, messages, et
          « Ma position » en icône sous la boule (suivi en cours, attente, et action). */}
      <NavballPilote
        hud={hud} engine={engine} locked={actions.northLocked} onRecalibrate={actions.recalibrateNorth}
        onStopAuto={() => camera.setAuto(false)} push={push}
        positionLive={myPosition.live} positionWaiting={myPosition.waiting} onMyPosition={myPosition.goToMe}
      />
      {/* Le pavé de zoom. */}
      <ZoomPad onZoom={actions.zoom} />
      {/* La jauge LiDAR. */}
      <LidarJauge hud={hud} />
      {/* L'indicateur de chargement des tuiles de l'astre visé. */}
      <TuilesLoader hud={hud} bodyId={currentBodyId} bodyName={currentBodyName} />
      {/* Le compteur d'images par seconde. */}
      <FpsCounter hud={hud} />
      {/* Le moniteur de performance. */}
      {performanceMonitorVisible && <PerfMonitor hud={hud} />}
      {/* Sur petit écran, accès aux dons hors de la barre compacte ; sur ordinateur, bouton intégré à la barre du bas. */}
      {compact && (
        // Bouton de don (début).
        <Button
          // Au clic : ouvre la fenêtre de don.
          onClick={() => panels.setPanel('donate')}
          // Nom pour les lecteurs d'écran.
          aria-label="Faire un don à Gobai Space"
          // Icône : un cœur.
          startIcon={<FavoriteIcon />}
          // Style (début).
          sx={{
            // Position fixe.
            position: 'fixed',
            // Sous le bandeau logo/titre, dans l'angle supérieur gauche ; marge adaptée à la hauteur du logo.
            top: `calc(${safe('top')} + ${compact ? 132 : 172}px)`,
            // À 12 px du bord gauche, après la marge de sécurité.
            left: `calc(${safe('left')} + 12px)`,
            // Au-dessus de la scène.
            zIndex: 30,
            // Hauteur minimale de 36 px.
            minHeight: 36,
            // Marge intérieure horizontale.
            px: 1.5,
            // Bords arrondis en pilule.
            borderRadius: 99,
            // Texte blanc.
            color: '#fff',
            // Fond bleu sombre presque opaque.
            bgcolor: 'rgba(26, 38, 61, .92)',
            // Bordure claire et fine.
            border: '1px solid rgba(255,255,255,.22)',
            // Flou de l'arrière-plan.
            backdropFilter: 'blur(14px)',
            // Le même, pour Safari.
            WebkitBackdropFilter: 'blur(14px)',
            // Texte de 11 px.
            fontSize: 11,
            // En gras.
            fontWeight: 700,
            // Lettres légèrement espacées.
            letterSpacing: '.02em',
            // Sans majuscules forcées.
            textTransform: 'none',
            // Fond plus clair au survol.
            '&:hover': { bgcolor: 'rgba(48, 65, 96, .98)' },
          // Fin du style.
          }}
        // Fin des réglages du bouton.
        >
          {/* Son texte. */}
          Faire un don
        {/* Fin du bouton. */}
        </Button>
        // Fin du cas « petit écran ».
        )}
      {/* La barre d'outils (début de la balise). */}
      <Toolbar
        // Le magasin du HUD.
        hud={hud}
        // Rotation automatique active ou non.
        auto={camera.auto}
        // Vue 3/4 active ou non.
        tilt={camera.tilt}
        // Rechercher : ouvre la fenêtre de recherche.
        onSearch={() => panels.setPanel('search')}
        // Claude : mémorise le bouton comme point d'ancrage, puis ouvre ou ferme le menu.
        onAssistant={() => setAssistantOpen((v) => !v)}
        // Menu de l'assistant ouvert ou non.
        assistantOpen={assistantOpen}
        // Mode nuit actif ou non.
        night={night}
        // Ombre : bascule jour/nuit, avec la transition de thème.
        onToggleDayNight={() => withThemeTransition(toggleDayNight)}
        // Rotation : inverse l'état.
        onToggleAuto={() => camera.setAuto((v) => !v)}
        // Vue 3/4 : inverse l'état.
        onToggleTilt={() => camera.setTilt((v) => !v)}
        // Verrouillage : transmis au moteur.
        onToggleLock={(on) => engine?.setViewLock(on)}
        // Vue globale.
        onReset={actions.resetView}
        // Aide : ouvre la fenêtre d'aide.
        onHelp={() => panels.setPanel('help')}
        // Son actif ou non.
        sound={sound}
        // Bascule du son.
        onToggleSound={toggleSound}
        // Langue : ouvre la fenêtre.
        onLanguage={() => setLanguageOpen(true)}
        // Sources : ouvre la fenêtre.
        onSources={() => panels.setPanel('sources')}
        // Dons : ouvre la fenêtre.
        onDonate={() => panels.setPanel('donate')}
        // Moniteur de performance : l'affiche ou le masque.
        onTogglePerformanceMonitor={() => setPerformanceMonitorVisible((visible) => !visible)}
        // Moniteur de performance : son état.
        performanceMonitorVisible={performanceMonitorVisible}
        // Galerie : ouvre la fenêtre.
        onGallery={() => setGalleryOpen(true)}
        // Boutique : ouvre la fenêtre des exports payants.
        onStore={() => setStoreOpen(true)}
        // Paramètres : ouvre la fenêtre.
        onSettings={() => setSettingsOpen(true)}
        // Plateau tournant : ouvre la fenêtre.
        onPlateau={() => setPlateauOpen(true)}
        // Partager la vue.
        onShare={shareCurrentView}
        // Nom de la langue en cours (dans sa propre langue, sinon son nom courant), vide si elle est inconnue.
        languageLabel={language.effective ? (language.effective.entry.autonym || language.effective.entry.name) : ''}
      // Fin de la barre d'outils.
      />
      {/* La fenêtre des sources (début de la balise). */}
      <Attribution
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
        // Sans les entrées vides, jointes par un point médian.
        ].filter(Boolean).join(' · ')}
        // Ouverte si le panneau courant est celui des sources.
        open={panels.panel === 'sources'}
        // Fermeture.
        onClose={panels.closePanel}
      // Fin de la fenêtre des sources.
      />
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
      {/* La fenêtre d'aide. */}
      <Aide open={panels.panel === 'help'} onClose={panels.closePanel} />
      {/* La fenêtre de don. */}
      <Don open={panels.panel === 'donate'} onClose={panels.closePanel} />
      {/* La fenêtre de la langue. */}
      <Langue open={languageOpen} onClose={() => setLanguageOpen(false)} language={language} />
      {/* La fenêtre des paramètres (début de la balise). */}
      <Parametres
        // Ouverte ou non.
        open={settingsOpen}
        // Moniteur de performance, désactivé par défaut.
        performanceMonitorVisible={performanceMonitorVisible}
        // Moniteur de performance : son changement.
        onPerformanceMonitorChange={setPerformanceMonitorVisible}
        // Fermeture.
        onClose={() => setSettingsOpen(false)}
        // Tous les astres, avec leur état.
        bodies={bodyStates}
        // Affichage d'un astre.
        onBodyShown={camera.setBodyShown}
        // Astre visé.
        focus={focus}
        // Sélection d'un astre.
        onSelect={actions.selectFocus}
        // Aller à un lieu.
        onGoPlace={actions.pickPlace}
        // « Ma position ».
        myPosition={myPosition}
        // Familles affichées.
        kinds={camera.kinds}
        // Affichage d'une famille.
        onKind={camera.setKind}
        // Vitesse de rotation.
        rotateSpeed={camera.rotateSpeed}
        // Réglage de la vitesse.
        onRotateSpeed={camera.setRotateSpeed}
        // Rotation en cours ou non.
        rotating={camera.auto}
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
        // Atmosphères.
        atmospheres={camera.atmospheres}
        // Réglage des atmosphères.
        onAtmospheres={camera.setAtmospheres}
        // Relief.
        relief={camera.relief}
        // Réglage du relief.
        onRelief={camera.setRelief}
        // Lieux de la Lune.
        moonPlaces={moon.moonFeatures}
        // Réglage des lieux de la Lune.
        onMoonPlaces={moon.setMoonFeatures}
        // Réglages des calques de la Terre (début de l'objet).
        earthLayers={{
          // Noms des villes : toujours cochés s'ils sont inclus dans le fond.
          cityNames: earth.namesIncluded ? true : earth.cityNames,
          // Réglage des noms des villes.
          onCityNames: earth.setCityNames,
          // Texte d'aide des noms des villes.
          cityNamesHint: cityNamesHintText(earth.namesIncluded, cityInfo),
          // Case désactivée si les noms sont inclus dans le fond.
          cityNamesDisabled: earth.namesIncluded,
          // Noms des pays.
          countryNames: earth.countryNames,
          // Réglage des noms des pays.
          onCountryNames: earth.setCountryNames,
          // Contours : frontières ou littoraux affichés.
          outlines: earth.borders || earth.coasts,
          // Réglage des contours : frontières et littoraux ensemble.
          onOutlines: (on) => { earth.setBorders(on); earth.setCoasts(on); },
          // Texte d'aide des contours, « Chargement… » tant que les frontières manquent.
          outlinesHint: bordersInfo ? 'Frontières des pays, bord de mer, océans et Caspienne · Natural Earth 1:50m' : 'Chargement…',
          // Rues.
          streets: earth.streets,
          // Réglage des rues.
          onStreets: earth.setStreets,
          // Volcans en éruption.
          volcanoes: earth.volcanoes,
          // Réglage des volcans en éruption.
          onVolcanoes: earth.setVolcanoes,
          // Texte d'aide des volcans : leur nombre dès que la liste est arrivée.
          volcanoesHint: earth.volcanoCount === null ? 'En direct · NASA EONET' : `${earth.volcanoCount} en cours dans le monde · NASA EONET`,
          // Calque LiDAR HD choisi.
          lidarId: earth.lidarId,
          // Calques LiDAR HD proposés.
          lidarLayers: earth.lidarLayers,
          // Choix du calque LiDAR HD.
          onLidar: earth.setLidar,
          // Villes de France où le LiDAR HD est proposé.
          lidarCities: earth.lidarCities,
          // Altitude d'arrivée au-dessus d'une ville.
          lidarCityAltitudeM: earth.lidarCityAltitudeM,
          // Points LiDAR affichés ou non.
          lidarPoints: lidarPoints.on,
          // Lieux des dalles LiDAR.
          lidarPlaces: lidarPoints.places,
          // Réglage des points LiDAR.
          onLidarPoints: lidarPoints.setOn,
          // Mode de couleur des points LiDAR.
          lidarColor: lidarPoints.color,
          // Réglage du mode de couleur.
          onLidarColor: lidarPoints.setColor,
        // Fin de l'objet.
        }}
      // Fin de la fenêtre des paramètres.
      />
      {/* La galerie. */}
      <Galerie open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      {/* La boutique des exports payants. */}
      <Boutique open={storeOpen} onClose={() => setStoreOpen(false)} />
      {/* Le plateau tournant (début de la balise). */}
      <Plateau
        // Ouvert ou non.
        open={plateauOpen}
        // Fermeture.
        onClose={() => setPlateauOpen(false)}
        // Le moteur.
        engine={engine}
        // Identifiant de l'astre visé.
        bodyId={currentBodyId}
        // Nom de l'astre visé.
        bodyName={currentBodyName}
        // Fond de carte de l'astre visé (celui de la Terre à défaut), null s'il n'y en a pas.
        baseKey={bases.bases[currentBodyId || 'earth'] ?? null}
      // Fin du plateau tournant.
      />

      {/* Pendant le chargement, l'écran Artemis II (SolarSystem) couvre la scène ; ici, seulement l'échec du moteur. */}
      {/* Si le moteur n'existe pas et qu'il y a une erreur (début). */}
      {!engine && error && (
        // Message plein écran.
        <FullScreenMessage>
          {/* Le texte de l'erreur, en rouge. */}
          <Typography color="error">{error}</Typography>
        {/* Fin du message. */}
        </FullScreenMessage>
      // Fin du cas d'erreur.
      )}


      {/* Cadre blanc autour de la fenêtre, au-dessus de tout, sans bloquer les clics. */}
      {/* Le cadre blanc (début de la balise). */}
      <Box
        // Caché aux lecteurs d'écran.
        aria-hidden
        // Début du style.
        sx={{
          // Couvre la fenêtre, tout au-dessus, sans capter les clics.
          position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
          // Bordure blanche de 3 px, comprise dans la taille.
          border: '3px solid #fff', boxSizing: 'border-box',
        // Fin du style.
        }}
      // Fin du cadre.
      />
    {/* Fin du conteneur racine. */}
    </Box>
  // Fin du rendu.
  );
// Fin de SolarScene.
}
