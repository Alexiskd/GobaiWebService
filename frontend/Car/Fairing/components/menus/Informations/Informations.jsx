// Importe de React les crochets useEffect, useRef et useState.
import { BodyDocumentation } from './BodyDocumentation.jsx';
import { SUN_FACTS } from './astres/sunFacts.js';
import { useEffect, useRef, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Collapse, IconButton } from '@/Fairing/kit';
// Importe le champ de recherche de lieux.
import { PlaceSearch } from '@/Fairing/components/ui/PlaceSearch';
// Importe le crochet de déplacement des panneaux.
import { useHudDraggable } from '@/Fairing/hooks/useHudDraggable';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/Engine/AstreSolideEngine/hudStore';
// Importe la largeur du panneau, la hauteur de la bande et edge.
import { PANEL_W, edge } from '@/Fairing/theme/layout';
// Importe les icônes de repli et de dépliage.
import { ExpandLessIcon, ExpandMoreIcon } from '../../ui/icons.jsx';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader.jsx';
// Importe le menu des cartes de l'astre.
import { BodyLayersMenu } from './couches/BodyLayersMenu.jsx';
// Importe la recherche de lieux et la fiche de l'astre.
import { BodyPlacesInfo } from './BodyPlacesInfo.jsx';
// Importe la fiche du Soleil.
import { SunInfo } from './astres/SunInfo.jsx';
// Importe la hauteur maximale d'une surface du dock du téléphone.
import { DOCK_SURFACE_MAX } from '../../ui/MobileZones.jsx';
// Importe le crochet qui résout l'astre visé.
import { useBodyView } from './useBodyView.jsx';

/** Téléphone : distance à l'astre dominant (« 12 400 km ») à côté du nom de l'astre, dans l'en-tête du tiroir. */
// Déclare le composant ZoomReadout : reçoit le magasin du HUD.
function ZoomReadout({ hud }) {
  // Lit la distance abrégée.
  const zoom = useHud(hud, (s) => s.zoomShort);
  // Niveau d'échelle (« Rue », « Ville », « Planète »…) après la distance : un mot court, qui tient sur un téléphone.
  // Lit le niveau d'échelle.
  const scale = useHud(hud, (s) => s.scaleText);
  // Affiche la distance, suivie du niveau d'échelle s'il existe ; rien sans distance.
  return zoom ? <span className="t-caption text-soft tabular-nums">{scale ? `${zoom} · ${scale}` : zoom}</span> : null;
// Fin de ZoomReadout.
}

/**
 * Petite pastille de l'en-tête (type de l'astre, diamètre) : une étiquette arrondie sur une seule ligne.
 * `accent` : teintée de la couleur primaire, pour le type ; sinon neutre.
 */
function Pastille({ accent = false, children }) {
  return (
    <span
      className={`inline-flex items-center h-5 px-[7.2px] rounded-full whitespace-nowrap text-[11px] font-semibold leading-none tracking-[0.02em] tabular-nums border ${accent ? 'border-primary' : 'border-line'} ${accent ? 'text-primary' : 'text-soft'} ${accent ? 'bg-transparent' : 'bg-hover'}`}
    >
      {children}
    </span>
  );
}

// Les titres de section du panneau (h3 en capitales) portent une barre d'accent : classe `g-titres` de theme/app.css.

// Déclare le composant InformationsShell, la coquille du panneau : vue, HUD, informations ouvertes, fermeture, menu, Soleil, fermable et contenu.
function InformationsShell({ view, hud, layersOpen, onCloseLayers, menu, sun, closable, children }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Replié par défaut sur tous les écrans, pour laisser l'astre visible : on le déplie par son en-tête.
  // État : panneau déplié ou non.
  const [open, setOpen] = useState(false);
  // Déplacement du panneau, désactivé en mode compact.
  const drag = useHudDraggable('panneau', !compact);
  // Référence vers la section des informations.
  const layersRef = useRef(null);

  // Effet relancé quand les informations s'ouvrent.
  useEffect(() => {
    // Si elles sont fermées, rien à faire.
    if (!layersOpen) return;
    // Déplie le panneau.
    setOpen(true);
    // Fait défiler jusqu'à la section des informations.
    layersRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  // Fin de l'effet ; dépendance : layersOpen.
  }, [layersOpen]);

  // Passage en compact : on replie pour ne pas recouvrir l'écran.
  // Référence : le mode compact au rendu précédent.
  const wasCompact = useRef(compact);
  // Effet relancé quand le mode compact change.
  useEffect(() => {
    // En passant en mode compact, replie le panneau, sauf si les informations sont ouvertes.
    if (compact && !wasCompact.current && !layersOpen) setOpen(false);
    // Mémorise le mode compact.
    wasCompact.current = compact;
  // Fin de l'effet ; dépendances : le mode compact et layersOpen.
  }, [compact, layersOpen]);

  // Ordinateur : fenêtre flottante à droite (déplaçable). Mobile : tiroir dans le flux du dock du bas (MobileDock),
  // au-dessus de la barre de l'assistant, de la bande des astres et de la navigation : il ne recouvre jamais ces étages.
  // Placement du panneau : en mode compact (début).
  const placementClass = compact
    ? 'relative w-auto flex-[0_1_auto] min-h-0 rounded-[14px_14px_0_0] min-[700px]:rounded-[14px]'
    : 'fixed z-[30]';
  // Position et tailles calculées (marges de sécurité, largeur du panneau).
  const placementStyle = compact
    ? { maxHeight: DOCK_SURFACE_MAX }
    : { right: edge('right', 76), top: edge('top', 12), width: PANEL_W, maxHeight: 'calc(100dvh - 100px)' };

  // Début du rendu.
  return (
    // Le panneau (début de la balise).
    <section
      // Attribut data-body : l'identifiant de l'astre.
      data-body={view?.id}
      // Marqueur « sheet » en mode compact.
      data-hud={compact ? 'sheet' : undefined}
      // Nom pour les lecteurs d'écran : celui de l'astre, « Informations » à défaut.
      aria-label={view ? view.name : 'Informations'}
      // Référence pour le déplacement.
      ref={drag.ref}
      // Style de position, après déplacement.
      style={{ ...placementStyle, ...drag.style }}
      // Fixé, en colonne, sans débordement, avec le placement calculé.
      className={`g-paper g-elev flex flex-col overflow-hidden ${placementClass}`}
    // Fin de la balise ouvrante.
    >
      {/* L'en-tête (début de la balise). */}
      <PanelHeader
        // En forme de tiroir en mode compact.
        sheet={compact}
        // Propriétés de la poignée de déplacement.
        dragProps={drag.handleProps}
        // En mode compact, un appui sur l'en-tête déplie ou replie.
        onClick={compact ? () => setOpen((v) => !v) : undefined}
        // Titre : « Soleil », le nom de l'astre ou « Informations ».
        title={sun ? 'Soleil' : view ? view.name : 'Informations'}
        // Type et diamètre à côté du nom de l'astre, dans le même axe que le titre ; zoom en mode compact.
        titleAdornment={(
          // Ligne du type, du diamètre et du zoom (début).
          <div className="flex flex-row gap-2 items-center min-w-0 flex-wrap">
            {/* Type de l'astre, suivi de son diamètre s'il est connu. */}
            {view && <Pastille accent>{view.type}</Pastille>}
            {view?.diameter && <Pastille>⌀ {view.diameter}</Pastille>}
            {/* Zoom, en mode compact. */}
            {compact && <ZoomReadout hud={hud} />}
          {/* Fin de la ligne. */}
          </div>
        // Fin de l'ajout au titre.
        )}
        // Bouton de fermeture seulement pour le Soleil ouvert à la demande.
        onClose={sun && closable ? onCloseLayers : undefined}
        // Pas de filet sous l'en-tête quand le panneau est replié.
        className={`${open ? '' : 'border-b-0'}`}
        // Actions de l'en-tête (début).
        actions={(
          // Le bouton de repli (début de la balise).
          <IconButton
            // Petite taille.
            size="small"
            // Au clic : déplie ou replie, sans propager le clic à l'en-tête.
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            // Indique si le panneau est déplié.
            aria-expanded={open}
            // Nom selon l'état.
            aria-label={open ? 'Réduire' : 'Déplier'}
          // Fin de la balise ouvrante.
          >
            {/* Chevron vers le haut si déplié, vers le bas sinon. */}
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          {/* Fin du bouton. */}
          </IconButton>
        // Fin des actions.
        )}
      // Fin de l'en-tête.
      />
      {/* Zone repliable : démontée quand elle est repliée, défile sans entraîner la page. */}
      <Collapse in={open} timeout="auto" unmountOnExit className="flex-[0_1_auto] min-h-0 overflow-y-auto overscroll-contain">
        {/* Marges intérieures (sur téléphone, la navigation du dock porte la marge de sécurité du bas). */}
        <div className="g-titres px-4 pt-3 pb-3">
          {/* Le contenu propre à l'astre. */}
          {children}
          {/* Cartes et couches de l'astre : plus de bouton dans la barre d'outils, la section est rendue ici, à la
              suite des caractéristiques, dès qu'un astre est visé (début). */}
          {!sun && view && (
            // Section des cartes, séparée des caractéristiques par un filet.
            <section aria-label="Cartes et couches" ref={layersRef} className="mt-1 pt-2.5 border-t border-line">
              {/* Ligne du titre. */}
              <div className="flex flex-row items-center min-h-9">
                {/* Le titre (début de la balise). */}
                <h3 className="t-overline text-soft block leading-[2.2]">
                  {/* « Cartes et couches », suivi du nom de l'astre s'il est connu. */}
                  Cartes et couches{menu.bodyName ? ` · ${menu.bodyName}` : ''}
                {/* Fin du titre. */}
                </h3>
              {/* Fin de la ligne. */}
              </div>
              {/* Le menu des cartes de l'astre. */}
              <BodyLayersMenu hud={hud} {...menu} />
            {/* Fin de la section. */}
            </section>
          // Fin du cas.
          )}
        {/* Fin des marges. */}
        </div>
      {/* Fin de la zone repliable. */}
      </Collapse>
    {/* Fin du panneau. */}
    </section>
  // Fin du rendu.
  );
// Fin de InformationsShell.
}

// Déclare et exporte le composant Informations ; les propriétés restantes forment le menu.
export function Informations({ hud, data, worldCities, phases, handlers, layersOpen, onCloseLayers, sunFocused, plateau = null, ...menu }) {
  // Résout l'astre visé et son contenu.
  const view = useBodyView({ hud, data, worldCities, phases, handlers });
  // Lit le mode compact.
  const { compact } = useViewport();
  // Téléphone : la fiche n'apparaît qu'après l'appui sur le bouton Informations de la barre d'outils.
  if (compact && !layersOpen) return null;
  // Soleil ciblé : le panneau s'affiche tout seul, comme pour une planète (caractéristiques et grandeurs en direct).
  // Sans astre ciblé, il s'ouvre aussi à la demande depuis la barre d'outils (et se referme par sa croix).
  // Sans astre visé, si le Soleil est visé ou si les informations sont demandées.
  if (!menu.bodyId && (sunFocused || layersOpen)) {
    // Cherche la Terre dans les données.
    const earth = data.bodies.planets.find((p) => p.earth || p.name === 'Terre');
    // Début du rendu.
    return (
      // La coquille, en mode Soleil ; fermable seulement si le Soleil n'est pas visé.
      <InformationsShell view={null} hud={hud} layersOpen={layersOpen} onCloseLayers={onCloseLayers} menu={menu} sun closable={!sunFocused}>
        {/* La fiche du Soleil, avec les éléments orbitaux de la Terre. */}
        <SunInfo earthElements={earth?.elements} />
        {/* Photos (Ma collection) et documentation du Soleil. */}
        <BodyDocumentation name={data.bodies.sun?.name || 'Soleil'} shownTerms={SUN_FACTS.map(([term]) => term)} />
      {/* Fin de la coquille. */}
      </InformationsShell>
    // Fin du rendu.
    );
  // Fin du cas.
  }
  // Sans vue et sans informations demandées, rien n'est affiché.
  if (!view && !layersOpen) return null;

  // Début du rendu.
  return (
    // La coquille, pour l'astre visé.
    <InformationsShell view={view} hud={hud} layersOpen={layersOpen} onCloseLayers={onCloseLayers} menu={menu}>
      {/* La recherche de lieux et la fiche de l'astre, s'il y a une vue ; le plateau tournant de l'astre y est posé au-dessus de la galerie. */}
      {view && <BodyPlacesInfo view={view} handlers={handlers} Search={PlaceSearch} plateau={plateau} />}
    {/* Fin de la coquille. */}
    </InformationsShell>
  // Fin du rendu.
  );
// Fin de Informations.
}
