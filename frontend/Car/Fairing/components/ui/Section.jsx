
/** Section d'un panneau : titre court en capitales (overline) puis contenu. */
// Déclare et exporte le composant Section : reçoit un titre et un contenu.
export function Section({ title, children }) {
  // Début du rendu.
  return (
    // Conteneur rendu en balise section, avec une marge en bas.
    <section className="mb-4">
      {/* Si un titre est donné : titre de niveau 3 au style overline, couleur secondaire, sur sa propre ligne. */}
      {title && <h3 className="t-overline text-soft block leading-[2.2]">{title}</h3>}
      {/* Le contenu de la section. */}
      {children}
    {/* Fin du conteneur. */}
    </section>
  // Fin du rendu.
  );
// Fin de Section.
}
