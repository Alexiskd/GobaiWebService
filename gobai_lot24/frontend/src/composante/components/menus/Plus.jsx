// Importe iconNode, qui dessine l'icône d'une action.
import { iconNode } from '../toolbar/iconNode';
// Importe de React les crochets useRef et useState.
import { useRef, useState } from 'react';
// Importe de MUI Box, ButtonBase, IconButton et Typography.
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
// Importe MQ, les requêtes média.
import { MQ } from '@/composante/theme/mediaQueries';
// Importe la feuille d'actions du téléphone.
import { FeuilleActions } from '../ui/FeuilleActions';

// Titres des blocs de la feuille (mêmes blocs que la barre d'outils de l'ordinateur).
// Titre de chaque bloc d'actions.
const GROUP_TITLES = { explore: 'Explorer', data: 'Données', camera: 'Vue', help: 'Plus' };

/** Tuile d'action : pastille avec l'icône, libellé court dessous. Une bascule active est remplie en couleur primaire. */
// Déclare le composant Tuile : l'action et le rappel de choix.
function Tuile({ action, onPick }) {
  // État enfoncé : indéfini si l'action n'est pas une bascule, booléen sinon.
  const pressed = action.pressed === undefined ? undefined : Boolean(action.pressed);
  // Début du rendu.
  return (
    // Le bouton de la tuile (début de la balise).
    <ButtonBase
      // Nom pour les lecteurs d'écran.
      aria-label={action.label}
      // État enfoncé pour les lecteurs d'écran.
      aria-pressed={pressed}
      // Marqueur data-no-sound si l'action ne doit pas faire de son.
      data-no-sound={action.noSound ? '' : undefined}
      // Désactivation éventuelle.
      disabled={action.disabled}
      // Au clic : appelle l'action, puis signale le choix.
      onClick={(e) => { action.onClick?.(e); onPick?.(); }}
      // Début du style.
      sx={{
        // Icône et libellé en colonne, centrés.
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 0.5,
        // Hauteur minimale de 76 px, coins arrondis.
        minWidth: 0, minHeight: 76, px: 0.25, py: 0.75, borderRadius: 2, color: 'text.primary',
        // Désactivée : estompée.
        '&.Mui-disabled': { opacity: 0.4 },
        // Pendant l'appui : la pastille rétrécit légèrement.
        '&:active .tuile-pastille': { transform: 'scale(0.92)' },
        // Pas de rétrécissement si l'utilisateur a demandé moins de mouvement.
        [MQ.reducedMotion]: { '&:active .tuile-pastille': { transform: 'none' } },
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* La pastille de l'icône (début de la balise). */}
      <Box
        // Classe visée par l'effet d'appui.
        className="tuile-pastille"
        // Cachée aux lecteurs d'écran.
        aria-hidden="true"
        // Début du style.
        sx={{
          // Carré arrondi de 48 px, contenu centré.
          width: 48, height: 48, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: '16px',
          // Taille de l'icône et transition de l'effet d'appui.
          fontSize: 21, lineHeight: 1, transition: 'transform 120ms ease',
          // Fond primaire si la bascule est active, léger sinon.
          bgcolor: pressed ? 'primary.main' : 'action.hover',
          // Couleur de l'icône assortie.
          color: pressed ? 'primary.contrastText' : 'inherit',
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* L'icône, à 22 px. */}
        {iconNode(action.icon, 22)}
      {/* Fin de la pastille. */}
      </Box>
      {/* Le libellé (début de la balise). */}
      <Typography
        // Rendu en balise span.
        component="span"
        // Début du style.
        sx={{
          // Petit texte centré, gras si la bascule est active.
          fontSize: 11, lineHeight: 1.2, fontWeight: pressed ? 700 : 500, textAlign: 'center', maxWidth: '100%',
          // Deux lignes au plus, le reste est coupé.
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* Le libellé court, sinon le libellé complet. */}
        {action.short || action.label}
      {/* Fin du libellé. */}
      </Typography>
    {/* Fin du bouton de la tuile. */}
    </ButtonBase>
  // Fin du rendu.
  );
// Fin de Tuile.
}

// Bouton ⋯ du téléphone : l'unique bouton de l'interface, en haut à droite. Il ouvre une feuille d'actions qui monte
// du bas de l'écran : toutes les actions en tuiles, rangées par bloc, à portée de pouce. Monté uniquement sur petit écran.
// Déclare et exporte le composant Plus : reçoit les actions.
export function Plus({ actions }) {
  // Référence vers le bouton ⋯.
  const button = useRef(null);
  // État : feuille ouverte ou non.
  const [open, setOpen] = useState(false);
  // close : ferme la feuille.
  const close = () => setOpen(false);

  // Une action qui ouvre un menu déroulant (Claude) s'ancre au bouton ⋯ : la tuile touchée disparaît avec la feuille.
  // Copie des actions dont le clic transmet le bouton ⋯ comme point d'ancrage.
  const anchored = actions.map((a) => ({ ...a, onClick: () => a.onClick?.({ currentTarget: button.current }) }));
  // Blocs d'actions, dans l'ordre.
  const groups = [];
  // Parcourt les actions.
  for (const a of anchored) {
    // Le dernier bloc créé.
    const last = groups[groups.length - 1];
    // Même bloc que l'action précédente : elle y est ajoutée.
    if (last && last.id === a.group) last.items.push(a);
    // Sinon : nouveau bloc.
    else groups.push({ id: a.group, items: [a] });
  // Fin du parcours.
  }

  // Début du rendu.
  return (
    // Fragment : regroupe le bouton et la feuille.
    <>
      {/* Le bouton ⋯ (début de la balise). */}
      <IconButton
        // Référence pour l'ancrage.
        ref={button}
        // Couleur héritée.
        color="inherit"
        // Nom pour les lecteurs d'écran.
        aria-label="Plus"
        // Annonce qu'il ouvre une boîte de dialogue.
        aria-haspopup="dialog"
        // Indique si la feuille est ouverte.
        aria-expanded={open}
        // Au clic : ouvre la feuille.
        onClick={() => setOpen(true)}
        // Carré de 44 px, arrondi comme son conteneur.
        sx={{ width: 44, height: 44, borderRadius: 'inherit' }}
      // Fin de la balise ouvrante.
      >
        {/* Le signe ⋯, décoratif. */}
        <Box component="span" aria-hidden="true" sx={{ fontSize: 24, lineHeight: 1, fontWeight: 700 }}>⋯</Box>
      {/* Fin du bouton. */}
      </IconButton>
      {/* La feuille d'actions. */}
      <FeuilleActions open={open} onClose={close} label="Actions">
        {/* Un bloc par groupe (début). */}
        {groups.map((g) => (
          // Le bloc, au rôle de groupe, nommé par son titre ; espacé du précédent.
          <Box key={g.id} role="group" aria-label={GROUP_TITLES[g.id] || g.id} sx={{ '& + &': { mt: 1 } }}>
            {/* Le titre du bloc (début de la balise). */}
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 0.75, lineHeight: '24px', letterSpacing: 0.8 }}>
              {/* Le titre, l'identifiant du bloc à défaut. */}
              {GROUP_TITLES[g.id] || g.id}
            {/* Fin du titre. */}
            </Typography>
            {/* Grille des tuiles : autant de colonnes de 72 px au moins que la largeur le permet. */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 0.5 }}>
              {/* Une tuile par action ; un choix ferme la feuille. */}
              {g.items.map((a) => <Tuile key={a.id} action={a} onPick={close} />)}
            {/* Fin de la grille. */}
            </Box>
          {/* Fin du bloc. */}
          </Box>
        // Fin des blocs.
        ))}
      {/* Fin de la feuille. */}
      </FeuilleActions>
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Plus.
}
