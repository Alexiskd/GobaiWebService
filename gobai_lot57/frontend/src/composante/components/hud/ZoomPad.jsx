// Importe de React les crochets useCallback, useEffect et useRef.
import { useCallback, useEffect, useRef } from 'react';
// Importe de MUI Paper, Tooltip, IconButton et Divider.
import { Paper, Tooltip, IconButton, Divider } from '@mui/material';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la distance du pavé au bas de l'écran et edge, la distance à un bord.
import { ZOOM_BOTTOM, edge } from '@/composante/theme/layout';
// Importe les icônes plus et moins.
import { AddIcon, RemoveIcon } from '../ui/icons';

// Intervalle de répétition du zoom pendant un appui maintenu, en millisecondes.
const HOLD_INTERVAL_MS = 65;

// Déclare et exporte le composant ZoomPad : reçoit le rappel de zoom.
export function ZoomPad({ onZoom }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Référence : l'identifiant de la répétition en cours, null s'il n'y en a pas.
  const timer = useRef(null);

  // stop : arrête la répétition ; début de la fonction mémorisée.
  const stop = useCallback(() => {
    // S'il y a une répétition en cours.
    if (timer.current !== null) {
      // L'arrête.
      clearInterval(timer.current);
      // Oublie son identifiant.
      timer.current = null;
    // Fin du cas.
    }
  // Fin de stop ; fonction stable.
  }, []);

  // start : fabrique le gestionnaire d'appui pour un facteur de zoom.
  const start = (factor) => (e) => {
    // Clic droit ignoré ; le doigt reste capturé même s'il glisse hors du bouton.
    // Seul le bouton principal compte.
    if (e.button !== undefined && e.button !== 0) return;
    // Empêche le comportement par défaut du navigateur.
    e.preventDefault();
    // Capture le pointeur, si le navigateur le permet.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // Arrête une éventuelle répétition précédente.
    stop();
    // Premier zoom immédiat.
    onZoom(factor);
    // Puis répétition à intervalle régulier tant que l'appui dure.
    timer.current = setInterval(() => onZoom(factor), HOLD_INTERVAL_MS);
  // Fin de start.
  };

  // onKeyDown : fabrique le gestionnaire clavier pour un facteur de zoom.
  const onKeyDown = (factor) => (e) => {
    // Entrée ou Espace.
    if (e.key === 'Enter' || e.key === ' ') {
      // Empêche le comportement par défaut (défilement de la page).
      e.preventDefault();
      // Un seul zoom.
      onZoom(factor);
    // Fin du cas.
    }
  // Fin de onKeyDown.
  };

  // Effet qui arrête la répétition dans tous les cas de fin d'appui.
  useEffect(() => {
    // Les deux événements de fin de pointeur.
    const events = ['pointerup', 'pointercancel'];
    // Les écoute sur toute la fenêtre.
    events.forEach((t) => window.addEventListener(t, stop));
    // Écoute aussi la perte de focus de la fenêtre.
    window.addEventListener('blur', stop);
    // Et le changement de visibilité de l'onglet.
    document.addEventListener('visibilitychange', stop);
    // Fonction de nettoyage.
    return () => {
      // Arrête la répétition.
      stop();
      // Retire les écouteurs de fin de pointeur.
      events.forEach((t) => window.removeEventListener(t, stop));
      // Retire l'écouteur de perte de focus.
      window.removeEventListener('blur', stop);
      // Retire l'écouteur de visibilité.
      document.removeEventListener('visibilitychange', stop);
    // Fin de la fonction de nettoyage.
    };
  // Fin de l'effet ; dépendance : stop.
  }, [stop]);

  // Propriétés communes aux deux boutons (début de l'objet).
  const common = {
    // Relâchement : arrêt.
    onPointerUp: stop,
    // Annulation : arrêt.
    onPointerCancel: stop,
    // Perte de la capture du pointeur : arrêt.
    onLostPointerCapture: stop,
    // Empêche le menu contextuel / la loupe sur appui long (iOS, Android).
    // Menu contextuel : bloqué.
    onContextMenu: (e) => e.preventDefault(),
  // Fin de l'objet.
  };

  // button : fabrique un bouton à partir du facteur, du libellé et de l'icône.
  const button = (factor, label, Icon) => (
    // Infobulle placée à gauche.
    <Tooltip title={label} placement="left">
      {/* Le bouton (début de la balise). */}
      <IconButton
        // Grande taille.
        size="large"
        // Nom pour les lecteurs d'écran.
        aria-label={label}
        // Appui : début du zoom maintenu.
        onPointerDown={start(factor)}
        // Clavier : un zoom par frappe.
        onKeyDown={onKeyDown(factor)}
        // Les propriétés communes.
        {...common}
        // Carré de 48 px, sans arrondi, gestes tactiles réservés.
        sx={{ borderRadius: 0, width: 48, height: 48, touchAction: 'none' }}
      // Fin de la balise ouvrante.
      >
        {/* L'icône. */}
        <Icon />
      {/* Fin du bouton. */}
      </IconButton>
    {/* Fin de l'infobulle. */}
    </Tooltip>
  // Fin de button.
  );

  // Téléphone : pas de boutons +/− (on zoome en pinçant, ou en penchant l'appareil avec ⬆️ / 🚀 de la navball).
  // En mode compact, rien n'est affiché.
  if (compact) return null;

  // Début du rendu.
  return (
    // Carte du pavé (début de la balise).
    <Paper
      // Ombre moyenne.
      elevation={4}
      // Rôle de groupe.
      role="group"
      // Nom pour les lecteurs d'écran.
      aria-label="Contrôles de zoom"
      // Début du style.
      sx={{
        // Fixée en bas à droite, au niveau du HUD.
        position: 'fixed', zIndex: (t) => t.zIndex.hud, right: edge('right', compact ? 8 : 14), bottom: edge('bottom', ZOOM_BOTTOM),
        // Boutons empilés ; ce qui dépasse est masqué.
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Le bouton plus : facteur 0,94, la vue se rapproche. */}
      {button(0.94, 'Maintenir pour zoomer', AddIcon)}
      {/* Filet de séparation. */}
      <Divider />
      {/* Le bouton moins : facteur 1,064, la vue s'éloigne. */}
      {button(1.064, 'Maintenir pour dézoomer', RemoveIcon)}
    {/* Fin de la carte. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de ZoomPad.
}
