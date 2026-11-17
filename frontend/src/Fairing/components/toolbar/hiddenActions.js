/**
 * Boutons masqués de la barre d'outils : les identifiants que `toolbarActions` retire de la liste.
 *
 * Ce module ne contient que cette donnée et n'importe rien : la fenêtre « Node » s'en sert pour ne pas citer le
 * dépôt d'une composante dont le bouton n'est plus affiché (hud/openSourceCredits), sans avoir à charger toute
 * la barre d'outils ni les icônes qu'elle dessine.
 */
// Ensemble des identifiants de boutons masqués : vide.
export const HIDDEN = new Set();
