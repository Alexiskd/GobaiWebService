// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe de MUI Box, Drawer (tiroir) et Paper (carte).
import { Box, Drawer, Paper } from '@mui/material';
// Importe MQ (requêtes média) et safe (marges de sécurité de l'écran).
import { MQ, safe } from '@/composante/theme/mediaQueries';
// Importe les calculs du geste : décalage, vitesse et décision de fermeture.
import { dragOffset, dragVelocity, shouldClose } from '@/moteur/lib/sheetGesture';

/**
 * Feuille du téléphone : panneau qui monte du bas de l'écran, à portée de pouce, et se referme en le tirant vers le
 * bas par sa poignée, en touchant le voile ou avec Échap. Le contenu défile à l'intérieur si l'écran est trop bas.
 * Le tiroir MUI porte l'animation d'entrée, le voile et le piège du focus ; la feuille visible est posée dedans pour
 * pouvoir suivre le doigt sans gêner cette animation.
 */
// Déclare et exporte le composant FeuilleActions : état d'ouverture, fermeture, libellé et contenu.
export function FeuilleActions({ open, onClose, label, children }) {
  // État : décalage vertical de la feuille pendant le tirage, en pixels.
  const [offset, setOffset] = useState(0);
  // État : vrai pendant le tirage.
  const [dragging, setDragging] = useState(false);
  // Référence : les données du geste en cours.
  const drag = useRef(null); // { id, y0, y, t, v } pendant le tirage

  // Une feuille rouverte repart de sa place.
  // À chaque ouverture : remet le décalage à zéro et oublie tout geste.
  useEffect(() => { if (open) { setOffset(0); setDragging(false); drag.current = null; } }, [open]);

  // Déclare onPointerDown : début du tirage.
  const onPointerDown = (e) => {
    // À la souris, seulement le bouton principal.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Mémorise le pointeur, sa position de départ et courante, l'instant et une vitesse nulle.
    drag.current = { id: e.pointerId, y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0 };
    // Capture le pointeur, si le navigateur le permet.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // Signale le début du tirage.
    setDragging(true);
  // Fin de onPointerDown.
  };
  // Déclare onPointerMove : la feuille suit le doigt.
  const onPointerMove = (e) => {
    // Récupère le geste en cours.
    const d = drag.current;
    // Ignore le mouvement s'il n'y a pas de geste, ou s'il vient d'un autre pointeur.
    if (!d || d.id !== e.pointerId) return;
    // Calcule la vitesse entre la position précédente et la nouvelle.
    d.v = dragVelocity(d.y, d.t, e.clientY, e.timeStamp);
    // Mémorise la nouvelle position.
    d.y = e.clientY;
    // Mémorise le nouvel instant.
    d.t = e.timeStamp;
    // Décale la feuille selon la distance parcourue depuis le départ.
    setOffset(dragOffset(e.clientY - d.y0));
  // Fin de onPointerMove.
  };
  // Déclare endDrag : fin du tirage, annulé ou non.
  const endDrag = (e, cancelled) => {
    // Récupère le geste en cours.
    const d = drag.current;
    // Ignore l'événement s'il n'y a pas de geste, ou s'il vient d'un autre pointeur.
    if (!d || d.id !== e.pointerId) return;
    // Oublie le geste.
    drag.current = null;
    // Signale la fin du tirage.
    setDragging(false);
    // Si le geste n'est pas annulé et que la distance ou la vitesse le justifie, ferme la feuille.
    if (!cancelled && shouldClose(d.y - d.y0, d.v)) onClose?.();
    // Sinon, la feuille revient à sa place.
    else setOffset(0);
  // Fin de endDrag.
  };

  // Début du rendu.
  return (
    // Tiroir MUI (début de la balise).
    <Drawer
      // Ancré en bas de l'écran.
      anchor="bottom"
      // Ouvert ou fermé selon le parent.
      open={open}
      // Fermeture demandée par le voile ou la touche Échap.
      onClose={onClose}
      // Réglages des éléments internes du tiroir (début).
      slotProps={{
        // Le papier du tiroir est invisible : c'est la feuille posée dedans qui se voit et qui suit le doigt.
        // Papier du tiroir : transparent, sans flou, sans ombre, débordement visible.
        paper: { sx: { backgroundColor: 'transparent', backdropFilter: 'none', boxShadow: 'none', border: 'none', overflow: 'visible' } },
      // Fin des réglages.
      }}
    // Fin de la balise ouvrante.
    >
      {/* La feuille visible (début de la balise). */}
      <Paper
        // Ombre marquée.
        elevation={8}
        // Rôle de boîte de dialogue.
        role="dialog"
        // Dialogue modal.
        aria-modal="true"
        // Nom de la feuille pour les lecteurs d'écran.
        aria-label={label}
        // Marqueur de l'élément d'interface « actions ».
        data-hud="actions"
        // Début du style.
        sx={{
          // Colonne, toute la largeur, 560 px au plus, centrée.
          display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 560, mx: 'auto',
          // Hauteur maximale : l'écran moins la marge de sécurité du haut et 56 px.
          maxHeight: `calc(100dvh - ${safe('top')} - 56px)`,
          // Coins arrondis en haut seulement.
          borderRadius: '20px 20px 0 0',
          // Marges de sécurité à gauche et à droite.
          pl: safe('left'), pr: safe('right'),
          // Décalage vertical qui suit le doigt.
          transform: `translate3d(0, ${offset}px, 0)`,
          // Pas de transition pendant le tirage ; retour animé en 220 ms sinon.
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          // Prévient le navigateur de l'animation seulement pendant le tirage.
          willChange: dragging ? 'transform' : 'auto',
          // Pas de transition si l'utilisateur a demandé moins de mouvement.
          [MQ.reducedMotion]: { transition: 'none' },
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* Poignée : toute la bande du haut se saisit, le trait n'en est que le repère. */}
        {/* La bande de la poignée (début de la balise). */}
        <Box
          // Début du tirage.
          onPointerDown={onPointerDown}
          // Suivi du doigt.
          onPointerMove={onPointerMove}
          // Fin normale du tirage.
          onPointerUp={(e) => endDrag(e, false)}
          // Tirage annulé par le système.
          onPointerCancel={(e) => endDrag(e, true)}
          // Bande de 32 px de haut, contenu centré, gestes tactiles réservés au tirage, curseur en main.
          sx={{ flex: 'none', height: 32, display: 'grid', placeItems: 'center', touchAction: 'none', cursor: 'grab' }}
        // Fin de la balise ouvrante.
        >
          {/* Le trait de repère : 40 px sur 4, arrondi, semi-transparent, décoratif. */}
          <Box aria-hidden="true" sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'text.secondary', opacity: 0.5 }} />
        {/* Fin de la bande de la poignée. */}
        </Box>
        {/* Zone de contenu : défile verticalement sans entraîner la page, avec la marge de sécurité du bas. */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', px: 1.5, pb: `calc(${safe('bottom')} + 12px)` }}>
          {/* Le contenu de la feuille. */}
          {children}
        {/* Fin de la zone de contenu. */}
        </Box>
      {/* Fin de la feuille. */}
      </Paper>
    {/* Fin du tiroir. */}
    </Drawer>
  // Fin du rendu.
  );
// Fin de FeuilleActions.
}
