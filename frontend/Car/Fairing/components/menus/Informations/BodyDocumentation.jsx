// Documentation et photos de l'astre visé, dans le panneau Caractéristiques et informations.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase, Collapse, Link, Stack, Typography } from '@mui/material';
import { get, resolveApiUrl } from '@/Computing/api/client';
import { ALL_SATELLITES, MOON, PLANETS, SUN } from '@/Engine/SystemeEngine/astronomy/data/bodies.data';
import { DOCUMENTS } from '../Donnees/data/index.js';
import { buildBodyCatalog, fold } from '../Donnees/bodyCatalog.js';
import { photosOf } from '../Donnees/collectionPhotos.js';
import { CollectionViewer } from '../Donnees/Collection.jsx';
import { Section } from '../../ui/Section.jsx';
import { DownloadIcon, ExpandLessIcon, ExpandMoreIcon, OpenInNewIcon } from '../../ui/icons.jsx';
import { Facts } from './Facts.jsx';

/** Catalogue de la documentation (tous les astres de l'application et les fiches PDF), construit une fois. */
let CATALOG = null;
const catalog = () => (CATALOG ||= buildBodyCatalog({ sun: SUN, moon: MOON, planets: PLANETS, satellites: ALL_SATELLITES, documents: DOCUMENTS }));

/** Ma collection (GET /galerie), chargée une fois pour tous les astres. */
let COLLECTION = null;
let COLLECTION_PROMISE = null;
function useCollection() {
  const [data, setData] = useState(COLLECTION);
  useEffect(() => {
    if (COLLECTION) return undefined;
    let alive = true;
    COLLECTION_PROMISE ||= get('/galerie').then((d) => { COLLECTION = d; return d; }).catch(() => { COLLECTION_PROMISE = null; return null; });
    COLLECTION_PROMISE.then((d) => { if (alive && d) setData(d); });
    return () => { alive = false; };
  }, []);
  return data;
}

/** Avertissement sur les incertitudes scientifiques, en tête de la documentation. */
export function UncertaintyNote() {
  return (
    <Box role="note" sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 1.25, mb: 1.25, borderRadius: 2, border: 1, borderColor: 'warning.main', bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(224,178,90,.10)' : 'rgba(224,178,90,.16)') }}>
      <Box aria-hidden="true" sx={{ flex: 'none', width: 20, height: 20, mt: '1px', borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'warning.main', color: '#1a1408', fontSize: 13, fontWeight: 700 }}>!</Box>
      <Typography variant="body2" sx={{ lineHeight: 1.5, overflowWrap: 'anywhere' }}>
        Ces informations peuvent être faussées par les incertitudes scientifiques : mesures approchées, valeurs révisées au fil des observations et des missions, modèles simplifiés.
      </Typography>
    </Box>
  );
}

/** Photos et vidéos de l'astre (Ma collection), en vignettes ; visionneuse plein écran au toucher. */
function Photos({ name }) {
  const collection = useCollection();
  const items = useMemo(
    () => photosOf(name, collection).map((i) => ({ ...i, url: resolveApiUrl(i.url), thumbUrl: resolveApiUrl(i.thumbUrl) })),
    [name, collection],
  );
  const [open, setOpen] = useState(null);
  const [all, setAll] = useState(false);
  const close = useCallback(() => setOpen(null), []);
  const nav = useCallback((d) => setOpen((i) => (i == null ? i : (i + d + items.length) % items.length)), [items.length]);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, 6);
  return (
    <Section title={`Photos · ${items.length}`}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }}>
        {shown.map((item, i) => (
          <ButtonBase key={item.id} onClick={() => setOpen(i)} aria-label={`Agrandir : ${item.title}`}
            sx={{ position: 'relative', aspectRatio: '1', borderRadius: 1.5, overflow: 'hidden', border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Box component="img" src={item.thumbUrl} alt="" loading="lazy" decoding="async" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {item.kind === 'video' && (
              <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, m: 'auto', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 13, pl: '2px' }}>▶</Box>
            )}
          </ButtonBase>
        ))}
      </Box>
      {items.length > shown.length && (
        <ButtonBase onClick={() => setAll(true)} sx={{ mt: 1, minHeight: 36, px: 1.5, borderRadius: 999, border: 1, borderColor: 'divider', fontSize: 13, '@media (pointer: coarse)': { minHeight: 44 } }}>
          Toutes les photos ({items.length})
        </ButtonBase>
      )}
      {open != null && items[open] && (
        <div className="gobai-gallery">
          <CollectionViewer item={items[open]} index={open} total={items.length} onClose={close} onNav={nav} />
        </div>
      )}
    </Section>
  );
}

/** Une fiche PDF (petit satellite hors scène), repliable : caractéristiques, résumé et liens. */
function PdfMoon({ entry }) {
  const [open, setOpen] = useState(false);
  const doc = entry.doc;
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <ButtonBase onClick={() => setOpen((v) => !v)} aria-expanded={open}
        sx={{ width: '100%', minHeight: 40, '@media (pointer: coarse)': { minHeight: 44 }, display: 'flex', alignItems: 'center', gap: 1, px: 0.5, textAlign: 'left', justifyContent: 'flex-start' }}>
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {entry.name} <Typography component="span" variant="caption" color="text.secondary">· {doc.designation} · {doc.physical?.size}</Typography>
        </Typography>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pb: 1.5 }}>
          <Facts items={entry.facts.filter((f) => f.term !== 'Type')} />
          <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.55 }}>{doc.summary}</Typography>
          <Stack direction="row" useFlexGap spacing={1.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Link href={doc.source} target="_blank" rel="noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13 }}>Wikipédia <OpenInNewIcon sx={{ fontSize: 14 }} /></Link>
            <Link href={doc.file} target="_blank" rel="noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13 }}>PDF <OpenInNewIcon sx={{ fontSize: 14 }} /></Link>
            <Link href={doc.file} download sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13 }}><DownloadIcon sx={{ fontSize: 14 }} /> Télécharger</Link>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * Documentation de l'astre visé, dans le panneau Caractéristiques et informations : l'avertissement sur les
 * incertitudes, ses photos (Ma collection), les caractéristiques de sa fiche que le panneau n'affiche pas déjà
 * (`shownTerms` : les termes des caractéristiques en direct), et, pour Jupiter, les petits satellites documentés par
 * des PDF (absents de la scène 3D).
 */
export function BodyDocumentation({ name, shownTerms = [], note = true }) {
  const entry = useMemo(() => catalog().entries.find((e) => fold(e.name) === fold(name)), [name]);
  const extra = useMemo(() => {
    const shown = new Set(shownTerms.map(fold));
    return (entry?.facts ?? []).filter((f) => !shown.has(fold(f.term)) && f.term !== 'Type');
  }, [entry, shownTerms]);
  const pdfMoons = useMemo(
    () => (entry && entry.kind !== 'satellite' ? catalog().entries.filter((e) => e.doc && e.parentName === entry.name) : []),
    [entry],
  );
  return (
    <>
      {note && <UncertaintyNote />}
      <Photos name={name} />
      {extra.length > 0 && (
        <Section title="Documentation">
          <Facts items={extra} />
        </Section>
      )}
      {pdfMoons.length > 0 && (
        <Section title={`Petits satellites documentés · ${pdfMoons.length}`}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Fiches établies à partir de documents PDF ; ces satellites ne sont pas dans la scène 3D.
          </Typography>
          {pdfMoons.map((e) => <PdfMoon key={e.id} entry={e} />)}
        </Section>
      )}
    </>
  );
}
