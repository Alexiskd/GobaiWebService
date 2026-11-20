// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe les chargements des frontières et des villes.
import { fetchBorders, fetchCityLabels } from '@/Computing/api';

/** Noms des villes et frontières (Natural Earth), avec leur attribution. */
// Déclare et exporte le crochet useMapFeeds : reçoit le moteur et la fonction de messages.
export function useMapFeeds({ engine, push }) {
  // État : informations sur les villes (attribution et nombre).
  const [cityInfo, setCityInfo] = useState(null);
  // État : la liste des villes.
  const [worldCities, setWorldCities] = useState([]); // ≈ 7 300 villes Natural Earth, aussi pour la recherche
  // État : informations sur les frontières (attribution).
  const [bordersInfo, setBordersInfo] = useState(null);

  // Effet qui charge les villes.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Charge les noms des villes.
    fetchCityLabels(ctrl.signal)
      // Réussite : donne les villes au moteur, les garde pour la recherche et note l'attribution et le nombre.
      .then((r) => { engine.setCityLabels(r.items); setWorldCities(r.items || []); setCityInfo({ attribution: r.attribution, count: r.count }); })
      // Un échec est ignoré.
      .catch(() => {}); // chargement automatique : échec silencieux
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendances : le moteur et push.
  }, [engine, push]);

  // Effet qui charge les frontières.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Charge les frontières.
    fetchBorders(ctrl.signal)
      // Réussite : les donne au moteur et note l'attribution.
      .then((r) => { engine.setBorders(r); setBordersInfo({ attribution: r.attribution }); })
      // Un échec est ignoré.
      .catch(() => {}); // chargement automatique : échec silencieux
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendances : le moteur et push.
  }, [engine, push]);

  // Renvoie les informations sur les villes et les frontières, et la liste des villes.
  return { cityInfo, bordersInfo, worldCities };
// Fin de useMapFeeds.
}
