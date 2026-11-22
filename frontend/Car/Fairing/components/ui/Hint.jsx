
// Déclare et exporte le composant Hint : une note d'aide, dont le contenu est passé en enfants.
export function Hint({ children }) {
  // Rend le contenu en petit texte de couleur secondaire, avec une marge verticale et un léger retrait horizontal.
  return <p className="t-body2 text-soft my-2 px-1">{children}</p>;
// Fin de Hint.
}
