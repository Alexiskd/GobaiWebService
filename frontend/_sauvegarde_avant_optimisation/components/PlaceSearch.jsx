import { useMemo, useState } from 'react';

const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const coords = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'O'}`;

/**
 * Recherche dans les lieux d’un corps (villes, lieux lunaires, repères planétaires).
 * `onPick` absent : la liste reste informative (corps sans surface navigable).
 */
export default function PlaceSearch({ places, onPick, placeholder = 'Rechercher un lieu…', max = 8 }) {
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

  return (
    <div className="moon-search place-search">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onPick && results[0]) onPick(results[0]);
          else if (e.key === 'Escape') setQuery('');
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck="false"
      />
      {q && (
        <ul>
          {results.map((f) => (
            <li key={f.name}>
              {onPick ? (
                <button onClick={() => onPick(f)} title={f.info || coords(f.lat, f.lon)}>
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
