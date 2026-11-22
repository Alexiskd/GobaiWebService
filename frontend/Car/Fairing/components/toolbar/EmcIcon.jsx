
/** Silhouette du bouton de l'affichage relativiste (image fournie, fond retiré, dans le dossier public). */
const EMC_IMAGE = '/data/images/einstein.png';

/**
 * Icône du bouton de l'affichage relativiste (anciennement « E = mc² ») : le profil d'Einstein, sans texte.
 *
 * Le PNG sert de masque : la silhouette prend la couleur du bouton (`currentColor`), comme les icônes du kit — claire
 * en mode nuit, sombre en mode jour, inversée quand le bouton est enfoncé. C'est un composant, comme les icônes
 * du kit : iconNode l'instancie avec `style.fontSize`, la taille demandée, et l'image est un carré de cette taille.
 */
export function EmcIcon({ style }) {
  const size = Number(style?.fontSize) || 18;
  const mask = `url(${EMC_IMAGE}) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className="block flex-none bg-current" style={{ width: size, height: size, WebkitMask: mask, mask }}
    />
  );
}
