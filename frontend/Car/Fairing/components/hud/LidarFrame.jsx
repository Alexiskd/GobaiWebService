// Importe de MUI Box, Icon, IconButton, Paper et Typography, pour le cadre, ses boutons et ses textes.
import { Box, Icon, IconButton, Paper, Typography } from '@mui/material';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/Fairing/theme/mediaQueries';
// Importe les icônes d'ouverture dans un onglet et de fermeture.
import { CloseIcon, OpenInNewIcon } from '../ui/icons.jsx';

// Cadre de la visionneuse LiDAR HD de l'IGN : une iframe de la visionneuse officielle, affichée en bas de la
// scène quand la caméra de Gobai survole la zone de référence à moins de 0,22 km d'altitude. L'adresse passée
// en propriété est recalculée à partir de la caméra (position ECEF et quaternion), c'est la visionneuse IGN qui
// suit le vol de Gobai (voir useLidarFrame et lidarFrameMath).

// La hauteur du cadre : au plus 46 % de la hauteur de la vue, au plus 480 px, au moins 220 px.
// Hauteur du cadre.
const HEIGHT = 'clamp(220px, 46vh, 480px)';

/**
 * Le cadre : l'adresse de la visionneuse (recalculée par useLidarFrame) et la fermeture demandée par le
 * visiteur (le cadre se rouvrira à la prochaine entrée dans la zone).
 */
// Déclare et exporte le composant LidarFrame : l'adresse de la visionneuse et la fermeture.
export function LidarFrame({ url, onClose }) {
  // Début du rendu.
  return (
    // Le panneau du cadre (début de la balise).
    <Paper
      // Marqueur de test.
      data-lidar-frame
      // Début du style.
      sx={{
        // Par-dessus la scène, sous les panneaux du haut, fixé en bas de la fenêtre.
        position: 'fixed', zIndex: 24,
        // Les marges de sécurité de l'écran, en bas au-dessus du cadre GPS.
        left: `calc(${safe('left')} + 8px)`, right: `calc(${safe('right')} + 8px)`,
        bottom: `calc(${safe('bottom')} + 8px)`,
        // La hauteur du cadre, sans déborder.
        height: HEIGHT, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        // Coins arrondis et ombre légère.
        borderRadius: 1.5, elevation: 2,
      // Fin du style.
      }}
    // Fin des propriétés du panneau.
    >
      {/* La barre de titre : le nom de la visionneuse et ses deux boutons. */}
      {/* La barre de titre (début de la balise). */}
      <Box
        // Début du style.
        sx={{
          // Une seule ligne, titre à gauche, boutons à droite, fond légèrement plus sombre.
          display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, flex: '0 0 auto',
          bgcolor: 'rgba(255, 255, 255, 0.06)', borderBottom: 1, borderColor: 'divider',
        // Fin du style.
        }}
      // Fin de la barre de titre.
      >
        {/* Le titre du cadre. */}
        <Typography variant="caption" sx={{ fontWeight: 600, userSelect: 'none', flex: 1 }}>
          Visionneuse LiDAR HD (IGN)
        </Typography>
        {/* Ouvrir la visionneuse dans un onglet : reprend la même adresse que l'iframe. */}
        <IconButton
          // Marqueur de test.
          data-lidar-frame-open
          // L'adresse de la visionneuse, dans un nouvel onglet.
          href={url} target="_blank" rel="noreferrer"
          // Petites tailles, la barre de titre reste discrète.
          size="small" aria-label="Ouvrir la visionneuse dans un onglet" title="Ouvrir dans un onglet"
        >
          {/* L'icône d'ouverture dans un onglet. */}
          <Icon fontSize="small"><OpenInNewIcon fontSize="small" /></Icon>
        </IconButton>
        {/* Fermer le cadre : il se rouvrira à la prochaine entrée dans la zone. */}
        <IconButton
          // Marqueur de test.
          data-lidar-frame-close
          // La fermeture demandée par le visiteur.
          onClick={onClose}
          // Petites tailles, la barre de titre reste discrète.
          size="small" aria-label="Fermer la visionneuse" title="Fermer"
        >
          {/* L'icône de fermeture. */}
          <Icon fontSize="small"><CloseIcon fontSize="small" /></Icon>
        </IconButton>
      {/* Fin de la barre de titre. */}
      </Box>
      {/* L'iframe de la visionneuse : toute la place restante du cadre. */}
      {/* L'iframe (début de la balise). */}
      <Box
        // Début du style.
        sx={{
          // Remplit le cadre sous la barre de titre.
          flex: 1, minHeight: 0, bgcolor: 'rgba(0, 0, 0, 0.4)',
        // Fin du style.
        }}
      // Début de l'iframe.
      >
        {/* La visionneuse de l'IGN, à l'adresse recalculée depuis la caméra. */}
        <iframe
          // Nom de l'iframe pour les lecteurs d'écran.
          title="Visionneuse LiDAR HD (IGN)"
          // L'adresse recalculée par useLidarFrame.
          src={url}
          // Toute la place du conteneur, sans bordure.
          style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
          // Permet à la visionneuse d'utiliser son plein écran intégré.
          allowFullScreen
        />
      {/* Fin de l'iframe. */}
      </Box>
    // Fin du panneau.
    />
  // Fin du rendu.
  );
// Fin de LidarFrame.
}
