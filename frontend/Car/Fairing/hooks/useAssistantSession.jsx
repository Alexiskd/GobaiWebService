// Session de l'assistant (fournisseur et clé de l'utilisateur), suivie par React.
import { useSyncExternalStore } from 'react';
import { getSession, subscribe } from '@/Engine/shared/lib/app/assistantSession';

/** La session en cours : { provider, key, model }, ou null. Se met à jour à la connexion et à la déconnexion. */
export function useAssistantSession() {
  return useSyncExternalStore(subscribe, getSession, () => null);
}
