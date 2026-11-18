// Rechargement automatique après un redéploiement : le serveur donne l'identifiant de sa version (GET /api/health,
// champ `build` = commit déployé sur Render). La page retient celui reçu à son ouverture, le relit régulièrement tant
// qu'elle est visible, et se recharge quand il a changé. Sans identifiant (développement), rien n'est rechargé.

// Délai entre deux lectures : une minute.
export const BUILD_CHECK_MS = 60 * 1000;   // une lecture par minute, page visible
// Délai avant la lecture de confirmation : 4 secondes.
export const BUILD_CONFIRM_MS = 4 * 1000;  // seconde lecture avant de recharger (bascule entre deux instances)

/** Identifiant de version lisible dans une réponse de /health, ou '' s'il manque. */
// Fonction buildOf : le champ « build » d'une réponse, sans espaces, ou un texte vide.
export const buildOf = (health) => (typeof health?.build === 'string' ? health.build.trim() : '');

/** Vrai si la version du serveur a changé depuis l'ouverture de la page (les deux identifiants doivent être connus). */
// Fonction buildChanged : vrai si les deux versions sont connues et différentes.
export const buildChanged = (opened, current) => Boolean(opened) && Boolean(current) && opened !== current;

/**
 * Surveille la version du serveur. `fetchBuild()` renvoie l'identifiant (ou '' / une erreur : ignoré), `reload()`
 * recharge la page. Renvoie la fonction d'arrêt. `timers` et `visible` sont remplaçables pour les tests.
 */
// Fonction watchBuild ; ses réglages : la lecture, le rechargement, les deux délais,
export function watchBuild({ fetchBuild, reload, everyMs = BUILD_CHECK_MS, confirmMs = BUILD_CONFIRM_MS,
  // les minuteries, et le test « la page est-elle visible ? ».
  timers = globalThis, visible = () => globalThis.document?.visibilityState !== 'hidden' }) {
  // Version à l'ouverture, arrêt, lecture en cours, minuterie de confirmation.
  let opened = '', stopped = false, busy = false, confirmTimer = null;
  // Fonction read : lit la version ; un échec donne un texte vide.
  const read = async () => { try { return await fetchBuild(); } catch { return ''; } };
  // Fonction check : une vérification.
  const check = async () => {
    // Rien si c'est arrêté, déjà en cours, ou si la page est cachée.
    if (stopped || busy || !visible()) return;
    // Marque la vérification en cours.
    busy = true;
    // Essaie :
    try {
      // lit la version ;
      const current = await read();
      // arrêt ou version inconnue : rien ;
      if (stopped || !current) return;
      // première version lue : la retient ;
      if (!opened) { opened = current; return; }
      // version inchangée : rien.
      if (!buildChanged(opened, current)) return;
      // Version différente : on la relit un peu plus tard, et on ne recharge que si elle est confirmée.
      // Attend le délai de confirmation.
      await new Promise((resolve) => { confirmTimer = timers.setTimeout(resolve, confirmMs); });
      // Arrêté entre-temps : rien.
      if (stopped) return;
      // Relit : si c'est la même nouvelle version, arrête la surveillance et recharge la page.
      if ((await read()) === current && !stopped) { stopped = true; reload(); }
    // Dans tous les cas, la vérification n'est plus en cours.
    } finally { busy = false; }
  // Fin de check.
  };
  // Première vérification, tout de suite.
  check();
  // Puis une par minute.
  const interval = timers.setInterval(check, everyMs);
  // Renvoie la vérification et la fonction d'arrêt, qui arrête les minuteries.
  return { check, stop: () => { stopped = true; timers.clearInterval(interval); if (confirmTimer) timers.clearTimeout(confirmTimer); } };
// Fin de watchBuild.
}
