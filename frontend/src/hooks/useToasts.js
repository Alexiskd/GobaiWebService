import { useCallback, useRef, useState } from 'react';

/** Messages brefs et temporaires. tone : 'info' | 'warn' | 'error'. */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback((text, tone = 'info', ms = 6000) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    if (ms) setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  return { toasts, push, dismiss };
}
