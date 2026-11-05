import { useMemo, useState } from 'react';
import { coords } from '@/lib/format';
import { fold } from '@/lib/search';

/**
 * Recherche dans les lieux d’un corps (villes, lieux lunaires, repères planétaires).
 * `onPick` absent : la liste reste informative (corps sans surface navigable).
 */
export function PlaceSearch({ places, onPick, placeholder = 'Rechercher un lieu…', max = 8 }) {
  const [query, setQuery] = useState('');
  const q = fold(query.trim());

  const results = useMemo(() => {
    if (!q) return [];
    return places
      .filter((f) => fold(f.name).includes(q)
        || (f.native && fold(f.native).includes(q))
        || (f.kind && fold(f.kind).includes(q))
        || (f.info && fold(f.info).includes(q)))
      .slice(0, max);
  }, [q, places, max]);

  const detail = (f) => [f.kind, f.native ? f.name : null, f.info, coords(f.lat, f.lon)]
    .filter(Boolean).join(' · ');

  const pick = (f) => {
    onPick(f);
    setQuery('');
  };

  return (
    <div className="moon-search place-search">
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onPick && results[0]) pick(results[0]);
          else if (e.key === 'Escape') setQuery('');
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
      />
      {q && (
        <ul>
          {results.map((f) => (
            // Deux lieux peuvent porter le même nom : la clé inclut les coordonnées.
            <li key={`${f.name}-${f.lat}-${f.lon}`}>
              {onPick ? (
                <button type="button" onClick={() => pick(f)} title={f.info || coords(f.lat, f.lon)}>
                  <span>{f.native || f.name}</span>
                  <small>{detail(f)}</small>
                </button>
              ) : (
                <div className="place-row" title={f.info || coords(f.lat, f.lon)}>
                  <span>{f.native || f.name}</span>
                  <small>{detail(f)}</small>
                </div>
              )}
            </li>
          ))}
          {!results.length && <li className="empty">Aucun lieu pour « {query} ».</li>}
        </ul>
      )}
    </div>
  );
}
