import { useState } from 'react';

/**
 * Le système solaire est calculé localement : aucun polling JPL, fetch ou proxy.
 * Le hook conserve l'API attendue par SolarScene pour ne pas modifier le HUD des phases.
 */
export function useMoonFeeds() {
  const [moonPhases] = useState(null);
  return { moonPhases };
}
