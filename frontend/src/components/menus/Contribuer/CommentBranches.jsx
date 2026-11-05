import { CommentForm } from './CommentForm';

export function CommentBranches({ comments, contributionCid, drafts, setDrafts, onSubmit, busy, maxDepth = 4 }) {
  const setDraft = (key) => (value) => setDrafts((current) => ({ ...current, [key]: value }));

  const branch = (parentCid, depth) => comments
    .filter((comment) => (comment.payload.parentCid || null) === parentCid)
    .map((comment) => {
      const draftKey = `${contributionCid}|${comment.cid}`;
      return (
        <div className="contribution-comment" key={comment.cid} style={{ '--depth': Math.min(depth, maxDepth) }}>
          <strong>{String(comment.payload.pseudonym || 'Participant sans pseudo')}</strong>
          <p>{String(comment.payload.text || '')}</p>
          <CommentForm
            value={drafts[draftKey] || ''}
            placeholder="Répondre"
            label="Répondre"
            busy={busy}
            onChange={setDraft(draftKey)}
            onSubmit={() => onSubmit(comment.cid)}
          />
          {branch(comment.cid, depth + 1)}
        </div>
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
