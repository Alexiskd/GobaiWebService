// Importe useEffect et useState de React.
import { useEffect, useState } from 'react';
// Importe la route des prochaines phases de la Lune (USNO, relayée par le serveur).
import { fetchMoonPhases } from '@/Computing/api/scene';

/**
 * Phases de la Lune lues sur le serveur, rafraîchies toutes les 6 heures.
 * Les positions de la Lune et des satellites restent calculées dans le navigateur (moteur Kepler de l'édition statique) :
 * ce hook ne pose donc plus d'éphémérides dans le moteur. Sans serveur, la liste reste vide et rien ne s'affiche.
 */
export function useMoonFeeds() {
  // Les phases : null tant que rien n'est reçu.
  const [moonPhases, setMoonPhases] = useState(null);
  useEffect(() => {
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonPhases(ctrl.signal)
        // Le repli statique rend une liste vide : on garde alors null (aucune phase à montrer).
        .then((r) => { if (r?.items?.length) setMoonPhases(r); })
        .catch(() => {}); // rafraîchissement automatique : échec silencieux
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, []);
  return { moonPhases };
}
