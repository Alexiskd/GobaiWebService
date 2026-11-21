// Importe de React les crochets useEffect, useMemo et useSyncExternalStore (lecture d'un magasin extérieur).
import { useEffect, useMemo, useSyncExternalStore } from 'react';
// Importe de MUI la remise à zéro CSS, les styles globaux et le fournisseur de thème.
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
// Importe le lecteur et l'abonnement du réglage jour/nuit.
import { getDayNight, subscribeDayNight } from '@/Engine/shared/lib/device/dayNight';
// Importe la détection de l'appareil et le test de compatibilité.
import { currentDevice, isDeviceSupported } from '@/Engine/shared/lib/device/deviceGate';
// Importe SolarSystem, le composant principal de l'application.
import SolarSystem from './components/SolarSystem.jsx';
// Importe l'écran affiché sur un appareil non compatible.
import { AppareilNonCompatible } from './components/ui/AppareilNonCompatible.jsx';
// Importe les styles des éléments créés par le moteur 3D.
import { SceneStyles } from './theme/SceneStyles.jsx';
// Importe la fabrique de thème et la couleur de la barre d'état.
import { makeTheme, statusBarColor } from './theme/theme.jsx';
// Importe les styles de transition entre thèmes.
import { themeTransitionStyles } from './theme/themeTransition.jsx';
// Importe le diagnostic de l'interface (?diagnostic=interface) et sa condition.
import { DiagnosticInterface, wantsDiagnostic } from './diagnostic/DiagnosticInterface.jsx';
// Importe RenderLoopRoot, qui possède la boucle de rendu de l'application complète.
import { RenderLoopRoot } from './components/RenderLoopRoot.jsx';

// Diagnostic demandé par l'adresse : lu une fois au chargement.
const DIAGNOSTIC = wantsDiagnostic();

// Thème Material Design de toute l'app : bleu nuit ou gris doux selon le bouton « Ombre » de la barre d'outils.
// Le passage d'un thème à l'autre est fondu par le navigateur (voir theme/themeTransition.jsx).
// `SceneStyles` habille les éléments que le moteur 3D crée lui-même.
// Téléphone en dessous de l'iPhone 15 ou de son équivalent : mot d'excuse à la place de l'app (rien de lourd n'est chargé).
// Calcule une seule fois, au chargement, si l'appareil est compatible.
const SUPPORTED = isDeviceSupported(currentDevice());

// Déclare et exporte par défaut le composant App, racine de l'application.
export default function App() {
  // Lit le réglage jour/nuit et s'y abonne (même lecteur côté serveur).
  const dayNight = useSyncExternalStore(subscribeDayNight, getDayNight, getDayNight);
  // Le noir pur, autrefois un réglage de Paramètres, est fusionné dans le thème : toujours actif en mode nuit.
  // Le bouton « Ombre » de la barre d'outils bascule jour/nuit comme avant (déjà implémenté).
  const oled = true;
  // Construit le thème, recalculé seulement si le réglage change.
  const theme = useMemo(() => makeTheme(dayNight, { oled }), [dayNight]);
  // Barre d'état du téléphone et barre du navigateur : teintées à la couleur des panneaux du thème en cours.
  // Effet relancé quand l'un des deux réglages change.
  useEffect(() => {
    // Met la couleur du thème dans la balise meta theme-color, si elle existe.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', statusBarColor(dayNight, { oled }));
  // Fin de l'effet ; dépendance : le réglage jour/nuit.
  }, [dayNight]);
  // Début du rendu.
  return (
    // Fournit le thème à toute l'application.
    <ThemeProvider theme={theme}>
      {/* La boucle de rendu de l'application complète : démarre au montage, arrêtée au démontage. */}
      <RenderLoopRoot>
        {/* Remise à zéro CSS de MUI, avec la palette de couleurs du navigateur accordée au thème. */}
        <CssBaseline enableColorScheme />
        {/* Styles globaux de la transition entre thèmes. */}
        <GlobalStyles styles={themeTransitionStyles} />
        {/* Styles des éléments créés par le moteur 3D. */}
        <SceneStyles />
        {/* Appareil compatible : l'application ; sinon : l'écran d'excuse. */}
        {SUPPORTED ? <SolarSystem /> : <AppareilNonCompatible />}
        {/* Diagnostic de la mise en page, seulement si l'adresse le demande. */}
        {DIAGNOSTIC && <DiagnosticInterface />}
      {/* Fin de la boucle de rendu. */}
      </RenderLoopRoot>
    {/* Fin du fournisseur de thème. */}
    </ThemeProvider>
  // Fin du rendu.
  );
// Fin de App.
}
