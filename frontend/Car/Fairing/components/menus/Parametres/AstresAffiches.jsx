// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { ToggleButton } from '@/Fairing/kit';
// Importe la liste des familles d'astres.
import { BODY_KINDS } from '@/Engine/AstreSolideEngine/BodyEngine/bodyKinds';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint.jsx';

/**
 * Familles d'astres : un bouton par famille, enfoncé quand elle est affichée. Un appui l'enlève de la scène (astres,
 * anneaux, cartes, orbites, repères et listes de navigation), un second la remet. Les satellites suivent leur planète.
 */
// Déclare et exporte le composant AstresAffiches : les familles affichées et le rappel.
export function AstresAffiches({ kinds = {}, onKind }) {
  // Début du rendu.
  return (
    // Conteneur au rôle de groupe.
    <div role="group" aria-label="Astres affichés" className="mb-4">
      {/* Le titre. */}
      <span className="t-overline text-soft block leading-[2.2]">Astres affichés</span>
      {/* Grille des boutons : une colonne sur très petit écran, deux sinon. */}
      <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-2">
        {/* Un bouton par famille (début). */}
        {BODY_KINDS.map(({ id, label, hint }) => {
          // Famille affichée, sauf si elle est explicitement à faux.
          const shown = kinds[id] !== false;
          // Début du rendu du bouton.
          return (
            // Le bouton à bascule (début de la balise).
            <ToggleButton
              // Clé unique.
              key={id}
              // Sa valeur : l'identifiant de la famille.
              value={id}
              // Enfoncé si la famille est affichée.
              selected={shown}
              // Au changement : demande l'état inverse.
              onChange={() => onKind?.(id, !shown)}
              // Nom pour les lecteurs d'écran, avec l'état et l'effet d'un appui.
              aria-label={`${label} : ${shown ? 'affichés, appuyer pour les enlever' : 'enlevés, appuyer pour les remettre'}`}
              // Début du style.
              className={`flex flex-col items-start gap-0.5 px-3 py-2 text-left leading-[1.25] ${shown ? 'opacity-100' : 'opacity-72'}`}
            // Fin de la balise ouvrante.
            >
              {/* Première ligne : nom et état aux deux extrémités. */}
              <span className="flex items-center justify-between gap-2 w-full">
                {/* Le nom, barré si la famille est enlevée. */}
                <span className={`${shown ? 'no-underline' : 'line-through'}`}>{label}</span>
                {/* L'état : « Affichés » ou « Enlevés ». */}
                <span aria-hidden="true" className="text-[0.75rem] opacity-85">{shown ? 'Affichés' : 'Enlevés'}</span>
              {/* Fin de la première ligne. */}
              </span>
              {/* Le texte d'aide de la famille, en petit. */}
              <span className="text-[0.72rem] [font-family:system-ui,sans-serif] tracking-[0px] opacity-80">{hint}</span>
            {/* Fin du bouton. */}
            </ToggleButton>
          // Fin du rendu du bouton.
          );
        // Fin des boutons.
        })}
      {/* Fin de la grille. */}
      </div>
      {/* Note d'aide. */}
      <Hint>Appuyez sur une famille pour l’enlever de la scène ou la remettre. Les satellites disparaissent avec leur planète.</Hint>
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de AstresAffiches.
}
