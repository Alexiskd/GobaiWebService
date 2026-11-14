// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe de MUI Box, Collapse (repli animé), IconButton, Paper, Stack et Typography.
import { Box, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
// Importe le champ de recherche de lieux.
import { PlaceSearch } from '@/composante/components/ui/PlaceSearch';
// Importe le crochet de déplacement des panneaux.
import { useHudDraggable } from '@/composante/hooks/useHudDraggable';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe la largeur du panneau, la hauteur de la bande et edge.
import { PANEL_W, STRIP_H, edge } from '@/composante/theme/layout';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';
// Importe les icônes de repli et de dépliage.
import { ExpandLessIcon, ExpandMoreIcon } from '../../ui/icons';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader';
// Importe le menu des cartes de l'astre.
import { BodyLayersMenu } from './BodyLayersMenu';
// Importe la recherche de lieux et la fiche de l'astre.
import { BodyPlacesInfo } from './BodyPlacesInfo';
// Importe la fiche du Soleil.
import { SunInfo } from './SunInfo';
// Importe le crochet qui résout l'astre visé.
import { useBodyView } from './useBodyView';

/** Téléphone : distance à l'astre dominant (« 12 400 km ») à côté du nom de l'astre, dans l'en-tête du tiroir. */
// Déclare le composant ZoomReadout : reçoit le magasin du HUD.
function ZoomReadout({ hud }) {
  // Lit la distance abrégée.
  const zoom = useHud(hud, (s) => s.zoomShort);
  // Niveau d'échelle (« Rue », « Ville », « Planète »…) après la distance : un mot court, qui tient sur un téléphone.
  // Lit le niveau d'échelle.
  const scale = useHud(hud, (s) => s.scaleText);
  // Affiche la distance, suivie du niveau d'échelle s'il existe ; rien sans distance.
  return zoom ? <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{scale ? `${zoom} · ${scale}` : zoom}</Typography> : null;
// Fin de ZoomReadout.
}

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

  // Ordinateur : fenêtre flottante à droite (déplaçable). Mobile : tiroir posé au-dessus de la bande des astres
  // (jamais dessus : la bande reste utilisable, tiroir ouvert ou replié).
  // Placement du panneau : en mode compact (début).
  const placement = compact ? {
    // Sur toute la largeur, posé au-dessus de la bande des astres.
    left: 0, right: 0, bottom: `calc(${STRIP_H}px + ${safe('bottom')})`, width: 'auto',
    // Hauteur limitée à 62 % de l'écran, et à la place disponible.
    maxHeight: `min(62dvh, calc(100dvh - ${STRIP_H}px - ${safe('bottom')} - ${safe('top')} - 76px))`,
    // Arrondi en haut seulement, au-dessus des barres d'outils.
    borderRadius: '18px 18px 0 0', zIndex: (t) => t.zIndex.toolbar + 5,
  // Sinon (début).
  } : {
    // À droite, près du haut, de la largeur d'un panneau, de hauteur limitée.
    right: edge('right', 76), top: edge('top', 12), width: PANEL_W, maxHeight: 'calc(100dvh - 100px)',
    // Au niveau des panneaux du HUD.
    zIndex: (t) => t.zIndex.hudPanel,
  // Fin du placement.
  };

  // Début du rendu.
  return (
    // Le panneau (début de la balise).
    <Paper
      // Rendu en balise section.
      component="section"
      // Ombre marquée.
      elevation={8}
      // Attribut data-body : l'identifiant de l'astre.
      data-body={view?.id}
      // Marqueur « sheet » en mode compact.
      data-hud={compact ? 'sheet' : undefined}
      // Nom pour les lecteurs d'écran : celui de l'astre, « Informations » à défaut.
      aria-label={view ? view.name : 'Informations'}
      // Référence pour le déplacement.
      ref={drag.ref}
      // Style de position, après déplacement.
      style={drag.style}
      // Fixé, en colonne, sans débordement, avec le placement calculé.
      sx={{ position: 'fixed', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...placement }}
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
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flexWrap: 'wrap' }}>
            {/* Type de l'astre, suivi de son diamètre s'il est connu. */}
            {view && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{view.type}{view.diameter ? ` · ${view.diameter}` : ''}</Typography>}
            {/* Zoom, en mode compact. */}
            {compact && <ZoomReadout hud={hud} />}
          {/* Fin de la ligne. */}
          </Stack>
        // Fin de l'ajout au titre.
        )}
        // Bouton de fermeture seulement pour le Soleil ouvert à la demande.
        onClose={sun && closable ? onCloseLayers : undefined}
        // Pas de filet sous l'en-tête quand le panneau est replié.
        sx={open ? undefined : { borderBottom: 0 }}
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
      <Collapse in={open} timeout="auto" unmountOnExit sx={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {/* Marges intérieures, avec la marge de sécurité du bas en mode compact. */}
        <Box sx={{ px: 2, pt: 1.5, pb: compact ? `calc(${safe('bottom')} + 12px)` : 1.5 }}>
          {/* Le contenu propre à l'astre. */}
          {children}
          {/* Cartes et couches de l'astre : plus de bouton dans la barre d'outils, la section est rendue ici, à la
              suite des caractéristiques, dès qu'un astre est visé (début). */}
          {!sun && view && (
            // Section des cartes, séparée des caractéristiques par un filet.
            <Box component="section" aria-label="Cartes et couches" ref={layersRef} sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              {/* Ligne du titre. */}
              <Stack direction="row" alignItems="center" sx={{ minHeight: 36 }}>
                {/* Le titre (début de la balise). */}
                <Typography component="h3" variant="subtitle2" color="text.secondary">
                  {/* « Cartes et couches », suivi du nom de l'astre s'il est connu. */}
                  Cartes et couches{menu.bodyName ? ` · ${menu.bodyName}` : ''}
                {/* Fin du titre. */}
                </Typography>
              {/* Fin de la ligne. */}
              </Stack>
              {/* Le menu des cartes de l'astre. */}
              <BodyLayersMenu hud={hud} {...menu} />
            {/* Fin de la section. */}
            </Box>
          // Fin du cas.
          )}
        {/* Fin des marges. */}
        </Box>
      {/* Fin de la zone repliable. */}
      </Collapse>
    {/* Fin du panneau. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de InformationsShell.
}

// Déclare et exporte le composant Informations ; les propriétés restantes forment le menu.
export function Informations({ hud, data, worldCities, phases, handlers, layersOpen, onCloseLayers, sunFocused, ...menu }) {
  // Résout l'astre visé et son contenu.
  const view = useBodyView({ hud, data, worldCities, phases, handlers });
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
      {/* La recherche de lieux et la fiche de l'astre, s'il y a une vue. */}
      {view && <BodyPlacesInfo view={view} handlers={handlers} Search={PlaceSearch} />}
    {/* Fin de la coquille. */}
    </InformationsShell>
  // Fin du rendu.
  );
// Fin de Informations.
}
