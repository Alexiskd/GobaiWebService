// Importe de React Fragment, memo et les crochets useEffect, useMemo, useRef et useState.
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
// Importe de MUI Box, ButtonBase (bouton nu), Chip (pastille cliquable), Paper et Stack.
import { Box, ButtonBase, Chip, Paper, Stack } from '@mui/material';
// Importe le crochet de déplacement des panneaux.
import { useHudDraggable } from '@/composante/hooks/useHudDraggable';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la largeur du rail, la hauteur de la bande et edge, la distance à un bord.
import { RAIL, STRIP_H, edge } from '@/composante/theme/layout';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';

/** Pastille de l'astre, à sa couleur : reflet en haut à gauche, ombre vers le bas. */
// Déclare le composant Orb : reçoit la couleur et la taille (14 px par défaut).
const Orb = ({ color, size = 14 }) => (
  // La pastille (début de la balise).
  <Box
    // Cachée aux lecteurs d'écran.
    aria-hidden="true"
    // Classe utilisée par la surbrillance.
    className="nav-orb"
    // Variable CSS --orb : la couleur de l'astre.
    style={{ '--orb': color }}
    // Début du style.
    sx={{
      // Rond de la taille demandée, qui ne se déforme pas.
      position: 'relative', width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-block',
      // Fond : un reflet clair en haut à gauche et (ligne suivante) un dégradé de la couleur vers une teinte sombre.
      background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.8), transparent 22%),
        radial-gradient(circle at 35% 30%, ${color}, color-mix(in srgb, ${color}, #101522 45%))`,
      // Transition de la taille (avec rebond) et de la luminosité ; ni halo, ni anneau irisé, ni éclat (feuille de route 3.1).
      transition: 'box-shadow .25s ease, filter .25s ease, transform .25s cubic-bezier(.3,1.6,.5,1)',
    // Fin du style.
    }}
  // Fin de la pastille.
  />
// Fin de Orb.
);

/**
 * Surbrillance de la sphère quand le curseur (ou le focus clavier) passe sur la ligne : liseré blanc fin, un peu
 * plus lumineuse et agrandie. À étaler dans le `sx` du bouton qui contient l'`Orb`.
 */
// Déclare orbHover, le style de surbrillance (début de l'objet).
const orbHover = {
  // Au survol ou au focus clavier du bouton, pour sa pastille (début).
  '&:hover .nav-orb, &.Mui-focusVisible .nav-orb': {
    // Un liseré blanc fin, sans lueur.
    boxShadow: '0 0 0 1px rgba(255,255,255,.85)',
    // Un peu plus lumineuse.
    filter: 'brightness(1.2)',
    // Agrandie de 20 %.
    transform: 'scale(1.2)',
  // Fin de la surbrillance.
  },
  // Si l'utilisateur a demandé moins de mouvement (début).
  '@media (prefers-reduced-motion: reduce)': {
    // Pour la même pastille (début).
    '&:hover .nav-orb, &.Mui-focusVisible .nav-orb': {
      // Pas d'agrandissement.
      transform: 'none',
    // Fin du cas.
    },
  // Fin de la règle.
  },
// Fin de l'objet.
};

/** Trait de l'arborescence horizontale (téléphone) : relie deux astres ; `knot` = nœud au départ d'une branche. */
// Déclare le composant Link : largeur (10 px par défaut) et nœud (non par défaut).
const Link = ({ width = 10, knot = false }) => (
  // Le trait (début de la balise).
  <Box
    // Caché aux lecteurs d'écran.
    aria-hidden="true"
    // Début du style.
    sx={{
      // Trait de 1 px de haut, de la largeur demandée ; plus marqué s'il porte un nœud.
      position: 'relative', flex: 'none', width, height: '1px', bgcolor: knot ? 'text.disabled' : 'divider',
      // Avec nœud : un petit rond de 7 px au départ du trait.
      ...(knot && { '&::before': { content: '""', position: 'absolute', left: -3, top: -3, width: 7, height: 7, borderRadius: '50%', bgcolor: 'text.disabled' } }),
    // Fin du style.
    }}
  // Fin du trait.
  />
// Fin de Link.
);

// Grand écran : rail déplaçable (arborescence verticale). Petit écran : la même arborescence, couchée à l'horizontale
// au bord bas de l'écran — les planètes sur un tronc, les satellites de la planète courante en branche à sa droite.
// Déclare et exporte le composant Navigator, mémorisé : astres, astre visé et rappel de sélection.
export const Navigator = memo(function Navigator({ bodies, focus, onSelect }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Déplacement du rail, désactivé en mode compact.
  const drag = useHudDraggable('navigation', !compact);
  // Référence vers l'élément de l'astre visé.
  const activeRef = useRef(null);
  // Référence vers le groupe de la planète courante.
  const groupRef = useRef(null);

  // Arborescence : chaque planète, puis ses satellites naturels (« 04 bis », « 06 ter »…) en branches.
  // Arborescence (début du calcul mémorisé).
  const tree = useMemo(() => {
    // Liste des planètes.
    const out = [];
    // Parcourt les astres.
    bodies.forEach((body, i) => {
      // Copie l'astre ; son indice est celui fourni, sa position dans la liste à défaut.
      const node = { ...body, index: body.index ?? i };
      // Satellite (ou numéro en « bis ») : rangé sous la dernière planète, s'il y en a une.
      if ((body.satellite || /\sbis$/.test(body.number || '')) && out.length) out[out.length - 1].moons.push(node);
      // Sinon : nouvelle planète, sans satellite pour l'instant.
      else out.push({ ...node, moons: [] });
    // Fin du parcours.
    });
    // Renvoie l'arborescence.
    return out;
  // Fin du calcul ; recalculé si les astres changent.
  }, [bodies]);
  // Un seul menu de satellites ouvert : celui de la planète où l'on se trouve (elle-même ou l'un de ses satellites).
  // Quitter la planète le referme tout seul ; recliquer sur la planète courante le replie ou le rouvre.
  // La planète où l'on se trouve : elle-même visée, ou l'un de ses satellites.
  const owner = tree.find((p) => p.index === focus || p.moons.some((m) => m.index === focus));
  // Son nom, seulement si elle a des satellites.
  const ownerName = owner?.moons.length ? owner.name : null;
  // État : menu des satellites replié ou non.
  const [folded, setFolded] = useState(false);
  // En changeant de planète, le menu se déplie.
  useEffect(() => { setFolded(false); }, [ownerName]);

  // Rail : la planète courante et tous ses satellites restent entièrement visibles, même si la liste défile.
  // Effet du rail.
  useEffect(() => {
    // Hors mode compact : fait défiler le rail pour que le groupe courant soit visible.
    if (!compact) groupRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  // Fin de l'effet ; dépendances : le mode compact, l'astre visé et le repli.
  }, [compact, focus, folded]);

  // En bande horizontale, l'astre actif reste visible (y compris quand sa branche de satellites s'ouvre ou se replie).
  // Effet de la bande.
  useEffect(() => {
    // En mode compact : fait défiler la bande pour centrer l'astre visé.
    if (compact) activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  // Fin de l'effet ; mêmes dépendances.
  }, [compact, focus, folded]);

  // Recliquer sur la planète courante replie ou rouvre le menu de ses satellites, et le zoom suit :
  // replié = la planète seule ; déplié = tout son système de satellites.
  // Déclare pickPlanet : clic sur une planète.
  const pickPlanet = (planet) => {
    // Si c'est la planète déjà visée et qu'elle a des satellites.
    if (focus === planet.index && planet.moons.length) {
      // Inverse le repli.
      const fold = !folded;
      // L'enregistre.
      setFolded(fold);
      // Vise la planète seule si le menu est replié, tout son système sinon.
      onSelect(planet.index, { planetOnly: fold });
    // Sinon.
    } else {
      // Vise simplement la planète.
      onSelect(planet.index);
    // Fin du choix.
    }
  // Fin de pickPlanet.
  };

  // En mode compact : la bande horizontale.
  if (compact) {
    // Début du rendu.
    return (
      // La bande (début de la balise).
      <Paper
        // Rendue en balise nav.
        component="nav"
        // Coins carrés.
        square
        // Nom pour les lecteurs d'écran.
        aria-label="Astres"
        // Marqueur de l'élément d'interface « nav-strip ».
        data-hud="nav-strip"
        // Début du style.
        sx={{
          // Fixée sur toute la largeur, juste sous le niveau des barres d'outils.
          position: 'fixed', zIndex: (t) => t.zIndex.toolbar - 5, left: 0, right: 0,
          // Posée au bord bas de l'écran ; la marge de sécurité (barre d'accueil du téléphone) est sous les pastilles.
          // Collée en bas ; hauteur de la bande plus la marge de sécurité, laissée sous les pastilles.
          bottom: 0, height: `calc(${STRIP_H}px + ${safe('bottom')})`, pb: safe('bottom'), boxSizing: 'border-box',
          // Filet en haut ; défile horizontalement seulement.
          borderTop: 1, borderColor: 'divider', overflowX: 'auto', overflowY: 'hidden',
          // Barre de défilement cachée ; le défilement s'accroche aux pastilles.
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, scrollSnapType: 'x proximity',
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* Ligne des pastilles, aussi large que son contenu. */}
        <Stack direction="row" alignItems="center" sx={{ height: '100%', px: 1, width: 'max-content' }}>
          {/* Un élément par planète (début). */}
          {tree.map((planet, i) => {
            // Planète visée ?
            const current = focus === planet.index;
            // A-t-elle des satellites ?
            const hasMoons = planet.moons.length > 0;
            // Sa branche est ouverte si elle en a, que c'est la planète courante et que le menu n'est pas replié.
            const open = hasMoons && planet.name === ownerName && !folded;
            // Début du rendu de la planète.
            return (
              // Fragment de clé unique.
              <Fragment key={planet.name}>
                {/* Tronc : un trait entre deux planètes. */}
                {/* Un trait avant chaque planète, sauf la première. */}
                {i > 0 && <Link />}
                {/* La pastille de la planète (début de la balise). */}
                <Chip
                  // Référence, si la planète est visée.
                  ref={current ? activeRef : undefined}
                  // Icône : la pastille à sa couleur.
                  icon={<Orb color={planet.color} size={12} />}
                  // Libellé (début).
                  label={(
                    // Fragment du libellé.
                    <>
                      {/* Le nom de la planète. */}
                      {planet.name}
                      {/* Si elle a des satellites (début). */}
                      {hasMoons && (
                        // Le chevron (début de la balise).
                        <Box
                          // Rendu en balise span.
                          component="span"
                          // Caché aux lecteurs d'écran.
                          aria-hidden="true"
                          // Tourné vers le bas quand la branche est ouverte, avec transition.
                          sx={{ display: 'inline-block', ml: 0.75, color: current ? 'inherit' : 'text.secondary', fontSize: 17, lineHeight: 1, transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'none' }}
                        // Fin de la balise ouvrante.
                        >
                          {/* Le signe ›. */}
                          ›
                        {/* Fin du chevron. */}
                        </Box>
                      // Fin du cas.
                      )}
                    {/* Fin du fragment du libellé. */}
                    </>
                  // Fin du libellé.
                  )}
                  // Cliquable.
                  clickable
                  // Couleur primaire si elle est visée.
                  color={current ? 'primary' : 'default'}
                  // Pleine si elle est visée, à contour sinon.
                  variant={current ? 'filled' : 'outlined'}
                  // Marque l'élément courant pour les lecteurs d'écran.
                  aria-current={current ? 'true' : undefined}
                  // Indique si la branche est ouverte, seulement s'il y a des satellites.
                  aria-expanded={hasMoons ? open : undefined}
                  // Au clic : choix de la planète.
                  onClick={() => pickPlanet(planet)}
                  // Haute de 40 px, arrondie, point d'accroche du défilement, avec la surbrillance.
                  sx={{ flex: 'none', height: 40, borderRadius: 5, scrollSnapAlign: 'center', '& .MuiChip-icon': { ml: 1.25 }, ...orbHover }}
                // Fin de la pastille de la planète.
                />
                {/* Branche : les satellites de la planète courante, chacun au bout d'un trait à nœud. */}
                {/* Si la branche est ouverte (début). */}
                {open && (
                  // Le groupe des satellites (début de la balise).
                  <Stack
                    // Disposition horizontale.
                    direction="row"
                    // Éléments centrés verticalement.
                    alignItems="center"
                    // Rôle de groupe.
                    role="group"
                    // Nom pour les lecteurs d'écran.
                    aria-label={`Satellites de ${planet.name}`}
                    // Cadre arrondi de 40 px de haut, à bordure fine et fond léger.
                    sx={{ flex: 'none', height: 40, ml: 0.5, pl: 1, pr: 0.75, borderRadius: 5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
                  // Fin de la balise ouvrante.
                  >
                    {/* Un élément par satellite (début). */}
                    {planet.moons.map((moon) => {
                      // Satellite visé ?
                      const moonCurrent = focus === moon.index;
                      // Début du rendu du satellite.
                      return (
                        // Fragment de clé unique.
                        <Fragment key={moon.name}>
                          {/* Un trait à nœud avant le satellite. */}
                          <Link width={12} knot />
                          {/* La pastille du satellite (début de la balise). */}
                          <Chip
                            // Référence, s'il est visé.
                            ref={moonCurrent ? activeRef : undefined}
                            // Petite taille.
                            size="small"
                            // Icône : la pastille à sa couleur.
                            icon={<Orb color={moon.color} size={10} />}
                            // Son nom.
                            label={moon.name}
                            // Cliquable.
                            clickable
                            // Couleur primaire s'il est visé.
                            color={moonCurrent ? 'primary' : 'default'}
                            // Pleine s'il est visé, à contour sinon.
                            variant={moonCurrent ? 'filled' : 'outlined'}
                            // Marque l'élément courant pour les lecteurs d'écran.
                            aria-current={moonCurrent ? 'true' : undefined}
                            // Au clic : vise le satellite.
                            onClick={() => onSelect(moon.index)}
                            // Haute de 30 px, point d'accroche du défilement, avec la surbrillance.
                            sx={{ flex: 'none', height: 30, mr: 0.5, scrollSnapAlign: 'center', '& .MuiChip-icon': { ml: 1 }, ...orbHover }}
                          // Fin de la pastille du satellite.
                          />
                        {/* Fin du fragment. */}
                        </Fragment>
                      // Fin du rendu du satellite.
                      );
                    // Fin des satellites.
                    })}
                  {/* Fin du groupe des satellites. */}
                  </Stack>
                // Fin du cas.
                )}
              {/* Fin du fragment. */}
              </Fragment>
            // Fin du rendu de la planète.
            );
          // Fin des planètes.
          })}
        {/* Fin de la ligne des pastilles. */}
        </Stack>
      {/* Fin de la bande. */}
      </Paper>
    // Fin du rendu.
    );
  // Fin du mode compact.
  }

  // Grand écran : le rail vertical (début du rendu).
  return (
    // Le rail (début de la balise).
    <Paper
      // Rendu en balise nav.
      component="nav"
      // Ombre moyenne.
      elevation={4}
      // Nom pour les lecteurs d'écran.
      aria-label="Navigation du système solaire"
      // Référence pour le déplacement.
      ref={drag.ref}
      // Style de position, après déplacement.
      style={drag.style}
      // Début du style.
      sx={{
        // Fixé au bord gauche, centré verticalement, au niveau du HUD.
        position: 'fixed', zIndex: (t) => t.zIndex.hud, left: edge('left'), top: '50%', transform: 'translateY(-50%)',
        // Largeur du rail ; hauteur limitée, avec défilement vertical fin.
        width: RAIL, maxHeight: 'calc(100dvh - 120px)', overflowY: 'auto', scrollbarWidth: 'thin',
        // Marges intérieures ; arrondi à droite seulement.
        p: '14px 10px 18px', borderRadius: '0 16px 16px 0',
        // Couleurs du thème (bleu la nuit, blanc et gris le jour) : voir theme.jsx.
        // Couleur unie et non dégradé : une transition CSS ne sait pas fondre un dégradé (changement de thème).
        // Fond uni : bleu nuit en thème sombre, gris clair sinon.
        bgcolor: (t) => (t.palette.mode === 'dark' ? '#0d1a3c' : '#c9ced6'),
        // Bordure fine.
        border: 1, borderColor: 'divider',
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* L'en-tête du rail (début de la balise). */}
      <Box
        // Propriétés de la poignée de déplacement.
        {...drag.handleProps}
        // Début du style.
        sx={{
          // Icône et titre en ligne, en demi-gras, couleur secondaire.
          display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, pb: 1.75, color: 'text.secondary', fontSize: 14, fontWeight: 600,
          // Curseur en main, texte non sélectionnable, gestes tactiles réservés.
          cursor: 'grab', userSelect: 'none', touchAction: 'none',
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* Le symbole de poignée, décoratif. */}
        <Box component="span" aria-hidden="true" sx={{ color: 'text.disabled', fontSize: 20, lineHeight: 1 }}>⠿</Box>
        {/* Le titre « Navigation ». */}
        Navigation
      {/* Fin de l'en-tête. */}
      </Box>

      {/* La liste des planètes, en colonne. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {/* Un groupe par planète (début). */}
        {tree.map((planet) => {
          // Planète visée ?
          const current = focus === planet.index;
          // A-t-elle des satellites ?
          const hasMoons = planet.moons.length > 0;
          // Sa branche est ouverte si elle en a, que c'est la planète courante et que le menu n'est pas replié.
          const open = hasMoons && planet.name === ownerName && !folded;
          // Début du rendu du groupe.
          return (
            // Le groupe, de clé unique ; il reçoit la référence si c'est la planète courante.
            <Box key={planet.name} ref={planet.name === owner?.name ? groupRef : undefined}>
              {/* Le bouton de la planète (début de la balise). */}
              <ButtonBase
                // Marque l'élément courant pour les lecteurs d'écran.
                aria-current={current ? 'true' : undefined}
                // Indique si la branche est ouverte, seulement s'il y a des satellites.
                aria-expanded={hasMoons ? open : undefined}
                // Au clic : choix de la planète.
                onClick={() => pickPlanet(planet)}
                // Début du style.
                sx={{
                  // Toute la largeur, 38 px de haut au moins, contenu en ligne.
                  width: '100%', minHeight: 38, display: 'flex', alignItems: 'center', gap: 1.5, px: '13px', py: '4px',
                  // Bordure transparente, forme arrondie, texte aligné à gauche.
                  border: '1px solid transparent', borderRadius: '24px', color: 'text.primary', fontSize: 14, textAlign: 'left',
                  // Fond de survol.
                  '&:hover': { bgcolor: 'action.hover' },
                  // Planète visée : fond de sélection, bordure visible et fond de survol plus marqué.
                  ...(current && { bgcolor: 'action.selected', borderColor: 'divider', '&:hover': { bgcolor: 'action.focus' } }),
                  // La surbrillance de la pastille.
                  ...orbHover,
                // Fin du style.
                }}
              // Fin de la balise ouvrante.
              >
                {/* La pastille de la planète. */}
                <Orb color={planet.color} size={14} />
                {/* Son nom, qui prend la largeur restante. */}
                <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{planet.name}</Box>
                {/* Son numéro (début de la balise), décoratif, en chiffres de largeur fixe. */}
                <Box component="span" aria-hidden="true" sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {/* Le numéro fourni, sinon l'indice plus un, sur deux chiffres. */}
                  {planet.number ?? String(planet.index + 1).padStart(2, '0')}
                {/* Fin du numéro. */}
                </Box>
                {/* Si elle a des satellites (début). */}
                {hasMoons && (
                  // Le chevron (début de la balise).
                  <Box
                    // Rendu en balise span.
                    component="span"
                    // Caché aux lecteurs d'écran.
                    aria-hidden="true"
                    // Tourné vers le bas quand la branche est ouverte, avec transition.
                    sx={{ width: 14, color: 'text.secondary', fontSize: 23, lineHeight: 1, transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'none' }}
                  // Fin de la balise ouvrante.
                  >
                    {/* Le signe ›. */}
                    ›
                  {/* Fin du chevron. */}
                  </Box>
                // Fin du cas.
                )}
              {/* Fin du bouton de la planète. */}
              </ButtonBase>

              {/* Si la branche est ouverte (début). */}
              {open && (
                // Le bloc des satellites, en retrait, bordé à gauche d'un trait vertical.
                <Box sx={{ position: 'relative', m: '2px 0 8px 27px', p: '1px 0 2px 25px', borderLeft: 1, borderColor: 'divider' }}>
                  {/* Un bouton par satellite (début). */}
                  {planet.moons.map((moon) => {
                    // Satellite visé ?
                    const moonCurrent = focus === moon.index;
                    // Début du rendu du satellite.
                    return (
                      // Le bouton du satellite (début de la balise).
                      <ButtonBase
                        // Clé unique : son nom.
                        key={moon.name}
                        // Marque l'élément courant pour les lecteurs d'écran.
                        aria-current={moonCurrent ? 'true' : undefined}
                        // Au clic : vise le satellite.
                        onClick={() => onSelect(moon.index)}
                        // Début du style.
                        sx={{
                          // Toute la largeur, 30 px de haut au moins, contenu aligné à gauche.
                          position: 'relative', width: '100%', minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                          // Marges, arrondi et texte un peu plus petit.
                          gap: 1.5, p: '3px 10px 3px 12px', borderRadius: '9px', color: 'text.primary', fontSize: 13, textAlign: 'left',
                          // Fond de survol.
                          '&:hover': { bgcolor: 'action.hover' },
                          // Satellite visé : fond bleuté.
                          ...(moonCurrent && { bgcolor: 'rgba(65, 112, 180, .2)' }),
                          // La surbrillance de la pastille.
                          ...orbHover,
                        // Fin du style.
                        }}
                      // Fin de la balise ouvrante.
                      >
                        {/* Branche de l'arborescence : trait horizontal terminé par un nœud. */}
                        {/* Le trait de la branche (début de la balise). */}
                        <Box
                          // Rendu en balise span.
                          component="span"
                          // Caché aux lecteurs d'écran.
                          aria-hidden="true"
                          // Début du style.
                          sx={{
                            // Trait horizontal de 22 px, à gauche du bouton, à mi-hauteur.
                            position: 'absolute', left: -26, top: '50%', width: 22, height: '1px', bgcolor: 'divider',
                            // Terminé par un nœud rond de 7 px.
                            '&::before': { content: '""', position: 'absolute', left: -1, top: -3, width: 7, height: 7, borderRadius: '50%', bgcolor: 'text.disabled' },
                          // Fin du style.
                          }}
                        // Fin du trait.
                        />
                        {/* La pastille du satellite. */}
                        <Orb color={moon.color} size={17} />
                        {/* Son nom, qui prend la largeur restante. */}
                        <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{moon.name}</Box>
                      {/* Fin du bouton du satellite. */}
                      </ButtonBase>
                    // Fin du rendu du satellite.
                    );
                  // Fin des satellites.
                  })}
                {/* Fin du bloc des satellites. */}
                </Box>
              // Fin du cas.
              )}
            {/* Fin du groupe. */}
            </Box>
          // Fin du rendu du groupe.
          );
        // Fin des groupes.
        })}
      {/* Fin de la liste des planètes. */}
      </Box>
    {/* Fin du rail. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de Navigator.
});
