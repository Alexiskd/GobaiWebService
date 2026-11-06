import { Box, Button, Card, CardActions, CardContent, Chip, Stack, Typography } from '@mui/material';
import { CommentBranches } from './CommentBranches';
import { formatNumber, shortCid } from './format';

const STATUS_COLOR = { validated: 'success', contested: 'error', pending: 'default' };

// Une contribution du flux : titre, fiabilité, votes, correction et commentaires.
export function FeedCard({ entry, feedMode, compact, busy, hasPseudonym, myVote, commentDrafts, setCommentDrafts, onVote, onCorrect, onComment }) {
  const voteDisabled = busy || Boolean(myVote) || !hasPseudonym;
  const reliability = Math.round((entry.reliability?.score ?? 0) * 100);
  return (
    <Card component="article" variant="outlined" sx={{ bgcolor: 'transparent', backdropFilter: 'none' }}>
      <CardContent sx={{ display: 'grid', gap: 0.75, pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography component="strong" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{entry.manifest.title}</Typography>
          <Chip size="small" variant="outlined" label={entry.reliability.status} color={STATUS_COLOR[entry.reliability.status] || 'default'} />
        </Stack>
        <Typography variant="body2">
          {(entry.manifest.pointCount ?? 0).toLocaleString('fr-FR')} points · fiabilité {reliability} %
          {feedMode === 'recommended'
            ? ` · affinité ${formatNumber(entry.recommendationScore, 2)} · ${entry.positivePeers ?? 0} vote(s) positif(s) de pairs`
            : ` · score hot ${formatNumber(entry.score, 5)}`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Par {entry.manifest.pseudonym || 'Participant sans pseudo'} · CID{' '}
          <Box component="span" title={entry.cid} sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{compact ? shortCid(entry.cid) : entry.cid}</Box>
        </Typography>
      </CardContent>
      <CardActions sx={{ px: 2, flexWrap: 'wrap', gap: 1 }} disableSpacing>
        <Button size="small" variant={myVote?.direction === 'up' ? 'contained' : 'outlined'} color="success" aria-pressed={myVote?.direction === 'up'} disabled={voteDisabled} onClick={() => onVote('up')}>
          Bien placé ({entry.upvotes ?? 0})
        </Button>
        <Button size="small" variant={myVote?.direction === 'down' ? 'contained' : 'outlined'} color="error" aria-pressed={myVote?.direction === 'down'} disabled={voteDisabled} onClick={() => onVote('down')}>
          Erroné ({entry.downvotes ?? 0})
        </Button>
        <Button size="small" disabled={busy} onClick={onCorrect}>Corriger le placement</Button>
      </CardActions>
      <Box sx={{ px: 2, pb: 2, display: 'grid', gap: 1 }}>
        <CommentBranches
          comments={entry.comments}
          contributionCid={entry.cid}
          drafts={commentDrafts}
          setDrafts={setCommentDrafts}
          onSubmit={onComment}
          busy={busy || !hasPseudonym}
          maxDepth={compact ? 3 : 4}
        />
      </Box>
    </Card>
  );
}
