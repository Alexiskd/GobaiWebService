// Importe de React les crochets useCallback, useEffect, useRef et useState.
import { useCallback, useEffect, useRef, useState } from 'react';
// Importe clampPanelPosition, qui garde une position dans les limites de la fenêtre.
import { clampPanelPosition } from '@/moteur/engine/dragMath';

// Mise en page « bureau » : chaque panneau garde la position où on l'a déposé, d'une visite à l'autre.
// Préfixe des clés du stockage local où sont gardées les positions des panneaux.
const STORAGE_PREFIX = 'gobai:panneau:';
// Les commandes à l'intérieur d'un en-tête (fermer, réduire, liens) ne déclenchent pas le déplacement.
// Sélecteur CSS des éléments qui ne déclenchent pas le déplacement.
const NO_DRAG = 'button, a, input, select, textarea, label, [data-no-drag]';

// Déclare readPosition, qui lit la position enregistrée d'un panneau.
function readPosition(key) {
  // Début du bloc protégé : le stockage ou le décodage peut échouer.
  try {
    // Lit la valeur brute dans le stockage local, s'il existe.
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + key);
    // Décode le JSON, null s'il n'y a rien.
    const p = raw ? JSON.parse(raw) : null;
    // Renvoie la position si x et y sont bien des nombres, null sinon.
    return typeof p?.x === 'number' && typeof p?.y === 'number' ? { x: p.x, y: p.y } : null;
  // En cas d'erreur.
  } catch {
    // Pas de position.
    return null;
  // Fin du bloc try/catch.
  }
// Fin de readPosition.
}

// Déclare writePosition, qui enregistre ou efface la position d'un panneau.
function writePosition(key, position) {
  // Début du bloc protégé.
  try {
    // S'il y a une position, l'enregistre en JSON.
    if (position) globalThis.localStorage?.setItem(STORAGE_PREFIX + key, JSON.stringify(position));
    // Sinon, efface l'entrée.
    else globalThis.localStorage?.removeItem(STORAGE_PREFIX + key);
  // Une erreur de stockage est ignorée.
  } catch { /* stockage refusé : la position reste valable pour la session */ }
// Fin de writePosition.
}

// Déclare clampInWindow, qui ramène une position dans la fenêtre pour un élément donné.
function clampInWindow(position, element) {
  // Mesure l'élément à l'écran.
  const rect = element.getBoundingClientRect();
  // Renvoie la position corrigée (début de l'appel).
  return clampPanelPosition(
    // La position demandée.
    position,
    // La taille du panneau.
    { width: rect.width, height: rect.height },
    // La taille de la fenêtre.
    { width: window.innerWidth, height: window.innerHeight }
  // Fin de l'appel.
  );
// Fin de clampInWindow.
}

/**
 * Rend un panneau déplaçable à la souris, au doigt et au stylet.
 * `handleProps` se pose sur l'en-tête (poignée) ; `ref` et `style` sur le panneau entier.
 * La position est mémorisée dans localStorage ; un double-clic sur l'en-tête rétablit la mise en page.
 */
// Déclare et exporte le crochet useDraggable : reçoit la clé du panneau.
export function useDraggable(key) {
  // Référence vers le nœud DOM du panneau.
  const ref = useRef(null);
  // État : la position du panneau, lue une seule fois dans le stockage (null : place d'origine).
  const [position, setPosition] = useState(() => readPosition(key));
  // Référence : l'état du geste en cours, null hors déplacement.
  const drag = useRef(null);

  // Le panneau peut apparaître après coup (Informations) : on reclampe dès que son nœud est monté.
  // attach : rappel de référence, appelé quand le nœud est monté ou démonté.
  const attach = useCallback((node) => {
    // Garde le nœud dans la référence.
    ref.current = node;
    // Au démontage (nœud nul), rien de plus.
    if (!node) return;
    // Reclampe la position enregistrée dans la fenêtre, s'il y en a une.
    setPosition((p) => (p ? clampInWindow(p, node) : p));
  // Fin de attach ; fonction stable.
  }, []);

  // Vrai si le panneau a été déplacé (une position existe).
  const moved = position !== null;

  // Effet relancé quand le panneau passe de « déplacé » à « non déplacé », ou l'inverse.
  useEffect(() => {
    // Panneau à sa place d'origine : rien à surveiller.
    if (!moved) return undefined;
    // Déclare onResize, appelé quand la fenêtre change de taille.
    const onResize = () => {
      // Récupère le nœud du panneau.
      const node = ref.current;
      // Sans nœud, rien à faire.
      if (!node) return;
      // Reclampe la position dans la nouvelle taille de fenêtre.
      setPosition((p) => (p ? clampInWindow(p, node) : p));
    // Fin de onResize.
    };
    // Écoute le redimensionnement de la fenêtre.
    window.addEventListener('resize', onResize);
    // Nettoyage : retire l'écouteur.
    return () => window.removeEventListener('resize', onResize);
  // Fin de l'effet ; dépendance : moved.
  }, [moved]);

  // Effet qui pose les écouteurs du geste de déplacement.
  useEffect(() => {
    // Déclare finish, qui termine le geste.
    const finish = () => {
      // Récupère l'état du geste.
      const state = drag.current;
      // Aucun geste en cours : rien à faire.
      if (!state) return;
      // Marque le geste comme terminé.
      drag.current = null;
      // Retire la classe is-dragging du panneau.
      ref.current?.classList.remove('is-dragging');
      // Si le panneau a bougé, enregistre sa position.
      if (state.position) writePosition(key, state.position);
    // Fin de finish.
    };
    // Déclare onMove, appelé à chaque mouvement de pointeur.
    const onMove = (event) => {
      // Récupère l'état du geste.
      const state = drag.current;
      // Ignore le mouvement s'il n'y a pas de geste, ou s'il vient d'un autre pointeur.
      if (!state || event.pointerId !== state.pointerId) return;
      // Récupère le nœud du panneau.
      const node = ref.current;
      // Sans nœud, rien à faire.
      if (!node) return;
      // Calcule la nouvelle position, gardée dans la fenêtre (début de l'appel).
      const next = clampInWindow(
        // Position du pointeur moins le décalage du point de saisie.
        { x: event.clientX - state.offsetX, y: event.clientY - state.offsetY },
        // Le nœud du panneau.
        node
      // Fin de l'appel.
      );
      // Garde la position dans l'état du geste.
      state.position = next;
      // Met à jour la position affichée.
      setPosition(next);
    // Fin de onMove.
    };
    // Déclare onEnd, appelé quand un pointeur est relâché ou annulé.
    const onEnd = (event) => {
      // Si c'est le pointeur du geste en cours, termine le geste.
      if (drag.current && event.pointerId === drag.current.pointerId) finish();
    // Fin de onEnd.
    };
    // Écoute les mouvements de pointeur sur toute la fenêtre.
    window.addEventListener('pointermove', onMove);
    // Écoute le relâchement du pointeur.
    window.addEventListener('pointerup', onEnd);
    // Écoute l'annulation du pointeur.
    window.addEventListener('pointercancel', onEnd);
    // Termine aussi le geste si la fenêtre perd le focus.
    window.addEventListener('blur', finish);
    // Fonction de nettoyage de l'effet.
    return () => {
      // Retire l'écouteur des mouvements.
      window.removeEventListener('pointermove', onMove);
      // Retire l'écouteur du relâchement.
      window.removeEventListener('pointerup', onEnd);
      // Retire l'écouteur de l'annulation.
      window.removeEventListener('pointercancel', onEnd);
      // Retire l'écouteur de perte de focus.
      window.removeEventListener('blur', finish);
    // Fin de la fonction de nettoyage.
    };
  // Fin de l'effet ; dépendance : la clé du panneau.
  }, [key]);

  // onPointerDown : début du geste, sur appui dans l'en-tête ; début de la fonction mémorisée.
  const onPointerDown = useCallback((event) => {
    // Seulement le bouton principal et le pointeur principal.
    if (event.button !== 0 || !event.isPrimary) return;
    // Pas de déplacement si l'appui vise une commande de l'en-tête.
    if (event.target.closest?.(NO_DRAG)) return;
    // Récupère le nœud du panneau.
    const node = ref.current;
    // Sans nœud, rien à faire.
    if (!node) return;
    // Mesure le panneau à l'écran.
    const rect = node.getBoundingClientRect();
    // Crée l'état du geste (début de l'objet).
    drag.current = {
      // L'identifiant du pointeur qui tient le panneau.
      pointerId: event.pointerId,
      // Décalage horizontal entre le pointeur et le bord gauche du panneau.
      offsetX: event.clientX - rect.left,
      // Décalage vertical entre le pointeur et le haut du panneau.
      offsetY: event.clientY - rect.top,
      // Pas encore de nouvelle position.
      position: null,
    // Fin de l'objet.
    };
    // Ajoute la classe is-dragging au panneau.
    node.classList.add('is-dragging');
    // Garde le pointeur pendant tout le geste, même hors de la fenêtre.
    // Capture le pointeur ; une erreur (pointeur déjà relâché) est ignorée.
    try { node.setPointerCapture(event.pointerId); } catch { /* pointeur déjà relâché */ }
    // Empêche le comportement par défaut du navigateur (sélection de texte, défilement).
    event.preventDefault();
  // Fin de onPointerDown ; fonction stable.
  }, []);

  // onDoubleClick : rétablit la place d'origine ; début de la fonction mémorisée.
  const onDoubleClick = useCallback((event) => {
    // Rien à faire si le double-clic vise une commande de l'en-tête.
    if (event.target.closest?.(NO_DRAG)) return;
    // Annule un éventuel geste en cours.
    drag.current = null;
    // Retire la classe is-dragging.
    ref.current?.classList.remove('is-dragging');
    // Efface la position : le panneau reprend sa place d'origine.
    setPosition(null);
    // Efface aussi la position enregistrée.
    writePosition(key, null);
  // Fin de onDoubleClick ; dépendance : la clé du panneau.
  }, [key]);

  // Style du panneau : seulement s'il a été déplacé.
  const style = moved
    // Début de l'objet de style.
    ? {
        // Position fixe dans la fenêtre.
        position: 'fixed',
        // Abscisse du coin supérieur gauche.
        left: position.x,
        // Ordonnée du coin supérieur gauche.
        top: position.y,
        // Annule l'ancrage à droite.
        right: 'auto',
        // Annule l'ancrage en bas.
        bottom: 'auto',
        // Annule toute transformation de centrage.
        transform: 'none',
        // Aucune marge.
        margin: 0,
      // Fin de l'objet de style.
      }
    // Sinon, aucun style : la mise en page d'origine s'applique.
    : undefined;

  // Début de l'objet renvoyé.
  return {
    // La référence à poser sur le panneau.
    ref: attach,
    // Le style à poser sur le panneau.
    style,
    // Vrai si le panneau a été déplacé.
    moved,
    // Les propriétés à poser sur l'en-tête (début de l'objet).
    handleProps: {
      // Attribut qui marque la poignée.
      'data-drag-handle': '',
      // Début du geste sur appui.
      onPointerDown,
      // Retour à la place d'origine sur double-clic.
      onDoubleClick,
      // Infobulle d'aide.
      title: 'Glisser pour déplacer · double-clic pour rétablir la position',
    // Fin des propriétés de la poignée.
    },
  // Fin de l'objet renvoyé.
  };
// Fin de useDraggable.
}
