import { CommentBranches } from './CommentBranches';
import { formatNumber, shortCid } from './format';

// Une contribution du flux : titre, fiabilité, votes, correction et commentaires.
export function FeedCard({ entry, feedMode, compact, busy, hasPseudonym, myVote, commentDrafts, setCommentDrafts, onVote, onCorrect, onComment }) {
  const voteDisabled = busy || Boolean(myVote) || !hasPseudonym;
  const reliability = Math.round((entry.reliability?.score ?? 0) * 100);
  return (
    <article className="contribution-card">
      <div className="contribution-card-title">
        <strong>{entry.manifest.title}</strong>
        <span className={`contribution-badge ${entry.reliability.status}`}>{entry.reliability.status}</span>
      </div>
      <p>
        {(entry.manifest.pointCount ?? 0).toLocaleString('fr-FR')} points · fiabilité {reliability} %
        {feedMode === 'recommended'
          ? ` · affinité ${formatNumber(entry.recommendationScore, 2)} · ${entry.positivePeers ?? 0} vote(s) positif(s) de pairs`
          : ` · score hot ${formatNumber(entry.score, 5)}`}
      </p>
      <small>
        Par {entry.manifest.pseudonym || 'Participant sans pseudo'} · CID{' '}
        <span className="contribution-cid" title={entry.cid}>{compact ? shortCid(entry.cid) : entry.cid}</span>
      </small>
      <div className="contribution-actions">
        <button type="button" aria-pressed={myVote?.direction === 'up'} disabled={voteDisabled} onClick={() => onVote('up')}>
          Bien placé ({entry.upvotes ?? 0})
        </button>
        <button type="button" aria-pressed={myVote?.direction === 'down'} disabled={voteDisabled} onClick={() => onVote('down')}>
          Erroné ({entry.downvotes ?? 0})
        </button>
        <button type="button" disabled={busy} onClick={onCorrect}>Corriger le placement</button>
      </div>
      <div className="contribution-comments">
        <CommentBranches
          comments={entry.comments}
          contributionCid={entry.cid}
          drafts={commentDrafts}
          setDrafts={setCommentDrafts}
          onSubmit={onComment}
          busy={busy || !hasPseudonym}
          maxDepth={compact ? 3 : 4}
        />
      </div>
    </article>
  );
}
