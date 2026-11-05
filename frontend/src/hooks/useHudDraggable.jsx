import { useDraggable } from './useDraggable';

/** Glisser-déposer des panneaux, désactivé en mode compact (les panneaux y ont une place fixe). */
export function useHudDraggable(id, enabled) {
  const drag = useDraggable(id);
  return enabled ? drag : { ref: drag.ref, style: undefined, handleProps: {} };
}
