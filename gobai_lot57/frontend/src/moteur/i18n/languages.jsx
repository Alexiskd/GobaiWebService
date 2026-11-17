// Fonctions qui indexent les langues et mettent en forme une langue.
import { indexLanguages, languageEntry } from './i18nMath';

/** ISO 639-3 (~7 900 langues), langues par pays et écritures (CLDR), voir scripts/build-languages.mjs. */
// Adresse du référentiel des langues.
export const LANGUAGES_URL = '/data/languages.json';

// Chargement en cours : aucun au départ.
let pending = null;

/** Charge le référentiel une seule fois (chargé à la demande : ~350 Ko). */
// Fonction loadLanguageData.
export function loadLanguageData() {
  // Au premier appel :
  if (!pending) {
    // télécharge le référentiel ;
    pending = fetch(LANGUAGES_URL)
      // lit le JSON, ou rejette avec le code HTTP ;
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      // puis :
      .then((raw) => {
        // index des langues par code à trois lettres et par code court ;
        const { byCode3, byShort } = indexLanguages(raw);
        // rend
        return {
          // les données brutes ;
          raw,
          // l'index par code à trois lettres ;
          byCode3,
          // l'index par code court ;
          byShort,
          // la liste des langues mises en forme ;
          entries: raw.languages.map(languageEntry),
          // les pays ;
          countries: raw.countries,
          // l'index des pays par code ;
          countryByCode: new Map(raw.countries.map((c) => [c[0], c])),
          // les écritures.
          scripts: raw.scripts,
        // Fin de l'objet.
        };
      // Fin du traitement.
      })
      // En cas d'échec : oublie le chargement et relance l'erreur.
      .catch((e) => { pending = null; throw e; });
  // Fin du cas.
  }
  // Renvoie la promesse.
  return pending;
// Fin de loadLanguageData.
}
