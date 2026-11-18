// Importe de MUI la boîte de dialogue et son contenu.
import { Dialog, DialogContent, FormControlLabel, Switch, Stack, Typography } from '@mui/material';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader';
// Importe la section des familles d'astres.
import { AstresAffiches } from './AstresAffiches';
// Importe la section des repères.
import { Reperes } from './Reperes';
// Importe la section du pilotage au téléphone.
import { PilotageTelephone } from './PilotageTelephone';
// Importe la liste des astres.
import { AllerAUnAstre } from './AllerAUnAstre';
// Importe le catalogue des astres, lu sur le serveur.
import { CatalogueAstres } from '../Astres/CatalogueAstres';
// Importe la section de l'économie d'énergie.
import { EconomieEnergie } from './EconomieEnergie';
// Importe la section de l'apparence.
import { Apparence } from './Apparence';
// Importe la section de la position.
import { MaPosition } from './MaPosition';

/**
 * Fenêtre « Paramètres » (bouton ⚙ de la barre d'outils, à côté de la galerie). Une section par fichier, triées par thème :
 * Réglages globaux de l'application :
 *  - Reperes             repères globaux (orbites, points et noms) et ciel lointain
 *  - PilotageTelephone   sensibilité du pilotage par inclinaison
 *  - Apparence et économie d'énergie
 * Astres :
 *  - AstresAffiches      familles et visibilité des astres
 *  - AllerAUnAstre       navigation dans le système solaire
 * Appareil :
 *  - Apparence           thème « noir pur » pour écrans OLED
 *  - EconomieEnergie     interrupteur du rendu allégé (moins d'images par seconde, densité de pixels 1)
 */
// Déclare et exporte le composant Parametres (début de la liste des propriétés).
export function Parametres({
  // Ouverture, fermeture, astres, affichage d'un astre, astre visé, sélection et familles.
  open, onClose, bodies, onBodyShown, focus, onSelect, kinds, onKind,
  // Les repères globaux du système solaire.
  orbits, onOrbits, markers, onMarkers, satellites, onSatellites, sky, onSky,
  // La position de l'appareil et le moniteur de performance.
  onGoPlace, myPosition, performanceMonitorVisible = false, onPerformanceMonitorChange,
// Fin de la liste des propriétés.
}) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // pick : va à un astre, puis ferme la fenêtre.
  const pick = (index) => { onSelect(index); onClose(); };

  // Début du rendu.
  return (
    // Boîte de dialogue : plein écran en mode compact, très petite largeur sinon.
    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="xs" fullWidth aria-label="Paramètres">
      {/* L'en-tête, avec le titre et la fermeture. */}
      <PanelHeader title="Paramètres" onClose={onClose} />
      {/* Contenu de la boîte de dialogue. */}
      <DialogContent sx={{ pt: 1.5, px: 2, pb: 2 }}>
        {/* La section de la position. */}
        <MaPosition onGoPlace={onGoPlace} myPosition={myPosition} onDone={onClose} />
        {/* Affichage du système solaire */}
        {/* La section des repères (début de la balise). */}
        <Reperes
          // Les lignes d'orbite.
          orbits={orbits} onOrbits={onOrbits}
          // Les repères des planètes.
          markers={markers} onMarkers={onMarkers}
          // Les repères des satellites.
          satellites={satellites} onSatellites={onSatellites}
          // Le ciel.
          sky={sky} onSky={onSky}
        // Fin de la section des repères.
        />
        {/* Déplacement global */}
        {/* Le pilotage au téléphone. */}
        <PilotageTelephone />
        {/* Appareil */}
        {/* L'apparence. */}
        <Apparence />
        {/* L'économie d'énergie. */}
        <EconomieEnergie />
        {/* Ligne du moniteur de performance (début). */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
          {/* Son libellé. */}
          <Typography variant="body2">Moniteur de performance (CPU / GPU / FPS)</Typography>
          {/* Son interrupteur : transmet le nouvel état. */}
          <FormControlLabel sx={{ m: 0 }} label="" control={<Switch size="small" checked={performanceMonitorVisible} onChange={(event) => onPerformanceMonitorChange?.(event.target.checked)} />} />
        {/* Fin de la ligne. */}
        </Stack>
        {/* Astres : familles, puis la liste complète (la plus longue, en dernier) */}
        {/* Les familles d'astres. */}
        <AstresAffiches kinds={kinds} onKind={onKind} />
        {/* La liste des astres. */}
        <AllerAUnAstre bodies={bodies} focus={focus} onPick={pick} onShown={onBodyShown} />
        {/* Le catalogue lu sur le serveur : planètes, naines et satellites naturels, sans table embarquée. */}
        <CatalogueAstres bodies={bodies} onSelect={onSelect} onBodyShown={onBodyShown} onDone={onClose} />
      {/* Fin du contenu. */}
      </DialogContent>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Parametres.
}
