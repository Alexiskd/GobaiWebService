
/** Groupe de réglages : titre puis lignes de même hauteur séparées par un filet, dans une carte à contour. */
// Déclare et exporte le composant Group : reçoit un titre et des lignes de réglages.
export function Group({ title, children }) {
  // Début du rendu.
  return (
    // Conteneur au rôle de groupe, nommé par le titre pour les lecteurs d'écran, avec une marge en bas.
    <div role="group" aria-label={title} className="mb-4">
      {/* Le titre, au style overline, couleur secondaire, sur sa propre ligne. */}
      <span className="t-overline text-soft block leading-[2.2]">{title}</span>
      {/* Carte à contour, fond transparent, sans flou d'arrière-plan ; ce qui dépasse est masqué. */}
      <div className="g-paper g-paper-outlined bg-transparent overflow-hidden">
        {/* Pile verticale des lignes, séparées par un filet. */}
        <div className="flex flex-col divide-y divide-line">{children}</div>
      {/* Fin de la carte. */}
      </div>
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de Group.
}
