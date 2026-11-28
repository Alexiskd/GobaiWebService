// Importe de React les crochets useCallback et useState.
import { useCallback, useEffect, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Alert, Button } from '@/Fairing/kit';
// Importe useSolarData, qui charge les données de la scène.
import { useSolarData } from '@/Fairing/hooks/useSolarData';
// Importe l'écran de chargement.
import { LoadingScreen } from './ui/LoadingScreen.jsx';

/** Écran plein (erreur) centré au-dessus de tout. */
// Déclare et exporte le composant FullScreenMessage : reçoit un contenu.
export function FullScreenMessage({ children }) {
  // Début du rendu.
  return (
    // Conteneur qui couvre la fenêtre, au-dessus des fenêtres modales, contenu centré, sur la couleur de fond du thème.
    <div className="fixed inset-0 z-[1320] grid place-items-center bg-bg p-4">
      {/* Le contenu. */}
      {children}
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de FullScreenMessage.
}

// Déclare et exporte le composant SolarSystem.
export function SolarSystem() {
  // Charge les données : statut, données, erreur et fonction de nouvelle tentative.
  const { status, data, error, retry } = useSolarData();
  // La scène 3D est importée après le premier affichage, quand le navigateur est disponible.
  const [SolarSceneComponent, setSolarSceneComponent] = useState(null);
  useEffect(() => {
    if (status !== 'ready' || SolarSceneComponent) return undefined;
    let cancelled = false;
    let idleId;
    let timeoutId;
    // Essais de chargement de la scène (réseau coupé un instant : nouvel essai, sans rien écrire dans la console).
    let tries = 0;
    const loadScene = () => import('./SolarScene.jsx').then(({ SolarScene }) => {
      if (!cancelled) setSolarSceneComponent(() => SolarScene);
    }).catch(() => {
      // Échec : jusqu'à trois nouveaux essais, espacés de 2 s.
      tries += 1;
      if (!cancelled && tries <= 3) timeoutId = window.setTimeout(loadScene, 2000);
    });
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(loadScene, { timeout: 1400 });
    } else {
      timeoutId = window.setTimeout(loadScene, 250);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [status, SolarSceneComponent]);
  // La scène est montée sous l'écran de chargement, qui reste affiché jusqu'à ce que le moteur 3D soit prêt.
  // État : vrai quand la scène est prête.
  const [sceneSettled, setSceneSettled] = useState(false);
  // État : vrai quand l'écran de chargement a disparu.
  const [loaderGone, setLoaderGone] = useState(false);
  // onSettled : note que la scène est prête ; fonction stable.
  const onSettled = useCallback(() => setSceneSettled(true), []);
  // onLoaderDone : note que l'écran de chargement a disparu ; fonction stable.
  const onLoaderDone = useCallback(() => setLoaderGone(true), []);
  // Tant que l'écran de chargement est opaque, le moteur 3D tourne au ralenti pour ne pas chauffer l'appareil.
  // État : vrai quand la scène est révélée (début du fondu de sortie).
  const [revealed, setRevealed] = useState(false);
  // onReveal : note que la scène est révélée ; fonction stable.
  const onReveal = useCallback(() => setRevealed(true), []);

  // Étape du chargement : erreur, données en cours, tout fini si la scène est prête, moteur en cours sinon.
  const step = status === 'error' ? 'error' : status === 'loading' ? 'api' : sceneSettled ? 'done' : 'engine';
  // Libellé affiché sous la barre, selon le statut.
  const label = status === 'error' ? 'Chargement interrompu' : status === 'loading' ? 'Connexion à l’API…' : 'Chargement de la Terre et de la Lune…';

  // Début du rendu.
  return (
    // Fragment : regroupe la scène et l'écran de chargement.
    <>
      {/* Données prêtes : monte la scène ; elle est « couverte » tant qu'elle n'est pas révélée et que l'écran de chargement est là. */}
      {status === 'ready' && SolarSceneComponent && <SolarSceneComponent data={data} onSettled={onSettled} covered={!revealed && !loaderGone} />}
      {/* Tant que l'écran de chargement n'a pas disparu (début). */}
      {!loaderGone && (
        // L'écran de chargement, avec l'étape, le libellé et les deux rappels.
        <LoadingScreen step={step} label={label} onDone={onLoaderDone} onReveal={onReveal}>
          {/* En cas d'erreur (début). */}
          {status === 'error' && (
            // Message d'alerte (début de la balise).
            <Alert
              // Gravité : erreur.
              severity="error"
              // Style à contour.
              variant="outlined"
              // Large de 480 px au plus, sur le fond des panneaux, avec flou d'arrière-plan.
              className="max-w-120"
              // Action : le bouton « Réessayer », qui relance le chargement.
              action={<Button color="inherit" size="small" onClick={retry}>Réessayer</Button>}
            // Fin de la balise ouvrante.
            >
              {/* Première ligne : l'API est injoignable, avec le message de l'erreur. */}
              <p className="t-body2">Impossible de joindre l’API : {error}.</p>
              {/* Seconde ligne, en couleur secondaire (début de la balise). */}
              <p className="t-body2 text-soft mt-1">
                {/* Le conseil : lancer le backend avec la commande indiquée, puis réessayer. */}
                Lancez le backend (<code>npm run dev:api</code>, port 3001), puis réessayez.
              {/* Fin de la seconde ligne. */}
              </p>
            {/* Fin du message d'alerte. */}
            </Alert>
          // Fin du cas d'erreur.
          )}
        {/* Fin de l'écran de chargement. */}
        </LoadingScreen>
      // Fin de la condition.
      )}
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de SolarSystem.
}

// Exporte aussi le composant par défaut.
export default SolarSystem;
