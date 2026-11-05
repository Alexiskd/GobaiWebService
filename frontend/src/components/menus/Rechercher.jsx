import { useEffect, useMemo, useRef, useState } from 'react';
import { searchPlaces } from '@/api';
import { useViewport } from '@/hooks/useViewport';
import { coords } from '@/lib/format';
import { fold } from '@/lib/search';

const MAX_RESULTS = 40;
const WORLD_DEBOUNCE_MS = 300;

/**
 * Recherche rapide (Ctrl K ou /) : astres, villes de l’API, puis lieux mondiaux si Uber Maps est configuré.
 * ↑ ↓ pour choisir, Entrée pour aller, Échap pour fermer. Plein écran sur téléphone.
 */
export function Rechercher({ open, onClose, cities, bodyNames, onPickCity, onPickBody, onPickPlace, worldSearch = false }) {
  const { compact } = useViewport();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [world, setWorld] = useState({ q: '', items: [], status: 'idle' });
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const index = useMemo(() => [
    ...bodyNames.map((name, i) => ({ type: 'body', name, key: fold(name), i, sub: 'Astre' })),
    ...cities.map((c, i) => ({ type: 'city', name: c.name, key: fold(c.name), i, sub: coords(c.lat, c.lon) })),
  ], [cities, bodyNames]);

  useEffect(() => {
    const q = query.trim();
    if (!open || !worldSearch || q.length < 2) { setWorld({ q: '', items: [], status: 'idle' }); return undefined; }
    const ctrl = new AbortController();
    setWorld((w) => ({ ...w, status: 'loading' }));
    const t = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => setWorld({ q, items: r.items, status: 'ready' }))
        .catch((e) => { if (e.name !== 'AbortError') setWorld({ q, items: [], status: 'error' }); });
    }, WORLD_DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [open, worldSearch, query]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const hits = q ? index.filter((r) => r.key.includes(q)) : index.filter((r) => r.type === 'body');
    if (q) hits.sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)));
    const local = hits.slice(0, MAX_RESULTS);
    const seen = new Set(local.filter((r) => r.type === 'city').map((r) => r.key));
    const places = world.items
      .filter((p) => !seen.has(fold(p.name)))
      .map((p, i) => ({ type: 'place', name: p.name, i, place: p, sub: p.context || coords(p.lat, p.lon) }));
    return [...local, ...places];
  }, [index, query, world.items]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    // Bloque le défilement de la page derrière la palette (iOS).
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active]);

  if (!open) return null;

  const choose = (r) => {
    if (!r) return;
    if (r.type === 'city') onPickCity(r.i);
    else if (r.type === 'place') onPickPlace?.(r.place);
    else onPickBody(r.i);
    inputRef.current?.blur(); // referme le clavier virtuel
    onClose();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="overlay palette-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={compact ? 'palette palette-sheet' : 'palette'} role="dialog" aria-modal="true" aria-label="Rechercher">
        <div className="palette-bar">
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="go"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={worldSearch ? (compact ? 'Ville, planète…' : 'N’importe quelle ville du monde, une planète…') : 'Une ville, une planète…'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `pal-${active}` : undefined}
          />
          {/* Pas de touche Échap sur mobile : bouton de fermeture visible. */}
          <button type="button" className="ghost palette-close" onClick={onClose} aria-label="Fermer la recherche">
            {compact ? 'Annuler' : '×'}
          </button>
        </div>
        <ul id="palette-list" role="listbox" ref={listRef}>
          {results.map((r, n) => (
            <li
              key={`${r.type}-${r.i}`}
              id={`pal-${n}`}
              role="option"
              aria-selected={n === active}
              onPointerMove={(e) => { if (e.pointerType === 'mouse') setActive(n); }}
              onClick={() => choose(r)}
            >
              <span>{r.name}</span>
              <small>{r.sub}</small>
            </li>
          ))}
          {!results.length && world.status !== 'loading' && <li className="empty" aria-disabled="true">Aucun résultat pour « {query} ». Essayez un autre nom.</li>}
          {worldSearch && world.status === 'loading' && <li className="empty" aria-disabled="true">Recherche dans le monde entier…</li>}
          {worldSearch && world.status === 'error' && <li className="empty" aria-disabled="true">Recherche mondiale indisponible.</li>}
        </ul>
      </div>
    </div>
  );
}
