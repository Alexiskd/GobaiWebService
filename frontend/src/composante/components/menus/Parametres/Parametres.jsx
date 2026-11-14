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
// Importe les deux sections de cartographie.
import { Cartographie, CartographieRelief } from './Cartographie';
// Importe la section de la vitesse de rotation.
import { VitesseRotation } from './VitesseRotation';
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
 * Terre :
 *  - MaPosition          survol de sa position (GPS de l'appareil) et lieu « Maison » gardé comme point de départ
 *  - Cartographie        à plat : noms des villes et des pays, frontières et littoraux, rues et routes
 *  - CartographieRelief  en relief : relief 3D de la Terre, LiDAR HD de l'IGN, points LiDAR 3D
 * Affichage du système solaire :
 *  - Reperes             repères (orbites, points et noms, lieux de la Lune), atmosphères et ciel lointain
 * Déplacement :
 *  - VitesseRotation     boutons de vitesse de la rotation automatique autour de l'astre
 *  - PilotageTelephone   sensibilité du pilotage par inclinaison (appareils tactiles à capteurs seulement)
 * Appareil :
 *  - Apparence           thème « noir pur » pour écrans OLED
 *  - EconomieEnergie     interrupteur du rendu allégé (moins d'images par seconde, densité de pixels 1)
 * Astres :
 *  - AstresAffiches      boutons qui masquent une famille d'astres (planètes solides, gazeuses, naines, satellites)
 *  - AllerAUnAstre       liste de tous les astres : une case pour enlever ou remettre chacun, un appui pour y aller
 */
// Déclare et exporte le composant Parametres (début de la liste des propriétés).
export function Parametres({
  // Ouverture, fermeture, astres, affichage d'un astre, astre visé, sélection et familles.
  open, onClose, bodies, onBodyShown, focus, onSelect, kinds, onKind,
  // Les repères, les atmosphères, le relief et les calques de la Terre, avec leurs rappels.
  orbits, onOrbits, markers, onMarkers, satellites, onSatellites, sky, onSky, moonPlaces, onMoonPlaces, atmospheres, onAtmospheres, relief, onRelief, earthLayers,
  // La vitesse de rotation, la rotation en cours, l'aller à un lieu et « Ma position ».
  rotateSpeed, onRotateSpeed, rotating, onGoPlace, myPosition, performanceMonitorVisible = false, onPerformanceMonitorChange,
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
        {/* Terre */}
        {/* La section de la position. */}
        <MaPosition onGoPlace={onGoPlace} myPosition={myPosition} onDone={onClose} />
        {/* La cartographie à plat. */}
        <Cartographie {...earthLayers} />
        {/* La cartographie en relief. */}
        <CartographieRelief {...earthLayers} relief={relief} onRelief={onRelief} onGoPlace={onGoPlace} onDone={onClose} />
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
          // Les lieux de la Lune.
          moonPlaces={moonPlaces} onMoonPlaces={onMoonPlaces}
          // Les atmosphères.
          atmospheres={atmospheres} onAtmospheres={onAtmospheres}
        // Fin de la section des repères.
        />
        {/* Déplacement */}
        {/* La vitesse de rotation. */}
        <VitesseRotation speed={rotateSpeed} onSpeed={onRotateSpeed} rotating={rotating} />
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
