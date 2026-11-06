import { Stack, Typography } from '@mui/material';
import { FeedCard } from './FeedCard';
import { FeedSearch } from './FeedSearch';
import { FeedTabs } from './FeedTabs';
import { Note } from './Note';

// Flux communautaire : classement, recherche, puis une carte par contribution visible.
export function ContributionFeed({
  compact, busy, hasPseudonym, publicKey, feedMode, feedSearch, entries, feedEntries, visibleFeedEntries, recommendations,
  commentDrafts, setCommentDrafts, onFeedMode, onFeedSearch, onVote, onCorrect, onComment,
}) {
  return (
    <Stack component="section" spacing={1.5} aria-label="Flux des contributions" sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
        {feedMode === 'hot' ? 'Flux communautaire' : 'Recommandé pour vous'}
      </Typography>
      <FeedTabs feedMode={feedMode} compact={compact} onChange={onFeedMode} />
      <FeedSearch value={feedSearch} onChange={onFeedSearch} />
      {!entries.length && <Note>Aucune contribution dans ce stockage local.</Note>}
      {entries.length > 0 && feedMode === 'recommended' && !recommendations.length && (
        <Note>Pas encore de recommandations : votez sur au moins deux contributions également évaluées par un pair.</Note>
      )}
      {feedEntries.length > 0 && visibleFeedEntries.length === 0 && <Note>Aucun résultat pour cette recherche.</Note>}
      {visibleFeedEntries.map((entry) => (
        <FeedCard
          key={entry.cid}
          entry={entry}
          feedMode={feedMode}
          compact={compact}
          busy={busy}
          hasPseudonym={hasPseudonym}
          myVote={entry.votes.find((item) => item.publicKey === publicKey)}
          commentDrafts={commentDrafts}
          setCommentDrafts={setCommentDrafts}
          onVote={(direction) => onVote(entry, direction)}
          onCorrect={() => onCorrect(entry)}
          onComment={(parentCid) => onComment(entry, parentCid)}
        />
      ))}
    </Stack>
  );
}
