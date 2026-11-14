// Importe de React les crochets useCallback, useEffect, useRef et useState.
import { useCallback, useEffect, useRef, useState } from 'react';
// Importe la liste des astres tuilés et leur table par identifiant.
import { TILED_BODIES, TILED_BODY_BY_ID } from '@/moteur/engine/tiledBodies';

/**
 * Fond par défaut au premier chargement des calques (modèle commun, voir engine/tiledBodies.jsx) : pour chaque planète
 * et chaque satellite, le premier fond de carte de sa liste, quel que soit son fournisseur (NASA Trek, USGS…).
 * Deux astres gardent leur réglage propre : la Terre (satellite HD : IGN en France, Sentinel-2 ailleurs)
 * et la Lune (composite « Lune réelle », voir chooseMoonBase).
 */
// Fonds par défaut propres à certains astres (début de l'objet).
const DEFAULT_BASE = {
  // Terre : le calque « earth-hd », sinon un fond hybride, sinon une imagerie.
  earth: (ls) => ls.find((l) => l.id === 'earth-hd') || ls.find((l) => l.kind === 'hybrid') || ls.find((l) => l.kind === 'imagery'),
// Fin de l'objet.
};

/** Calques LiDAR HD de l'IGN (ombrages des modèles de surface, de terrain et de hauteur), voir useEarthDisplay. */
// isLidarLayer : vrai pour un calque superposé dont l'identifiant commence par « lidar-hd- ».
export const isLidarLayer = (l) => l.kind === 'overlay' && l.id.startsWith('lidar-hd-');

// isOwnLayer : fabrique le test « ce calque appartient à cet astre » (pour la Terre : astre absent ou « earth »).
const isOwnLayer = (id) => (l) => (id === 'earth' ? !l.body || l.body === 'earth' : l.body === id);

/**
 * Fonds possibles d'un astre, du préféré au dernier recours : son fond par défaut (ci-dessus) s'il en a un, puis ses
 * fonds dans l'ordre de la liste — le premier est donc celui affiché par défaut. Si un fond ne répond pas, le suivant
 * prend le relais : tant que le fournisseur en propose un, l'astre a toujours un fond.
 */
// Déclare et exporte baseCandidates : identifiant de l'astre et liste des calques.
export function baseCandidates(id, layers = []) {
  // Les fonds de l'astre : ses calques, sans les calques superposés.
  const own = layers.filter(isOwnLayer(id)).filter((l) => l.kind !== 'overlay');
  // Son fond préféré, s'il a une règle par défaut.
  const preferred = DEFAULT_BASE[id]?.(own);
  // Le préféré puis les autres, sans doublon ni valeur vide.
  return [...new Set([preferred, ...own].filter(Boolean))];
// Fin de baseCandidates.
}

/**
 * Fond de carte par astre, avec une seule logique pour tous : choix, erreur affichée, et une requête plus récente
 * qui rend obsolète le résultat d'une requête précédente (par astre).
 * Renvoie l'API générique (bases, chooseBodyBase) et les noms historiques utilisés par les menus.
 */
// Déclare et exporte le crochet useTileBases : moteur, sa référence, statut, calques classés, tous les calques, messages et état Trek.
export function useTileBases({ engine, engineRef, status, layers, allLayers = [], push, trekStatus = [] }) {
  // Extrait les calques de la Terre et ceux de la Lune réelle.
  const { earthLayers, moonDetailLayer, moonShadeLayer, moonRealAvailable } = layers;
  // État : le fond choisi pour chaque astre.
  const [bases, setBases] = useState({}); // id de l'astre → id de la couche choisie (ou 'real' pour la Lune)
  // Référence : numéro de la dernière demande, par astre.
  const requests = useRef({});
  // Référence : vrai une fois les fonds par défaut posés.
  const autoChosen = useRef(false);
  // Référence : la liste courante de tous les calques.
  const allLayersRef = useRef(allLayers);
  // Mise à jour à chaque rendu.
  allLayersRef.current = allLayers;

  /** Lance une demande pour un astre : renvoie une fonction qui dit si elle est toujours la plus récente. */
  // Déclare begin : identifiant de l'astre et valeur demandée.
  const begin = (id, value) => {
    // Numéro de cette demande : le précédent plus un.
    const n = (requests.current[id] || 0) + 1;
    // Mémorise ce numéro.
    requests.current[id] = n;
    // Enregistre tout de suite le choix dans l'état.
    setBases((b) => ({ ...b, [id]: value }));
    // Renvoie le test « cette demande est-elle toujours la plus récente ? ».
    return () => requests.current[id] === n;
  // Fin de begin.
  };
  // Déclare fail : signale l'échec du fond d'un astre.
  const fail = (id, err) => {
    // Efface le choix de cet astre.
    setBases((b) => ({ ...b, [id]: null }));
    // Affiche l'erreur pendant 9 secondes, avec le nom de la carte de l'astre (son identifiant à défaut).
    push(`${TILED_BODY_BY_ID[id]?.mapLabel || id} indisponible : ${err.message}.`, 'error', 9000);
  // Fin de fail.
  };

  /**
   * Pose le fond par défaut d'un astre : essaie ses fonds possibles l'un après l'autre jusqu'à ce qu'un s'affiche
   * (`skip` : celui qui vient d'échouer). Un astre ne reste sans fond que si aucune de ses cartes ne répond.
   */
  // applyDefaultBase : pose le fond par défaut d'un astre ; début de la fonction asynchrone mémorisée.
  const applyDefaultBase = useCallback(async (id, skip = null) => {
    // Récupère le moteur.
    const e = engineRef.current;
    // Sans moteur, échec.
    if (!e) return false;
    // Dernière erreur rencontrée.
    let lastError = null;
    // Parcourt les fonds possibles de l'astre, du préféré au dernier recours.
    for (const layer of baseCandidates(id, allLayersRef.current)) {
      // Saute celui qui vient d'échouer.
      if (layer.id === skip) continue;
      // Ouvre une demande pour ce fond.
      const current = begin(id, layer.id);
      // Début du bloc protégé.
      try {
        // Demande au moteur d'afficher ce fond et attend.
        await e.setBodyTileBase(id, layer.id);
        // Réussite : on s'arrête là.
        return true;
      // En cas d'échec.
      } catch (err) {
        // Si une demande plus récente existe, on abandonne.
        if (!current()) return false; // un choix plus récent a pris la main
        // Garde l'erreur et essaie le fond suivant.
        lastError = err;
      // Fin du bloc try/catch.
      }
    // Fin du parcours.
    }
    // Pose automatique (lancement, repli) : aucun message, l'astre garde sa sphère unie. Seul un fond choisi à la
    // main par l'utilisateur signale son échec (chooseBodyBase, chooseMoonBase).
    // Si tous les fonds ont échoué, efface le choix de cet astre.
    if (lastError) setBases((b) => ({ ...b, [id]: null }));
    // Aucun fond posé.
    return false;
  // Fin de applyDefaultBase ; dépendance déclarée : push.
  }, [push]);

  // chooseBodyBase : pose le fond choisi par l'utilisateur ; début de la fonction asynchrone mémorisée.
  const chooseBodyBase = useCallback(async (id, layerId) => {
    // Récupère le moteur.
    const e = engineRef.current;
    // Sans moteur, rien à faire.
    if (!e) return;
    // Ouvre une demande pour ce fond.
    const current = begin(id, layerId);
    // Début du bloc protégé.
    try {
      // Demande au moteur d'afficher ce fond et attend.
      await e.setBodyTileBase(id, layerId);
    // En cas d'échec.
    } catch (err) {
      // Si une demande plus récente existe, on abandonne.
      if (!current()) return;
      // Le fond choisi ne répond pas : on le signale et on revient à un fond qui marche, jamais à un astre nu.
      // Signale l'échec.
      fail(id, err);
      // Revient à un fond par défaut, en sautant celui qui a échoué.
      applyDefaultBase(id, layerId);
    // Fin du bloc try/catch.
    }
  // Fin de chooseBodyBase ; dépendances : push et applyDefaultBase.
  }, [push, applyDefaultBase]);

  // Lune : « réelle » = composite (couleurs naturelles + détail Kaguya + relief LOLA), sinon une couche simple.
  // chooseMoonBase : pose le fond de la Lune ; début de la fonction asynchrone mémorisée.
  const chooseMoonBase = useCallback(async (id) => {
    // Récupère le moteur.
    const e = engineRef.current;
    // Sans moteur, rien à faire.
    if (!e) return;
    // Ouvre une demande pour la Lune.
    const current = begin('moon', id);
    // Vrai si l'on demande la « Lune réelle ».
    const real = id === 'real';
    // Début du bloc protégé.
    try {
      // Active ou coupe le composite ; l'option pan seulement en Lune réelle avec le calque de détail.
      e.setBodyComposite('moon', real, { pan: real && Boolean(moonDetailLayer) });
      // Attend deux opérations en parallèle (début).
      await Promise.all([
        // Le fond : en Lune réelle, le calque de détail (sinon celui d'ombrage) ; sinon le calque demandé.
        e.setBodyTileBase('moon', real ? (moonDetailLayer || moonShadeLayer).id : id),
        // Aucun calque superposé sur la Lune.
        e.setBodyTileOverlay('moon', null),
      // Fin des deux opérations.
      ]);
    // En cas d'échec.
    } catch (err) {
      // Si une demande plus récente existe, on abandonne.
      if (!current()) return;
      // Signale l'échec.
      fail('moon', err);
      // Retour à une carte simple de la Lune plutôt qu'à un astre nu.
      // Coupe le composite.
      e.setBodyComposite('moon', false, { pan: false });
      // Revient à un fond par défaut, en sautant celui qui a échoué.
      applyDefaultBase('moon', real ? (moonDetailLayer || moonShadeLayer)?.id : id);
    // Fin du bloc try/catch.
    }
  // Fin de chooseMoonBase ; dépendances : push, les deux calques lunaires et applyDefaultBase.
  }, [push, moonShadeLayer, moonDetailLayer, applyDefaultBase]);

  // chooseBase : le fond de la Terre.
  const chooseBase = useCallback((id) => chooseBodyBase('earth', id), [chooseBodyBase]);
  // chooseMarsBase : le fond de Mars.
  const chooseMarsBase = useCallback((id) => chooseBodyBase('mars', id), [chooseBodyBase]);
  // chooseMercuryBase : le fond de Mercure.
  const chooseMercuryBase = useCallback((id) => chooseBodyBase('mercury', id), [chooseBodyBase]);
  // chooseVenusBase : le fond de Vénus.
  const chooseVenusBase = useCallback((id) => chooseBodyBase('venus', id), [chooseBodyBase]);

  // Effet qui pose les fonds par défaut, une seule fois.
  useEffect(() => {
    // Il faut un moteur, des calques prêts, et que ce ne soit pas déjà fait.
    if (!engine || status !== 'ready' || autoChosen.current) return;
    // Note que c'est fait.
    autoChosen.current = true;
    // Chaque planète et chaque satellite reçoit dès le départ le premier fond de carte de sa liste, sans condition
    // sur son fournisseur. Lune : le composite « Lune réelle » quand ses calques sont là, sinon sa première carte.
    // Parcourt les astres tuilés.
    for (const cfg of TILED_BODIES) {
      // Lune : le composite « Lune réelle », s'il est disponible.
      if (cfg.id === 'moon' && moonRealAvailable) chooseMoonBase('real');
      // Sinon : le fond par défaut de l'astre.
      else applyDefaultBase(cfg.id);
    // Fin du parcours.
    }
  // Fin de l'effet ; dépendances : le moteur, le statut, la disponibilité de la Lune réelle, les calques et les deux fonctions.
  }, [engine, status, moonRealAvailable, allLayers, applyDefaultBase, chooseMoonBase]);

  // Début de l'objet renvoyé.
  return {
    // Les fonds choisis et la fonction générique.
    bases, chooseBodyBase,
    // Les fonds de la Terre, de la Lune et de Mars, null s'ils manquent.
    baseId: bases.earth ?? null, moonBaseId: bases.moon ?? null, marsBaseId: bases.mars ?? null,
    // Les fonds de Mercure et de Vénus.
    mercuryBaseId: bases.mercury ?? null, venusBaseId: bases.venus ?? null,
    // Les fonctions de choix par astre.
    chooseBase, chooseMoonBase, chooseMarsBase, chooseMercuryBase, chooseVenusBase,
    // Le calque du fond de la Terre, null s'il n'existe pas.
    baseLayer: earthLayers.find((l) => l.id === bases.earth) || null,
    // Calque des routes et des noms ; les calques LiDAR HD (France) ont leur propre interrupteur.
    // Le premier calque superposé de la Terre qui n'est pas un LiDAR HD, null s'il n'y en a pas.
    overlayLayer: earthLayers.find((l) => l.kind === 'overlay' && !isLidarLayer(l)) || null,
    // Les calques LiDAR HD de la Terre.
    lidarLayers: earthLayers.filter(isLidarLayer),
  // Fin de l'objet renvoyé.
  };
// Fin de useTileBases.
}
