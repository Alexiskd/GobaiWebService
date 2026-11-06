import { useMemo, useRef, useState } from 'react';
import { inspectLasFile } from '@/contributions/las';
import { anchorIsValid, EMPTY_ANCHOR_INPUT, toAnchor, toAnchorInput } from './anchor';

const MAX_FILE_BYTES = 256 * 1024 * 1024; // 256 Mio, comme annoncé dans l'interface

// Brouillon d'une contribution : fichier LAZ choisi, métadonnées, nom, dimensions, ancrage, aperçu.
export function useContributionDraft({ setError, setStatus }) {
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [title, setTitle] = useState('');
  const [dimensions, setDimensions] = useState(['', '', '']);
  const [anchorInput, setAnchorInput] = useState(EMPTY_ANCHOR_INPUT);
  const [preview, setPreview] = useState(null);
  const [correction, setCorrection] = useState(null);
  const fileInputRef = useRef(null);

  const anchor = useMemo(() => toAnchor(anchorInput), [anchorInput]);

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

  const resetDraft = () => {
    setFile(null);
    setMetadata(null);
    setPreview(null);
    setCorrection(null);
    setTitle('');
    setDimensions(['', '', '']);
    resetFileInput();
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
    requestAnimationFrame(() => document.querySelector('[data-contribution-body]')?.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const cancelCorrection = () => {
    setCorrection(null);
    setPreview(null);
    setTitle('');
    setDimensions(['', '', '']);
    setStatus('');
  };

  return {
    file,
    metadata,
    title,
    setTitle,
    dimensions,
    anchorInput,
    preview,
    setPreview,
    correction,
    anchor,
    previewItem,
    fileInputRef,
    handleFile,
    updateDimension,
    updateAnchor,
    startCorrection,
    cancelCorrection,
    resetDraft,
  };
}
