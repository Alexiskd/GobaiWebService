// Importe de React les crochets useCallback et useState.
import { useCallback, useState } from 'react';
// Importe de MUI Alert (message d'alerte), Box, Button et Typography.
import { Alert, Box, Button, Typography } from '@mui/material';
// Importe useSolarData, qui charge les données de la scène.
import { useSolarData } from '@/composante/hooks/useSolarData';
// Importe SolarScene, la scène 3D et son interface.
import { SolarScene } from './SolarScene';
// Importe l'écran de chargement.
import { LoadingScreen } from './ui/LoadingScreen';

/** Écran plein (erreur) centré au-dessus de tout. */
// Déclare et exporte le composant FullScreenMessage : reçoit un contenu.
export function FullScreenMessage({ children }) {
  // Début du rendu.
  return (
    // Conteneur qui couvre la fenêtre, au-dessus des fenêtres modales, contenu centré, sur la couleur de fond du thème.
    <Box sx={{ position: 'fixed', inset: 0, zIndex: (t) => t.zIndex.modal + 20, display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      {/* Le contenu. */}
      {children}
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de FullScreenMessage.
}

// Déclare et exporte le composant SolarSystem.
export function SolarSystem() {
  // Charge les données : statut, données, erreur et fonction de nouvelle tentative.
  const { status, data, error, retry } = useSolarData();
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
      {status === 'ready' && <SolarScene data={data} onSettled={onSettled} covered={!revealed && !loaderGone} />}
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
              sx={{ maxWidth: 480, bgcolor: 'var(--panel, rgba(9, 13, 22, 0.88))', backdropFilter: 'blur(14px)' }}
              // Action : le bouton « Réessayer », qui relance le chargement.
              action={<Button color="inherit" size="small" onClick={retry}>Réessayer</Button>}
            // Fin de la balise ouvrante.
            >
              {/* Première ligne : l'API est injoignable, avec le message de l'erreur. */}
              <Typography variant="body2">Impossible de joindre l’API : {error}.</Typography>
              {/* Seconde ligne, en couleur secondaire (début de la balise). */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {/* Le conseil : lancer le backend avec la commande indiquée, puis réessayer. */}
                Lancez le backend (<Box component="code">npm run dev:api</Box>, port 3001), puis réessayez.
              {/* Fin de la seconde ligne. */}
              </Typography>
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
