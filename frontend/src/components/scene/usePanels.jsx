import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Panneaux ouverts : recherche, aide, informations, tuile 3D et contributions.
 * Petit écran : un seul grand panneau à la fois (sinon ils se recouvrent).
 * Raccourcis : Ctrl K ou / (recherche), ? (aide), L (informations), Échap (fermer).
 */
export function usePanels({ compact, bodySelected }) {
  const [panel, setPanel] = useState(null); // 'layers' | 'search' | 'help' | null
  const [pointCloudOpen, setPointCloudOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const bodySelectedRef = useRef(bodySelected);
  bodySelectedRef.current = bodySelected;

  const layersOpen = panel === 'layers' && bodySelected;
  const closePanel = useCallback(() => setPanel(null), []);

  const toggleLayers = useCallback(() => {
    setPanel((p) => (p === 'layers' ? null : 'layers'));
    if (compact) { setPointCloudOpen(false); setContributionOpen(false); }
  }, [compact]);
  const togglePointClouds = useCallback(() => {
    setPointCloudOpen((o) => !o);
    if (compact) { setContributionOpen(false); setPanel((p) => (p === 'layers' ? null : p)); }
  }, [compact]);
  const toggleContributions = useCallback(() => {
    setContributionOpen((o) => !o);
    if (compact) { setPointCloudOpen(false); setPanel((p) => (p === 'layers' ? null : p)); }
  }, [compact]);

  useEffect(() => {
    if (!bodySelected) setPanel((p) => (p === 'layers' ? null : p));
  }, [bodySelected]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPanel('search'); return; }
      if (e.key === 'Escape') { setPanel(null); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setPanel('search'); }
      else if (e.key === '?') setPanel((p) => (p === 'help' ? null : 'help'));
      else if (e.key.toLowerCase() === 'l' && bodySelectedRef.current) setPanel((p) => (p === 'layers' ? null : 'layers'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    panel, setPanel, closePanel, layersOpen,
    pointCloudOpen, setPointCloudOpen, contributionOpen, setContributionOpen,
    toggleLayers, togglePointClouds, toggleContributions,
  };
}
