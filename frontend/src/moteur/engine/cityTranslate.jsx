// Importe le nettoyage d'une traduction, le choix des traductions retenues et la liste des textes à traduire.
import { cleanTranslation, pickTranslations, translationTargets } from './cityTranslateMath';

// Adresse de l'API de traduction MyMemory.
const ENDPOINT = 'https://api.mymemory.translated.net/get';
// Délai d'abandon d'une requête : huit secondes.
const TIMEOUT_MS = 8000;
// Durée de validité d'une traduction : un jour.
const FRESH_MS = 24 * 60 * 60 * 1000; // une traduction ne change pas : gardée pour la session
// Délai avant une nouvelle tentative après un échec : dix minutes.
const RETRY_MS = 10 * 60 * 1000;       // échec : pas de nouvelle tentative avant dix minutes

// Cache des traductions, par langue et texte.
const cache = new Map();   // « langue|texte » → { at, text }
// Requêtes en cours, par langue et texte.
const pending = new Map(); // requêtes en cours, partagées entre villes voisines

// Déclare request : traduit un texte d'une langue source vers le français.
async function request(text, source) {
  // Le couple de langues demandé.
  const langpair = `${source}|fr`;
  // L'adresse de la requête, avec le texte et le couple de langues encodés.
  const url = `${ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  // Crée un contrôleur d'annulation.
  const ctrl = new AbortController();
  // Annule la requête après le délai d'abandon.
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  // Début du bloc protégé.
  try {
    // Lance la requête, en demandant du JSON.
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    // Réponse en erreur : rien.
    if (!res.ok) return null;
    // Lit la réponse et nettoie la traduction.
    return cleanTranslation(await res.json(), text);
  // En cas d'échec.
  } catch {
    // Rien.
    return null;
  // Dans tous les cas.
  } finally {
    // Annule le délai d'abandon.
    clearTimeout(timer);
  // Fin du bloc.
  }
// Fin de request.
}

// Déclare translateText : traduit un texte, avec cache.
function translateText(text, source) {
  // La clé du cache.
  const key = `${source}|${text}`;
  // L'entrée du cache, s'il y en a une.
  const hit = cache.get(key);
  // Entrée encore valable (traduction fraîche, ou échec récent) : sa valeur.
  if (hit && Date.now() - hit.at < (hit.text ? FRESH_MS : RETRY_MS)) return Promise.resolve(hit.text);
  // Requête déjà en cours : la même promesse.
  if (pending.has(key)) return pending.get(key);
  // Sinon, lance la requête ; à la réponse (début).
  const promise = request(text, source).then((translated) => {
    // Range la traduction dans le cache, avec sa date.
    cache.set(key, { at: Date.now(), text: translated });
    // Retire la requête des requêtes en cours.
    pending.delete(key);
    // Renvoie la traduction.
    return translated;
  // Fin du traitement de la réponse.
  });
  // Note la requête comme en cours.
  pending.set(key, promise);
  // Renvoie la promesse.
  return promise;
// Fin de translateText.
}

/**
 * Traduction française du nom local et de la région d'une ville (MyMemory), pour sa fiche au survol seulement.
 * `null` quand la fiche n'a rien à traduire ou que le service est indisponible.
 */
// Déclare et exporte translateCity : reçoit une ville.
export async function translateCity(city) {
  // Les textes à traduire pour cette ville.
  const targets = translationTargets(city);
  // Rien à traduire : null.
  if (!targets.length) return null;
  // Traduit tous les textes en parallèle.
  const values = await Promise.all(targets.map((t) => translateText(t.text, t.source)));
  // Résultats, par champ.
  const results = {};
  // Pour chaque texte.
  targets.forEach((t, i) => {
    // Si sa traduction existe, la range sous son champ.
    if (values[i]) results[t.field] = values[i];
  // Fin du parcours.
  });
  // Choisit les traductions à retenir.
  const picked = pickTranslations(city, results);
  // S'il y en a : les renvoie, avec le nom du service ; sinon null.
  return picked ? { ...picked, engine: 'MyMemory' } : null;
// Fin de translateCity.
}
