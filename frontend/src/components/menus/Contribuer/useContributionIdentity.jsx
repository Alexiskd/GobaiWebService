import { useEffect, useState } from 'react';
import { getIdentity, getSavedPseudonym, MAX_PSEUDONYM_LENGTH, savePseudonym } from '@/contributions/store';

// Identité de signature locale et pseudo, conservés dans le navigateur.
export function useContributionIdentity({ setError }) {
  const [identity, setIdentity] = useState(null);
  const [pseudonym, setPseudonym] = useState('');

  useEffect(() => {
    let active = true;
    getIdentity().then((value) => { if (active) setIdentity(value); }).catch((reason) => {
      if (active) setError(`Initialisation de la signature locale impossible : ${reason.message}`);
    });
    try {
      setPseudonym(getSavedPseudonym());
    } catch (reason) {
      setError(`Impossible de charger le pseudo : ${reason.message}`);
    }
    return () => { active = false; };
  }, [setError]);

  const updatePseudonym = (value) => {
    const boundedValue = value.slice(0, MAX_PSEUDONYM_LENGTH);
    setPseudonym(boundedValue);
    try {
      savePseudonym(boundedValue);
    } catch (reason) {
      setError(`Impossible d’enregistrer le pseudo : ${reason.message}`);
    }
  };

  return { identity, pseudonym, updatePseudonym };
}
