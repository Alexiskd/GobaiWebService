// Fonction booléenne NASA JPL / Trek de chaque astre, affichée dans la console du navigateur. Fonctions pures.

/**
 * Astres absents du test du serveur (GET /tiles/bodies/availability) :
 *  - Soleil : code JPL Horizons 10, pas de carte NASA Trek ;
 *  - Lune : code JPL Horizons 301, cartes NASA Moon Trek.
 */
// Valeurs fixes du Soleil (JPL seulement) et de la Lune (Trek et JPL).
const FIXED = { sun: { trek: false, jpl: true }, moon: { trek: true, jpl: true } };

/**
 * Une ligne par astre de la navigation : { astre, trek, jpl, affiche }.
 *  - `trek` : l'astre a une carte NASA Trek (test du serveur sur l'API Trek) ;
 *  - `jpl` : l'astre a un code JPL Horizons dans la table du serveur (l'API JPL n'est plus interrogée : les orbites
 *    sont calculées par Kepler) ;
 *  - `affiche` : l'astre est affiché par défaut (coché dans Paramètres).
 * @param bodies        astres de la navigation : { index, id?, name }
 * @param availability  lignes du test du serveur : [{ id, trek, jpl }]
 * @param hidden        indices des astres décochés par défaut (tableau ou Set)
 */
// Déclare et exporte bodyBooleans : les astres, les disponibilités et les astres décochés.
export function bodyBooleans(bodies = [], availability = [], hidden = []) {
  // Table des disponibilités par identifiant (les lignes sans identifiant sont ignorées).
  const rows = new Map((availability || []).filter((r) => r?.id).map((r) => [r.id, r]));
  // Ensemble des indices décochés.
  const off = new Set(hidden);
  // Pour chaque astre.
  return bodies.map((b) => {
    // Sa ligne : valeur fixe (Soleil ou Lune), sinon disponibilité du serveur, sinon vide.
    const row = FIXED[b.index === 0 ? 'sun' : b.id] || rows.get(b.id) || {};
    // Renvoie son nom, ses deux booléens (vrais seulement s'ils valent exactement true) et son affichage.
    return { astre: b.name, trek: row.trek === true, jpl: row.jpl === true, affiche: !off.has(b.index) };
  // Fin du parcours.
  });
// Fin de bodyBooleans.
}

/** Affiche le tableau dans la console (une seule fois, à l'ouverture de l'application). */
// Déclare et exporte logBodyBooleans : reçoit les lignes.
export function logBodyBooleans(rows) {
  // Affiche un tableau dans la console : une ligne par astre, trois colonnes (règle ESLint désactivée par la ligne suivante).
  // eslint-disable-next-line no-console
  console.table(Object.fromEntries(rows.map(({ astre, trek, jpl, affiche }) => [astre, { 'NASA Trek': trek, 'NASA JPL': jpl, 'Affiché': affiche }])));
// Fin de logBodyBooleans.
}
