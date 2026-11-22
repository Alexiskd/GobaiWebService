// Importe de React les crochets useEffect, useLayoutEffect et useSyncExternalStore.
import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
// Importe le lecteur et l'abonnement du réglage jour/nuit.
import { getDayNight, subscribeDayNight } from '@/Engine/shared/lib/device/dayNight';
// Importe la détection de l'appareil et le test de compatibilité.
import { currentDevice, isDeviceSupported } from '@/Engine/shared/lib/device/deviceGate';
// Importe le composant principal de la scène.
import SolarSystem from './components/SolarSystem.jsx';
// Importe l'écran d'excuse des appareils non compatibles.
import { AppareilNonCompatible } from './components/ui/AppareilNonCompatible.jsx';
// Importe SceneStyles, qui bloque la sélection de texte sur écran tactile (la feuille scene.css habille la scène).
import { SceneStyles } from './theme/SceneStyles.jsx';
// Importe le nom du thème et la couleur de la barre d'état.
import { statusBarColor, themeName } from './theme/theme.jsx';
// Importe le fournisseur des infobulles du kit (délai commun).
import { TooltipProvider } from './kit';
// Importe le diagnostic de mise en page et son déclencheur.
import { DiagnosticInterface, wantsDiagnostic } from './diagnostic/DiagnosticInterface.jsx';
// Importe RenderLoopRoot, qui possède la boucle de rendu de l'application complète.
import { RenderLoopRoot } from './components/RenderLoopRoot.jsx';

// Diagnostic demandé par l'adresse : lu une fois au chargement.
const DIAGNOSTIC = wantsDiagnostic();

// Thème de toute l'app (feuille theme/app.css, Tailwind CSS) : bleu nuit ou gris doux selon le bouton « Ombre ».
// Le passage d'un thème à l'autre est fondu par le navigateur (voir theme/themeTransition.jsx).
// `SceneStyles` habille les éléments que le moteur 3D crée lui-même.
// Téléphone en dessous de l'iPhone 15 ou de son équivalent : mot d'excuse à la place de l'app (rien de lourd n'est chargé).
// Calcule une seule fois, au chargement, si l'appareil est compatible.
const SUPPORTED = isDeviceSupported(currentDevice());

// Déclare et exporte par défaut le composant App, racine de l'application.
export default function App() {
  // Lit le réglage jour/nuit et s'y abonne (même lecteur côté serveur).
  const dayNight = useSyncExternalStore(subscribeDayNight, getDayNight, getDayNight);
  // Thème : un simple attribut sur <html>, lu par la feuille de style (variables CSS). Posé avant l'affichage, pour
  // que le fondu de thème (theme/themeTransition.jsx) photographie la page déjà recolorée.
  useLayoutEffect(() => {
    // Pose « night » ou « day ».
    document.documentElement.setAttribute('data-theme', themeName(dayNight));
  // Fin de l'effet ; dépendance : le réglage jour/nuit.
  }, [dayNight]);
  // Barre d'état du téléphone et barre du navigateur : teintées à la couleur des panneaux du thème en cours.
  useEffect(() => {
    // Met la couleur du thème dans la balise meta theme-color, si elle existe.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', statusBarColor(dayNight));
  // Fin de l'effet ; dépendance : le réglage jour/nuit.
  }, [dayNight]);
  // Début du rendu.
  return (
    // Le délai commun des infobulles.
    <TooltipProvider>
      {/* La boucle de rendu de l'application complète : démarre au montage, arrêtée au démontage. */}
      <RenderLoopRoot>
        {/* Blocage de la sélection de texte sur écran tactile. */}
        <SceneStyles />
        {/* Appareil compatible : l'application ; sinon : l'écran d'excuse. */}
        {SUPPORTED ? <SolarSystem /> : <AppareilNonCompatible />}
        {/* Diagnostic de la mise en page, seulement si l'adresse le demande. */}
        {DIAGNOSTIC && <DiagnosticInterface />}
      {/* Fin de la boucle de rendu. */}
      </RenderLoopRoot>
    {/* Fin du fournisseur des infobulles. */}
    </TooltipProvider>
  // Fin du rendu.
  );
// Fin de App.
}
