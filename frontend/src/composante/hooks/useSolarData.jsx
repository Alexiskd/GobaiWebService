// Importe de React les crochets useCallback, useEffect et useState.
import { useCallback, useEffect, useState } from 'react';
// Importe fetchSceneData, qui charge les données de la scène depuis l'API.
import { fetchSceneData } from '@/moteur/api';

/** Charge les données de la scène depuis l'API. status : 'loading' | 'ready' | 'error'. */
// Déclare et exporte le crochet useSolarData.
export function useSolarData() {
  // État : statut « loading » au départ, pas de données, pas d'erreur.
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  // État : numéro de la tentative, incrémenté pour relancer le chargement.
  const [attempt, setAttempt] = useState(0);

  // Effet relancé à chaque nouvelle tentative.
  useEffect(() => {
    // Crée un contrôleur d'annulation pour pouvoir interrompre la requête.
    const ctrl = new AbortController();
    // Remet l'état à « chargement » (utile lors d'une nouvelle tentative).
    setState({ status: 'loading', data: null, error: null });
    // Lance le chargement des données de la scène, avec le signal d'annulation.
    fetchSceneData(ctrl.signal)
      // Réussite : état « ready » avec les données reçues.
      .then((data) => setState({ status: 'ready', data, error: null }))
      // Échec : début du traitement de l'erreur.
      .catch((e) => {
        // Sauf annulation volontaire (AbortError), passe à l'état « error » avec le message de l'erreur.
        if (e.name !== 'AbortError') setState({ status: 'error', data: null, error: e.message });
      // Fin du traitement de l'erreur.
      });
    // Nettoyage : annule la requête si le composant est démonté ou si une nouvelle tentative démarre.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendance : le numéro de tentative.
  }, [attempt]);

  // retry : incrémente le numéro de tentative, ce qui relance l'effet ; fonction stable.
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Renvoie l'état (statut, données, erreur) et la fonction de nouvelle tentative.
  return { ...state, retry };
// Fin de useSolarData.
}
