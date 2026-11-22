// Importe les hooks useRef et useState de React.
import { useRef, useState } from 'react';
// Importe les composants MUI de la boîte, du bouton nu, du panneau et du texte.
import { Box, ButtonBase, Paper, Typography } from '@mui/material';
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
    <ButtonBase
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
      sx={{
        // en colonne, centré, aligné en haut ;
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        // espacement, taille minimale, marge intérieure et coins arrondis ;
        gap: 0.75, minWidth: 0, minHeight: 82, p: 1, borderRadius: 3,
        // couleur du texte ; fond marqué quand l'action est enfoncée ;
        color: 'text.primary', bgcolor: pressed ? 'action.selected' : 'transparent',
        // fond au toucher ;
        '&:active': { bgcolor: 'action.hover' },
        // estompé quand il est coupé.
        '&.Mui-disabled': { opacity: 0.4 },
      // Fin du style.
      }}
    // Fin des réglages du bouton.
    >
      {/* Pastille de l'icône (début) : */}
      <Box sx={{
        // carré de 48 px, contenu centré, coins arrondis ;
        width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: '17px',
        // fond de la couleur principale quand l'action est enfoncée ;
        bgcolor: pressed ? 'primary.main' : 'action.hover',
        // couleur de l'icône assortie ;
        color: pressed ? 'primary.contrastText' : 'text.primary',
        // taille de 22 px.
        fontSize: 22,
      // Fin du style de la pastille.
      }}>
        {/* L'icône de l'action. */}
        {iconNode(action.icon, 22)}
      {/* Fin de la pastille. */}
      </Box>
      {/* Libellé (début) : */}
      <Typography component="span" sx={{
        // petit texte, gras quand l'action est enfoncée ;
        fontSize: 11, lineHeight: 1.2, fontWeight: pressed ? 700 : 500,
        // centré, coupé où il faut ;
        textAlign: 'center', maxWidth: '100%', overflowWrap: 'anywhere',
        // deux lignes au plus.
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      // Fin du style du libellé.
      }}>
        {/* Le libellé court, sinon le libellé. */}
        {action.short || action.label}
      {/* Fin du libellé. */}
      </Typography>
    {/* Fin du bouton. */}
    </ButtonBase>
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
      <Paper
        // Sa référence.
        ref={anchorRef}
        // Balise nav.
        component="nav"
        // Rôle de navigation.
        role="navigation"
        // Nom pour les lecteurs d'écran.
        aria-label="Navigation principale"
        // Repère pour le reste de l'interface.
        data-hud="mobile-navigation"
        // Ombre portée.
        elevation={8}
        // Style (début) :
        sx={{
          // dans le flux du dock du bas (MobileDock), dont elle est le dernier étage, sur toute la largeur ;
          position: 'relative',
          // autant de colonnes égales que de boutons ;
          display: 'grid', gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))`,
          // marges intérieures, avec celles de sécurité sur les côtés (paysage, encoche) ;
          gap: 0, pt: 0.75, pl: `calc(6px + ${safe('left')})`, pr: `calc(6px + ${safe('right')})`,
          // marge du bas : 6 px plus la marge de sécurité de l'écran ;
          pb: 'calc(6px + ' + safe('bottom') + ')',
          // trait du haut et coins arrondis en haut ;
          borderTop: 1, borderColor: 'divider', borderRadius: '18px 18px 0 0',
          // fond sombre presque opaque et texte clair ;
          bgcolor: 'rgba(7, 13, 27, 0.94)', color: '#E7EEFC',
          // flou de l'arrière-plan.
          backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
        // Fin du style.
        }}
      // Fin des réglages de la barre.
      >
        {/* Pour chaque bouton (début). */}
        {entries.map((tab) => {
          // Est-il ouvert ?
          const { isActive } = tab;
          // Rendu (début).
          return (
            // Bouton de l'espace (début).
            <ButtonBase
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
              sx={{
                // taille minimale et marges ;
                minWidth: 0, minHeight: 52, px: 0.25, py: 0.5,
                // en colonne ;
                display: 'flex', flexDirection: 'column', gap: 0.4,
                // écran bas (paysage) : icône et libellé sur une ligne, 44 px de haut, pour laisser la place à la scène ;
                '@media (max-height: 500px)': { minHeight: 44, flexDirection: 'row', gap: 0.75, py: 0.25 },
                // coins arrondis ; couleur plus vive quand il est ouvert ;
                borderRadius: 2.5, color: isActive ? '#B9D7FF' : 'rgba(226,235,250,.68)',
                // fond léger quand il est ouvert.
                bgcolor: isActive ? 'rgba(88, 145, 220, .16)' : 'transparent',
              // Fin du style.
              }}
            // Fin des réglages du bouton.
            >
              {/* Son icône. */}
              <Box component="span" aria-hidden="true" sx={{ display: 'flex', fontSize: 21, lineHeight: 1.1 }}>{iconNode(tab.icon, 21)}</Box>
              {/* Son libellé (début). */}
              <Typography component="span" sx={{ fontSize: 10, lineHeight: 1.15, fontWeight: isActive ? 700 : 500 }}>
                {/* Le texte. */}
                {tab.label}
              {/* Fin du libellé. */}
              </Typography>
            {/* Fin du bouton. */}
            </ButtonBase>
          // Fin du rendu.
          );
        // Fin de la boucle.
        })}
      {/* Fin de la barre. */}
      </Paper>

      {/* Feuille des actions : ouverte quand un espace est choisi. */}
      <FeuilleActions open={Boolean(selected)} onClose={close} label={selected?.title || 'Navigation'}>
        {/* Son contenu (début). */}
        <Box id="gobai-mobile-actions" sx={{ pt: 0.25, pb: 1 }}>
          {/* Titre (début). */}
          <Typography component="h2" sx={{ px: 1, pb: 1.5, fontSize: 15, fontWeight: 700, letterSpacing: 0.2 }}>
            {/* Le titre de l'espace. */}
            {selected ? TITLES[selected.id] : ''}
          {/* Fin du titre. */}
          </Typography>
          {/* S'il y a des actions (début). */}
          {items.length ? (
            // Grille des tuiles (début).
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 0.5 }}>
              {/* Pour chaque action (début) : */}
              {items.map((action) => (
                // sa tuile.
                <ActionTile key={action.id} action={action} onPick={close} anchorRef={anchorRef} />
              // Fin de la boucle.
              ))}
            {/* Fin de la grille. */}
            </Box>
          // Sinon, si un espace est ouvert (début).
          ) : selected ? (
            // Message (début).
            <Typography color="text.secondary" sx={{ px: 1, py: 2, fontSize: 13 }}>
              {/* Le texte : aucune action dans cet espace. */}
              Aucune action disponible dans cet espace pour le moment.
            {/* Fin du message. */}
            </Typography>
          // Sinon : rien.
          ) : null}
        {/* Fin du contenu. */}
        </Box>
      {/* Fin de la feuille. */}
      </FeuilleActions>
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de CompactToolbar.
}
