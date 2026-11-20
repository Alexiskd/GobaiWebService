// Fenêtre plein écran « Données » : en-tête, barre de navigation à onglets, puis le contenu de l'onglet choisi.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, CircularProgress, Dialog, IconButton, Tooltip, Typography } from '@mui/material';
import { CloseIcon, DescriptionIcon, GalleryIcon, PsychologyIcon, ScienceIcon } from '../../ui/icons.jsx';

// Chargées à l'ouverture de leur onglet seulement : rien de tout cela n'alourdit le démarrage de la scène 3D.
const GalerieApp = lazy(() => import('./GalerieApp.jsx').then((m) => ({ default: m.GalerieApp })));
const Documents = lazy(() => import('./Documents.jsx').then((m) => ({ default: m.Documents })));
const FluxCognitif = lazy(() => import('../../hud/FluxCognitif.jsx').then((m) => ({ default: m.FluxCognitif })));
const TheorieQuantique = lazy(() => import('../../hud/TheorieQuantique.jsx').then((m) => ({ default: m.TheorieQuantique })));

/** Les onglets de la fenêtre, dans l'ordre de la barre : nom, nom court (téléphone), description et icône. */
export const DONNEES_TABS = [
  { id: 'documentation', name: 'Documentation', short: 'Docs', hint: 'Fiches des documents de référence (PDF)', Icon: DescriptionIcon },
  { id: 'galerie', name: 'Galerie', short: 'Galerie', hint: 'Archives NASA et collection personnelle', Icon: GalleryIcon },
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
    <Box
      role="tablist"
      aria-label="Vues de la fenêtre Données"
      onKeyDown={onKeyDown}
      sx={{
        display: 'flex', gap: 0.5, p: 0.5, mx: 'auto', width: { xs: '100%', sm: 'auto' }, maxWidth: '100%',
        overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        border: `1px solid ${V.line}`, borderRadius: 999, bgcolor: V.panel,
      }}
    >
      {DONNEES_TABS.map(({ id, name, short, Icon }) => {
        const active = tab === id;
        return (
          <ButtonBase
            key={id}
            ref={(el) => { refs.current[id] = el; }}
            role="tab"
            id={`donnees-tab-${id}`}
            aria-selected={active}
            aria-label={name}
            aria-controls={`donnees-panel-${id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            sx={{
              flex: { xs: '1 0 auto', sm: 'none' }, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
              minHeight: { xs: 44, sm: 38 }, px: { xs: 1.25, sm: 2 }, borderRadius: 999, whiteSpace: 'nowrap',
              fontFamily: V.font, fontSize: { xs: 14, sm: 14.5 }, fontWeight: active ? 600 : 500, lineHeight: 1.2,
              color: active ? V.void : V.muted, bgcolor: active ? V.ink : 'transparent',
              transition: 'background-color .15s, color .15s',
              '&:hover': active ? {} : { color: V.ink, bgcolor: 'rgba(255,255,255,.06)' },
              '&.Mui-focusVisible': { outline: `2px solid ${V.ink}`, outlineOffset: 2 },
            }}
          >
            <Icon sx={{ fontSize: 18, flex: 'none' }} aria-hidden="true" />
            {/* Nom complet sur ordinateur, nom court sur téléphone ; le nom complet est lu par les lecteurs d'écran (aria-label). */}
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{name}</Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{short}</Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

/**
 * Fenêtre plein écran « Données » : Documentation (fiches des PDF de data/), Galerie (images NASA et collection
 * personnelle), et les deux pages de recherche de l'auteur : Flux cognitif et Théorie quantique.
 *
 * L'en-tête et la barre de navigation restent fixes en haut ; seul le contenu défile. Les marges de sécurité de
 * l'iPhone (encoche, barre d'accueil) sont respectées en portrait comme en paysage.
 */
export function Donnees({ open, onClose }) {
  const [tab, setTab] = useState('documentation');
  // Visionneuse d'image ouverte ou non (côté galerie et documents) : Échap la ferme d'abord.
  const [lightbox, setLightbox] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { if (!open) setLightbox(false); }, [open]);
  const onLightboxChange = useCallback((v) => setLightbox(v), []);
  // Changer d'onglet ramène le contenu en haut.
  const changeTab = useCallback((id) => { setTab(id); scrollRef.current?.scrollTo?.({ top: 0 }); }, []);

  const current = DONNEES_TABS.find((t) => t.id === tab) ?? DONNEES_TABS[0];

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => { if (lightbox && reason === 'escapeKeyDown') return; onClose?.(event, reason); }}
      fullScreen
      aria-label="Données"
      slotProps={{ paper: { sx: { bgcolor: V.void, color: V.ink, backgroundImage: 'none', backdropFilter: 'none', fontFamily: V.font } } }}
    >
      {/* En-tête fixe : titre, description de l'onglet, fermeture ; puis la barre de navigation. */}
      <Box
        component="header"
        sx={{
          flex: 'none', display: 'flex', flexDirection: 'column', gap: { xs: 1.25, sm: 1.5 },
          pt: `calc(${safe('top')} + 12px)`, pb: 1.5,
          pl: `calc(${safe('left')} + 16px)`, pr: `calc(${safe('right')} + 16px)`,
          borderBottom: `1px solid ${V.line}`,
          bgcolor: 'rgba(7, 8, 13, 0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, maxWidth: 1400, width: '100%', mx: 'auto', minWidth: 0 }}>
          <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
            <Typography component="h2" sx={{ fontFamily: V.font, fontWeight: 700, fontSize: { xs: 22, sm: 26 }, lineHeight: 1.15, letterSpacing: '-0.01em', color: V.ink }}>
              Données
            </Typography>
            <Typography sx={{ mt: 0.25, fontFamily: V.font, fontSize: 13.5, lineHeight: 1.35, color: V.muted, overflowWrap: 'anywhere' }}>
              {current.hint}
            </Typography>
          </Box>
          <Tooltip title="Fermer">
            <IconButton onClick={() => onClose?.()} aria-label="Fermer la fenêtre Données"
              sx={{ flex: 'none', width: 44, height: 44, color: V.ink, border: `1px solid ${V.line}`, '&:hover': { bgcolor: 'rgba(255,255,255,.06)' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ maxWidth: 1400, width: '100%', mx: 'auto', display: 'flex' }}>
          <DonneesNav tab={tab} onChange={changeTab} />
        </Box>
      </Box>

      {/* Contenu de l'onglet : seule partie qui défile. */}
      <Box
        ref={scrollRef}
        role="tabpanel"
        id={`donnees-panel-${tab}`}
        aria-labelledby={`donnees-tab-${tab}`}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', pb: safe('bottom'), pl: safe('left'), pr: safe('right') }}
      >
        {open && (
          <Suspense fallback={<Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress sx={{ color: V.muted }} /></Box>}>
            {tab === 'galerie' ? <GalerieApp onLightboxChange={onLightboxChange} />
              : tab === 'flux' || tab === 'theorie' ? (
                <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3, color: 'text.primary' }}>
                  {tab === 'flux' ? <FluxCognitif /> : <TheorieQuantique />}
                </Box>
              ) : <Documents onLightboxChange={onLightboxChange} />}
          </Suspense>
        )}
      </Box>
    </Dialog>
  );
}
