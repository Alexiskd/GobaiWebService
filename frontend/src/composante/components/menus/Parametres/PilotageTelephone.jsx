// Importe useSyncExternalStore de React.
import { useSyncExternalStore } from 'react';
// Importe de MUI Box, Paper, Slider (réglette) et Typography.
import { Box, Paper, Slider, Typography } from '@mui/material';
// Importe plusieurs éléments du module tiltSensitivity (début de la liste).
import {
  // Les bornes et le pas de la sensibilité, les deux lecteurs et le réglage du déplacement latéral.
  SENSITIVITY_MAX, SENSITIVITY_MIN, SENSITIVITY_STEP, getTiltSensitivity, getTiltZoomSensitivity, setTiltSensitivity,
  // Le réglage du zoom et les deux abonnements.
  setTiltZoomSensitivity, subscribeTiltSensitivity, subscribeTiltZoomSensitivity,
// Fin de la liste ; module d'origine.
} from '@/moteur/lib/tiltSensitivity';

/** Une réglette de sensibilité : libellé, valeur (×1,00) et aide. */
// Déclare le composant Sensibilite : identifiant, libellé, aide, valeur et rappel de changement.
function Sensibilite({ id, label, hint, value, onChange }) {
  // Début du rendu.
  return (
    // Conteneur, espacé de la réglette précédente.
    <Box sx={{ '& + &': { mt: 1.5 } }}>
      {/* Ligne du libellé et de la valeur, aux deux extrémités. */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
        {/* Le libellé, dont l'identifiant nomme la réglette. */}
        <Typography id={id} variant="body2">{label}</Typography>
        {/* La valeur (début de la balise), en chiffres de largeur fixe. */}
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {/* Le signe × suivi de la valeur à deux décimales, au format français. */}
          ×{value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        {/* Fin de la valeur. */}
        </Typography>
      {/* Fin de la ligne. */}
      </Box>
      {/* La réglette (début de la balise). */}
      <Slider
        // Nommée par le libellé.
        aria-labelledby={id}
        // Petite taille.
        size="small"
        // Valeur courante.
        value={value}
        // Valeur minimale.
        min={SENSITIVITY_MIN}
        // Valeur maximale.
        max={SENSITIVITY_MAX}
        // Pas.
        step={SENSITIVITY_STEP}
        // Un repère à la valeur 1.
        marks={[{ value: 1 }]}
        // Au changement : transmet la nouvelle valeur.
        onChange={(e, v) => onChange(v)}
      // Fin de la réglette.
      />
      {/* Le texte d'aide, en petit. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{hint}</Typography>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de Sensibilite.
}

/**
 * Pilotage au téléphone (boutons ⬆️ et 🚀 de la navball) : sensibilité de l'inclinaison, réglée séparément pour
 * avancer / reculer et pour droite / gauche. Proposé seulement sur les appareils tactiles qui ont des capteurs
 * d'orientation. La réglette « avancer / reculer » est aussi à côté de la navball pendant le pilotage.
 */
// Déclare et exporte le composant PilotageTelephone.
export function PilotageTelephone() {
  // Lit la sensibilité du zoom et s'y abonne.
  const zoom = useSyncExternalStore(subscribeTiltZoomSensitivity, getTiltZoomSensitivity, getTiltZoomSensitivity);
  // Lit la sensibilité du déplacement latéral et s'y abonne.
  const pan = useSyncExternalStore(subscribeTiltSensitivity, getTiltSensitivity, getTiltSensitivity);
  // Capteurs présents : une fenêtre, des événements d'orientation et un écran tactile.
  const hasSensors = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && (navigator.maxTouchPoints || 0) > 0;
  // Sans capteurs, rien n'est affiché.
  if (!hasSensors) return null;

  // Début du rendu.
  return (
    // Conteneur au rôle de groupe.
    <Box role="group" aria-label="Pilotage au téléphone" sx={{ mb: 2 }}>
      {/* Le titre. */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>Pilotage au téléphone</Typography>
      {/* Carte à contour, transparente. */}
      <Paper variant="outlined" sx={{ bgcolor: 'transparent', backdropFilter: 'none', px: 1.5, pt: 1, pb: 1.25 }}>
        {/* Réglette « avancer / reculer » (début de la balise). */}
        <Sensibilite
          // Son identifiant, son libellé, sa valeur et son réglage.
          id="sensibilite-avance-recul" label="Avancer / reculer" value={zoom} onChange={setTiltZoomSensitivity}
          // Son texte d'aide.
          hint="Zoom en penchant le téléphone vers l’avant ou l’arrière (les deux boutons sous la navball). Plus haut : il suffit de moins pencher."
        // Fin de la réglette.
        />
        {/* Réglette « droite / gauche » (début de la balise). */}
        <Sensibilite
          // Son identifiant, son libellé, sa valeur et son réglage.
          id="sensibilite-droite-gauche" label="Droite / gauche" value={pan} onChange={setTiltSensitivity}
          // Son texte d'aide.
          hint="Déplacement en penchant le téléphone sur le côté (bouton de décollage, sous la navball)."
        // Fin de la réglette.
        />
      {/* Fin de la carte. */}
      </Paper>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de PilotageTelephone.
}
