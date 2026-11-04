import { useRef, useState } from 'react';
import { useDraggable } from '@/hooks/useDraggable';
import { formatBytes } from '@/p2p/client';

const readName = () => {
  try { return globalThis.localStorage?.getItem('gobai-p2p-name') || ''; } catch { return ''; }
};
const saveName = (name) => {
  try { globalThis.localStorage?.setItem('gobai-p2p-name', name); } catch { /* stockage refusé */ }
};

const STATUS_LABEL = {
  offered: 'en attente',
  sending: 'envoi',
  receiving: 'réception',
  done: 'terminé',
  declined: 'refusé',
  cancelled: 'annulé',
  error: 'échec',
};

function Transfer({ transfer, onRespond, onCancel, onDismiss }) {
  const { key, direction, name, size, bytes, status, peerName, error, url } = transfer;
  const progress = size > 0 ? Math.min(100, Math.round((100 * bytes) / size)) : 0;
  const active = status === 'sending' || status === 'receiving';
  return (
    <li className={`transfer ${status}`}>
      <div className="transfer-head">
        <strong title={name}>{name}</strong>
        <span>{direction === 'in' ? 'reçu de' : 'envoyé à'} {peerName}</span>
      </div>
      <div className="transfer-meta">
        <span>{STATUS_LABEL[status] || status}</span>
        {size > 0 && <span>{formatBytes(bytes)} / {formatBytes(size)}</span>}
      </div>
      {active && (
        <div className="progress" aria-label={`${progress} %`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="hint bad">{error}</p>}
      <div className="transfer-actions">
        {direction === 'in' && status === 'offered' && (
          <>
            <button onClick={() => onRespond(key, true)}>Accepter</button>
            <button className="ghost" onClick={() => onRespond(key, false)}>Refuser</button>
          </>
        )}
        {active && <button className="ghost" onClick={() => onCancel(key)}>Annuler</button>}
        {status === 'done' && direction === 'in' && url && (
          <a className="button" href={url} download={name}>Télécharger</a>
        )}
        {['done', 'declined', 'cancelled', 'error'].includes(status) && (
          <button className="ghost" onClick={() => onDismiss(key)}>Retirer</button>
        )}
      </div>
    </li>
  );
}

/**
 * Panneau pair-à-pair : salon, pairs connectés, partage de tuiles, fichiers, visite synchronisée.
 * Seule la signalisation traverse le serveur ; les données passent de navigateur à navigateur.
 */
export default function P2PPanel({
  open, onClose, state, peerCount, onToast, onConnect, onDisconnect, onViewRole, onTileSharing,
  onSendFile, onRespondFile, onCancelTransfer, onDismissTransfer,
}) {
  const [pseudo, setPseudo] = useState(readName);
  const [roomCode, setRoomCode] = useState('');
  const [target, setTarget] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  const drag = useDraggable('p2p');

  if (!open) return null;

  const status = state?.status || 'idle';
  const joined = status === 'joined';
  const peers = state?.peers || [];
  const transfers = [...(state?.transfers || [])].sort((a, b) => b.createdAt - a.createdAt);
  const tiles = state?.tiles;

  const start = (e) => {
    e.preventDefault();
    const name = pseudo.trim() || 'Visiteur';
    saveName(name);
    onConnect({ room: roomCode.trim() || null, name });
  };

  const copy = async () => {
    if (!state?.room) return;
    try {
      await navigator.clipboard.writeText(state.room);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast?.('Copie impossible : sélectionnez le code à la main.', 'warn');
    }
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onSendFile(file, target || null);
  };

  return (
    <section className="panel p2p" aria-label="Pair-à-pair" ref={drag.ref} style={drag.style}>
      <header {...drag.handleProps}>
        <span className="drag-grip" aria-hidden="true" />
        <h2>Pair-à-pair</h2>
        <button className="ghost" onClick={onClose} aria-label="Fermer le panneau">×</button>
      </header>

      {!joined ? (
        <form className="p2p-join" onSubmit={start}>
          <p className="hint">
            Reliez deux navigateurs pour partager les tuiles déjà téléchargées, envoyer des fichiers sans stockage
            serveur et suivre la même vue.
          </p>
          <label>
            Votre nom
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={24} placeholder="Visiteur" />
          </label>
          <label>
            Code du salon <small>(vide pour en créer un)</small>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={8}
              placeholder="EX. 7KQ2M9"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck="false"
            />
          </label>
          <div className="p2p-actions">
            <button type="submit" disabled={status === 'connecting'}>
              {status === 'connecting' ? 'Connexion…' : roomCode ? 'Rejoindre le salon' : 'Créer un salon'}
            </button>
            {(state?.error || status === 'error') && (
              <button type="button" className="ghost" onClick={onDisconnect}>Réinitialiser</button>
            )}
          </div>
          {state?.error && <p className="hint bad">{state.error}</p>}
          {status === 'connecting' && !state?.error && <p className="hint">Connexion au relais de signalisation…</p>}
        </form>
      ) : (
        <>
          <fieldset>
            <legend>Salon</legend>
            <div className="room-code">
              <code>{state.room}</code>
              <button className="ghost" onClick={copy}>{copied ? 'Copié' : 'Copier'}</button>
              <button className="ghost" onClick={onDisconnect}>Quitter</button>
            </div>
            <p className="hint">{peerCount} pair{peerCount > 1 ? 's' : ''} connecté{peerCount > 1 ? 's' : ''} · code à partager.</p>
            <ul className="peers">
              {peers.map((p) => (
                <li key={p.id}>
                  <span className={`dot ${p.connected ? 'on' : ''}`} aria-hidden="true" />
                  <span className="peer-name">{p.name}{p.id === state.peerId ? ' (vous)' : ''}</span>
                  {p.tiles > 0 && <small>{p.tiles.toLocaleString('fr-FR')} tuiles</small>}
                </li>
              ))}
              {!peers.length && <li className="hint">En attente d’un autre visiteur…</li>}
            </ul>
          </fieldset>

          <fieldset>
            <legend>Tuiles</legend>
            <div className="row">
              <input
                id="sw-p2p-tiles" type="checkbox" role="switch" checked={tiles?.sharing ?? true}
                onChange={(e) => onTileSharing(e.target.checked)}
              />
              <label htmlFor="sw-p2p-tiles">
                Partager les tuiles entre pairs
                <small>Une tuile déjà vue chez un pair est demandée avant le fournisseur.</small>
              </label>
            </div>
            <p className="hint">
              {tiles ? `${tiles.sent} envoyées · ${tiles.received} reçues · ${formatBytes(tiles.bytesIn)} entrants, ${formatBytes(tiles.bytesOut)} sortants · ${tiles.available.toLocaleString('fr-FR')} annoncées` : ''}
            </p>
          </fieldset>

          <fieldset>
            <legend>Visite synchronisée</legend>
            <div className="row">
              <label className="view-role">
                Rôle
                <select value={state.viewRole || 'off'} onChange={(e) => onViewRole(e.target.value)}>
                  <option value="off">Désactivé</option>
                  <option value="lead">Je guide</option>
                  <option value="follow">Je suis</option>
                </select>
              </label>
            </div>
            <p className="hint">
              {state.viewRole === 'lead' ? 'Votre caméra est transmise aux visiteurs en mode « Je suis ».'
                : state.viewRole === 'follow' ? 'Les commandes de caméra sont verrouillées : vous suivez le guide.'
                  : 'Le guide transmet sa caméra 4 fois par seconde.'}
            </p>
          </fieldset>

          <fieldset>
            <legend>Fichiers</legend>
            {peerCount > 0 ? (
              <>
                <div className="file-send">
                  <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Destinataire">
                    <option value="">Tous les pairs</option>
                    {peers.filter((p) => p.connected).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button onClick={() => fileRef.current?.click()}>Choisir un fichier</button>
                  <input ref={fileRef} type="file" hidden onChange={pickFile} />
                </div>
                <p className="hint">Aucun stockage serveur : le fichier circule directement, après acceptation (512 Mo maximum).</p>
              </>
            ) : (
              <p className="hint">Un pair doit être connecté pour envoyer un fichier.</p>
            )}
            {transfers.length > 0 && (
              <ul className="transfers">
                {transfers.map((tr) => (
                  <Transfer
                    key={tr.key}
                    transfer={tr}
                    onRespond={onRespondFile}
                    onCancel={onCancelTransfer}
                    onDismiss={onDismissTransfer}
                  />
                ))}
              </ul>
            )}
          </fieldset>

          <p className="hint p2p-note">
            Seule la signalisation (salon, offres SDP, candidats ICE) passe par le serveur. Tuiles, fichiers, vue et
            éphémérides circulent directement entre navigateurs, chiffrés par WebRTC.
          </p>
        </>
      )}
    </section>
  );
}
