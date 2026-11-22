// Documentation et photos de l'astre visé, dans le panneau Caractéristiques et informations.
import { useCallback, useEffect, useMemo, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Collapse, Link } from '@/Fairing/kit';
import { get, resolveApiUrl } from '@/Computing/api/client';
import { ALL_SATELLITES, MOON, PLANETS, SUN } from '@/Engine/SystemeEngine/astronomy/data/bodies.data';
import { DOCUMENTS } from '../Donnees/data/index.js';
import { buildBodyCatalog, fold } from '../Donnees/bodyCatalog.js';
import { photosOf } from '../Donnees/collection/collectionPhotos.js';
import { CollectionViewer } from '../Donnees/collection/Collection.jsx';
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
    <div role="note" className="flex gap-2 items-start p-2.5 mb-2.5 rounded-[10px] border border-warning bg-warning/12">
      <div aria-hidden="true" className="flex-none w-5 h-5 mt-[1px] rounded-full grid place-items-center bg-warning text-[#1a1408] text-[13px] font-bold">!</div>
      <p className="t-body2 leading-[1.5] [overflow-wrap:anywhere]">
        Ces informations peuvent être faussées par les incertitudes scientifiques : mesures approchées, valeurs révisées au fil des observations et des missions, modèles simplifiés.
      </p>
    </div>
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
      <div className="grid grid-cols-3 gap-1.5">
        {shown.map((item, i) => (
          <button type="button" key={item.id} onClick={() => setOpen(i)} aria-label={`Agrandir : ${item.title}`}
            className="g-base relative aspect-[1] rounded-[12px] overflow-hidden border border-line bg-hover">
            <img src={item.thumbUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover block" />
            {item.kind === 'video' && (
              <div aria-hidden="true" className="absolute inset-0 m-auto w-8 h-8 rounded-full grid place-items-center bg-[color:rgba(0,0,0,.6)] text-[#fff] text-[13px] pl-[2px]">▶</div>
            )}
          </button>
        ))}
      </div>
      {items.length > shown.length && (
        <button type="button" onClick={() => setAll(true)} className="g-base mt-2 min-h-9 px-3 rounded-full border border-line text-[13px] pointer-coarse:min-h-11">
          Toutes les photos ({items.length})
        </button>
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
    <div className="border-t border-line">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="g-base w-full min-h-10 pointer-coarse:min-h-11 flex items-center gap-2 px-1 text-left justify-start">
        <p className="t-body1 flex-1 min-w-0 text-[14px] font-semibold [overflow-wrap:anywhere]">
          {entry.name} <span className="t-caption text-soft">· {doc.designation} · {doc.physical?.size}</span>
        </p>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </button>
      <Collapse in={open} unmountOnExit>
        <div className="pb-3">
          <Facts items={entry.facts.filter((f) => f.term !== 'Type')} />
          <p className="t-body2 mt-2 leading-[1.55]">{doc.summary}</p>
          <div className="flex flex-row gap-3 mt-2 flex-wrap">
            <Link href={doc.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px]">Wikipédia <OpenInNewIcon className="text-[14px]" /></Link>
            <Link href={doc.file} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px]">PDF <OpenInNewIcon className="text-[14px]" /></Link>
            <Link href={doc.file} download className="inline-flex items-center gap-1 text-[13px]"><DownloadIcon className="text-[14px]" /> Télécharger</Link>
          </div>
        </div>
      </Collapse>
    </div>
  );
}

/**
 * Documentation de l'astre visé, dans le panneau Caractéristiques et informations : l'avertissement sur les
 * incertitudes, le plateau tournant de l'astre (`plateau`, facultatif, juste au-dessus de la galerie), ses photos
 * (Ma collection), les caractéristiques de sa fiche que le panneau n'affiche pas déjà
 * (`shownTerms` : les termes des caractéristiques en direct), et, pour Jupiter, les petits satellites documentés par
 * des PDF (absents de la scène 3D).
 */
export function BodyDocumentation({ name, shownTerms = [], note = true, plateau = null }) {
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
      {/* Le plateau tournant de l'astre, posé juste au-dessus de la galerie de photos. */}
      {plateau}
      <Photos name={name} />
      {extra.length > 0 && (
        <Section title="Documentation">
          <Facts items={extra} />
        </Section>
      )}
      {pdfMoons.length > 0 && (
        <Section title={`Petits satellites documentés · ${pdfMoons.length}`}>
          <span className="t-caption text-soft block mb-1">
            Fiches établies à partir de documents PDF ; ces satellites ne sont pas dans la scène 3D.
          </span>
          {pdfMoons.map((e) => <PdfMoon key={e.id} entry={e} />)}
        </Section>
      )}
    </>
  );
}
