// Importe de React memo (rendu évité quand rien ne change) et les crochets d'état, de référence et de mémoire.
import { memo, useCallback, useMemo, useRef, useState } from 'react';
// Importe iconNode, le dessin d'une icône.
import { iconNode } from './iconNode.jsx';
// Importe les icônes des deux espaces à feuille.
import { ExploreIcon, ShadowIcon } from '../ui/icons.jsx';
// Onglet du téléphone de chaque bloc de la barre.
import { PHONE_TAB } from './toolbarActions.jsx';
// Importe FeuilleActions, la feuille qui monte du bas de l'écran.
import { FeuilleActions } from '../ui/FeuilleActions.jsx';

// Les deux espaces de la navigation qui ouvrent une feuille (début).
const TABS = [
  // Explorer.
  { id: 'explore', label: 'Explorer', icon: ExploreIcon, title: 'Explorer' },
  // Affichage : éclairage, relativité, mouvements automatiques de la caméra, verrouillage.
  { id: 'display', label: 'Affichage', icon: ShadowIcon, title: 'Affichage' },
// Fin des espaces.
];

// Boutons directs de la barre du bas (début) : ils ouvrent leur fenêtre sans feuille ni bouton parent.
const DIRECT_IDS = ['gallery', 'sources'];

// Titre de la feuille de chaque espace (début).
const TITLES = {
  // Explorer.
  explore: 'Explorer',
  // Affichage.
  display: 'Affichage',
// Fin des titres.
};

/**
 * Tuile d'une action dans la feuille : une pastille d'icône et son libellé (classes `m-tile…` de theme/app.css).
 * Mémorisée : la feuille se redessine quand on la tire, pas ses tuiles.
 */
// Déclare ActionTile : l'action, la fermeture de la feuille et la référence d'ancrage.
const ActionTile = memo(function ActionTile({ action, onPick, anchorRef }) {
  // État enfoncé : indéfini pour une action sans bascule, sinon un booléen.
  const pressed = action.pressed === undefined ? undefined : Boolean(action.pressed);
  // Rend la tuile.
  return (
    <button
      type="button"
      className="m-tile"
      aria-label={action.label}
      aria-pressed={pressed}
      disabled={action.disabled}
      // Marque les actions sans son de clic.
      data-no-sound={action.noSound ? '' : undefined}
      // Au clic : lance l'action, ancrée sur la barre, puis referme la feuille.
      onClick={() => { action.onClick?.({ currentTarget: anchorRef.current }); onPick(); }}
    >
      {/* Pastille de l'icône. */}
      <span className="m-tile-icon" aria-hidden="true">{iconNode(action.icon, 22)}</span>
      {/* Libellé court, sinon le libellé ; deux lignes au plus. */}
      <span className="m-tile-label">{action.short || action.label}</span>
    </button>
  );
// Fin de ActionTile.
});

/**
 * Navigation du téléphone : une barre flottante de quatre boutons. Explorer et Affichage ouvrent une feuille
 * d'actions ; Données et Node ouvrent directement leur fenêtre.
 * Aucun style n'est calculé au rendu (classes `m-nav…`), et le composant est mémorisé : il ne se redessine que si
 * la liste des actions change.
 */
// Déclare et exporte CompactToolbar, avec les actions.
export const CompactToolbar = memo(function CompactToolbar({ actions }) {
  // État : l'espace ouvert, aucun au départ.
  const [active, setActive] = useState(null);
  // Référence de la barre, pour ancrer les menus.
  const anchorRef = useRef(null);
  // L'espace ouvert.
  const selected = TABS.find((tab) => tab.id === active);
  // Les actions de cet espace, dans l'ordre de la barre.
  const items = useMemo(() => actions.filter((action) => PHONE_TAB[action.group] === active), [actions, active]);
  // Les actions directes (celles qui existent), qui ouvrent leur fenêtre sans feuille.
  const direct = useMemo(() => DIRECT_IDS.map((id) => actions.find((a) => a.id === id)).filter(Boolean), [actions]);
  // close : referme la feuille ; fonction stable, pour que les tuiles mémorisées ne se redessinent pas.
  const close = useCallback(() => setActive(null), []);

  // Rendu.
  return (
    <>
      {/* Barre de navigation flottante. */}
      <nav ref={anchorRef} className="m-nav" aria-label="Navigation principale" data-hud="mobile-navigation">
        {/* Les espaces à feuille : un clic ouvre l'espace, ou le referme s'il est ouvert. */}
        {TABS.map((tab) => (
          <button
            type="button" key={tab.id} className="m-nav-btn" aria-label={tab.title}
            aria-expanded={active === tab.id} aria-controls={active === tab.id ? 'gobai-mobile-actions' : undefined}
            data-active={active === tab.id ? '' : undefined}
            onClick={() => setActive((current) => (current === tab.id ? null : tab.id))}
          >
            <span className="m-nav-icon" aria-hidden="true">{iconNode(tab.icon, 20)}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        {/* Les boutons directs : referment la feuille ouverte et ouvrent leur fenêtre. */}
        {direct.map((a) => (
          <button
            type="button" key={a.id} className="m-nav-btn" aria-label={a.label} data-active={a.pressed ? '' : undefined}
            onClick={() => { setActive(null); a.onClick?.({ currentTarget: anchorRef.current }); }}
          >
            <span className="m-nav-icon" aria-hidden="true">{iconNode(a.icon, 20)}</span>
            <span>{a.short || a.label}</span>
          </button>
        ))}
      </nav>

      {/* Feuille des actions : ouverte quand un espace est choisi. */}
      <FeuilleActions open={Boolean(selected)} onClose={close} label={selected?.title || 'Navigation'}>
        <div id="gobai-mobile-actions" className="pt-0.5 pb-2">
          {/* Titre de l'espace. */}
          <h2 className="m-sheet-title">{selected ? TITLES[selected.id] : ''}</h2>
          {items.length ? (
            // Grille des tuiles.
            <div className="m-tiles">
              {items.map((action) => <ActionTile key={action.id} action={action} onPick={close} anchorRef={anchorRef} />)}
            </div>
          ) : selected ? (
            <p className="t-body2 text-soft px-2 py-4">Aucune action disponible dans cet espace pour le moment.</p>
          ) : null}
        </div>
      </FeuilleActions>
    </>
  );
// Fin de CompactToolbar.
});
