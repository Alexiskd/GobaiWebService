// Importe de React lazy et Suspense (chargement différé) et les crochets useCallback, useEffect et useState.
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
// Importe de MUI Box, CircularProgress et Dialog.
import { Box, CircularProgress, Dialog } from '@mui/material';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader.jsx';

// Chargées à l'ouverture seulement : la galerie et les documents n'alourdissent pas le démarrage de la scène 3D.
// Déclare GalerieApp en chargement différé : le module est demandé à la première ouverture de l'onglet.
const GalerieApp = lazy(() => import('./GalerieApp.jsx').then((m) => ({ default: m.GalerieApp })));
// Déclare Documents en chargement différé : le module est demandé à la première ouverture de l'onglet.
const Documents = lazy(() => import('./Documents.jsx').then((m) => ({ default: m.Documents })));
// Pages de recherche de l'auteur, venues de la fenêtre Node : chargées seulement à l'ouverture de leur onglet.
const FluxCognitif = lazy(() => import('../../hud/FluxCognitif.jsx').then((m) => ({ default: m.FluxCognitif })));
const TheorieQuantique = lazy(() => import('../../hud/TheorieQuantique.jsx').then((m) => ({ default: m.TheorieQuantique })));

// Identifiant de la balise link des polices de la fenêtre Données.
const FONTS_ID = 'galerie-fonts';
// Adresse des polices (Syne, IBM Plex Sans et IBM Plex Mono) chez Google Fonts.
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Syne:wght@600;800&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap';

// Les deux onglets de la fenêtre : la documentation (fiches des PDF) et la galerie d'images.
const TABS = [
  { id: 'documentation', name: 'Documentation' },
  { id: 'galerie', name: 'Galerie' },
  { id: 'flux', name: 'Flux cognitif' },
  { id: 'theorie', name: 'Théorie quantique' },
];

/**
 * Fenêtre plein écran « Données » : Documentation (fiches des PDF de data/), Galerie (images NASA et collection
 * personnelle), et les deux pages de recherche de l'auteur : Flux cognitif et Théorie quantique.
 */
// Déclare et exporte le composant Donnees : ouverture, fermeture et onglet affiché.
export function Donnees({ open, onClose }) {
  // État : l'onglet affiché, la documentation au départ.
  const [tab, setTab] = useState('documentation');
  // État : visionneuse d'image ouverte ou non (côté galerie).
  const [lightbox, setLightbox] = useState(false);

  // Effet relancé à l'ouverture et à la fermeture.
  useEffect(() => {
    // Fenêtre fermée : la visionneuse est considérée comme fermée, et rien de plus.
    if (!open) { setLightbox(false); return; }
    // Si les polices ne sont pas encore demandées.
    if (!document.getElementById(FONTS_ID)) {
      // Crée une balise link.
      const link = document.createElement('link');
      // Lui donne son identifiant.
      link.id = FONTS_ID;
      // C'est une feuille de style.
      link.rel = 'stylesheet';
      // Son adresse.
      link.href = FONTS_URL;
      // L'ajoute à l'en-tête du document.
      document.head.appendChild(link);
    // Fin du cas.
    }
  // Fin de l'effet ; dépendance : l'ouverture.
  }, [open]);

  // onLightboxChange : note l'état de la visionneuse ; fonction stable.
  const onLightboxChange = useCallback((v) => setLightbox(v), []);

  // Début du rendu.
  return (
    // Boîte de dialogue (début de la balise).
    <Dialog
      // Ouverte ou non.
      open={open}
      // Fermeture ; Échap ne ferme pas la fenêtre tant que la visionneuse d'image est ouverte (elle se ferme d'abord).
      onClose={(event, reason) => { if (lightbox && reason === 'escapeKeyDown') return; onClose?.(event, reason); }}
      // Plein écran.
      fullScreen
      // Nom pour les lecteurs d'écran.
      aria-label="Données"
      // Fond presque noir, sans flou d'arrière-plan.
      slotProps={{ paper: { sx: { bgcolor: '#07080d', backdropFilter: 'none' } } }}
    // Fin de la balise ouvrante.
    >
      {/* L'en-tête, avec le titre et la fermeture. */}
      <PanelHeader title="Données" onClose={onClose} />
      {/* Zone de contenu, qui défile. */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Seulement quand la fenêtre est ouverte (début). */}
        {open && (
          <>
            {/* La barre des onglets, stylée par la galerie (conteneur .gobai-gallery). */}
            <div className="gobai-gallery">
              <div className="cat-wrap" style={{ paddingBottom: 0 }}>
                {/* La barre des onglets. */}
                <nav className="views" aria-label="Vues de la fenêtre Données">
                  {/* Un bouton par onglet (début). */}
                  {TABS.map((t) => (
                    // Le bouton, actif si c'est l'onglet affiché.
                    <button key={t.id} className={`view-tab ${tab === t.id ? 'is-active' : ''}`}
                      // Au clic : affiche l'onglet ; état enfoncé pour les lecteurs d'écran.
                      onClick={() => setTab(t.id)} aria-pressed={tab === t.id}>
                      {/* Le nom de l'onglet. */}
                      {t.name}
                    {/* Fin du bouton. */}
                    </button>
                  // Fin des onglets.
                  ))}
                {/* Fin de la barre des onglets. */}
                </nav>
              {/* Fin du bloc du choix. */}
              </div>
            {/* Fin du conteneur des styles. */}
            </div>
            {/* Zone d'attente : une roue centrée pendant le chargement du module. */}
            <Suspense fallback={<Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress /></Box>}>
              {/* Selon l'onglet : la galerie, une page de recherche (dans une colonne lisible), ou la documentation. */}
              {tab === 'galerie' ? <GalerieApp onLightboxChange={onLightboxChange} />
                : tab === 'flux' || tab === 'theorie' ? (
                  <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3, color: 'text.primary' }}>
                    {tab === 'flux' ? <FluxCognitif /> : <TheorieQuantique />}
                  </Box>
                ) : <Documents onLightboxChange={onLightboxChange} />}
            {/* Fin de la zone d'attente. */}
            </Suspense>
          </>
        // Fin du cas.
        )}
      {/* Fin de la zone de contenu. */}
      </Box>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Donnees.
}
