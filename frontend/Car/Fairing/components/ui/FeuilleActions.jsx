// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Drawer, IconButton } from '@/Fairing/kit';
// Importe les conversions des valeurs de style calculées au rendu.
import { sp } from '@/Fairing/kit/sx';
// Importe l'icône de fermeture (croix).
import { CloseIcon } from './icons.jsx';
// Importe MQ (requêtes média) et safe (marges de sécurité de l'écran).
import { safe } from '@/Fairing/theme/mediaQueries';
// Importe les calculs du geste : décalage, vitesse et décision de fermeture.
import { dragOffset, dragVelocity, shouldClose } from '@/Engine/shared/lib/device/sheetGesture';

/**
 * Feuille du téléphone : panneau qui monte du bas de l'écran, à portée de pouce, et se referme en le tirant vers le
 * bas par sa poignée, en touchant le voile, avec Échap ou par son bouton Fermer (44 px, toujours visible en haut à
 * droite, aussi pour les lecteurs d'écran). Le contenu défile à l'intérieur si l'écran est trop bas.
 * Le tiroir du kit (Base UI) porte l'animation d'entrée, le voile et le piège du focus ; la feuille visible est posée dedans pour
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
    // Tiroir du kit (début de la balise).
    <Drawer open={open} onClose={onClose} aria-label={label}>
      {/* La feuille visible (début de la balise). */}
      <div
        // Marqueur de l'élément d'interface « actions ».
        data-hud="actions"
        // Début du style.
        className={`g-paper g-elev relative flex flex-col w-full max-w-140 mx-auto rounded-[16px_16px_0_0] ${dragging ? '[transition:none]' : '[transition:transform_220ms_cubic-bezier(0.2,0.8,0.2,1)]'} ${dragging ? '[will-change:transform]' : '[will-change:auto]'} motion-reduce:[transition:none]`} style={{ maxHeight: `calc(100dvh - ${safe('top')} - 56px)`, paddingLeft: sp(safe('left')), paddingRight: sp(safe('right')), transform: `translate3d(0, ${offset}px, 0)` }}
      // Fin de la balise ouvrante.
      >
        {/* Poignée : toute la bande du haut se saisit, le trait n'en est que le repère. */}
        {/* La bande de la poignée (début de la balise). */}
        <div
          // Début du tirage.
          onPointerDown={onPointerDown}
          // Suivi du doigt.
          onPointerMove={onPointerMove}
          // Fin normale du tirage.
          onPointerUp={(e) => endDrag(e, false)}
          // Tirage annulé par le système.
          onPointerCancel={(e) => endDrag(e, true)}
          // Bande de 32 px de haut, contenu centré, gestes tactiles réservés au tirage, curseur en main.
          className="flex-none h-8 grid place-items-center touch-none cursor-grab"
        // Fin de la balise ouvrante.
        >
          {/* Le trait de repère : 40 px sur 4, arrondi, semi-transparent, décoratif. */}
          <div aria-hidden="true" className="w-10 h-1 rounded-full bg-soft opacity-50" />
        {/* Fin de la bande de la poignée. */}
        </div>
        {/* Bouton Fermer : en haut à droite, hors de la poignée et du défilement, cible de 44 px (début). */}
        <IconButton
          // Nom pour les lecteurs d'écran.
          aria-label="Fermer"
          // Ferme la feuille.
          onClick={onClose}
          // Posé sur la feuille, à 4 px du haut et à 6 px du bord droit (marge de sécurité comprise), au-dessus du contenu.
          className="absolute top-1 z-1 w-11 h-11 right-[calc(var(--safe-right,env(safe-area-inset-right,0px))_+_6px)]"
        // Fin de la balise ouvrante.
        >
          {/* La croix. */}
          <CloseIcon className="text-[20px]" />
        {/* Fin du bouton Fermer. */}
        </IconButton>
        {/* Zone de contenu : défile verticalement sans entraîner la page, avec la marge de sécurité du bas. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-[calc(var(--safe-bottom,env(safe-area-inset-bottom,0px))_+_12px)]">
          {/* Le contenu de la feuille. */}
          {children}
        {/* Fin de la zone de contenu. */}
        </div>
      {/* Fin de la feuille. */}
      </div>
    {/* Fin du tiroir. */}
    </Drawer>
  // Fin du rendu.
  );
// Fin de FeuilleActions.
}
