import { useState } from 'react';
import { validateAnchor } from '@/contributions/geodesy';
import { appendSignedEvent, putBytes, putChunk } from '@/contributions/store';

// Actions sur le journal local : publier, voter, commenter.
export function useContributionActions({ identity, pseudonym, draft, chunkCacheRef, refreshJournal, setBusy, setError, setStatus }) {
  const { file, metadata, title, dimensions, anchor, preview, correction, resetDraft } = draft;
  const [commentDrafts, setCommentDrafts] = useState({});

  const publish = async () => {
    const displayName = pseudonym.trim();
    if ((!correction && (!file || !metadata)) || !preview || !identity || !displayName) return;
    const isCorrection = Boolean(correction);
    setBusy(true);
    setError('');
    try {
      validateAnchor(anchor);
      const dimensionsMeters = dimensions.map(Number);
      if (dimensionsMeters.some((value) => !Number.isFinite(value) || value <= 0)) {
        throw new RangeError('Les trois dimensions doivent être des nombres positifs en mètres.');
      }
      let manifest;
      if (isCorrection) {
        manifest = {
          ...correction.manifest,
          title: (title.trim() || correction.manifest.title).slice(0, 100),
          pseudonym: displayName,
          anchor: { ...anchor },
          dimensionsMeters,
          sourceDimensionsMeters: correction.manifest.sourceDimensionsMeters || correction.manifest.dimensionsMeters,
          createdAt: new Date().toISOString(),
          previousVersionCid: correction.cid,
        };
      } else {
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const fileCid = await putBytes(fileBytes);
        const chunkCids = [];
        for (const chunk of preview.chunks) {
          const cid = await putChunk(chunk);
          chunkCids.push(cid);
          chunkCacheRef.current.set(cid, chunk);
        }
        manifest = {
          schemaVersion: 1,
          title: (title.trim() || file.name).slice(0, 100),
          pseudonym: displayName,
          filename: file.name,
          fileCid,
          chunkCids,
          pointCount: metadata.pointCount,
          bounds: metadata.bounds,
          crsWkt: metadata.crsWkt,
          anchor: { ...anchor },
          dimensionsMeters,
          sourceDimensionsMeters: dimensionsMeters,
          createdAt: new Date().toISOString(),
          previousVersionCid: null,
        };
      }
      await appendSignedEvent(identity, 'contribution', manifest);
      resetDraft();
      setStatus(isCorrection ? 'Correction publiée comme nouvelle version.' : 'Contribution publiée dans le stockage local pair-à-pair.');
      await refreshJournal();
    } catch (reason) {
      setError(`Publication échouée : ${reason.message}`);
    } finally {
      setBusy(false);
    }
  };

  const vote = async (entry, direction) => {
    const displayName = pseudonym.trim();
    if (!identity || !displayName) return;
    setBusy(true);
    setError('');
    try {
      await appendSignedEvent(identity, 'vote', { contributionCid: entry.cid, direction, pseudonym: displayName });
      await refreshJournal();
    } catch (reason) {
      setError(`Vote non enregistré : ${reason.message}`);
    } finally {
      setBusy(false);
    }
  };

  const comment = async (entry, parentCid = null) => {
    const draftKey = `${entry.cid}|${parentCid || ''}`;
    const text = (commentDrafts[draftKey] || '').trim();
    const displayName = pseudonym.trim();
    if (!identity || !displayName || !text) return;
    setBusy(true);
    setError('');
    try {
      await appendSignedEvent(identity, 'comment', { contributionCid: entry.cid, text, parentCid, pseudonym: displayName });
      setCommentDrafts((current) => ({ ...current, [draftKey]: '' }));
      await refreshJournal();
    } catch (reason) {
      setError(`Commentaire non enregistré : ${reason.message}`);
    } finally {
      setBusy(false);
    }
  };

  return { commentDrafts, setCommentDrafts, publish, vote, comment };
}
