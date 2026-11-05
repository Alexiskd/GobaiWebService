// État de la synchronisation pair-à-pair, avec l'erreur éventuelle.
export function PeerStatus({ status, error }) {
  return (
    <>
      <p className="contribution-peer-status" role="status">{status}</p>
      {error && <p className="contribution-note">P2P : {error}</p>}
    </>
  );
}
