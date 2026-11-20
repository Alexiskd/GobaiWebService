// Importe de React Fragment, memo et les crochets useEffect, useMemo, useRef et useState.
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
// Arborescence des astres (Soleil → Planètes / Planètes naines → planète → satellites).
import { navTree, pathTo } from './navTree.js';
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

/** Flèche de dépliage, tournée quand la branche est ouverte ; place gardée quand il n'y a rien à déplier. */
const Chevron = ({ open, show = true, size = 20 }) => (
  <Box component="span" aria-hidden="true" sx={{
    flex: 'none', width: 14, color: 'text.secondary', fontSize: size, lineHeight: 1, textAlign: 'center',
    transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'none', visibility: show ? 'visible' : 'hidden',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  }}>›</Box>
);

/**
 * Navigation des astres, en arborescence (la même que la documentation des astres) : le Soleil en tête ; dessous, « Planètes » et
 * « Planètes naines » ; sous chaque planète, ses satellites.
 *
 *  - Ordinateur : rail de gauche dépliable. Un appui sur un astre le vise et déplie ses enfants ; un nouvel appui sur
 *    l'astre visé replie ses enfants (une planète repliée est alors visée seule, sans son système). Les branches se
 *    déplient sans rien viser. Le chemin vers l'astre visé se déplie tout seul.
 *  - Téléphone : bande du bas en navigation par niveaux (Soleil et branches, puis planètes, puis satellites), avec
 *    un bouton « ‹ » pour remonter : une seule rangée de 44 px de haut, défilante, sans chevauchement.
 *
 * `onMovedChange(moved)` prévient le parent quand le rail est déplacé à la main ou remis en place : l'assistant, qui
 * s'écarte du rail quand il est à sa place d'origine, reste alors à la sienne.
 */
export const Navigator = memo(function Navigator({ bodies, focus, onSelect, onMovedChange }) {
  const { compact } = useViewport();
  const drag = useHudDraggable('navigation', !compact);
  const moved = Boolean(drag.moved);
  useEffect(() => { onMovedChange?.(!compact && moved); }, [compact, moved, onMovedChange]);
  useEffect(() => () => onMovedChange?.(false), [onMovedChange]);

  const tree = useMemo(() => navTree(bodies), [bodies]);
  const path = useMemo(() => pathTo(tree, focus), [tree, focus]);

  // Nœuds dépliés (ordinateur) : 'soleil', 'planetes', 'naines', ou l'indice d'une planète. Le chemin vers l'astre
  // visé s'y ajoute à chaque changement de cible ; ce que l'utilisateur a déplié reste déplié.
  const [open, setOpen] = useState(() => new Set(['soleil']));
  useEffect(() => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.add('soleil');
      if (path.branch) next.add(path.branch);
      if (path.planet != null) next.add(path.planet);
      return next;
    });
  }, [path.branch, path.planet]);
  const toggle = (key) => setOpen((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  /** Appui sur une planète : la vise et déplie ses satellites ; sur la planète déjà visée, replie ou rouvre son système. */
  const pickPlanet = (planet) => {
    if (focus === planet.index && planet.moons.length) {
      const willOpen = !open.has(planet.index);
      toggle(planet.index);
      onSelect(planet.index, { planetOnly: !willOpen });
      return;
    }
    onSelect(planet.index);
  };

  // Téléphone : niveau affiché dans la bande ('racine', l'identifiant d'une branche, ou l'indice d'une planète).
  const [level, setLevel] = useState('racine');
  // Changement de cible venu d'ailleurs (assistant, clic dans la scène) : la bande descend au niveau de l'astre.
  useEffect(() => {
    if (!compact) return;
    if (path.planet != null) {
      const planet = tree.branches.flatMap((b) => b.planets).find((p) => p.index === path.planet);
      setLevel(planet?.moons.length && focus !== planet.index ? planet.index : path.branch);
    }
  }, [compact, focus, path.branch, path.planet, tree]);

  const activeRef = useRef(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [focus, open, level]);

  if (compact) {
    const branch = tree.branches.find((b) => b.id === level);
    const planet = typeof level === 'number' ? tree.branches.flatMap((b) => b.planets).find((p) => p.index === level) : null;
    const up = planet ? (tree.branches.find((b) => b.planets.includes(planet))?.id ?? 'racine') : branch ? 'racine' : null;
    const chip = (b, { onClick, more = false, small = false } = {}) => {
      const current = focus === b.index;
      return (
        <Chip
          key={b.index ?? b.id}
          ref={current ? activeRef : undefined}
          icon={b.color ? <Orb color={b.color} size={small ? 10 : 12} /> : undefined}
          label={<>{b.name}{more && <Box component="span" aria-hidden="true" sx={{ ml: 0.75, fontSize: 17, lineHeight: 1 }}>›</Box>}</>}
          clickable
          color={current ? 'primary' : 'default'}
          variant={current ? 'filled' : 'outlined'}
          aria-current={current ? 'true' : undefined}
          onClick={onClick}
          sx={{ flex: 'none', height: 44, borderRadius: 5.5, scrollSnapAlign: 'center', '& .MuiChip-icon': { ml: 1.25 }, ...orbHover }}
        />
      );
    };
    return (
      <Paper
        component="nav"
        square
        aria-label="Astres"
        data-hud="nav-strip"
        sx={{
          position: 'relative', height: STRIP_H + 4, boxSizing: 'border-box', pl: safe('left'), pr: safe('right'),
          borderTop: 1, borderColor: 'divider', overflowX: 'auto', overflowY: 'hidden',
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, scrollSnapType: 'x proximity',
        }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', height: '100%', px: 1, width: 'max-content' }}>
          {up && (
            <Chip
              label="‹"
              clickable
              aria-label={up === 'racine' ? 'Revenir au Soleil' : 'Revenir aux planètes'}
              onClick={() => setLevel(up)}
              sx={{ flex: 'none', height: 44, minWidth: 44, borderRadius: 5.5, fontSize: 22, '& .MuiChip-label': { px: 1.25 } }}
            />
          )}
          {level === 'racine' && (
            <>
              {tree.sun && chip(tree.sun, { onClick: () => onSelect(tree.sun.index) })}
              {tree.branches.map((b, i) => (
                <Fragment key={b.id}>
                  {(i > 0 || tree.sun) && <Link />}
                  <Chip
                    label={<>{b.name} <Box component="span" sx={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{b.planets.length}</Box><Box component="span" aria-hidden="true" sx={{ ml: 0.75, fontSize: 17, lineHeight: 1 }}>›</Box></>}
                    clickable variant="outlined" onClick={() => setLevel(b.id)}
                    sx={{ flex: 'none', height: 44, borderRadius: 5.5 }}
                  />
                </Fragment>
              ))}
            </>
          )}
          {branch && branch.planets.map((p, i) => (
            <Fragment key={p.index}>
              {i > 0 && <Link />}
              {chip(p, {
                more: p.moons.length > 0,
                onClick: () => { onSelect(p.index); if (p.moons.length) setLevel(p.index); },
              })}
            </Fragment>
          ))}
          {planet && (
            <>
              {chip(planet, { onClick: () => onSelect(planet.index, { planetOnly: true }) })}
              <Stack direction="row" role="group" aria-label={`Satellites de ${planet.name}`} spacing={0.5}
                sx={{ alignItems: 'center', flex: 'none', height: 44, pl: 1, pr: 0.75, borderRadius: 5.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
                {planet.moons.map((m) => (
                  <Fragment key={m.index}>
                    <Link width={12} knot />
                    {chip(m, { small: true, onClick: () => onSelect(m.index) })}
                  </Fragment>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    );
  }

  // Ordinateur : rail de gauche, ajusté à la fenêtre (voir RAIL_W, RAIL_TOP, RAIL_BOTTOM dans theme/layout).
  const short = '@media (max-height: 760px)';
  const row = (depth, current) => ({
    width: '100%', minHeight: 36, [MQ.coarse]: { minHeight: 44 }, [short]: { minHeight: 30 },
    display: 'flex', alignItems: 'center', gap: 1, pl: `${8 + depth * 14}px`, pr: 1.25, py: '3px',
    border: '1px solid transparent', borderRadius: '20px', color: 'text.primary', fontSize: depth >= 3 ? 13 : 14, lineHeight: 1.3, textAlign: 'left',
    '&:hover': { bgcolor: 'action.hover' },
    ...(current && { bgcolor: 'action.selected', borderColor: 'divider', '&:hover': { bgcolor: 'action.focus' } }),
    ...orbHover,
  });
  const name = (text) => <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</Box>;
  const count = (n) => <Box component="span" aria-hidden="true" sx={{ flex: 'none', fontSize: 11, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{n}</Box>;
  const sunOpen = open.has('soleil');

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
        maxHeight: `calc(100dvh - ${safe('top')} - ${safe('bottom')} - ${RAIL_TOP + RAIL_BOTTOM}px)`,
        width: RAIL_W, maxWidth: `calc(100vw - ${safe('left')} - ${safe('right')} - 28px)`, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: '0 16px 16px 0',
        bgcolor: (t) => (t.palette.mode === 'dark' ? '#0d1a3c' : '#c9ced6'),
        border: 1, borderColor: 'divider',
      }}
    >
      {/* En-tête (poignée de déplacement) : toujours visible, l'arborescence défile dessous. */}
      <Box
        {...drag.handleProps}
        sx={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 1.25, px: 2.25, pt: 1.75, pb: 1.25,
          color: 'text.secondary', fontSize: 14, fontWeight: 600, borderBottom: 1, borderColor: 'divider',
          cursor: 'grab', userSelect: 'none', touchAction: 'none', [short]: { pt: 1.25, pb: 0.75 },
        }}
      >
        <Box component="span" aria-hidden="true" sx={{ color: 'text.disabled', fontSize: 20, lineHeight: 1 }}>⠿</Box>
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>Navigation</Box>
      </Box>

      <Box role="tree" aria-label="Astres" sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', p: '6px 6px 10px' }}>
        {/* Le Soleil, racine : l'appui le vise et déplie ou replie les branches. */}
        {tree.sun && (
          <ButtonBase
            role="treeitem" aria-level={1} aria-expanded={sunOpen} aria-current={focus === tree.sun.index ? 'true' : undefined}
            ref={focus === tree.sun.index ? activeRef : undefined}
            onClick={() => { if (focus === tree.sun.index) toggle('soleil'); else { onSelect(tree.sun.index); setOpen((p) => new Set(p).add('soleil')); } }}
            sx={{ ...row(0, focus === tree.sun.index), fontWeight: 600, fontSize: 15 }}
          >
            <Chevron open={sunOpen} />
            <Orb color={tree.sun.color} size={16} />
            {name(tree.sun.name)}
          </ButtonBase>
        )}
        {(sunOpen || !tree.sun) && tree.branches.map((branch) => {
          const bOpen = open.has(branch.id);
          return (
            <Box key={branch.id}>
              {/* Branche : se déplie sans rien viser. */}
              <ButtonBase role="treeitem" aria-level={2} aria-expanded={bOpen} onClick={() => toggle(branch.id)}
                sx={{ ...row(1, false), color: 'text.secondary', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                <Chevron open={bOpen} />
                {name(branch.name)}
                {count(branch.planets.length)}
              </ButtonBase>
              {bOpen && branch.planets.map((planet) => {
                const current = focus === planet.index;
                const pOpen = planet.moons.length > 0 && open.has(planet.index);
                return (
                  <Box key={planet.index}>
                    <ButtonBase role="treeitem" aria-level={3} aria-expanded={planet.moons.length ? pOpen : undefined}
                      aria-current={current ? 'true' : undefined} ref={current ? activeRef : undefined}
                      onClick={() => { pickPlanet(planet); if (!current && planet.moons.length) setOpen((p) => new Set(p).add(planet.index)); }}
                      title={planet.name} sx={row(2, current)}>
                      <Chevron open={pOpen} show={planet.moons.length > 0} />
                      <Orb color={planet.color} size={14} />
                      {name(planet.name)}
                      {planet.moons.length > 0 && count(planet.moons.length)}
                    </ButtonBase>
                    {pOpen && (
                      // Système à nombreux satellites : sa liste défile dans sa zone, bornée à 40 % de la hauteur.
                      <Box role="group" aria-label={`Satellites de ${planet.name}`}
                        sx={{ ml: '38px', borderLeft: 1, borderColor: 'divider', maxHeight: 'min(360px, 40dvh)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}>
                        {planet.moons.map((moon) => {
                          const mCurrent = focus === moon.index;
                          return (
                            <ButtonBase key={moon.index} role="treeitem" aria-level={4} aria-current={mCurrent ? 'true' : undefined}
                              ref={mCurrent ? activeRef : undefined} onClick={() => onSelect(moon.index)} title={moon.name}
                              sx={{ ...row(0, false), pl: 1.25, borderRadius: '9px', fontSize: 13, ...(mCurrent && { bgcolor: 'rgba(65, 112, 180, .2)' }) }}>
                              <Orb color={moon.color} size={12} />
                              {name(moon.name)}
                            </ButtonBase>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
});
