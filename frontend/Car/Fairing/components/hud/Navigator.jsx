// Importe de React Fragment, memo et les crochets useEffect, useMemo, useRef et useState.
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
// Importe de MUI Box, ButtonBase (bouton nu), Chip (pastille cliquable), Paper et Stack.
import { Box, ButtonBase, Chip, Paper, Stack } from '@mui/material';
// Importe le crochet de déplacement des panneaux.
import { useHudDraggable } from '@/Fairing/hooks/useHudDraggable';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe la largeur du rail, la hauteur de la bande et edge, la distance à un bord.
import { RAIL_BOTTOM, RAIL_TOP, RAIL_W, STRIP_H, edge } from '@/Fairing/theme/layout';
// Importe MQ (requêtes média, dont l'écran tactile) et safe, qui donne une marge de sécurité de l'écran.
import { MQ, safe } from '@/Fairing/theme/mediaQueries';

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
    if (compact) return;
    groupRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // Satellite visé : visible aussi dans la liste des satellites, qui défile dans sa propre zone.
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
          // Dans le flux du dock du bas (MobileDock), juste au-dessus de la navigation : jamais dessous, sur toute la
          // largeur ; la navigation porte la marge de sécurité du bas, les côtés gardent celles de l'encoche (paysage).
          position: 'relative', height: STRIP_H + 4, boxSizing: 'border-box', pl: safe('left'), pr: safe('right'),
          // Filet en haut ; défile horizontalement seulement.
          borderTop: 1, borderColor: 'divider', overflowX: 'auto', overflowY: 'hidden',
          // Barre de défilement cachée ; le défilement s'accroche aux pastilles.
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, scrollSnapType: 'x proximity',
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* Ligne des pastilles, aussi large que son contenu. */}
        <Stack direction="row" sx={{ alignItems: 'center', height: '100%', px: 1, width: 'max-content' }}>
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
                  sx={{ flex: 'none', height: 44, borderRadius: 5.5, scrollSnapAlign: 'center', '& .MuiChip-icon': { ml: 1.25 }, ...orbHover }}
                // Fin de la pastille de la planète.
                />
                {/* Branche : les satellites de la planète courante, chacun au bout d'un trait à nœud. */}
                {/* Si la branche est ouverte (début). */}
                {open && (
                  // Le groupe des satellites (début de la balise).
                  <Stack
                    // Disposition horizontale.
                    direction="row"
                    // Rôle de groupe.
                    role="group"
                    // Nom pour les lecteurs d'écran.
                    aria-label={`Satellites de ${planet.name}`}
                    // Cadre arrondi de 40 px de haut, à bordure fine et fond léger.
                    sx={{ alignItems: 'center', flex: 'none', height: 44, ml: 0.5, pl: 1, pr: 0.75, borderRadius: 5.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
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
                            sx={{ flex: 'none', height: 44, mr: 0.5, scrollSnapAlign: 'center', '& .MuiChip-icon': { ml: 1 }, ...orbHover }}
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

  // Ordinateur : rail de gauche, ajusté à la fenêtre (voir RAIL_W, RAIL_TOP, RAIL_BOTTOM dans theme/layout) :
  //  - largeur fluide, de 208 à 260 px selon la largeur de la fenêtre ;
  //  - posé entre le bandeau du haut et la barre d'outils du bas, centré dans cette zone (haut + bas + marge auto),
  //    jamais plus haut qu'elle : au-delà, la liste défile à l'intérieur et l'en-tête reste visible ;
  //  - écran bas (moins de 760 px) : lignes plus serrées ; la liste d'un système à très nombreux satellites
  //    (Jupiter, Saturne) défile dans sa propre zone, pour que les planètes suivantes restent accessibles ;
  //  - noms trop longs terminés par « … » (nom complet en infobulle) : rien ne passe sous les numéros.
  const short = '@media (max-height: 760px)';
  return (
    <Paper
      component="nav"
      elevation={4}
      aria-label="Navigation du système solaire"
      ref={drag.ref}
      style={drag.style}
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.hud, left: edge('left'),
        top: edge('top', RAIL_TOP), bottom: edge('bottom', RAIL_BOTTOM), height: 'fit-content', my: 'auto',
        // Même hauteur maximale une fois déplacé à la main (le haut est alors fixé, le bas libéré).
        maxHeight: `calc(100dvh - ${safe('top')} - ${safe('bottom')} - ${RAIL_TOP + RAIL_BOTTOM}px)`,
        width: RAIL_W, maxWidth: `calc(100vw - ${safe('left')} - ${safe('right')} - 28px)`, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: '0 16px 16px 0',
        bgcolor: (t) => (t.palette.mode === 'dark' ? '#0d1a3c' : '#c9ced6'),
        border: 1, borderColor: 'divider',
      }}
    >
      {/* En-tête (poignée de déplacement) : toujours visible, la liste défile dessous. */}
      <Box
        {...drag.handleProps}
        sx={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 1.25, px: 2.25, pt: 1.75, pb: 1.25,
          color: 'text.secondary', fontSize: 14, fontWeight: 600, borderBottom: 1, borderColor: 'divider',
          cursor: 'grab', userSelect: 'none', touchAction: 'none',
          [short]: { pt: 1.25, pb: 0.75 },
        }}
      >
        <Box component="span" aria-hidden="true" sx={{ color: 'text.disabled', fontSize: 20, lineHeight: 1 }}>⠿</Box>
        <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Navigation</Box>
      </Box>

      {/* Liste des astres : seule partie qui défile. */}
      <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: 0.25, p: '8px 8px 12px', [short]: { gap: 0, py: 0.5 } }}>
        {tree.map((planet) => {
          const current = focus === planet.index;
          const hasMoons = planet.moons.length > 0;
          const open = hasMoons && planet.name === ownerName && !folded;
          return (
            <Box key={planet.name} ref={planet.name === owner?.name ? groupRef : undefined} sx={{ flex: 'none' }}>
              <ButtonBase
                aria-current={current ? 'true' : undefined}
                aria-expanded={hasMoons ? open : undefined}
                onClick={() => pickPlanet(planet)}
                title={planet.name}
                sx={{
                  width: '100%', minHeight: 38, [MQ.coarse]: { minHeight: 44 }, display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: '4px',
                  border: '1px solid transparent', borderRadius: '24px', color: 'text.primary', fontSize: 14, lineHeight: 1.3, textAlign: 'left',
                  [short]: { minHeight: 32, fontSize: 13.5 },
                  '&:hover': { bgcolor: 'action.hover' },
                  ...(current && { bgcolor: 'action.selected', borderColor: 'divider', '&:hover': { bgcolor: 'action.focus' } }),
                  ...orbHover,
                }}
              >
                <Orb color={planet.color} size={14} />
                <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{planet.name}</Box>
                {/* Nombre de satellites, discret. */}
                {hasMoons && (
                  <Box component="span" aria-hidden="true" sx={{ flex: 'none', fontSize: 11, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{planet.moons.length}</Box>
                )}
                <Box component="span" aria-hidden="true" sx={{ flex: 'none', fontSize: 12, fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {planet.number ?? String(planet.index + 1).padStart(2, '0')}
                </Box>
                {/* Flèche de dépliage ; place gardée sans satellites, pour que les numéros restent alignés. */}
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{ flex: 'none', width: 14, color: 'text.secondary', fontSize: 23, lineHeight: 1, transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'none', visibility: hasMoons ? 'visible' : 'hidden' }}
                >
                  ›
                </Box>
              </ButtonBase>

              {open && (
                <Box
                  role="group"
                  aria-label={`Satellites de ${planet.name}`}
                  sx={{
                    position: 'relative', m: '2px 0 6px 22px', p: '1px 2px 2px 20px', borderLeft: 1, borderColor: 'divider',
                    // Système à nombreux satellites : sa liste défile dans sa zone, bornée à 40 % de la hauteur.
                    maxHeight: 'min(360px, 40dvh)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin',
                  }}
                >
                  {planet.moons.map((moon) => {
                    const moonCurrent = focus === moon.index;
                    return (
                      <ButtonBase
                        key={moon.name}
                        ref={moonCurrent ? activeRef : undefined}
                        aria-current={moonCurrent ? 'true' : undefined}
                        onClick={() => onSelect(moon.index)}
                        title={moon.name}
                        sx={{
                          position: 'relative', width: '100%', minHeight: 30, [MQ.coarse]: { minHeight: 44 }, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                          gap: 1.25, p: '3px 8px 3px 10px', borderRadius: '9px', color: 'text.primary', fontSize: 13, lineHeight: 1.3, textAlign: 'left',
                          [short]: { minHeight: 28 },
                          '&:hover': { bgcolor: 'action.hover' },
                          ...(moonCurrent && { bgcolor: 'rgba(65, 112, 180, .2)' }),
                          ...orbHover,
                        }}
                      >
                        <Box
                          component="span"
                          aria-hidden="true"
                          sx={{
                            position: 'absolute', left: -21, top: '50%', width: 18, height: '1px', bgcolor: 'divider',
                            '&::before': { content: '""', position: 'absolute', left: -1, top: -3, width: 7, height: 7, borderRadius: '50%', bgcolor: 'text.disabled' },
                          }}
                        />
                        <Orb color={moon.color} size={15} />
                        <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{moon.name}</Box>
                      </ButtonBase>
                    );
                  })}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
// Fin de Navigator.
});
