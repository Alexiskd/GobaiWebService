import { FeedCard } from './FeedCard';
import { FeedSearch } from './FeedSearch';
import { FeedTabs } from './FeedTabs';

// Flux communautaire : classement, recherche, puis une carte par contribution visible.
export function ContributionFeed({
  compact, busy, hasPseudonym, publicKey, feedMode, feedSearch, entries, feedEntries, visibleFeedEntries, recommendations,
  commentDrafts, setCommentDrafts, onFeedMode, onFeedSearch, onVote, onCorrect, onComment,
}) {
  return (
    <section className="contribution-feed" aria-label="Flux des contributions">
      <h3>{feedMode === 'hot' ? 'Flux communautaire' : 'Recommandé pour vous'}</h3>
      <FeedTabs feedMode={feedMode} compact={compact} onChange={onFeedMode} />
      <FeedSearch value={feedSearch} onChange={onFeedSearch} />
      {!entries.length && <p className="contribution-note">Aucune contribution dans ce stockage local.</p>}
      {entries.length > 0 && feedMode === 'recommended' && !recommendations.length && (
        <p className="contribution-note">
          Pas encore de recommandations : votez sur au moins deux contributions également évaluées par un pair.
        </p>
      )}
      {feedEntries.length > 0 && visibleFeedEntries.length === 0 && (
        <p className="contribution-note">Aucun résultat pour cette recherche.</p>
      )}
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
    </section>
  );
}
