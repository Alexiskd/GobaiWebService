// Galerie d'un astre, dans sa fiche de la Documentation : images des archives NASA (images-api.nasa.gov, sans clé).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { galleryTargetFor, searchImages } from './galerieData.jsx';
import { Lightbox } from './GalerieApp.jsx';
import './galerie.css';

/** Nombre de vignettes montrées avant « Voir plus ». */
const FIRST = 12;

/**
 * Galerie de la fiche d'un astre : les images NASA de l'astre, toutes missions confondues ou mission par mission,
 * avec la visionneuse de la galerie (plein écran, image en pleine résolution, téléchargement). Rien n'est demandé à
 * la NASA tant que la fiche n'est pas ouverte. Un astre sans archives dans la galerie n'affiche rien.
 */
export function BodyGallery({ entry, onLightboxChange }) {
  const target = useMemo(() => galleryTargetFor(entry.name, entry.parentName), [entry.name, entry.parentName]);
  const [mission, setMission] = useState('all');
  const [state, setState] = useState({ status: 'idle', images: [], failed: 0 });
  const [shown, setShown] = useState(FIRST);
  const [open, setOpen] = useState(null);

  useEffect(() => { onLightboxChange?.(open != null); }, [open, onLightboxChange]);
  useEffect(() => () => onLightboxChange?.(false), [onLightboxChange]);

  useEffect(() => {
    if (!target) return undefined;
    const ctrl = new AbortController();
    const missions = mission === 'all' ? target.planet.missions : target.planet.missions.filter((m) => m.id === mission);
    setState({ status: 'loading', images: [], failed: 0 });
    setShown(FIRST);
    Promise.allSettled(missions.map((m) => searchImages(target.planet, target.body, m, 1, ctrl.signal))).then((results) => {
      if (ctrl.signal.aborted) return;
      const seen = new Set();
      const images = [];
      let failed = 0;
      for (const r of results) {
        if (r.status !== 'fulfilled') { failed += 1; continue; }
        for (const img of r.value.images) if (!seen.has(img.id)) { seen.add(img.id); images.push(img); }
      }
      // Les plus récentes d'abord.
      images.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      setState({ status: 'ready', images, failed });
    });
    return () => ctrl.abort();
  }, [target, mission]);

  const nav = useCallback((d) => setOpen((i) => (i == null ? i : (i + d + state.images.length) % state.images.length)), [state.images.length]);
  const close = useCallback(() => setOpen(null), []);

  if (!target) return null;
  const { images, status, failed } = state;

  return (
    <section className="doc-card doc-gallery" aria-label={`Galerie de ${entry.name}`}>
      <div className="doc-gallery-head">
        <h2>Galerie</h2>
        <span className="doc-gallery-src">Archives NASA · images-api.nasa.gov</span>
      </div>
      <div className="doc-filters doc-gallery-missions" role="group" aria-label="Missions">
        <button className={`doc-filter ${mission === 'all' ? 'is-active' : ''}`} aria-pressed={mission === 'all'} onClick={() => setMission('all')}>Toutes les missions</button>
        {target.planet.missions.map((m) => (
          <button key={m.id} className={`doc-filter ${mission === m.id ? 'is-active' : ''}`} aria-pressed={mission === m.id} onClick={() => setMission(m.id)}>
            {m.name} <span className="doc-gallery-year">{m.year}</span>
          </button>
        ))}
      </div>

      {status === 'loading' && <p className="doc-count" role="status">Chargement des images…</p>}
      {status === 'ready' && failed > 0 && <p className="doc-count" role="status">Une partie des archives NASA n’a pas répondu ; réessayez dans un instant.</p>}
      {status === 'ready' && images.length === 0 && failed === 0 && <p className="doc-count">Aucune image trouvée pour {entry.name} dans ces archives.</p>}

      {images.length > 0 && (
        <>
          <p className="doc-count" role="status">{images.length} {images.length > 1 ? 'images' : 'image'}</p>
          <div className="doc-gallery-grid">
            {images.slice(0, shown).map((img, i) => (
              <button key={img.id} className="doc-gallery-tile" onClick={() => setOpen(i)} aria-label={`Agrandir : ${img.title}`}>
                <img src={img.thumb} alt="" loading="lazy" decoding="async" />
                <span className="doc-gallery-cap">{img.missionName}{img.date ? ` · ${String(img.date).slice(0, 4)}` : ''}</span>
              </button>
            ))}
          </div>
          {shown < images.length && (
            <button className="doc-btn doc-gallery-more" onClick={() => setShown((n) => n + FIRST * 2)}>
              Voir plus ({images.length - shown})
            </button>
          )}
        </>
      )}

      {open != null && images[open] && (
        <div className="gobai-gallery">
          <Lightbox image={images[open]} index={open} total={images.length} onClose={close} onNav={nav} />
        </div>
      )}
    </section>
  );
}
