// Importe de React les crochets useState et useSyncExternalStore.
import { useState, useSyncExternalStore } from 'react';
// Importe de MUI Box, Button, CircularProgress (roue de chargement), Stack et Typography.
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
// Importe la mise en forme d'une position.
import { formatLatLon } from '@/moteur/engine/gps';
// Importe plusieurs éléments du module homePlace (début de la liste).
import {
  // Le nom « Maison », l'altitude d'arrivée, le message d'erreur, le lecteur, la localisation, la conversion en lieu, le réglage et l'abonnement.
  HOME_NAME, FLY_ALTITUDE_MIN_M, geolocationMessage, getHome, locate, placeFromPosition, setHome, subscribeHome,
// Fin de la liste ; module d'origine.
} from '@/moteur/lib/homePlace';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Icônes du lieu et de la maison.
import { HomeIcon, PlaceIcon } from '../../ui/icons';

// Boutons larges : cible tactile d'au moins 44 px (recommandation iPhone), même hauteur sur ordinateur.
// Style commun des boutons : 44 px de haut au moins, largeur partagée, casse d'origine.
const BUTTON_SX = { minHeight: 44, flex: 1, textTransform: 'none', lineHeight: 1.2 };

/**
 * Position sur la Terre : « Ma position » zoome sur l'endroit où se trouve l'appareil, y pose un point bleu
 * (halo de précision, cône d'orientation quand le cap est connu) et le suit en direct (voir useMyPosition) ;
 * « Maison » garde un lieu (dans le navigateur seulement) qui sert de point de départ, et y retourne d'un appui.
 */
// Déclare et exporte le composant MaPosition : aller à un lieu, « Ma position » et rappel de fin.
export function MaPosition({ onGoPlace, myPosition, onDone }) {
  // Lit le lieu « Maison » et s'y abonne.
  const home = useSyncExternalStore(subscribeHome, getHome, getHome);
  // État : la mesure en cours, null s'il n'y en a pas.
  const [busy, setBusy] = useState(null); // 'position' | 'maison' pendant la mesure
  // État : le message affiché.
  const [message, setMessage] = useState('');

  // La mesure part de l'appui lui-même (condition de Safari pour demander l'autorisation).
  // Déclare goToMe : aller à sa position.
  const goToMe = async () => {
    // Si une mesure est en cours, rien à faire.
    if (busy) return;
    // Note que la mesure de position est en cours.
    setBusy('position');
    // Efface le message.
    setMessage('');
    // Lance la mesure, sans message à l'écran, et attend le résultat.
    const result = await myPosition.goToMe({ toast: false });
    // Mesure terminée.
    setBusy(null);
    // Réussite : signale la fin (la fenêtre se ferme).
    if (result.ok) onDone?.();
    // Échec : affiche le message dans la fenêtre.
    else setMessage(result.message);
  // Fin de goToMe.
  };

  // Déclare saveHome : enregistrer la position comme Maison.
  const saveHome = async () => {
    // Si une mesure est en cours, rien à faire.
    if (busy) return;
    // Note que la mesure de la Maison est en cours.
    setBusy('maison');
    // Efface le message.
    setMessage('');
    // Début du bloc protégé.
    try {
      // Mesure la position et la convertit en lieu.
      const place = placeFromPosition(await locate());
      // Position illisible : erreur.
      if (!place) throw new Error('position illisible');
      // Enregistre le lieu.
      setHome(place);
      // Confirme l'enregistrement.
      setMessage('Maison enregistrée sur cet appareil.');
    // En cas d'échec.
    } catch (error) {
      // Affiche le message d'erreur de géolocalisation.
      setMessage(geolocationMessage(error));
    // Dans tous les cas.
    } finally {
      // Mesure terminée.
      setBusy(null);
    // Fin du bloc.
    }
  // Fin de saveHome.
  };

  // Déclare goHome : aller à la Maison.
  const goHome = () => {
    // Sans Maison, rien à faire.
    if (!home) return;
    // Demande d'aller au lieu enregistré, à l'altitude d'arrivée minimale.
    onGoPlace?.({ name: HOME_NAME, ...home, altitudeM: FLY_ALTITUDE_MIN_M });
    // Signale la fin.
    onDone?.();
  // Fin de goHome.
  };

  // La roue de chargement affichée dans un bouton.
  const spinner = <CircularProgress size={16} color="inherit" aria-hidden="true" />;

  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Position">
      {/* Conteneur avec marges. */}
      <Box sx={{ p: 1.25 }}>
        {/* Première rangée de boutons. */}
        <Stack direction="row" spacing={1}>
          {/* Bouton plein « Ma position », désactivé pendant une mesure, avec la roue pendant la sienne. */}
          <Button variant="contained" disableElevation sx={BUTTON_SX} disabled={Boolean(busy)} onClick={goToMe} startIcon={busy === 'position' ? spinner : <PlaceIcon />}>
            {/* Son libellé. */}
            Ma position
          {/* Fin du bouton. */}
          </Button>
          {/* Bouton à contour « Maison », désactivé sans Maison ou pendant une mesure. */}
          <Button variant="outlined" sx={BUTTON_SX} disabled={!home || Boolean(busy)} onClick={goHome} startIcon={<HomeIcon />}>
            {/* Son libellé. */}
            {HOME_NAME}
          {/* Fin du bouton. */}
          </Button>
        {/* Fin de la première rangée. */}
        </Stack>
        {/* Deuxième rangée de boutons. */}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {/* Petit bouton d'enregistrement, avec la roue pendant sa mesure. */}
          <Button size="small" sx={BUTTON_SX} disabled={Boolean(busy)} onClick={saveHome} startIcon={busy === 'maison' ? spinner : null}>
            {/* Son libellé, selon qu'une Maison existe déjà ou non. */}
            {home ? 'Déplacer la Maison ici' : 'Enregistrer ici comme Maison'}
          {/* Fin du bouton. */}
          </Button>
          {/* S'il y a une Maison (début). */}
          {home && (
            // Petit bouton qui l'efface et le confirme.
            <Button size="small" color="inherit" sx={{ ...BUTTON_SX, flex: 'none' }} disabled={Boolean(busy)} onClick={() => { setHome(null); setMessage('Maison oubliée.'); }}>
              {/* Son libellé. */}
              Oublier
            {/* Fin du bouton. */}
            </Button>
          // Fin du cas.
          )}
        {/* Fin de la deuxième rangée. */}
        </Stack>
        {/* Pendant le suivi en direct (début). */}
        {myPosition.live && (
          // Troisième rangée.
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {/* Petit bouton qui arrête le suivi et le confirme. */}
            <Button size="small" color="inherit" sx={BUTTON_SX} onClick={() => { myPosition.stop(); setMessage('Suivi en direct arrêté.'); }}>
              {/* Son libellé. */}
              Arrêter le suivi en direct
            {/* Fin du bouton. */}
            </Button>
          {/* Fin de la troisième rangée. */}
          </Stack>
        // Fin du cas.
        )}
        {/* Ligne de message, annoncée aux lecteurs d'écran, de hauteur réservée. */}
        <Typography variant="caption" color="text.secondary" role="status" aria-live="polite" sx={{ display: 'block', mt: 1, minHeight: '1.4em' }}>
          {/* Le message, sinon : s'il y a une Maison… */}
          {message || (home
            // … sa position et son rôle…
            ? `Maison : ${formatLatLon(home.lat, home.lon, 4)}. Elle sert de point de départ et reste sur cet appareil.`
            // … sinon, pendant le suivi…
            : myPosition.live
              // … le rappel que la position suivie reste sur l'appareil…
              ? 'Position suivie en direct. Elle reste sur cet appareil : elle n’est pas envoyée au serveur.'
              // … sinon le rappel que la position reste sur l'appareil.
              : 'Votre position reste sur cet appareil : elle n’est pas envoyée au serveur.')}
        {/* Fin de la ligne de message. */}
        </Typography>
      {/* Fin du conteneur. */}
      </Box>
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de MaPosition.
}
