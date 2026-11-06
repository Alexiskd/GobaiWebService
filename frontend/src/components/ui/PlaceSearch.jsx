import { useMemo, useState } from 'react';
import { List, ListItem, ListItemButton, ListItemText, Paper, TextField } from '@mui/material';
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
    <>
      <TextField
        type="search"
        size="small"
        fullWidth
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onPick && results[0]) pick(results[0]);
          else if (e.key === 'Escape') setQuery('');
        }}
        placeholder={placeholder}
        slotProps={{
          htmlInput: {
            'aria-label': placeholder, inputMode: 'search', enterKeyHint: 'search',
            autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'none', spellCheck: 'false',
          },
        }}
      />
      {q && (
        <Paper variant="outlined" sx={{ mt: 1, bgcolor: 'transparent', backdropFilter: 'none', maxHeight: 280, overflowY: 'auto' }}>
          <List dense disablePadding>
            {results.map((f) => {
              // Deux lieux peuvent porter le même nom : la clé inclut les coordonnées.
              const text = <ListItemText primary={f.native || f.name} secondary={detail(f)} />;
              return onPick ? (
                <ListItemButton key={`${f.name}-${f.lat}-${f.lon}`} onClick={() => pick(f)} title={f.info || coords(f.lat, f.lon)}>
                  {text}
                </ListItemButton>
              ) : (
                <ListItem key={`${f.name}-${f.lat}-${f.lon}`} title={f.info || coords(f.lat, f.lon)}>{text}</ListItem>
              );
            })}
            {!results.length && (
              <ListItem><ListItemText secondary={`Aucun lieu pour « ${query} ».`} /></ListItem>
            )}
          </List>
        </Paper>
      )}
    </>
  );
}
