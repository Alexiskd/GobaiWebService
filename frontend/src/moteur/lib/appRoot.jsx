/**
 * Racine React de l'application : elle est gardée ici pour pouvoir être démontée proprement.
 *
 * `createRoot` rend un objet qu'il faut conserver si l'on veut un jour effacer ce que React affiche dans le
 * DOM — c'est `root.unmount()` qui le fait, et lui seul : retirer les nœuds à la main laisserait React croire
 * qu'il les possède encore, et ses effets continueraient de tourner (minuteries, écouteurs, animations).
 *
 * Ce module minuscule existe pour éviter un cycle d'imports : `main.jsx` dépose la racine ici après l'avoir
 * créée, et `failover.jsx` demande le démontage avant de quitter la page, sans avoir à importer `main.jsx`.
 *
 * La séparation qui compte : l'élément `#root` n'appartient qu'à React. Le contenu de départ lu par les
 * moteurs de recherche vit à côté, dans `#seo`, et c'est ce module qui le retire une fois l'application
 * affichée. Les deux ne partagent donc jamais de parent, et personne ne réécrit les nœuds de l'autre.
 */

// La racine React, une fois créée ; null avant.
let appRoot = null;
// Démontage déjà demandé ? Un second appel ne doit rien faire.
let unmounted = false;

/** Dépose la racine créée par `main.jsx`. */
export function setAppRoot(root) {
  // Garde la racine.
  appRoot = root;
  // Un nouveau dépôt rouvre la possibilité de démonter.
  unmounted = false;
  // La racine, pour l'enchaînement.
  return root;
// Fin de setAppRoot.
}

/** La racine déposée, ou null. */
export const getAppRoot = () => appRoot;

/**
 * Retire le contenu de départ destiné aux moteurs de recherche.
 * Il a fait son travail dans le HTML servi : le garder dans la page ne sert plus qu'à être parcouru par le
 * traducteur et les lecteurs d'écran, qui liraient alors deux fois la même présentation.
 */
export function removeSeoShell(doc = globalThis.document) {
  // Le nœud, s'il est encore là.
  const shell = doc?.getElementById?.('seo');
  // Absent : rien à faire.
  if (!shell) return false;
  // Retiré de son parent.
  shell.remove();
  // Retrait fait.
  return true;
// Fin de removeSeoShell.
}

/**
 * Efface ce que React affiche dans le DOM : `root.unmount()`, une seule fois.
 * Renvoie vrai si le démontage a bien eu lieu.
 */
export function unmountApp() {
  // Aucune racine, ou démontage déjà fait : rien à faire.
  if (!appRoot || unmounted) return false;
  // Noté avant l'appel : même si React lève, on ne réessaie pas en boucle.
  unmounted = true;
  // Essaie le démontage.
  try {
    // React retire ses nœuds et arrête ses effets.
    appRoot.unmount();
    // Fait.
    return true;
  // React refuse (démontage pendant un rendu, par exemple) : on n'en fait pas une erreur de plus.
  } catch {
    // Non fait.
    return false;
  // Fin de l'essai.
  }
// Fin de unmountApp.
}
