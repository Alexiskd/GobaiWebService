// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe de MUI Box, CircularProgress, Dialog, Stack et Typography.
import { Box, CircularProgress, Dialog, Stack, Typography } from '@mui/material';
// Importe buildGlobeCanvas, qui assemble la carte du globe.
import { buildGlobeCanvas } from '@/moteur/engine/globeTexture';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader';
// Importe le globe tournant.
import { PlateauTournant } from './PlateauTournant';

/**
 * Plateau tournant : le globe de l'astre ciblé (la Terre par défaut), habillé du même fond de carte que celui
 * actif sur l'astre dans la scène. Se met à jour quand on change de fond.
 *  bodyId    astre ciblé (id des tuiles : 'earth', 'mars', 'moon'…) ou null
 *  bodyName  nom affiché
 *  baseKey   id du fond actif de cet astre (change → nouvelle carte)
 */
// Déclare et exporte le composant Plateau : ouverture, fermeture, moteur, astre, nom et fond actif.
export function Plateau({ open, onClose, engine, bodyId, bodyName, baseKey }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // L'astre affiché : celui qui est visé, la Terre à défaut.
  const id = bodyId || 'earth';
  // État : la carte du globe, null tant qu'elle n'est pas prête.
  const [globe, setGlobe] = useState(null);
  // État du chargement.
  const [state, setState] = useState('idle'); // 'loading' | 'ready' | 'none'

  // Effet qui construit la carte.
  useEffect(() => {
    // Fenêtre fermée ou moteur absent : rien à faire.
    if (!open || !engine) return undefined;
    // Demande au moteur la source du fond de l'astre.
    const source = engine.bodyBaseSource(id);
    // Sans source : pas de carte, état « none ».
    if (!source) { setGlobe(null); setState('none'); return undefined; }
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Passe à l'état « chargement ».
    setState('loading');
    // Assemble la carte, au niveau de zoom 2 en mode compact, 3 sinon.
    buildGlobeCanvas(source, { zoom: compact ? 2 : 3, signal: ctrl.signal })
      // Réussite : garde la carte, état « prêt ».
      .then((canvas) => { setGlobe(canvas); setState('ready'); })
      // Échec, sauf annulation volontaire : pas de carte, état « none ».
      .catch((e) => { if (e.name !== 'AbortError') { setGlobe(null); setState('none'); } });
    // Nettoyage : annule la construction en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendances : l'ouverture, le moteur, l'astre, le fond et le mode compact.
  }, [open, engine, id, baseKey, compact]);

  // Début du rendu.
  return (
    // Boîte de dialogue (début de la balise).
    <Dialog
      // Plein écran en mode compact, largeur moyenne sinon.
      open={open} onClose={onClose} fullScreen={compact} maxWidth="md" fullWidth aria-label="Plateau tournant"
      // Fond presque noir, sans dégradé, sans débordement.
      PaperProps={{ sx: { bgcolor: '#07090d', backgroundImage: 'none', overflow: 'hidden' } }}
    // Fin de la balise ouvrante.
    >
      {/* L'en-tête : surtitre, nom de l'astre (« Terre » à défaut) et fermeture. */}
      <PanelHeader kicker="Plateau tournant" title={bodyName || 'Terre'} onClose={onClose} />
      {/* Zone du globe : toute la hauteur en mode compact, 70 % de l'écran sinon, 360 px au moins. */}
      <Box sx={{ position: 'relative', height: compact ? '100%' : '70vh', minHeight: 360 }}>
        {/* Le globe tournant, monté seulement quand la fenêtre est ouverte. */}
        {open && <PlateauTournant globe={globe} />}
        {/* Tant que la carte n'est pas prête (début). */}
        {state !== 'ready' && (
          // Bloc de message, centré en haut, sans capter les clics.
          <Stack alignItems="center" spacing={1} sx={{ position: 'absolute', top: 16, left: 0, right: 0, pointerEvents: 'none' }}>
            {/* La roue de chargement, pendant le chargement. */}
            {state === 'loading' && <CircularProgress size={20} />}
            {/* Le message (début de la balise). */}
            <Typography variant="caption" color="text.secondary">
              {/* « Chargement… » ou « Aucun fond de carte actif ». */}
              {state === 'loading' ? 'Chargement du fond de carte…' : 'Aucun fond de carte actif sur cet astre.'}
            {/* Fin du message. */}
            </Typography>
          {/* Fin du bloc. */}
          </Stack>
        // Fin du cas.
        )}
      {/* Fin de la zone du globe. */}
      </Box>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Plateau.
}
