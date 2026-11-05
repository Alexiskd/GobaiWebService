// Entrées utilisateur sur la scène : rotation (glisser ou flèches), pincement, molette,
// pincement du pavé tactile (Ctrl+molette), clic de sélection et raccourcis clavier.
// Retourne une fonction qui retire tous les écouteurs.

export const ZOOM_IN = 0.65;
export const ZOOM_OUT = 1.55;

// Flèches maintenues : rotation continue, appliquée par la boucle de rendu (engine.updateCamera).
const ARROW_DIRS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

export function bindInput(engine) {
  const cv = engine.canvas;
  const pointers = {};   // id → [x, y]
  const taps = {};       // id → { x, y, moved, points }
  let pinch = 0, lastX = 0, lastY = 0;
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  on(cv, 'pointerdown', (e) => {
    taps[e.pointerId] = { x: e.clientX, y: e.clientY, moved: false, points: Object.keys(pointers).length };
    cv.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = [e.clientX, e.clientY];
    engine.drag = true;
    lastX = e.clientX; lastY = e.clientY;
    cv.style.cursor = 'grabbing';
  });

  on(cv, 'pointermove', (e) => {
    if (!pointers[e.pointerId]) return;
    const tap = taps[e.pointerId];
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap.moved = true;
    pointers[e.pointerId] = [e.clientX, e.clientY];
    const ids = Object.keys(pointers);

    if (ids.length >= 2) {
      // Pincement à deux doigts : zoom
      ids.forEach((id) => { if (taps[id]) taps[id].moved = true; });
      const a = pointers[ids[0]], b = pointers[ids[1]];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && d > 0) engine.zoom(Math.max(0.82, Math.min(1.22, pinch / d)));
      pinch = d;
      engine.lockCity = null;
      return;
    }

    // Un doigt : rotation, d'autant plus fine qu'on est proche de l'astre
    const kz = Math.max(1e-9, Math.min(1, (engine.dist / engine.focusTarget().r - 1) * 0.9));
    engine.az -= (e.clientX - lastX) * 0.006 * kz;
    engine.el = Math.max(-1.5, Math.min(1.5, engine.el + (e.clientY - lastY) * 0.006 * kz));
    lastX = e.clientX; lastY = e.clientY;
  });

  const release = (e) => {
    const tap = taps[e.pointerId];
    const wasSingle = tap && tap.points === 0;
    if (tap && wasSingle && !tap.moved && Object.keys(pointers).length === 1) engine.selectAt(e.clientX, e.clientY);
    delete taps[e.pointerId];
    delete pointers[e.pointerId];
    pinch = 0;
    const rest = Object.keys(pointers);
    if (!rest.length) {
      engine.drag = false;
      cv.style.cursor = 'grab';
    } else {
      lastX = pointers[rest[0]][0];
      lastY = pointers[rest[0]][1];
    }
  };
  on(cv, 'pointerup', release);
  on(cv, 'pointercancel', release);

  // Molette (sur la scène) et pincement du pavé tactile (Ctrl+molette, géré une seule fois au niveau fenêtre).
  const wheelZoom = (e, trackpad) => {
    if (trackpad && !e.ctrlKey) return;
    if (!trackpad && e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = Math.max(-120, Math.min(120, e.deltaY));
    engine.zoom(Math.exp(delta * (e.ctrlKey ? 0.012 : 0.0025)));
  };
  on(cv, 'wheel', (e) => wheelZoom(e, false), { passive: false });
  on(window, 'wheel', (e) => wheelZoom(e, true), { passive: false, capture: true });

  // Clavier : + / − (aussi pavé numérique), 0 du pavé numérique = vue globale,
  // flèches maintenues = rotation autour de l'astre ciblé.
  on(window, 'keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const dir = ARROW_DIRS[e.key];
    if (dir) {
      e.preventDefault();
      engine.keyRotate[dir] = true;
      engine.releaseLocks();    // tourner à la main reprend la caméra sur un lieu suivi
      return;
    }
    if (['NumpadAdd', 'Equal', 'Plus'].includes(e.code) || e.key === '+') {
      e.preventDefault();
      engine.zoom(ZOOM_IN);
    } else if (['NumpadSubtract', 'Minus'].includes(e.code) || e.key === '-') {
      e.preventDefault();
      engine.zoom(ZOOM_OUT);
    } else if (e.code === 'Numpad0') {
      e.preventDefault();
      engine.resetView();
    }
  });

  const releaseArrow = (e) => {
    const dir = ARROW_DIRS[e.key];
    if (dir) engine.keyRotate[dir] = false;
  };
  on(window, 'keyup', releaseArrow);
  // Fenêtre quittée touche enfoncée : sinon la rotation resterait bloquée.
  on(window, 'blur', () => Object.keys(engine.keyRotate).forEach((k) => { engine.keyRotate[k] = false; }));

  on(window, 'resize', () => engine.resize());

  return () => cleanups.forEach((f) => f());
}
