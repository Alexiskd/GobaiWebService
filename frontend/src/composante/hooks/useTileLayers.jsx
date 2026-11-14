// Importe de React les crochets useEffect (effet après rendu) et useState (état).
import { useEffect, useState } from 'react';
// Importe tilesApi, le client de l'API des tuiles.
import { tilesApi } from '@/moteur/api';

/**
 * Couches de tuiles proposées par l'API (GET /tiles/layers).
 * status : 'loading' | 'ready' | 'error' — en cas d'erreur, la Terre et la Lune restent des sphères unies.
 */
// Déclare et exporte le crochet useTileLayers.
export function useTileLayers() {
  // État initial : chargement en cours, aucun fournisseur, pas de repli, pas de recherche de lieux, aucune couche, aucune erreur.
  const [state, setState] = useState({ status: 'loading', provider: null, fallback: false, placeSearch: false, layers: [], error: null });

  // Effet exécuté une seule fois, au montage du composant.
  useEffect(() => {
    // Crée un contrôleur d'annulation pour pouvoir interrompre la requête.
    const ctrl = new AbortController();
    // Demande la liste des couches à l'API, en passant le signal d'annulation.
    tilesApi.layers(ctrl.signal)
      // Réponse reçue : état « ready » avec le fournisseur, l'indicateur de repli, la recherche de lieux (convertie en booléen) et les couches.
      .then((r) => setState({ status: 'ready', provider: r.provider, fallback: r.fallback, placeSearch: Boolean(r.placeSearch), layers: r.layers, error: null }))
      // Échec : sauf annulation volontaire (AbortError), passe à l'état « error » avec le message de l'erreur.
      .catch((e) => { if (e.name !== 'AbortError') setState({ status: 'error', provider: null, fallback: false, placeSearch: false, layers: [], error: e.message }); });
    // Nettoyage au démontage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; tableau de dépendances vide : une seule exécution.
  }, []);

  // Renvoie l'état courant.
  return state;
// Fin de useTileLayers.
}
