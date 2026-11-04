import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalStyles, useMediaQuery } from '@mui/material';
import * as THREE from 'three';
import { enuToScene, validateAnchor } from '../contributions/geodesy.ts';
import { inspectLasFile } from '../contributions/las.ts';
import { connectContributionsPeer } from '../contributions/peer-network.ts';
import { collaborativeRank, deduplicateVotes, rank, reliabilityStatus } from '../contributions/scoring.ts';
import {
  appendSignedEvent,
  getSavedPseudonym,
  getChunk,
  getIdentity,
  MAX_PSEUDONYM_LENGTH,
  putBytes,
  putChunk,
  readSignedEvents,
  savePseudonym,
  subscribeToEvents,
} from '../contributions/store.ts';

// Panneau des contributions communautaires (nuages de points LAZ).
// Écran large : fenêtre centrée. Mobile / téléphone en paysage : plein écran.
// Tous les styles sont en MUI (`GlobalStyles` + `useMediaQuery`), aucun fichier .css.

// ---------------------------------------------------------------- Constantes

const MAX_FILE_BYTES = 256 * 1024 * 1024; // 256 Mio, comme annoncé dans l'interface
// Ancrage saisi sous forme de texte : on peut taper « - » ou « 48. » sans que le champ se vide.
const EMPTY_ANCHOR_INPUT = { latitude: '0', longitude: '0', altitudeMeters: '0' };
const ANCHOR_FIELDS = [
  ['latitude', 'Latitude'],
  ['longitude', 'Longitude'],
  ['altitudeMeters', 'Altitude (m)'],
];

const QUERIES = {
  compact: '(max-width: 720px), (max-height: 500px) and (pointer: coarse)',
  xs: '(max-width: 480px)',
  coarse: '(pointer: coarse)',
};
const MQ = {
  compact: `@media ${QUERIES.compact}`,
  xs: `@media ${QUERIES.xs}`,
  coarse: `@media ${QUERIES.coarse}`,
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
};

// ---------------------------------------------------------------- Styles MUI

const TOUCH = '44px';
const safe = (side) => `env(safe-area-inset-${side}, 0px)`;

const contributionStyles = {
  // ------------------------------------------------ Fenêtre (écran large)
  'html .contribution-overlay': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `clamp(8px, 2vw, 24px)`,
  },
  'html .contribution-panel': {
    width: 'min(760px, calc(100vw - 32px))',
    maxHeight: `calc(100dvh - 32px - ${safe('top')} - ${safe('bottom')})`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    margin: 0,
  },
  'html .contribution-panel > header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flex: 'none',
  },
  'html .contribution-panel > header h2': { margin: 0, fontSize: 'clamp(17px, 1vw + 12px, 22px)' },
  'html .contribution-panel .icon-btn': { minWidth: '36px', minHeight: '36px', flex: 'none' },
  'html .contribution-body': {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingBottom: `calc(12px + ${safe('bottom')})`,
  },

  // ------------------------------------------------ Champs
  'html .contribution-field, html .contribution-search': {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  'html .contribution-panel input': { width: '100%', minWidth: 0, boxSizing: 'border-box' },
  'html .contribution-panel input[type="file"]': { cursor: 'pointer' },
  'html .contribution-panel fieldset': { margin: 0, minWidth: 0, border: 'none', padding: 0 },
  'html .contribution-panel legend': { padding: 0, marginBottom: '6px' },
  'html .contribution-grid': {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  'html .contribution-grid label': { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },

  // ------------------------------------------------ Textes longs (CID, CRS) : jamais de débordement
  'html .contribution-meta': { display: 'flex', flexDirection: 'column', gap: '4px' },
  [[
    'html .contribution-meta span',
    'html .contribution-card small',
    'html .contribution-card p',
    'html .contribution-status',
    'html .contribution-error',
    'html .contribution-note',
    'html .contribution-comment p',
  ].join(', ')]: { overflowWrap: 'anywhere', wordBreak: 'break-word' },
  'html .contribution-cid': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em' },

  // ------------------------------------------------ Notes repliables
  'html .contribution-notes summary': { cursor: 'pointer', fontSize: '13px', opacity: 0.85 },
  'html .contribution-notes[open] summary': { marginBottom: '6px' },

  // ------------------------------------------------ Actions
  'html .contribution-actions': { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  'html .contribution-actions button': { flex: '1 1 auto' },
  'html .contribution-feed-tabs': { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  'html .contribution-feed-tabs button': { flex: '1 1 0', minWidth: 0 },

  // ------------------------------------------------ Flux
  'html .contribution-feed': { display: 'flex', flexDirection: 'column', gap: '10px' },
  'html .contribution-card': { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 },
  'html .contribution-card-title': {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
  },
  'html .contribution-card-title strong': { minWidth: 0, overflowWrap: 'anywhere' },
  'html .contribution-badge': { flex: 'none', whiteSpace: 'nowrap' },

  // ------------------------------------------------ Commentaires
  'html .contribution-comment': {
    marginLeft: 'calc(var(--depth, 0) * 12px)',
    paddingLeft: '8px',
    borderLeft: '2px solid rgba(255, 255, 255, 0.12)',
    minWidth: 0,
  },
  'html .contribution-comment-form': { display: 'flex', gap: '6px', alignItems: 'stretch', marginTop: '6px' },
  'html .contribution-comment-form input': { flex: 1 },
  'html .contribution-comment-form button': { flex: 'none' },

  // ================================================ Tactile
  [MQ.coarse]: {
    [[
      'html .contribution-panel button',
      'html .contribution-panel input:not([type="file"])',
      'html .contribution-notes summary',
    ].join(', ')]: { minHeight: TOUCH },
    'html .contribution-panel .icon-btn': { minWidth: TOUCH },
    'html .contribution-panel input': { fontSize: '16px' }, // pas de zoom auto sur iOS
  },

  // ================================================ Mobile : plein écran
  [MQ.compact]: {
    'html .contribution-overlay': { padding: 0, alignItems: 'stretch', justifyContent: 'stretch' },
    'html .contribution-panel': {
      width: '100%',
      maxWidth: 'none',
      height: '100dvh',
      maxHeight: 'none',
      borderRadius: 0,
      padding: `calc(${safe('top')} + 10px) calc(${safe('right')} + 12px) 0 calc(${safe('left')} + 12px)`,
    },
    'html .contribution-panel > header': {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      paddingBottom: '8px',
    },
    'html .contribution-panel input': { fontSize: '16px' },
    'html .contribution-actions button': { flex: '1 1 100%' },
    'html .contribution-comment': { marginLeft: 'calc(var(--depth, 0) * 8px)' },
  },

  // ================================================ Téléphone étroit
  [MQ.xs]: {
    'html .contribution-grid': { gridTemplateColumns: '1fr' },
    'html .contribution-comment-form': { flexDirection: 'column' },
    'html .contribution-comment-form button': { width: '100%' },
  },

  [MQ.reducedMotion]: {
    'html .contribution-body': { scrollBehavior: 'auto' },
  },
};

function ContributionStyles() {
  return <GlobalStyles styles={contributionStyles} />;
}

// ---------------------------------------------------------------- Utilitaires

function anchorIsValid(anchor) {
  try {
    validateAnchor(anchor);
    return true;
  } catch {
    return false;
  }
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('fr');
}

const toAnchor = (input) => ({
  latitude: Number(input.latitude),
  longitude: Number(input.longitude),
  altitudeMeters: Number(input.altitudeMeters),
});
const toAnchorInput = (anchor) => ({
  latitude: String(anchor.latitude),
  longitude: String(anchor.longitude),
  altitudeMeters: String(anchor.altitudeMeters),
});

const formatNumber = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : '—');
const shortCid = (cid) => (cid && cid.length > 20 ? `${cid.slice(0, 10)}…${cid.slice(-6)}` : cid);

// ---------------------------------------------------------------- Panneau

export function ContributionPanel({ engine, open, onClose }) {
  const compact = useMediaQuery(QUERIES.compact, { noSsr: true });
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [title, setTitle] = useState('');
  const [dimensions, setDimensions] = useState(['', '', '']);
  const [anchorInput, setAnchorInput] = useState(EMPTY_ANCHOR_INPUT);
  const [preview, setPreview] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [entries, setEntries] = useState([]);
  const [feedMode, setFeedMode] = useState('hot');
  const [feedSearch, setFeedSearch] = useState('');
  const [identity, setIdentity] = useState(null);
  const [pseudonym, setPseudonym] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [status, setStatus] = useState('');
  const [p2pStatus, setP2pStatus] = useState('Connexion à la signalisation…');
  const [p2pError, setP2pError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false); // distinct de `busy` : le libellé « Analyse x % » ne s'affiche plus pendant une publication
  const [progress, setProgress] = useState(0);
  const workerRef = useRef(null);
  const jobIdRef = useRef(0);                         // identifiant unique de tâche (Date.now() pouvait se répéter)
  const fileInputRef = useRef(null);
  const entriesRef = useRef(entries);
  const chunkCacheRef = useRef(new Map());
  entriesRef.current = entries;

  const anchor = useMemo(() => toAnchor(anchorInput), [anchorInput]);
  const hasPseudonym = Boolean(pseudonym.trim());

  const recommendations = useMemo(
    () => collaborativeRank(entries, entries.flatMap((entry) => entry.votes), identity?.publicKey),
    [entries, identity?.publicKey],
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
  }, []);

  useEffect(() => {
    let active = true;
    const worker = new Worker(new URL('../contributions/las.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    let peerConnection;
    connectContributionsPeer(
      (value) => { if (active) setP2pStatus(value); },
      (message) => {
        if (!active) return;
        setP2pError(message);
        setP2pStatus('Synchronisation indisponible');
      },
    ).then((connection) => {
      if (active) peerConnection = connection;
      else connection.close();
    }).catch((reason) => {
      if (active) {
        setP2pError(reason.message);
        setP2pStatus('Synchronisation indisponible');
      }
    });
    getIdentity().then((value) => { if (active) setIdentity(value); }).catch((reason) => {
      if (active) setError(`Initialisation de la signature locale impossible : ${reason.message}`);
    });
    try {
      setPseudonym(getSavedPseudonym());
    } catch (reason) {
      setError(`Impossible de charger le pseudo : ${reason.message}`);
    }
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
      peerConnection?.close();
      worker.terminate();
      workerRef.current = null;
    };
  }, [refreshJournal]);

  // Échap ferme le panneau ; le fond ne défile pas derrière (iOS).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // Le titre n'intervient pas dans le rendu 3D : il ne fait plus reconstruire la scène à chaque frappe.
  const previewItem = useMemo(() => {
    if (!preview || !anchorIsValid(anchor)) return null;
    const dimensionsMeters = dimensions.map(Number);
    if (dimensionsMeters.some((value) => !Number.isFinite(value) || value <= 0)) return null;
    return {
      cid: 'local-preview',
      manifest: {
        title: 'Aperçu',
        anchor,
        dimensionsMeters,
        sourceDimensionsMeters: correction
          ? correction.manifest.sourceDimensionsMeters || correction.manifest.dimensionsMeters
          : undefined,
      },
      chunks: preview.chunks,
      reliability: { status: 'pending' },
    };
  }, [anchor, correction, dimensions, preview]);

  const visualItems = useMemo(
    () => (previewItem ? [...entries, previewItem] : entries),
    [entries, previewItem],
  );

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (event) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(null);
    setMetadata(null);
    setPreview(null);
    setCorrection(null);
    setError('');
    setStatus('');
    if (!selected) return;
    if (!/\.laz$/i.test(selected.name)) {
      setError('Seuls les fichiers .laz sont acceptés.');
      resetFileInput();
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError(`Fichier trop volumineux (${(selected.size / 1024 / 1024).toFixed(0)} Mio) : 256 Mio maximum.`);
      resetFileInput();
      return;
    }
    try {
      const inspected = await inspectLasFile(selected);
      if (!inspected.compressed) {
        throw new TypeError('Le fichier porte l’extension .laz mais son contenu n’est pas compressé.');
      }
      const extent = [
        inspected.bounds.maxX - inspected.bounds.minX,
        inspected.bounds.maxY - inspected.bounds.minY,
        inspected.bounds.maxZ - inspected.bounds.minZ,
      ];
      setFile(selected);
      setMetadata(inspected);
      setDimensions(extent.map((value) => String(value > 0 ? value : 1)));
      setTitle(selected.name.replace(/\.laz$/i, ''));
      setStatus(`${inspected.pointCount.toLocaleString('fr-FR')} points · en-tête LAS ${inspected.version} · fichier LAZ`);
    } catch (reason) {
      setError(reason.message);
      resetFileInput();
    }
  };

  const updateDimension = (index, value) => {
    setDimensions((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
    if (!correction) setPreview(null);
  };

  const updateAnchor = (key, value) => {
    setAnchorInput((current) => ({ ...current, [key]: value }));
  };

  const analyzeFile = async () => {
    if (!file || !metadata || !workerRef.current) return;
    setBusy(true);
    setAnalyzing(true);
    setError('');
    setPreview(null);
    setProgress(0);
    try {
      const size = dimensions.map(Number);
      if (size.some((value) => !Number.isFinite(value) || value <= 0)) {
        throw new RangeError('Les trois dimensions doivent être des nombres positifs en mètres.');
      }
      validateAnchor(anchor);
      const bytes = await file.arrayBuffer();
      const parsed = await new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) { reject(new Error('Décodeur indisponible.')); return; }
        const id = ++jobIdRef.current;
        const cleanup = () => {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
        };
        const onMessage = (event) => {
          if (event.data.id !== id) return;
          if (event.data.type === 'progress') setProgress(Math.round(event.data.progress * 100));
          if (event.data.type === 'error') { cleanup(); reject(new Error(event.data.message)); }
          if (event.data.type === 'complete') { cleanup(); resolve(event.data); }
        };
        const onError = (event) => {
          cleanup();
          reject(new Error(event.message || 'Échec du décodage du fichier LAZ.'));
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage({ id, buffer: bytes, dimensionsMeters: size }, [bytes]);
      });
      if (parsed.pointCount !== metadata.pointCount) {
        throw new Error('Le nombre de points décodé ne correspond pas à l’en-tête du fichier.');
      }
      const tolerance = Math.max(...metadata.scale) + 1e-6;
      for (const axis of ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ']) {
        if (Math.abs(parsed.bounds[axis] - metadata.bounds[axis]) > tolerance) {
          throw new Error('L’emprise décodée ne correspond pas aux métadonnées du fichier.');
        }
      }
      setPreview({ chunks: parsed.chunks, bounds: parsed.bounds });
      setProgress(100);
      setStatus(`Aperçu prêt · ${parsed.chunks.length} chunks · ${parsed.pointCount.toLocaleString('fr-FR')} points`);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
      setAnalyzing(false);
    }
  };

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
      setFile(null);
      setMetadata(null);
      setPreview(null);
      setCorrection(null);
      setTitle('');
      setDimensions(['', '', '']);
      resetFileInput();
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

  const updatePseudonym = (value) => {
    const boundedValue = value.slice(0, MAX_PSEUDONYM_LENGTH);
    setPseudonym(boundedValue);
    try {
      savePseudonym(boundedValue);
    } catch (reason) {
      setError(`Impossible d’enregistrer le pseudo : ${reason.message}`);
    }
  };

  const startCorrection = (entry) => {
    setCorrection(entry);
    setFile(null);
    setMetadata(null);
    resetFileInput();
    setTitle(entry.manifest.title);
    setAnchorInput(toAnchorInput(entry.manifest.anchor));
    setDimensions(entry.manifest.dimensionsMeters.map(String));
    setPreview({ chunks: entry.chunks, bounds: entry.manifest.bounds });
    setStatus(`Nouvelle version de ${entry.manifest.title} · CID précédent ${entry.cid}`);
    setError('');
    // Remonte au formulaire : sur mobile il est hors de l'écran quand on touche une carte du flux.
    requestAnimationFrame(() => document.querySelector('.contribution-body')?.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const cancelCorrection = () => {
    setCorrection(null);
    setPreview(null);
    setTitle('');
    setDimensions(['', '', '']);
    setStatus('');
  };

  // Notes d'information : repliées sur mobile pour laisser la place au formulaire.
  const notes = (
    <>
      <p className="contribution-note">
        Import LAZ uniquement. Les contributions et commentaires apparaissent sous votre pseudo ; les fichiers restent dans le stockage pair-à-pair.
      </p>
      <p className="contribution-note">Le compte par jeton de connexion sera ajouté ultérieurement.</p>
      <p className="contribution-note">Tiering : pseudo et index dans localStorage, gros blocs dans le Cache du navigateur, petits blocs dans IndexedDB. Aucun cookie.</p>
    </>
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
              {compact ? (
                <details className="contribution-notes">
                  <summary>ⓘ Comment ça marche</summary>
                  {notes}
                </details>
              ) : notes}

              <label className="contribution-field">
                Pseudo (visible dans le flux communautaire)
                <input
                  type="text"
                  value={pseudonym}
                  maxLength={MAX_PSEUDONYM_LENGTH}
                  autoComplete="nickname"
                  autoCapitalize="none"
                  autoCorrect="off"
                  enterKeyHint="done"
                  placeholder="Choisissez un pseudo"
                  onChange={(event) => updatePseudonym(event.target.value)}
                  disabled={busy}
                  required
                />
              </label>
              <p className="contribution-peer-status" role="status">{p2pStatus}</p>
              {p2pError && <p className="contribution-note">P2P : {p2pError}</p>}
              {!correction && (
                <label className="contribution-field">
                  Fichier LAZ uniquement (maximum 256 Mio)
                  <input ref={fileInputRef} type="file" accept=".laz" onChange={handleFile} disabled={busy} />
                </label>
              )}
              {(metadata || correction) && (
                <>
                  {metadata && (
                    <div className="contribution-meta">
                      <span>{metadata.pointCount.toLocaleString('fr-FR')} points · format {metadata.pointFormat}</span>
                      <span title={metadata.crsWkt || undefined}>
                        CRS : {metadata.crsWkt ? `${metadata.crsWkt.slice(0, 90)}${metadata.crsWkt.length > 90 ? '…' : ''}` : 'non défini dans le fichier'}
                      </span>
                    </div>
                  )}
                  {correction && (
                    <div className="contribution-identity">
                      <p className="contribution-note">Correction immuable de {correction.manifest.title} — l’ancienne version reste disponible.</p>
                      <button type="button" onClick={cancelCorrection} disabled={busy}>Annuler la correction</button>
                    </div>
                  )}
                  <label className="contribution-field">
                    Nom
                    <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} enterKeyHint="next" />
                  </label>
                  <fieldset>
                    <legend>Dimensions de la modélisation (m)</legend>
                    <div className="contribution-grid">
                      {['X', 'Y', 'Z'].map((axis, index) => (
                        <label key={axis}>
                          {axis}
                          <input
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="next"
                            min="0.001"
                            step="any"
                            value={dimensions[index]}
                            onChange={(event) => updateDimension(index, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Ancrage GPS (WGS84)</legend>
                    <div className="contribution-grid">
                      {ANCHOR_FIELDS.map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            type="text"
                            inputMode="decimal"  // clavier numérique avec le signe « - » sur mobile
                            enterKeyHint="next"
                            pattern="-?[0-9]*[.,]?[0-9]*"
                            value={anchorInput[key]}
                            onChange={(event) => updateAnchor(key, event.target.value.replace(',', '.'))}
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="contribution-actions">
                    {!correction && (
                      <button type="button" onClick={analyzeFile} disabled={busy}>
                        {analyzing ? `Analyse ${progress} %` : 'Prévisualiser le placement'}
                      </button>
                    )}
                    <button type="button" onClick={publish} disabled={busy || !preview || !identity || !hasPseudonym}>
                      {correction ? 'Publier la correction' : 'Publier'}
                    </button>
                  </div>
                  {!hasPseudonym && preview && <p className="contribution-note">Choisissez un pseudo pour publier.</p>}
                </>
              )}
              {status && <p className="contribution-status" role="status">{status}</p>}
              {error && <p className="contribution-error" role="alert">{error}</p>}

              <section className="contribution-feed" aria-label="Flux des contributions">
                <h3>{feedMode === 'hot' ? 'Flux communautaire' : 'Recommandé pour vous'}</h3>
                <div className="contribution-feed-tabs" role="group" aria-label="Mode de classement">
                  <button type="button" aria-pressed={feedMode === 'hot'} onClick={() => setFeedMode('hot')}>
                    {compact ? 'Tendances' : 'Tendances · Hot'}
                  </button>
                  <button type="button" aria-pressed={feedMode === 'recommended'} onClick={() => setFeedMode('recommended')}>
                    {compact ? 'Pour vous' : 'Pour vous · voisins'}
                  </button>
                </div>
                <label className="contribution-search">
                  Rechercher dans le flux
                  <input
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    value={feedSearch}
                    onChange={(event) => setFeedSearch(event.target.value)}
                    placeholder="Nom, pseudo ou CID…"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </label>
                {!entries.length && <p className="contribution-note">Aucune contribution dans ce stockage local.</p>}
                {entries.length > 0 && feedMode === 'recommended' && !recommendations.length && (
                  <p className="contribution-note">
                    Pas encore de recommandations : votez sur au moins deux contributions également évaluées par un pair.
                  </p>
                )}
                {feedEntries.length > 0 && visibleFeedEntries.length === 0 && (
                  <p className="contribution-note">Aucun résultat pour cette recherche.</p>
                )}
                {visibleFeedEntries.map((entry) => {
                  const myVote = entry.votes.find((item) => item.publicKey === identity?.publicKey);
                  const voteDisabled = busy || Boolean(myVote) || !hasPseudonym;
                  const reliability = Math.round((entry.reliability?.score ?? 0) * 100);
                  return (
                    <article className="contribution-card" key={entry.cid}>
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
                        <button type="button" aria-pressed={myVote?.direction === 'up'} disabled={voteDisabled} onClick={() => vote(entry, 'up')}>
                          Bien placé ({entry.upvotes ?? 0})
                        </button>
                        <button type="button" aria-pressed={myVote?.direction === 'down'} disabled={voteDisabled} onClick={() => vote(entry, 'down')}>
                          Erroné ({entry.downvotes ?? 0})
                        </button>
                        <button type="button" disabled={busy} onClick={() => startCorrection(entry)}>Corriger le placement</button>
                      </div>
                      <div className="contribution-comments">
                        <CommentBranches
                          comments={entry.comments}
                          contributionCid={entry.cid}
                          drafts={commentDrafts}
                          setDrafts={setCommentDrafts}
                          onSubmit={(parentCid) => comment(entry, parentCid)}
                          busy={busy || !hasPseudonym}
                          maxDepth={compact ? 3 : 4}
                        />
                      </div>
                    </article>
                  );
                })}
              </section>
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

// ---------------------------------------------------------------- Commentaires

function CommentForm({ value, placeholder, label, busy, onChange, onSubmit }) {
  const submit = () => { if (!busy && value.trim()) onSubmit(); };
  return (
    <div className="contribution-comment-form">
      <input
        value={value}
        maxLength={1000}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="send"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
      />
      <button type="button" disabled={busy || !value.trim()} onClick={submit}>{label}</button>
    </div>
  );
}

function CommentBranches({ comments, contributionCid, drafts, setDrafts, onSubmit, busy, maxDepth = 4 }) {
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

// ---------------------------------------------------------------- Couche 3D

function ContributionLayer({ engine, entries }) {
  // Taille des points adaptée à la densité de pixels de l'écran (Retina, mobiles).
  const pointSize = typeof window === 'undefined' ? 2.5 : 2.5 * Math.min(window.devicePixelRatio || 1, 2);

  useEffect(() => {
    if (!engine?.earth?.group) return undefined;
    const root = new THREE.Group();
    root.name = 'anonymous-contributions';
    engine.earth.group.add(root);
    const lodPointGroups = [];
    for (const entry of entries) {
      const anchor = entry.manifest.anchor;
      const origin = enuToScene({ east: 0, north: 0, up: 0 }, anchor);
      const latitude = anchor.latitude * Math.PI / 180;
      const longitude = anchor.longitude * Math.PI / 180;
      const east = new THREE.Vector3(-Math.sin(longitude), 0, -Math.cos(longitude));
      const north = new THREE.Vector3(-Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude));
      const up = new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), -Math.cos(latitude) * Math.sin(longitude));
      const matrix = new THREE.Matrix4().makeBasis(east, north, up);
      const contribution = new THREE.Group();
      contribution.position.set(origin.x, origin.y, origin.z);
      contribution.quaternion.setFromRotationMatrix(matrix);
      const sourceDimensions = entry.manifest.sourceDimensionsMeters || entry.manifest.dimensionsMeters;
      contribution.scale.set(
        entry.manifest.dimensionsMeters[0] / sourceDimensions[0] / 6_371_000,
        entry.manifest.dimensionsMeters[1] / sourceDimensions[1] / 6_371_000,
        entry.manifest.dimensionsMeters[2] / sourceDimensions[2] / 6_371_000,
      );
      root.add(contribution);
      const tint = entry.reliability.status === 'validated' ? 0x49df8a
        : entry.reliability.status === 'contested' ? 0xff5b69 : 0xffc857;
      for (const chunk of entry.chunks) {
        if (!chunk) continue; // bloc manquant dans le stockage local
        const chunkGroup = new THREE.Group();
        contribution.add(chunkGroup);
        const lodPoints = [];
        chunk.levels.forEach((level, index) => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(level.positions, 3));
          geometry.setAttribute('color', new THREE.BufferAttribute(level.colors, 4, true));
          const points = new THREE.Points(geometry, new THREE.PointsMaterial({
            size: pointSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
          }));
          points.visible = index === 0;
          lodPoints.push(points);
          chunkGroup.add(points);
        });
        lodPointGroups.push(lodPoints);
        const box = new THREE.BoxGeometry(
          Math.max(chunk.bounds.maxX - chunk.bounds.minX, 0.001),
          Math.max(chunk.bounds.maxY - chunk.bounds.minY, 0.001),
          Math.max(chunk.bounds.maxZ - chunk.bounds.minZ, 0.001),
        );
        const edgeGeometry = new THREE.EdgesGeometry(box);
        box.dispose(); // la boîte ne sert qu'à calculer les arêtes : elle fuyait en mémoire GPU
        const edgeMaterial = new THREE.ShaderMaterial({
          uniforms: { color: { value: new THREE.Color(tint) } },
          vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 0.95); }',
          transparent: true,
          depthWrite: false,
        });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edges.position.set(
          (chunk.bounds.minX + chunk.bounds.maxX) / 2,
          (chunk.bounds.minY + chunk.bounds.maxY) / 2,
          (chunk.bounds.minZ + chunk.bounds.maxZ) / 2,
        );
        chunkGroup.add(edges);
      }
    }
    let frame = 0;
    let activeLod = -1;
    const updateLod = () => {
      if (engine.stopped) return;
      const altitude = Math.max(0, engine.cam.position.distanceTo(engine.earth.group.position) - 1);
      const selected = altitude > 0.12 ? 2 : altitude > 0.025 ? 1 : 0;
      if (selected !== activeLod) {
        activeLod = selected;
        for (const lodPoints of lodPointGroups) {
          // Si un bloc a moins de niveaux, on garde le plus grossier disponible.
          const level = Math.min(selected, lodPoints.length - 1);
          lodPoints.forEach((points, index) => { points.visible = index === level; });
        }
      }
      frame = requestAnimationFrame(updateLod);
    };
    frame = requestAnimationFrame(updateLod);
    return () => {
      cancelAnimationFrame(frame);
      engine.earth.group.remove(root);
      root.traverse((object) => {
        if (object instanceof THREE.Points || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        }
      });
    };
  }, [engine, entries, pointSize]);
  return null;
}
