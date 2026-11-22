// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Skeleton } from '@/Fairing/kit';

/**
 * Squelette de chargement d'une liste de fonds de carte : la silhouette des lignes à venir (pastille, nom,
 * description) à la place d'un texte « Chargement… ». La liste arrive ensuite à la même place, sans saut de mise en page.
 */
// Déclare et exporte le composant LayerSkeleton : nombre de lignes (3 par défaut) et libellé d'accessibilité.
export function LayerSkeleton({ rows = 3, label = 'Chargement des fonds de carte' }) {
  // Début du rendu.
  return (
    // Conteneur au rôle d'état, nommé par le libellé et signalé « occupé » aux lecteurs d'écran.
    <div role="status" aria-label={label} aria-busy="true">
      {/* Crée autant de lignes que demandé (i : numéro de la ligne). */}
      {Array.from({ length: rows }, (_, i) => (
        // Une ligne : pastille et textes côte à côte, alignés en haut, avec les marges d'une vraie ligne.
        <div key={i} className="flex items-start gap-3 px-3 py-2.5">
          {/* Pastille ronde de 18 px, qui ne se déforme pas, légèrement descendue. */}
          <Skeleton variant="circular" width={18} height={18} className="flex-none mt-0.5" />
          {/* Colonne des textes, qui prend la largeur restante. */}
          <div className="flex-1 min-w-0">
            {/* Faux nom : largeur de 62 %, réduite de 9 points à chaque ligne. */}
            <Skeleton variant="text" width={`${62 - i * 9}%`} className="text-[0.95rem]" />
            {/* Fausse description : largeur de 88 %, réduite de 7 points à chaque ligne, en plus petit. */}
            <Skeleton variant="text" width={`${88 - i * 7}%`} className="text-[0.75rem]" />
          {/* Fin de la colonne des textes. */}
          </div>
        {/* Fin de la ligne. */}
        </div>
      // Fin de la création des lignes.
      ))}
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de LayerSkeleton.
}
