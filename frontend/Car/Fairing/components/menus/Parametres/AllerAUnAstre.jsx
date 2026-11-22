// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Checkbox, List, ListItem, ListItemButton, ListItemText } from '@/Fairing/kit';
// Importe les conversions des valeurs de style calculées au rendu.
import { tok } from '@/Fairing/kit/sx';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint.jsx';

/** Pastille à la couleur de l'astre. */
// Déclare le composant Dot : la couleur et l'indicateur « estompé ».
const Dot = ({ color, dim }) => (
  // Rond de 10 px à la couleur de l'astre (gris à défaut), estompé si demandé.
  <div aria-hidden="true" className={`w-2.5 h-2.5 rounded-full flex-none ${dim ? 'opacity-35' : 'opacity-100'}`} style={{ backgroundColor: tok(color || 'text.disabled') }} />
// Fin de Dot.
);

/**
 * Liste de tous les astres, avec leur numéro (la Lune en « 04 bis ») et les satellites en retrait sous leur planète.
 *  - la case enlève l'astre de la scène ou le remet (le Soleil n'en a pas) ; enlever une planète enlève ses satellites ;
 *  - un appui sur le nom s'y téléporte et ferme la fenêtre.
 * `shown` = case cochée ; `locked` = enlevé par sa famille (boutons du haut) ou par sa planète : case grisée.
 */
// Déclare et exporte le composant AllerAUnAstre : astres, astre visé, rappel de choix et rappel d'affichage.
export function AllerAUnAstre({ bodies = [], focus, onPick, onShown }) {
  // Début du rendu.
  return (
    // Conteneur au rôle de groupe.
    <div role="group" aria-label="Astres">
      {/* Le titre. */}
      <span className="t-overline text-soft block leading-[2.2]">Astres</span>
      {/* Carte à contour, transparente. */}
      <div className="g-paper g-paper-outlined bg-transparent overflow-hidden">
        {/* Liste dense, sans marge. */}
        <List dense disablePadding>
          {/* Un élément par astre (début). */}
          {bodies.map((body) => {
            // Est-ce le Soleil ?
            const isSun = body.index === 0;
            // Astre affiché, sauf si shown est explicitement à faux.
            const shown = body.shown !== false;
            // Astre visé ?
            const current = focus === body.index;
            // Début du rendu de l'élément.
            return (
              // L'élément de liste (début de la balise).
              <ListItem
                // Clé unique : le nom de l'astre.
                key={body.name}
                // Sans marge intérieure.
                disablePadding
                // En retrait pour un satellite.
                className={`${body.satellite ? 'pl-5' : 'pl-0'}`}
              // Fin de la balise ouvrante.
              >
                {/* Pour le Soleil (début). */}
                {isSun ? (
                  // Un espace vide à la place de la case.
                  <div aria-hidden="true" className="w-9.5 flex-none" />
                // Sinon (début).
                ) : (
                  // La case à cocher (début de la balise).
                  <Checkbox
                    // Petite taille.
                    size="small"
                    // Cochée si l'astre est affiché.
                    checked={shown}
                    // Grisée si l'astre est verrouillé.
                    disabled={Boolean(body.locked)}
                    // Au changement : affiche ou enlève l'astre.
                    onChange={(e) => onShown?.(body.index, e.target.checked)}
                    // Nom pour les lecteurs d'écran : « Enlever » ou « Remettre », suivi du nom.
                    slotProps={{ input: { 'aria-label': `${shown ? 'Enlever' : 'Remettre'} ${body.name}` } }}
                    // Taille fixe et marges.
                    className="flex-none ml-2.5 mr-1.5"
                  // Fin de la case.
                  />
                // Fin du choix.
                )}
                {/* Le bouton de l'astre (début de la balise). */}
                <ListItemButton
                  // Dense.
                  dense
                  // Sélectionné si l'astre est visé.
                  selected={current}
                  // Désactivé si l'astre est enlevé.
                  disabled={!shown}
                  // Marque l'élément courant pour les lecteurs d'écran.
                  aria-current={current ? 'true' : undefined}
                  // Au clic : va à l'astre.
                  onClick={() => onPick(body.index)}
                  // Espacement et marges.
                  className="gap-2.5 pl-1.5 pr-3"
                // Fin de la balise ouvrante.
                >
                  {/* La pastille, estompée si l'astre est enlevé. */}
                  <Dot color={body.color} dim={!shown} />
                  {/* Le nom (début de la balise). */}
                  <ListItemText
                    // Son texte.
                    primary={body.name}
                    // Style du texte (début).
                    slotProps={{ primary: { className: `text-[0.84rem] ${current ? 'font-semibold' : 'font-normal'} ${body.satellite ? 'text-soft' : 'text-ink'} ${shown ? '' : 'line-through'}` } }}
                  // Fin du nom.
                  />
                  {/* Le numéro de l'astre, en police à chasse fixe. */}
                  <span className="t-caption text-soft [font-family:monospace] whitespace-nowrap">{body.number}</span>
                {/* Fin du bouton. */}
                </ListItemButton>
              {/* Fin de l'élément. */}
              </ListItem>
            // Fin du rendu de l'élément.
            );
          // Fin des éléments.
          })}
        {/* Fin de la liste. */}
        </List>
      {/* Fin de la carte. */}
      </div>
      {/* Note d'aide. */}
      <Hint>Décochez un astre pour l’enlever de la scène, recochez-le pour le remettre. Appuyez sur son nom pour y aller.</Hint>
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de AllerAUnAstre.
}
