import { useCallback, useEffect, useRef, useState } from 'react';
import { clampPanelPosition } from '@/engine/dragMath';

// Mise en page « bureau » : chaque panneau garde la position où on l'a déposé, d'une visite à l'autre.
const STORAGE_PREFIX = 'gobai:panneau:';
// Les commandes à l'intérieur d'un en-tête (fermer, réduire, liens) ne déclenchent pas le déplacement.
const NO_DRAG = 'button, a, input, select, textarea, label, [data-no-drag]';

function readPosition(key) {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + key);
    const p = raw ? JSON.parse(raw) : null;
    return typeof p?.x === 'number' && typeof p?.y === 'number' ? { x: p.x, y: p.y } : null;
  } catch {
    return null;
  }
}

function writePosition(key, position) {
  try {
    if (position) globalThis.localStorage?.setItem(STORAGE_PREFIX + key, JSON.stringify(position));
    else globalThis.localStorage?.removeItem(STORAGE_PREFIX + key);
  } catch { /* stockage refusé : la position reste valable pour la session */ }
}

function clampInWindow(position, element) {
  const rect = element.getBoundingClientRect();
  return clampPanelPosition(
    position,
    { width: rect.width, height: rect.height },
    { width: window.innerWidth, height: window.innerHeight }
  );
}

/**
 * Rend un panneau déplaçable à la souris, au doigt et au stylet.
 * `handleProps` se pose sur l'en-tête (poignée) ; `ref` et `style` sur le panneau entier.
 * La position est mémorisée dans localStorage ; un double-clic sur l'en-tête rétablit la mise en page.
 */
export function useDraggable(key) {
  const ref = useRef(null);
  const [position, setPosition] = useState(() => readPosition(key));
  const drag = useRef(null);

  // Le panneau peut apparaître après coup (Informations) : on reclampe dès que son nœud est monté.
  const attach = useCallback((node) => {
    ref.current = node;
    if (!node) return;
    setPosition((p) => (p ? clampInWindow(p, node) : p));
  }, []);

  const moved = position !== null;

  useEffect(() => {
    if (!moved) return undefined;
    const onResize = () => {
      const node = ref.current;
      if (!node) return;
      setPosition((p) => (p ? clampInWindow(p, node) : p));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [moved]);

  useEffect(() => {
    const finish = () => {
      const state = drag.current;
      if (!state) return;
      drag.current = null;
      ref.current?.classList.remove('is-dragging');
      if (state.position) writePosition(key, state.position);
    };
    const onMove = (event) => {
      const state = drag.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const node = ref.current;
      if (!node) return;
      const next = clampInWindow(
        { x: event.clientX - state.offsetX, y: event.clientY - state.offsetY },
        node
      );
      state.position = next;
      setPosition(next);
    };
    const onEnd = (event) => {
      if (drag.current && event.pointerId === drag.current.pointerId) finish();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('blur', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', finish);
    };
  }, [key]);

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target.closest?.(NO_DRAG)) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      position: null,
    };
    node.classList.add('is-dragging');
    // Garde le pointeur pendant tout le geste, même hors de la fenêtre.
    try { node.setPointerCapture(event.pointerId); } catch { /* pointeur déjà relâché */ }
    event.preventDefault();
  }, []);

  const onDoubleClick = useCallback((event) => {
    if (event.target.closest?.(NO_DRAG)) return;
    drag.current = null;
    ref.current?.classList.remove('is-dragging');
    setPosition(null);
    writePosition(key, null);
  }, [key]);

  const style = moved
    ? {
        position: 'fixed',
        left: position.x,
        top: position.y,
        right: 'auto',
        bottom: 'auto',
        transform: 'none',
        margin: 0,
      }
    : undefined;

  return {
    ref: attach,
    style,
    moved,
    handleProps: {
      'data-drag-handle': '',
      onPointerDown,
      onDoubleClick,
      title: 'Glisser pour déplacer · double-clic pour rétablir la position',
    },
  };
}
