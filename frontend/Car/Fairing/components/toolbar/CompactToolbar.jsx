// Importe les hooks useRef et useState de React.
import { useRef, useState } from 'react';
import { sp } from '@/Fairing/kit/sx';
// Importe iconNode, le dessin d'une icône.
import { iconNode } from './iconNode.jsx';
// Importe les icônes des deux espaces à feuille.
import { ExploreIcon, ShadowIcon } from '../ui/icons.jsx';
// Onglet du téléphone de chaque bloc de la barre.
import { PHONE_TAB } from './toolbarActions.jsx';
// Importe FeuilleActions, la feuille qui monte du bas de l'écran.
import { FeuilleActions } from '../ui/FeuilleActions.jsx';
// Importe safe, la marge de sécurité de l'écran.
import { safe } from '@/Fairing/theme/mediaQueries';

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

// Composant ActionTile : la tuile d'une action, avec la fonction de choix et la référence d'ancrage (début).
function ActionTile({ action, onPick, anchorRef }) {
  // État enfoncé : indéfini pour une action sans bascule, sinon un booléen.
  const pressed = action.pressed === undefined ? undefined : Boolean(action.pressed);
  // Rendu (début).
  return (
    // Bouton (début).
    <button type="button"
      // Nom pour les lecteurs d'écran.
      aria-label={action.label}
      // État enfoncé, pour les lecteurs d'écran.
      aria-pressed={pressed}
      // Coupé si l'action l'est.
      disabled={action.disabled}
      // Marque les actions sans son.
      data-no-sound={action.noSound ? '' : undefined}
      // Au clic (début) :
      onClick={() => {
        // lance l'action, ancrée sur la barre,
        action.onClick?.({ currentTarget: anchorRef.current });
        // puis referme la feuille.
        onPick();
      // Fin du clic.
      }}
      // Style (début) :
      className={`g-base flex flex-col items-center justify-start gap-1.5 min-w-0 min-h-20.5 p-2 rounded-[24px] text-ink ${pressed ? 'bg-selected' : 'bg-transparent'} active:bg-hover disabled:opacity-40`}
    // Fin des réglages du bouton.
    >
      {/* Pastille de l'icône (début) : */}
      <div className={`w-12 h-12 grid place-items-center rounded-[17px] ${pressed ? 'bg-primary' : 'bg-hover'} ${pressed ? 'text-on-primary' : 'text-ink'} text-[22px]`}>
        {/* L'icône de l'action. */}
        {iconNode(action.icon, 22)}
      {/* Fin de la pastille. */}
      </div>
      {/* Libellé (début) : */}
      <span className={`t-body1 text-[11px] leading-[1.2] ${pressed ? 'font-bold' : 'font-medium'} text-center max-w-full [overflow-wrap:anywhere] line-clamp-2 overflow-hidden`}>
        {/* Le libellé court, sinon le libellé. */}
        {action.short || action.label}
      {/* Fin du libellé. */}
      </span>
    {/* Fin du bouton. */}
    </button>
  // Fin du rendu.
  );
// Fin de ActionTile.
}

/** Navigation mobile : deux espaces à feuille (Explorer, Affichage) et deux boutons directs (Données, Node). */
// Déclare et exporte le composant CompactToolbar, avec les actions (début).
export function CompactToolbar({ actions }) {
  // État : l'espace ouvert, aucun au départ.
  const [active, setActive] = useState(null);
  // Référence de la barre, pour ancrer les menus.
  const anchorRef = useRef(null);
  // L'espace ouvert.
  const selected = TABS.find((tab) => tab.id === active);
  // Les actions de cet espace, dans l'ordre de la barre.
  const items = actions.filter((action) => PHONE_TAB[action.group] === active);

  // close : referme la feuille.
  const close = () => setActive(null);
  // toggle : ouvre un espace, ou le referme s'il est déjà ouvert.
  const toggle = (id) => setActive((current) => current === id ? null : id);

  // Boutons de la barre (début) : d'abord les espaces à feuille…
  const entries = [
    ...TABS.map((tab) => ({ key: tab.id, label: tab.label, title: tab.title, icon: tab.icon, sheet: true, isActive: active === tab.id, onClick: () => toggle(tab.id) })),
    // … puis les actions directes (celles qui existent), qui ouvrent leur fenêtre sans passer par une feuille.
    ...DIRECT_IDS.map((id) => actions.find((a) => a.id === id)).filter(Boolean).map((a) => ({
      key: a.id, label: a.short || a.label, title: a.label, icon: a.icon, sheet: false, isActive: Boolean(a.pressed),
      onClick: () => { setActive(null); a.onClick?.({ currentTarget: anchorRef.current }); },
    })),
  // Fin des boutons de la barre.
  ];

  // Rendu (début).
  return (
    // Fragment (début).
    <>
      {/* Barre de navigation (début). */}
      <nav
        // Sa référence.
        ref={anchorRef}
        // Rôle de navigation.
        role="navigation"
        // Nom pour les lecteurs d'écran.
        aria-label="Navigation principale"
        // Repère pour le reste de l'interface.
        data-hud="mobile-navigation"
        // Style (début) :
        className="g-paper g-elev relative grid gap-0 pt-1.5 border-t border-line rounded-[18px_18px_0_0] bg-[color:rgba(7,13,27,0.94)] text-[#E7EEFC]" style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))`, paddingLeft: `calc(6px + ${safe('left')})`, paddingRight: `calc(6px + ${safe('right')})`, paddingBottom: sp('calc(6px + ' + safe('bottom') + ')') }}
      // Fin des réglages de la barre.
      >
        {/* Pour chaque bouton (début). */}
        {entries.map((tab) => {
          // Est-il ouvert ?
          const { isActive } = tab;
          // Rendu (début).
          return (
            // Bouton de l'espace (début).
            <button type="button"
              // Sa clé.
              key={tab.key}
              // Nom pour les lecteurs d'écran.
              aria-label={tab.title}
              // État ouvert, pour les lecteurs d'écran (seulement pour les espaces à feuille).
              aria-expanded={tab.sheet ? isActive : undefined}
              // Lien avec la feuille, quand elle est ouverte.
              aria-controls={tab.sheet && isActive ? 'gobai-mobile-actions' : undefined}
              // Au clic : ouvre ou referme l'espace, ou ouvre directement la fenêtre.
              onClick={tab.onClick}
              // Style (début) :
              className={`g-base min-w-0 min-h-13 px-0.5 py-1 flex flex-col gap-[3.2px] [@media(max-height:500px)]:min-h-11 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:gap-1.5 [@media(max-height:500px)]:py-0.5 rounded-[20px] ${isActive ? 'text-[#B9D7FF]' : 'text-[color:rgba(226,235,250,.68)]'} ${isActive ? 'bg-[color:rgba(88,145,220,.16)]' : 'bg-transparent'}`}
            // Fin des réglages du bouton.
            >
              {/* Son icône. */}
              <span aria-hidden="true" className="flex text-[21px] leading-[1.1]">{iconNode(tab.icon, 21)}</span>
              {/* Son libellé (début). */}
              <span className={`t-body1 text-[10px] leading-[1.15] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {/* Le texte. */}
                {tab.label}
              {/* Fin du libellé. */}
              </span>
            {/* Fin du bouton. */}
            </button>
          // Fin du rendu.
          );
        // Fin de la boucle.
        })}
      {/* Fin de la barre. */}
      </nav>

      {/* Feuille des actions : ouverte quand un espace est choisi. */}
      <FeuilleActions open={Boolean(selected)} onClose={close} label={selected?.title || 'Navigation'}>
        {/* Son contenu (début). */}
        <div id="gobai-mobile-actions" className="pt-0.5 pb-2">
          {/* Titre (début). */}
          <h2 className="t-body1 px-2 pb-3 text-[15px] font-bold tracking-[0.2px]">
            {/* Le titre de l'espace. */}
            {selected ? TITLES[selected.id] : ''}
          {/* Fin du titre. */}
          </h2>
          {/* S'il y a des actions (début). */}
          {items.length ? (
            // Grille des tuiles (début).
            <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1">
              {/* Pour chaque action (début) : */}
              {items.map((action) => (
                // sa tuile.
                <ActionTile key={action.id} action={action} onPick={close} anchorRef={anchorRef} />
              // Fin de la boucle.
              ))}
            {/* Fin de la grille. */}
            </div>
          // Sinon, si un espace est ouvert (début).
          ) : selected ? (
            // Message (début).
            <p className="t-body1 text-soft px-2 py-4 text-[13px]">
              {/* Le texte : aucune action dans cet espace. */}
              Aucune action disponible dans cet espace pour le moment.
            {/* Fin du message. */}
            </p>
          // Sinon : rien.
          ) : null}
        {/* Fin du contenu. */}
        </div>
      {/* Fin de la feuille. */}
      </FeuilleActions>
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de CompactToolbar.
}
