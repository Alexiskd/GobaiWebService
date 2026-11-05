import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collaborativeRank, deduplicateVotes, rank, reliabilityStatus } from '@/contributions/scoring';
import { getChunk, readSignedEvents, subscribeToEvents } from '@/contributions/store';
import { normalizeSearch } from './format';

// Journal local des contributions : rechargement, classements « hot » et « pour vous », recherche.
export function useContributionFeed({ publicKey, setError }) {
  const [entries, setEntries] = useState([]);
  const [feedMode, setFeedMode] = useState('hot');
  const [feedSearch, setFeedSearch] = useState('');
  const entriesRef = useRef(entries);
  const chunkCacheRef = useRef(new Map());
  entriesRef.current = entries;

  const recommendations = useMemo(
    () => collaborativeRank(entries, entries.flatMap((entry) => entry.votes), publicKey),
    [entries, publicKey],
  );
  const feedEntries = feedMode === 'recommended' ? recommendations : entries;
  const visibleFeedEntries = useMemo(() => {
    const query = normalizeSearch(feedSearch);
    if (!query) return feedEntries;
    return feedEntries.filter((entry) => [
      entry.manifest.title,
      entry.manifest.filename,
      entry.manifest.pseudonym,
      entry.cid,
    ].some((value) => normalizeSearch(value).includes(query)));
  }, [feedEntries, feedSearch]);

  const refreshJournal = useCallback(async () => {
    const events = await readSignedEvents();
    const current = new Map(entriesRef.current.map((entry) => [entry.cid, entry]));
    for (const entry of current.values()) {
      entry.manifest.chunkCids.forEach((cid, index) => {
        if (entry.chunks[index]) chunkCacheRef.current.set(cid, entry.chunks[index]);
      });
    }
    const contributions = events.filter((event) => event.kind === 'contribution');
    const next = await Promise.all(contributions.map(async (event) => {
      const manifest = event.payload;
      const old = current.get(event.cid);
      const chunks = old?.chunks ?? await Promise.all(manifest.chunkCids.map(async (cid) => (
        chunkCacheRef.current.get(cid) || getChunk(cid)
      )));
      const related = events.filter((item) => item.payload.contributionCid === event.cid);
      const votes = deduplicateVotes(related
        .filter((item) => item.kind === 'vote')
        .map((item) => ({
          cid: item.cid,
          contributionCid: event.cid,
          publicKey: item.publicKey,
          direction: item.payload.direction,
          signature: item.signature,
        })));
      const eventByCid = new Map(related.map((item) => [item.cid, item]));
      const upvotes = votes.filter((vote) => vote.direction === 'up').length;
      const downvotes = votes.length - upvotes;
      const feedback = related.filter((item) => item.kind === 'comment');
      const feedbackByCid = new Map(feedback.map((item) => [item.cid, item]));
      const commentDepth = (comment) => {
        let depth = 0;
        let parentCid = comment.payload.parentCid;
        const visited = new Set([comment.cid]);
        while (typeof parentCid === 'string' && feedbackByCid.has(parentCid) && !visited.has(parentCid)) {
          visited.add(parentCid);
          depth++;
          parentCid = feedbackByCid.get(parentCid).payload.parentCid;
        }
        return depth;
      };
      const post = {
        createdAt: manifest.createdAt,
        upvotes,
        downvotes,
        comments: feedback.length,
        avgCommentDepth: feedback.length
          ? feedback.reduce((sum, item) => sum + commentDepth(item), 0) / feedback.length
          : 0,
        upvoteTimes: votes
          .filter((vote) => vote.direction === 'up')
          .map((vote) => eventByCid.get(vote.cid)?.createdAt)
          .filter(Boolean),
      };
      return {
        cid: event.cid,
        authorPublicKey: event.publicKey,
        manifest,
        chunks,
        votes,
        comments: feedback,
        reliability: reliabilityStatus(upvotes, downvotes),
        hot: post,
      };
    }));
    setEntries(rank(next.map((entry) => ({ ...entry, ...entry.hot }))));
    setError('');
  }, [setError]);

  useEffect(() => {
    let active = true;
    refreshJournal().catch((reason) => {
      if (active) setError(`Journal local indisponible : ${reason.message}`);
    });
    const unsubscribe = subscribeToEvents(() => {
      refreshJournal().catch((reason) => {
        if (active) setError(`Impossible de relire le journal : ${reason.message}`);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshJournal, setError]);

  return {
    entries,
    feedMode,
    setFeedMode,
    feedSearch,
    setFeedSearch,
    recommendations,
    feedEntries,
    visibleFeedEntries,
    refreshJournal,
    chunkCacheRef,
  };
}
