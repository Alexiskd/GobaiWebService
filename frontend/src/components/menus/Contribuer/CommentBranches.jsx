import { Box, Typography } from '@mui/material';
import { CommentForm } from './CommentForm';

export function CommentBranches({ comments, contributionCid, drafts, setDrafts, onSubmit, busy, maxDepth = 4 }) {
  const setDraft = (key) => (value) => setDrafts((current) => ({ ...current, [key]: value }));

  const branch = (parentCid, depth) => comments
    .filter((comment) => (comment.payload.parentCid || null) === parentCid)
    .map((comment) => {
      const draftKey = `${contributionCid}|${comment.cid}`;
      return (
        <Box
          key={comment.cid}
          sx={{ display: 'grid', gap: 0.5, ml: Math.min(depth, maxDepth) * 1.5, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}
        >
          <Typography component="strong" variant="body2" sx={{ fontWeight: 600 }}>{String(comment.payload.pseudonym || 'Participant sans pseudo')}</Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{String(comment.payload.text || '')}</Typography>
          <CommentForm
            value={drafts[draftKey] || ''}
            placeholder="Répondre"
            label="Répondre"
            busy={busy}
            onChange={setDraft(draftKey)}
            onSubmit={() => onSubmit(comment.cid)}
          />
          {branch(comment.cid, depth + 1)}
        </Box>
      );
    });

  const rootKey = `${contributionCid}|`;
  return (
    <>
      {branch(null, 0)}
      <CommentForm
        value={drafts[rootKey] || ''}
        placeholder="Ajouter un commentaire"
        label="Envoyer"
        busy={busy}
        onChange={setDraft(rootKey)}
        onSubmit={() => onSubmit(null)}
      />
    </>
  );
}
