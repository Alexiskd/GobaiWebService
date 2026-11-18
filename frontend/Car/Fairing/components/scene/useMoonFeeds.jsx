/** Hook de compatibilité : les positions sont désormais calculées localement. */
import { useState } from 'react';
export function useMoonFeeds() {
  const [moonPhases] = useState(null);
  return { moonPhases };
}
