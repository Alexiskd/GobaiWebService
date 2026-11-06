import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, IconButton, InputBase, List, ListItem, ListItemButton, ListItemText, Stack } from '@mui/material';
import { searchPlaces } from '@/api';
import { useViewport } from '@/hooks/useViewport';
import { coords } from '@/lib/format';
import { fold } from '@/lib/search';
import { altitudeForView, formatLatLon, parseLatLon } from '@/engine/gps';
import { CloseIcon } from '../ui/icons';

const MAX_RESULTS = 40;
const WORLD_DEBOUNCE_MS = 300;
const GPS_VIEW_M = 10; // un point GPS est survolé à l'échelle de 10 m (hauteur de l'écran)

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
    // Coordonnées saisies (« 48.8584, 2.2945 », « 48°51'30"N 2°17'40"E »…) : premier résultat, survol à 10 m.
    const point = parseLatLon(query);
    const gps = point ? [{
      type: 'gps', i: 0, name: formatLatLon(point.lat, point.lon, 6),
      sub: `Coordonnées GPS · survol à l’échelle de ${GPS_VIEW_M} m`,
      place: { name: formatLatLon(point.lat, point.lon, 5), lat: point.lat, lon: point.lon, altitudeM: altitudeForView(GPS_VIEW_M) },
    }] : [];
    return [...gps, ...local, ...places];
  }, [index, query, world.items]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    // Le dialogue MUI bloque déjà le défilement de la page ; le focus va au champ une fois la fenêtre montée.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const choose = (r) => {
    if (!r) return;
    if (r.type === 'city') onPickCity(r.i);
    else if (r.type === 'place' || r.type === 'gps') onPickPlace?.(r.place);
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

  const empty = (text) => (
    <ListItem aria-disabled="true"><ListItemText secondary={text} /></ListItem>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={compact}
      fullWidth
      maxWidth="sm"
      aria-label="Rechercher"
      sx={{ '& .MuiDialog-container': { alignItems: compact ? 'stretch' : 'flex-start' } }}
      slotProps={{ paper: { sx: compact ? {} : { mt: '14vh' } } }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <InputBase
          inputRef={inputRef}
          type="search"
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={worldSearch ? (compact ? 'Ville, planète, GPS…' : 'Une ville du monde, une planète ou des coordonnées GPS…') : 'Une ville, une planète ou des coordonnées GPS…'}
          sx={{ fontSize: '1.05rem', py: 1 }}
          slotProps={{
            input: {
              inputMode: 'search', enterKeyHint: 'go', autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'none', spellCheck: 'false',
              role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list',
              'aria-activedescendant': results[active] ? `pal-${active}` : undefined,
            },
          }}
        />
        {/* Pas de touche Échap sur mobile : bouton de fermeture visible. */}
        {compact ? (
          <Button onClick={onClose} aria-label="Fermer la recherche">Annuler</Button>
        ) : (
          <IconButton onClick={onClose} aria-label="Fermer la recherche"><CloseIcon /></IconButton>
        )}
      </Stack>
      <List id="palette-list" role="listbox" ref={listRef} dense sx={{ maxHeight: compact ? 'none' : '46vh', overflowY: 'auto', p: 0.75 }}>
        {results.map((r, n) => (
          <ListItemButton
            key={`${r.type}-${r.i}`}
            id={`pal-${n}`}
            role="option"
            aria-selected={n === active}
            selected={n === active}
            onPointerMove={(e) => { if (e.pointerType === 'mouse') setActive(n); }}
            onClick={() => choose(r)}
            sx={{ borderRadius: 1.5 }}
          >
            <ListItemText
              primary={r.name}
              secondary={r.sub}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1.5, my: 0.25 }}
              slotProps={{ secondary: { sx: { textAlign: 'right', flex: 'none', maxWidth: '55%' } } }}
            />
          </ListItemButton>
        ))}
        {!results.length && world.status !== 'loading' && empty(`Aucun résultat pour « ${query} ». Essayez un autre nom.`)}
        {worldSearch && world.status === 'loading' && empty('Recherche dans le monde entier…')}
        {worldSearch && world.status === 'error' && empty('Recherche mondiale indisponible.')}
      </List>
    </Dialog>
  );
}
