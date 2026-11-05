import { useMemo, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { ContributionLayer } from './ContributionLayer';
import { ContributionStyles } from './ContributionStyles';
import { ContributionNotes } from './ContributionNotes';
import { ContributionForm } from './ContributionForm';
import { ContributionFeed } from './ContributionFeed';
import { LazFileField } from './LazFileField';
import { PeerStatus } from './PeerStatus';
import { PseudonymField } from './PseudonymField';
import { QUERIES } from './media';
import { useContributionActions } from './useContributionActions';
import { useContributionDraft } from './useContributionDraft';
import { useContributionFeed } from './useContributionFeed';
import { useContributionIdentity } from './useContributionIdentity';
import { useContributionPeer } from './useContributionPeer';
import { useLazAnalysis } from './useLazAnalysis';
import { useModalLock } from './useModalLock';

// Panneau des contributions communautaires (nuages de points LAZ).
// Écran large : fenêtre centrée. Mobile / téléphone en paysage : plein écran.
// Tous les styles sont en MUI (`GlobalStyles` + `useMediaQuery`), aucun fichier .css.
export function Contribuer({ engine, open, onClose }) {
  const compact = useMediaQuery(QUERIES.compact, { noSsr: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const { p2pStatus, p2pError } = useContributionPeer();
  const { identity, pseudonym, updatePseudonym } = useContributionIdentity({ setError });
  const feed = useContributionFeed({ publicKey: identity?.publicKey, setError });
  const draft = useContributionDraft({ setError, setStatus });
  const { analyzing, progress, analyzeFile } = useLazAnalysis({
    file: draft.file,
    metadata: draft.metadata,
    dimensions: draft.dimensions,
    anchor: draft.anchor,
    setBusy,
    setError,
    setStatus,
    setPreview: draft.setPreview,
  });
  const { commentDrafts, setCommentDrafts, publish, vote, comment } = useContributionActions({
    identity,
    pseudonym,
    draft,
    chunkCacheRef: feed.chunkCacheRef,
    refreshJournal: feed.refreshJournal,
    setBusy,
    setError,
    setStatus,
  });
  useModalLock(open, onClose);

  const hasPseudonym = Boolean(pseudonym.trim());
  const visualItems = useMemo(
    () => (draft.previewItem ? [...feed.entries, draft.previewItem] : feed.entries),
    [feed.entries, draft.previewItem],
  );

  return (
    <>
      <ContributionLayer engine={engine} entries={visualItems} />
      {open && (
        <div className="overlay contribution-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <ContributionStyles />
          <section className="contribution-panel panel" role="dialog" aria-modal="true" aria-label="Contributions communautaires">
            <header>
              <div><span className="city-pointcloud-kicker">Données 3D locales</span><h2>Contributions</h2></div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">×</button>
            </header>
            <div className="contribution-body">
              <ContributionNotes compact={compact} />
              <PseudonymField value={pseudonym} busy={busy} onChange={updatePseudonym} />
              <PeerStatus status={p2pStatus} error={p2pError} />
              {!draft.correction && (
                <LazFileField inputRef={draft.fileInputRef} busy={busy} onChange={draft.handleFile} />
              )}
              {(draft.metadata || draft.correction) && (
                <ContributionForm
                  draft={draft}
                  busy={busy}
                  hasPseudonym={hasPseudonym}
                  identity={identity}
                  analyzing={analyzing}
                  progress={progress}
                  onAnalyze={analyzeFile}
                  onPublish={publish}
                />
              )}
              {status && <p className="contribution-status" role="status">{status}</p>}
              {error && <p className="contribution-error" role="alert">{error}</p>}
              <ContributionFeed
                compact={compact}
                busy={busy}
                hasPseudonym={hasPseudonym}
                publicKey={identity?.publicKey}
                feedMode={feed.feedMode}
                feedSearch={feed.feedSearch}
                entries={feed.entries}
                feedEntries={feed.feedEntries}
                visibleFeedEntries={feed.visibleFeedEntries}
                recommendations={feed.recommendations}
                commentDrafts={commentDrafts}
                setCommentDrafts={setCommentDrafts}
                onFeedMode={feed.setFeedMode}
                onFeedSearch={feed.setFeedSearch}
                onVote={vote}
                onCorrect={draft.startCorrection}
                onComment={comment}
              />
              <p className="contribution-note">
                Anti-abus : une voix comptée par participant et contribution, preuve de travail légère (10 bits). La résistance Sybil reste limitée :
                plusieurs pseudos peuvent toujours être créés. IndexedDB conserve les blocs uniquement sur cet appareil.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
