import { useEffect, useState } from 'react';
import { connectContributionsPeer } from '@/contributions/peer-network';

// Synchronisation pair-à-pair du journal : statut affiché et dernière erreur.
export function useContributionPeer() {
  const [p2pStatus, setP2pStatus] = useState('Connexion à la signalisation…');
  const [p2pError, setP2pError] = useState('');

  useEffect(() => {
    let active = true;
    let peerConnection;
    connectContributionsPeer(
      (value) => { if (active) setP2pStatus(value); },
      (message) => {
        if (!active) return;
        setP2pError(message);
        setP2pStatus('Synchronisation indisponible');
      },
    ).then((connection) => {
      if (active) peerConnection = connection;
      else connection.close();
    }).catch((reason) => {
      if (active) {
        setP2pError(reason.message);
        setP2pStatus('Synchronisation indisponible');
      }
    });
    return () => {
      active = false;
      peerConnection?.close();
    };
  }, []);

  return { p2pStatus, p2pError };
}
