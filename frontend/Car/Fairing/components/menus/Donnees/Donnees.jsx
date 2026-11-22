// Fenêtre plein écran « Données » : en-tête, barre de navigation à onglets, puis le contenu de l'onglet choisi.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { CircularProgress, Dialog, IconButton, Tooltip } from '@/Fairing/kit';
// Importe les conversions des valeurs de style calculées au rendu.
import { sp } from '@/Fairing/kit/sx';
import { CloseIcon, PsychologyIcon, ScienceIcon } from '../../ui/icons.jsx';

// Chargées à l'ouverture de leur onglet seulement : rien de tout cela n'alourdit le démarrage de la scène 3D.
const FluxCognitif = lazy(() => import('../../hud/recherche/FluxCognitif.jsx').then((m) => ({ default: m.FluxCognitif })));
const TheorieQuantique = lazy(() => import('../../hud/recherche/TheorieQuantique.jsx').then((m) => ({ default: m.TheorieQuantique })));

/** Les onglets de la fenêtre, dans l'ordre de la barre : nom, nom court (téléphone), description et icône. */
export const DONNEES_TABS = [
  { id: 'flux', name: 'Flux cognitif', short: 'Flux', hint: 'Page de recherche de l’auteur', Icon: PsychologyIcon },
  { id: 'theorie', name: 'Théorie quantique', short: 'Théorie', hint: 'Page de recherche de l’auteur', Icon: ScienceIcon },
];

/** Couleurs de la fenêtre (fond presque noir, comme la galerie) et police de l'interface. */
const V = {
  void: '#07080d', panel: '#10121b', line: '#222636', ink: '#e8e9f0', muted: '#8a8fa6',
  font: '"Google Sans", "Roboto", "Helvetica Neue", Arial, sans-serif',
};
// Marges de sécurité de l'écran (encoche, coins arrondis de l'iPhone).
const safe = (side) => `env(safe-area-inset-${side}, 0px)`;

/**
 * Barre de navigation de la fenêtre : contrôle segmenté, un onglet par vue (icône + nom).
 *  - Ordinateur : centrée, noms complets.
 *  - Téléphone  : pleine largeur, noms courts, quatre onglets égaux de 44 px de haut au moins ; si la place manque
 *    malgré tout (très petit écran, grand corps de texte), la barre défile horizontalement au lieu de chevaucher.
 * Motif « tablist » : flèches gauche/droite, Début et Fin déplacent l'onglet actif, comme le veut l'accessibilité.
 */
function DonneesNav({ tab, onChange }) {
  const refs = useRef({});
  const onKeyDown = (e) => {
    const i = DONNEES_TABS.findIndex((t) => t.id === tab);
    const n = DONNEES_TABS.length;
    const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = DONNEES_TABS[next].id;
    onChange(id);
    refs.current[id]?.focus();
  };
  // L'onglet actif reste visible quand la barre défile (téléphone étroit).
  useEffect(() => { refs.current[tab]?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' }); }, [tab]);

  return (
    <div
      role="tablist"
      aria-label="Vues de la fenêtre Données"
      onKeyDown={onKeyDown}
      className="flex gap-1 p-1 mx-auto w-full min-[600px]:w-auto max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-full" style={{ border: `1px solid ${V.line}`, backgroundColor: V.panel }}
    >
      {DONNEES_TABS.map(({ id, name, short, Icon }) => {
        const active = tab === id;
        return (
          <button type="button"
            key={id}
            ref={(el) => { refs.current[id] = el; }}
            role="tab"
            id={`donnees-tab-${id}`}
            aria-selected={active}
            aria-label={name}
            aria-controls={`donnees-panel-${id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            className={`g-base flex-[1_0_auto] min-[600px]:flex-none flex items-center justify-center gap-1.5 min-h-11 min-[600px]:min-h-9.5 px-2.5 min-[600px]:px-4 rounded-full whitespace-nowrap text-[14px] min-[600px]:text-[14.5px] ${active ? 'font-semibold' : 'font-medium'} leading-[1.2] [transition:background-color_.15s,color_.15s] focus-visible:outline-2 focus-visible:outline-[#e8e9f0] focus-visible:outline-offset-2 ${active ? 'text-[#07080d] bg-[#e8e9f0]' : 'text-[#8a8fa6] hover:text-[#e8e9f0] hover:bg-white/6'}`} style={{ fontFamily: V.font }}
          >
            <Icon className="text-[18px] flex-none" aria-hidden="true" />
            {/* Nom complet sur ordinateur, nom court sur téléphone ; le nom complet est lu par les lecteurs d'écran (aria-label). */}
            <span className="hidden min-[600px]:inline">{name}</span>
            <span className="inline min-[600px]:hidden">{short}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Fenêtre plein écran « Données » : les deux pages de recherche de l'auteur, Flux cognitif et Théorie quantique.
 * La documentation des astres et leurs photos sont dans le panneau Caractéristiques et informations de chaque astre,
 * et l'arborescence des astres dans la Navigation.
 *
 * L'en-tête et la barre de navigation restent fixes en haut ; seul le contenu défile. Les marges de sécurité de
 * l'iPhone (encoche, barre d'accueil) sont respectées en portrait comme en paysage.
 */
export function Donnees({ open, onClose }) {
  const [tab, setTab] = useState('flux');
  const scrollRef = useRef(null);

  // Changer d'onglet ramène le contenu en haut.
  const changeTab = useCallback((id) => { setTab(id); scrollRef.current?.scrollTo?.({ top: 0 }); }, []);

  const current = DONNEES_TABS.find((t) => t.id === tab) ?? DONNEES_TABS[0];

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => onClose?.(event, reason)}
      fullScreen
      aria-label="Données"
      paperClassName="bg-[#07080d] text-[#e8e9f0]" paperStyle={{ fontFamily: V.font }}
    >
      {/* En-tête fixe : titre, description de l'onglet, fermeture ; puis la barre de navigation. */}
      <header
        className="flex-none flex flex-col gap-2.5 min-[600px]:gap-3 pb-3 bg-[color:rgba(7,8,13,0.92)]" style={{ paddingTop: `calc(${safe('top')} + 12px)`, paddingLeft: `calc(${safe('left')} + 16px)`, paddingRight: `calc(${safe('right')} + 16px)`, borderBottom: `1px solid ${V.line}` }}
      >
        <div className="flex items-center gap-3 max-w-350 w-full mx-auto min-w-0">
          <div className="flex-auto min-w-0">
            <h2 className="t-body1 font-bold text-[22px] min-[600px]:text-[26px] leading-[1.15] tracking-[-0.01em]" style={{ fontFamily: V.font, color: V.ink }}>
              Données
            </h2>
            <p className="t-body1 mt-0.5 text-[13.5px] leading-[1.35] [overflow-wrap:anywhere]" style={{ fontFamily: V.font, color: V.muted }}>
              {current.hint}
            </p>
          </div>
          <Tooltip title="Fermer">
            <IconButton onClick={() => onClose?.()} aria-label="Fermer la fenêtre Données"
              className="flex-none w-11 h-11 hover:bg-[color:rgba(255,255,255,.06)]" style={{ color: V.ink, border: `1px solid ${V.line}` }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
        <div className="max-w-350 w-full mx-auto flex">
          <DonneesNav tab={tab} onChange={changeTab} />
        </div>
      </header>

      {/* Contenu de l'onglet : seule partie qui défile. */}
      <div
        ref={scrollRef}
        role="tabpanel"
        id={`donnees-panel-${tab}`}
        aria-labelledby={`donnees-tab-${tab}`}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ paddingBottom: sp(safe('bottom')), paddingLeft: sp(safe('left')), paddingRight: sp(safe('right')) }}
      >
        {open && (
          <Suspense fallback={<div className="grid place-items-center py-20"><CircularProgress style={{ color: V.muted }} /></div>}>
            <div className="max-w-245 mx-auto px-4 min-[600px]:px-6 py-6 text-ink">
              {tab === 'theorie' ? <TheorieQuantique /> : <FluxCognitif />}
            </div>
          </Suspense>
        )}
      </div>
    </Dialog>
  );
}
