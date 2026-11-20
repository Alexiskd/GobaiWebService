// Rappel des dons : ouvre la fenêtre « Dons » à l'ouverture de l'application, puis toutes les deux minutes.
import { useEffect, useRef, useState } from 'react';
import { DonationPromptClock } from './donationPrompt.js';

/**
 * `ready` : la scène est prête ; `panel` : la fenêtre ouverte (null : aucune) ; `openDonate` : ouvre la fenêtre des
 * dons. Voir donationPrompt.js pour les règles (pause pendant les autres fenêtres et quand l'onglet est caché).
 */
export function useDonationPrompt({ ready, panel, openDonate }) {
  const clock = useRef(null);
  const open = useRef(openDonate);
  open.current = openDonate;
  // L'onglet visible ou non, suivi pour mettre le compte à rebours en pause.
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const now = performance.now();
    clock.current ||= new DonationPromptClock(now);
    const delay = clock.current.update(now, { paused: hidden || Boolean(panel), donateOpen: panel === 'donate' });
    if (delay === null) return undefined;
    const timer = setTimeout(() => {
      if (clock.current.due(performance.now())) open.current?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [ready, panel, hidden]);
}
