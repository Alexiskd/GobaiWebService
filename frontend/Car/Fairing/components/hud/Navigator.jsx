// Importe de React Fragment, memo et les crochets useEffect, useMemo, useRef et useState.
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
// Arborescence des astres (Soleil → Planètes / Planètes naines → planète → satellites).
import { navTree, pathTo } from './navTree.js';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Chip } from '@/Fairing/kit';
// Importe les conversions des valeurs de style calculées au rendu.
import { sz } from '@/Fairing/kit/sx';
// Importe le crochet de déplacement des panneaux.
import { useHudDraggable } from '@/Fairing/hooks/useHudDraggable';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe la largeur du rail, la hauteur de la bande et edge, la distance à un bord.
import { RAIL_BOTTOM, RAIL_TOP, RAIL_W, edge } from '@/Fairing/theme/layout';
// Importe MQ (requêtes média, dont l'écran tactile) et safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/Fairing/theme/mediaQueries';

/** Pastille de l'astre, à sa couleur : reflet en haut à gauche, ombre vers le bas. */
// Déclare le composant Orb : reçoit la couleur et la taille (14 px par défaut).
const Orb = ({ color, size = 14 }) => (
  // La pastille (début de la balise).
  <div
    // Cachée aux lecteurs d'écran.
    aria-hidden="true"
    // Début du style.
    className="nav-orb relative rounded-full flex-none inline-block [transition:box-shadow_.25s_ease,filter_.25s_ease,transform_.25s_cubic-bezier(.3,1.6,.5,1)]" style={{ '--orb': color, width: sz(size), height: sz(size), background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.8), transparent 22%),
        radial-gradient(circle at 35% 30%, ${color}, color-mix(in srgb, ${color}, #101522 45%))` }}
  // Fin de la pastille.
  />
// Fin de Orb.
);

// Le survol d'une ligne ou d'une pastille agrandit et éclaire sa pastille d'astre (`.nav-orb`) : voir theme/app.css.

/** Trait de l'arborescence horizontale (téléphone) : relie deux astres ; `knot` = nœud au départ d'une branche. */
// Déclare le composant Link : largeur (10 px par défaut) et nœud (non par défaut).
const Link = ({ width = 10, knot = false }) => (
  // Le trait (début de la balise).
  <div
    // Caché aux lecteurs d'écran.
    aria-hidden="true"
    // Début du style.
    className={`relative flex-none h-[1px] ${knot ? 'bg-faint' : 'bg-line'} ${knot ? 'before:absolute before:-left-0.75 before:-top-0.75 before:w-1.75 before:h-1.75 before:rounded-full before:bg-faint' : ''}`}
  // Fin du trait.
  />
// Fin de Link.
);

/** Flèche de dépliage, tournée quand la branche est ouverte ; place gardée quand il n'y a rien à déplier. */
const Chevron = ({ open, show = true, size = 20 }) => (
  <span aria-hidden="true" className={`flex-none w-3.5 text-soft leading-none text-center [transition:transform_.18s_ease] ${open ? '[transform:rotate(90deg)]' : '[transform:none]'} ${show ? 'visible' : 'invisible'} motion-reduce:[transition:none]`} style={{ fontSize: size }}>›</span>
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
          label={<>{b.name}{more && <span aria-hidden="true" className="ml-1.5 text-[17px] leading-none">›</span>}</>}
          clickable
          color={current ? 'primary' : 'default'}
          variant={current ? 'filled' : 'outlined'}
          aria-current={current ? 'true' : undefined}
          onClick={onClick}
          className="nav-chip flex-none h-11 rounded-full snap-center [&_.g-chip-icon]:ml-2.5"
        />
      );
    };
    return (
      <nav
        aria-label="Astres"
        data-hud="nav-strip"
        className="m-strip"
      >
        <div className="m-strip-row">
          {up && (
            <Chip
              label="‹"
              clickable
              aria-label={up === 'racine' ? 'Revenir au Soleil' : 'Revenir aux planètes'}
              onClick={() => setLevel(up)}
              className="flex-none h-11 min-w-11 rounded-full text-[22px] [&_.g-chip-label]:px-2.5"
            />
          )}
          {level === 'racine' && (
            <>
              {tree.sun && chip(tree.sun, { onClick: () => onSelect(tree.sun.index) })}
              {tree.branches.map((b, i) => (
                <Fragment key={b.id}>
                  {(i > 0 || tree.sun) && <Link />}
                  <Chip
                    label={<>{b.name} <span className="opacity-70 tabular-nums">{b.planets.length}</span><span aria-hidden="true" className="ml-1.5 text-[17px] leading-none">›</span></>}
                    clickable variant="outlined" onClick={() => setLevel(b.id)}
                    className="flex-none h-11 rounded-full"
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
              <div role="group" aria-label={`Satellites de ${planet.name}`}
                className="flex flex-row gap-1 items-center flex-none h-11 pl-2 pr-1.5 rounded-full border border-line bg-hover">
                {planet.moons.map((m) => (
                  <Fragment key={m.index}>
                    <Link width={12} knot />
                    {chip(m, { small: true, onClick: () => onSelect(m.index) })}
                  </Fragment>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>
    );
  }

  // Ordinateur : rail de gauche, ajusté à la fenêtre (voir RAIL_W, RAIL_TOP, RAIL_BOTTOM dans theme/layout).
  // Les lignes de l'arbre portent la classe `nav-row` (theme/app.css) ; leur retrait suit `--depth`.
  const depth = (n) => ({ '--depth': n });
  const name = (text) => <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{text}</span>;
  const count = (n) => <span aria-hidden="true" className="flex-none text-[11px] text-faint tabular-nums">{n}</span>;
  const sunOpen = open.has('soleil');

  return (
    <nav
      aria-label="Navigation du système solaire"
      ref={drag.ref}
      className="g-paper bg-nav fixed z-[20] h-fit my-auto box-border flex flex-col overflow-hidden rounded-[0_12px_12px_0] border border-line" style={{ ...drag.style, left: edge('left'), top: edge('top', RAIL_TOP), bottom: edge('bottom', RAIL_BOTTOM), maxHeight: `calc(100dvh - ${safe('top')} - ${safe('bottom')} - ${RAIL_TOP + RAIL_BOTTOM}px)`, width: sz(RAIL_W), maxWidth: `calc(100vw - ${safe('left')} - ${safe('right')} - 28px)`,  }}
    >
      {/* En-tête (poignée de déplacement) : toujours visible, l'arborescence défile dessous. */}
      <div
        {...drag.handleProps}
        className="flex-none flex items-center gap-2.5 px-4.5 pt-3.5 pb-2.5 text-soft text-[14px] font-semibold border-b border-line cursor-grab select-none touch-none"
      >
        <span aria-hidden="true" className="text-faint text-[20px] leading-none">⠿</span>
        <span className="flex-1 min-w-0">Navigation</span>
      </div>

      <div role="tree" aria-label="Astres" className="flex-auto min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] p-[6px_6px_10px]">
        {/* Le Soleil, racine : l'appui le vise et déplie ou replie les branches. */}
        {tree.sun && (
          <button type="button"
            role="treeitem" aria-level={1} aria-expanded={sunOpen} aria-current={focus === tree.sun.index ? 'true' : undefined}
            ref={focus === tree.sun.index ? activeRef : undefined}
            onClick={() => { if (focus === tree.sun.index) toggle('soleil'); else { onSelect(tree.sun.index); setOpen((p) => new Set(p).add('soleil')); } }}
            className="g-base nav-row font-semibold text-[15px]" style={depth(0)}
          >
            <Chevron open={sunOpen} />
            <Orb color={tree.sun.color} size={16} />
            {name(tree.sun.name)}
          </button>
        )}
        {(sunOpen || !tree.sun) && tree.branches.map((branch) => {
          const bOpen = open.has(branch.id);
          return (
            <div key={branch.id}>
              {/* Branche : se déplie sans rien viser. */}
              <button type="button" role="treeitem" aria-level={2} aria-expanded={bOpen} onClick={() => toggle(branch.id)}
                className="g-base nav-row text-soft text-[12px] font-bold tracking-[.06em] uppercase" style={depth(1)}>
                <Chevron open={bOpen} />
                {name(branch.name)}
                {count(branch.planets.length)}
              </button>
              {bOpen && branch.planets.map((planet) => {
                const current = focus === planet.index;
                const pOpen = planet.moons.length > 0 && open.has(planet.index);
                return (
                  <div key={planet.index}>
                    <button type="button" className="g-base nav-row" style={depth(2)} role="treeitem" aria-level={3} aria-expanded={planet.moons.length ? pOpen : undefined}
                      aria-current={current ? 'true' : undefined} ref={current ? activeRef : undefined}
                      onClick={() => { pickPlanet(planet); if (!current && planet.moons.length) setOpen((p) => new Set(p).add(planet.index)); }}
                      title={planet.name}>
                      <Chevron open={pOpen} show={planet.moons.length > 0} />
                      <Orb color={planet.color} size={14} />
                      {name(planet.name)}
                      {planet.moons.length > 0 && count(planet.moons.length)}
                    </button>
                    {pOpen && (
                      // Système à nombreux satellites : sa liste défile dans sa zone, bornée à 40 % de la hauteur.
                      <div role="group" aria-label={`Satellites de ${planet.name}`}
                        className="ml-[38px] border-l border-line max-h-[min(360px,40dvh)] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                        {planet.moons.map((moon) => {
                          const mCurrent = focus === moon.index;
                          return (
                            <button type="button" key={moon.index} role="treeitem" aria-level={4} aria-current={mCurrent ? 'true' : undefined}
                              ref={mCurrent ? activeRef : undefined} onClick={() => onSelect(moon.index)} title={moon.name}
                              className={`g-base nav-row pl-2.5 rounded-[8px] text-[13px] ${mCurrent ? 'bg-selected' : ''}`}>
                              <Orb color={moon.color} size={12} />
                              {name(moon.name)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </nav>
  );
});
