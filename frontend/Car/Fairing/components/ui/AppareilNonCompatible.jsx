// Importe les liens vers les pages légales.
import { LiensLegaux } from './LiensLegaux.jsx';

/**
 * Mot d'excuse affiché à la place de l'app sur un téléphone en dessous de l'iPhone 15 ou de son équivalent
 * (voir moteur/lib/deviceGate.jsx). Le nom de l'app n'est jamais traduit.
 */
// Déclare et exporte le composant AppareilNonCompatible.
export function AppareilNonCompatible() {
  // Début du rendu.
  return (
    // Fond de l'écran (début de la balise).
    <main
      // Début du style.
      className="fixed inset-0 grid place-items-center p-6 bg-[#000] [background-image:radial-gradient(60%_50%_at_18%_12%,rgba(0,0,255,0.22),transparent_70%),radial-gradient(70%_60%_at_85%_100%,rgba(240,178,74,0.16),transparent_70%)]"
    // Fin de la balise ouvrante.
    >
      {/* Carte à contour au rôle d'alerte : largeur maximale de 420 px, texte centré, fond sombre translucide, texte clair. */}
      <div role="alert" className="g-paper g-paper-outlined max-w-105 p-6 text-center bg-[color:rgba(9,13,22,0.88)] text-[#e8edf8] border-[color:rgba(232,237,248,0.2)]">
        {/* Titre de niveau 1, jamais traduit, en gras. */}
        <h1 translate="no" className="t-h6 font-bold mb-4">
          {/* Le nom de l'application. */}
          Go白ناन्टех
        {/* Fin du titre. */}
        </h1>
        {/* Premier paragraphe. */}
        <p className="t-body1 mb-3">
          {/* Le mot d'excuse. */}
          Désolé pour la gêne occasionnée.
        {/* Fin du premier paragraphe. */}
        </p>
        {/* Deuxième paragraphe, en gris-bleu. */}
        <p className="t-body2 mb-3 text-[#8b97b3]">
          {/* Les téléphones acceptés (texte sur deux lignes). */}
          Sur téléphone, le site est accessible avec un iPhone 15 ou plus récent, un Samsung Galaxy équivalent ou plus
          récent, et les modèles équivalents des autres marques.
        {/* Fin du deuxième paragraphe. */}
        </p>
        {/* Troisième paragraphe, en gris-bleu. */}
        <p className="t-body2 text-[#8b97b3]">
          {/* La raison du refus et la solution proposée (texte sur deux lignes). */}
          Votre appareil n’est pas assez récent pour afficher le système solaire en 3D sans surchauffer. Vous pouvez
          ouvrir le site depuis un ordinateur ou un téléphone plus récent.
        {/* Fin du troisième paragraphe. */}
        </p>
        {/* Pages légales, accessibles même sans l'app. */}
        <LiensLegaux className="justify-center mt-4 text-[#8b97b3]" />
      {/* Fin de la carte. */}
      </div>
    {/* Fin du fond. */}
    </main>
  // Fin du rendu.
  );
// Fin de AppareilNonCompatible.
}
