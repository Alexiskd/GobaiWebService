import { Box, Stack } from '@mui/material';
import { AstresAffiches } from './AstresAffiches.jsx';
import { Reperes } from './Reperes.jsx';
import { AllerAUnAstre } from './AllerAUnAstre.jsx';
import { EntrainementIA } from './EntrainementIA.jsx';
import { CatalogueAstres } from '../Astres/CatalogueAstres.jsx';

/**
 * Contenu des paramètres : une seule page : astres (familles affichées, aller à un astre, catalogue) et lien « Entraînement IA » vers gobaispace.info.
 * Il n'a plus de fenêtre propre : c'est l'onglet « Paramètres » de la fenêtre Node (hud/node/Attribution). Les pages
 * « Général » (Ma position, pilotage au téléphone) et « Affichage » ont été supprimées ; « Ma position » vit sous la navball.
 */
export function Parametres({
  onClose, bodies, onBodyShown, focus, onSelect, kinds, onKind,
  orbits, onOrbits, markers, onMarkers, satellites, onSatellites, sky, onSky, engineRef,
}) {
  const pick = (index) => { onSelect?.(index); onClose?.(); };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Stack spacing={1.5}>
        {/* Repères et Univers : masqués à l'écran, mais toujours montés dans le DOM, */}
        {/* pour que l'assistant puisse continuer à actionner ces réglages. */}
        <Box sx={{ display: 'none' }} aria-hidden="true">
          <Reperes orbits={orbits} onOrbits={onOrbits} markers={markers} onMarkers={onMarkers} satellites={satellites} onSatellites={onSatellites} sky={sky} onSky={onSky} />
        </Box>
        <AstresAffiches kinds={kinds} onKind={onKind} />
        <EntrainementIA />
        <AllerAUnAstre bodies={bodies} focus={focus} onPick={pick} onShown={onBodyShown} />
        <CatalogueAstres bodies={bodies} onSelect={onSelect} onBodyShown={onBodyShown} onDone={onClose} engineRef={engineRef} />
      </Stack>
    </Box>
  );
}
