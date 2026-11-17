// Entrées utilisateur sur la scène : rotation (glisser ou flèches), pincement, molette,
// pincement du pavé tactile (Ctrl+molette), clic de sélection et raccourcis clavier.
// Retourne une fonction qui retire tous les écouteurs.

// Importe le facteur de zoom d'un pincement et la détection des contacts périmés, depuis touchMath.
import { pinchFactor, stalePointers } from './touchMath';

// Déclare et exporte le facteur d'un zoom avant au clavier : 0,65.
export const ZOOM_IN = 0.65;
// Déclare et exporte le facteur d'un zoom arrière au clavier : 1,55.
export const ZOOM_OUT = 1.55;

// Flèches maintenues : rotation continue, appliquée par la boucle de rendu (engine.updateCamera).
// Table qui associe chaque flèche du clavier à une direction.
const ARROW_DIRS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

// Déclare et exporte bindInput : le moteur.
export function bindInput(engine) {
  // Le canevas du moteur.
  const cv = engine.canvas;
  // Contacts en cours, par identifiant.
  const pointers = {};   // id → { x, y, type, label } (label : geste commencé sur une étiquette de la scène)
  // Appuis en cours, par identifiant.
  const taps = {};       // id → { x, y, moved, points }
  // Écartement de référence du pincement, milieu des deux doigts et dernière position du doigt.
  let pinch = 0, midX = 0, midY = 0, lastX = 0, lastY = 0;
  // Liste des fonctions de nettoyage.
  const cleanups = [];
  // on : ajoute un écouteur et prépare son retrait (début).
  const on = (target, type, fn, opts) => {
    // Ajoute l'écouteur.
    target.addEventListener(type, fn, opts);
    // Range la fonction qui le retire.
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  // Fin de on.
  };
  // forget : oublie un contact et son appui.
  const forget = (id) => { delete pointers[id]; delete taps[id]; };
  /** Plus aucun contact : fin du glisser. */
  // idle : plus aucun contact (début).
  const idle = () => {
    // Plus d'écartement de référence.
    pinch = 0;
    // Le glisser est terminé.
    engine.drag = false;
    // Curseur en main ouverte.
    cv.style.cursor = 'grab';
  // Fin de idle.
  };

  // Étiquettes posées sur la scène (villes, astres, sondes) : elles reçoivent le doigt à la place du canevas. Un
  // geste qui commence sur une étiquette déplace et zoome quand même la vue ; seul un appui sans mouvement reste un
  // clic sur l'étiquette.
  // labelOf : l'étiquette de la scène sur laquelle porte un événement, ou null.
  const labelOf = (e) => (typeof e.target?.closest === 'function' ? e.target.closest('.l') : null);
  // Instant jusqu'auquel un clic sur une étiquette est ignoré.
  let ignoreLabelClickUntil = 0;

  // down : un contact commence, sur le canevas ou sur une étiquette (début).
  const down = (e, label = false) => {
    // Signale une activité au moteur.
    engine.markActive();
    // Contacts restés en mémoire sans « pointerup » (geste du système, doigt sorti de l'écran) : sans ce ménage,
    // un seul doigt serait pris pour un pincement et la vue zoomerait toute seule.
    // Oublie les contacts périmés.
    stalePointers(pointers, e).forEach(forget);
    // Note l'appui : sa position, sans mouvement, et le nombre de contacts déjà posés.
    taps[e.pointerId] = { x: e.clientX, y: e.clientY, moved: false, points: Object.keys(pointers).length };
    // Sur le canevas : capture le pointeur ; une erreur est ignorée.
    if (!label) { try { cv.setPointerCapture(e.pointerId); } catch { /* contact déjà terminé : rien à capturer */ } }
    // Enregistre le contact.
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY, type: e.pointerType, label };
    // Le glisser commence.
    engine.drag = true;
    // L'écartement de référence est remis à zéro.
    pinch = 0; // un doigt de plus : l'écartement de référence est repris au prochain mouvement
    // Dernière position : celle de ce contact.
    lastX = e.clientX; lastY = e.clientY;
    // Curseur en main fermée.
    cv.style.cursor = 'grabbing';
  // Fin de down.
  };
  // Écoute l'appui d'un pointeur sur le canevas.
  on(cv, 'pointerdown', (e) => down(e));

  // move : un contact bouge (début).
  const move = (e) => {
    // Le contact.
    const pointer = pointers[e.pointerId];
    // Inconnu : ignoré.
    if (!pointer) return;
    // Signale une activité au moteur.
    engine.markActive();
    // L'appui de ce contact.
    const tap = taps[e.pointerId];
    // Au-delà de 8 pixels : l'appui est noté comme ayant bougé.
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap.moved = true;
    // Met à jour la position du contact.
    pointer.x = e.clientX; pointer.y = e.clientY;
    // Identifiants des contacts en cours.
    const ids = Object.keys(pointers);

    // Avec deux contacts ou plus (début).
    if (ids.length >= 2) {
      // Deux doigts : l'écartement zoome, le déplacement du milieu des doigts déplace la vue (le sol suit les doigts).
      // Tous les appuis sont notés comme ayant bougé.
      ids.forEach((id) => { if (taps[id]) taps[id].moved = true; });
      // Les deux premiers contacts.
      const a = pointers[ids[0]], b = pointers[ids[1]];
      // Leur écartement.
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      // Leur milieu.
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // Si un écartement de référence existe (début).
      if (pinch > 0 && d > 0) {
        // Zoome du facteur du pincement.
        engine.zoom(pinchFactor(pinch, d));
        // Déplace la vue du mouvement du milieu.
        engine.dragBy(mx - midX, my - midY);
      // Fin de ce cas.
      }
      // Nouvel écartement et nouveau milieu de référence.
      if (d > 0) { pinch = d; midX = mx; midY = my; }
      // Libère les verrous de la caméra.
      engine.releaseLocks();
      // Terminé.
      return;
    // Fin du cas à deux contacts.
    }

    // Un doigt : le sol reste sous le doigt, quels que soient le zoom, le cap et l'inclinaison de la vue. Comme avec
    // les flèches, glisser reprend la caméra sur un lieu suivi (sinon le verrou la recale à chaque image).
    // Si le doigt a bougé : libère les verrous de la caméra.
    if (tap?.moved) engine.releaseLocks();
    // Déplace la vue du mouvement du doigt.
    engine.dragBy(e.clientX - lastX, e.clientY - lastY);
    // Dernière position : celle-ci.
    lastX = e.clientX; lastY = e.clientY;
  // Fin de move.
  };
  // Écoute le mouvement d'un pointeur sur le canevas.
  on(cv, 'pointermove', move);

  // release : un contact se termine (début).
  const release = (e) => {
    // Contact inconnu : ignoré.
    if (!pointers[e.pointerId]) return; // déjà relâché (« pointerup » puis « lostpointercapture »)
    // Son appui.
    const tap = taps[e.pointerId];
    // Vrai s'il était le seul contact quand il s'est posé.
    const wasSingle = tap && tap.points === 0;
    // Vrai s'il a commencé sur une étiquette.
    const label = pointers[e.pointerId].label;
    // Appui sans mouvement sur la scène : sélection. Sur une étiquette, c'est son propre clic qui agit — sauf si le
    // doigt a glissé ou pincé : le clic qui suit est alors ignoré (voir plus bas).
    // Sur une étiquette, après un mouvement : le clic est ignoré pendant 500 ms.
    if (label && tap?.moved) ignoreLabelClickUntil = Date.now() + 500;
    // Sur le canevas, pour un lever de doigt seul et sans mouvement : sélectionne le point.
    if (!label && e.type === 'pointerup' && tap && wasSingle && !tap.moved && Object.keys(pointers).length === 1) engine.selectAt(e.clientX, e.clientY);
    // Oublie le contact.
    forget(e.pointerId);
    // Plus d'écartement de référence.
    pinch = 0;
    // Contacts restants.
    const rest = Object.keys(pointers);
    // Aucun : fin du glisser.
    if (!rest.length) idle();
    // Sinon (début).
    else {
      // Un doigt reste posé après un pincement : il reprend le glisser là où il se trouve, sans saut.
      // Dernière position horizontale : celle du contact restant.
      lastX = pointers[rest[0]].x;
      // Dernière position verticale : celle du contact restant.
      lastY = pointers[rest[0]].y;
    // Fin de ce cas.
    }
  // Fin de release.
  };
  // Écoute le lever d'un pointeur sur le canevas.
  on(cv, 'pointerup', release);
  // Écoute l'annulation d'un pointeur.
  on(cv, 'pointercancel', release);
  // Capture perdue sans « pointerup » (le navigateur ou le système a repris le geste) : le contact est terminé.
  // Écoute la perte de la capture d'un pointeur.
  on(cv, 'lostpointercapture', release);
  // Gestes commencés sur une étiquette : suivis au niveau du document (le canevas ne reçoit pas ces événements).
  // Sur le document : un appui sur une étiquette commence un contact.
  on(document, 'pointerdown', (e) => { if (labelOf(e)) down(e, true); });
  // Sur le document : le mouvement d'un contact commencé sur une étiquette.
  on(document, 'pointermove', (e) => { if (pointers[e.pointerId]?.label) move(e); });
  // releaseLabel : termine un contact commencé sur une étiquette.
  const releaseLabel = (e) => { if (pointers[e.pointerId]?.label) release(e); };
  // L'écoute au lever d'un pointeur sur le document.
  on(document, 'pointerup', releaseLabel);
  // Et à son annulation.
  on(document, 'pointercancel', releaseLabel);
  // Sur le document, pour chaque clic (début).
  on(document, 'click', (e) => {
    // Pendant le délai, sur une étiquette : le clic est arrêté et annulé.
    if (Date.now() < ignoreLabelClickUntil && labelOf(e)) { e.stopPropagation(); e.preventDefault(); }
  // Fin : écouteur en phase de capture.
  }, true);
  // Page quittée ou masquée doigts posés : tous les contacts sont oubliés, rien ne reste « enfoncé ».
  // releaseAll : oublie tous les contacts et termine le glisser.
  const releaseAll = () => { Object.keys(pointers).forEach(forget); idle(); };
  // L'écoute quand la fenêtre perd le focus.
  on(window, 'blur', releaseAll);
  // Et quand la page devient masquée.
  on(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') releaseAll(); });

  // Molette (sur la scène) et pincement du pavé tactile (Ctrl+molette, géré une seule fois au niveau fenêtre).
  // wheelZoom : zoome à la molette ou au pavé tactile (début).
  const wheelZoom = (e, trackpad) => {
    // Écouteur du pavé tactile sans la touche Ctrl : ignoré.
    if (trackpad && !e.ctrlKey) return;
    // Écouteur de la molette avec la touche Ctrl : ignoré.
    if (!trackpad && e.ctrlKey) return;
    // Empêche le défilement de la page.
    e.preventDefault();
    // Arrête la propagation de l'événement.
    e.stopPropagation();
    // Déplacement de la molette, borné entre −120 et 120.
    const delta = Math.max(-120, Math.min(120, e.deltaY));
    // Zoome d'un facteur exponentiel, plus fort avec la touche Ctrl.
    engine.zoom(Math.exp(delta * (e.ctrlKey ? 0.012 : 0.0025)));
  // Fin de wheelZoom.
  };
  // Écoute la molette sur le canevas.
  on(cv, 'wheel', (e) => wheelZoom(e, false), { passive: false });
  // Molette au-dessus d'une étiquette de la scène : même zoom que sur le canevas.
  // Écoute la molette sur le document, au-dessus d'une étiquette et sans la touche Ctrl.
  on(document, 'wheel', (e) => { if (!e.ctrlKey && labelOf(e)) wheelZoom(e, false); }, { passive: false });
  // Écoute la molette sur la fenêtre, en phase de capture, pour le pavé tactile.
  on(window, 'wheel', (e) => wheelZoom(e, true), { passive: false, capture: true });

  // Clavier : + / − (aussi pavé numérique), 0 du pavé numérique = vue globale,
  // flèches maintenues = rotation autour de l'astre ciblé.
  // Écoute l'appui d'une touche (début).
  on(window, 'keydown', (e) => {
    // Avec Ctrl, Alt ou la touche Méta : ignoré.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // Élément qui a le focus.
    const t = e.target;
    // Dans un champ de saisie : ignoré.
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    // Direction de la flèche, s'il s'agit d'une flèche.
    const dir = ARROW_DIRS[e.key];
    // Signale une activité au moteur.
    engine.markActive();
    // Pour une flèche (début).
    if (dir) {
      // Empêche le défilement de la page.
      e.preventDefault();
      // Active la rotation dans cette direction.
      engine.keyRotate[dir] = true;
      // Libère les verrous de la caméra.
      engine.releaseLocks();    // tourner à la main reprend la caméra sur un lieu suivi
      // Terminé.
      return;
    // Fin du cas d'une flèche.
    }
    // Touche plus (début).
    if (['NumpadAdd', 'Equal', 'Plus'].includes(e.code) || e.key === '+') {
      // Empêche l'action par défaut.
      e.preventDefault();
      // Zoom avant.
      engine.zoom(ZOOM_IN);
    // Touche moins (début).
    } else if (['NumpadSubtract', 'Minus'].includes(e.code) || e.key === '-') {
      // Empêche l'action par défaut.
      e.preventDefault();
      // Zoom arrière.
      engine.zoom(ZOOM_OUT);
    // Touche 0 du pavé numérique (début).
    } else if (e.code === 'Numpad0') {
      // Empêche l'action par défaut.
      e.preventDefault();
      // Revient à la vue globale.
      engine.resetView();
    // Fin du choix de la touche.
    }
  // Fin de l'écouteur.
  });

  // releaseArrow : une touche est relâchée (début).
  const releaseArrow = (e) => {
    // Direction de la flèche.
    const dir = ARROW_DIRS[e.key];
    // Arrête la rotation dans cette direction.
    if (dir) engine.keyRotate[dir] = false;
  // Fin de releaseArrow.
  };
  // L'écoute au relâchement d'une touche.
  on(window, 'keyup', releaseArrow);
  // Fenêtre quittée touche enfoncée : sinon la rotation resterait bloquée.
  // Quand la fenêtre perd le focus : arrête toutes les rotations.
  on(window, 'blur', () => Object.keys(engine.keyRotate).forEach((k) => { engine.keyRotate[k] = false; }));

  // Au redimensionnement de la fenêtre : redimensionne le moteur.
  on(window, 'resize', () => engine.resize());

  // Renvoie la fonction qui retire tous les écouteurs.
  return () => cleanups.forEach((f) => f());
// Fin de bindInput.
}
