import { useMemo, useState } from 'react';
import { Alert, Box, Dialog, Typography, useMediaQuery } from '@mui/material';
import { QUERIES } from '@/theme/mediaQueries';
import { PanelHeader } from '../../ui/PanelHeader';
import { ContributionLayer } from './ContributionLayer';
import { ContributionNotes } from './ContributionNotes';
import { ContributionForm } from './ContributionForm';
import { ContributionFeed } from './ContributionFeed';
import { LazFileField } from './LazFileField';
import { PeerStatus } from './PeerStatus';
import { PseudonymField } from './PseudonymField';
import { useContributionActions } from './useContributionActions';
import { useContributionDraft } from './useContributionDraft';
import { useContributionFeed } from './useContributionFeed';
import { useContributionIdentity } from './useContributionIdentity';
import { useContributionPeer } from './useContributionPeer';
import { useLazAnalysis } from './useLazAnalysis';

// Panneau des contributions communautaires (nuages de points LAZ).
// Écran large : fenêtre centrée. Mobile / téléphone en paysage : plein écran.
// Dialogue MUI (Échap et blocage du défilement inclus), composants stylés par `sx`.
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

  const hasPseudonym = Boolean(pseudonym.trim());
  const visualItems = useMemo(
    () => (draft.previewItem ? [...feed.entries, draft.previewItem] : feed.entries),
    [feed.entries, draft.previewItem],
  );

  return (
    <>
      <ContributionLayer engine={engine} entries={visualItems} />
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={compact}
        fullWidth
        maxWidth="md"
        aria-label="Contributions communautaires"
        slotProps={{ paper: { sx: { display: 'flex', flexDirection: 'column', maxHeight: compact ? 'none' : 'min(88vh, 900px)' } } }}
      >
        <PanelHeader kicker="Données 3D locales" title="Contributions" onClose={onClose} />
        <Box data-contribution-body="" sx={{ overflowY: 'auto', overscrollBehavior: 'contain', p: 2, display: 'grid', gap: 2, minHeight: 0 }}>
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
          {status && <Alert severity="info" role="status">{status}</Alert>}
          {error && <Alert severity="error" role="alert">{error}</Alert>}
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
          <Typography variant="caption" color="text.secondary">
            Anti-abus : une voix comptée par participant et contribution, preuve de travail légère (10 bits). La résistance Sybil reste limitée :
            plusieurs pseudos peuvent toujours être créés. IndexedDB conserve les blocs uniquement sur cet appareil.
          </Typography>
        </Box>
      </Dialog>
    </>
  );
}
