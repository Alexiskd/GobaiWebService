// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { IconButton } from '@/Fairing/kit';
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
    <div
      // Marqueur de test.
      data-lidar-frame
      // Début du style.
      className="g-paper fixed z-24 h-[clamp(220px,46vh,480px)] flex flex-col overflow-hidden rounded-[12px]" style={{ left: `calc(${safe('left')} + 8px)`, right: `calc(${safe('right')} + 8px)`, bottom: `calc(${safe('bottom')} + 8px)` }}
    // Fin des propriétés du panneau.
    >
      {/* La barre de titre : le nom de la visionneuse et ses deux boutons. */}
      {/* La barre de titre (début de la balise). */}
      <div
        // Début du style.
        className="flex items-center gap-2 px-2 py-1 flex-[0_0_auto] bg-[color:rgba(255,255,255,0.06)] border-b border-line"
      // Fin de la barre de titre.
      >
        {/* Le titre du cadre. */}
        <span className="t-caption font-semibold select-none flex-1">
          Visionneuse LiDAR HD (IGN)
        </span>
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
          <OpenInNewIcon fontSize="small" />
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
          <CloseIcon fontSize="small" />
        </IconButton>
      {/* Fin de la barre de titre. */}
      </div>
      {/* L'iframe de la visionneuse : toute la place restante du cadre. */}
      {/* L'iframe (début de la balise). */}
      <div
        // Début du style.
        className="flex-1 min-h-0 bg-[color:rgba(0,0,0,0.4)]"
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
      </div>
    {/* Fin du panneau. */}
    </div>
  // Fin du rendu.
  );
// Fin de LidarFrame.
}
