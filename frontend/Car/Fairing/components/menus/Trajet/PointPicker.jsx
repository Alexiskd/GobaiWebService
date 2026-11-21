// Choix d'une position (départ ou arrivée) : un lieu de la Terre (recherche ou « Ma position ») ou un site de la Lune.
import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { searchPlaces } from '@/Computing/api';
import { geolocationMessage, locate, placeFromPosition } from '@/Engine/shared/lib/device/homePlace';
import { earthPoint, formatCoords, moonPoint } from '@/Engine/shared/lib/app/trajet';
import { MyLocationIcon } from '../../ui/icons.jsx';

/** Délai avant de lancer la recherche, pendant la frappe (ms). */
const SEARCH_DELAY_MS = 300;

/** Libellé d'un résultat de recherche : le nom, puis son contexte (région, pays). */
const placeLabel = (p) => (p?.context ? `${p.name} — ${p.context}` : p?.name ?? '');

/**
 * Une position à choisir. `value` : { body, lat, lon, name? } ou null ; `onChange` reçoit la nouvelle position (ou
 * null quand on change d'astre). `moonSites` : les sites Apollo servis par le backend.
 */
export function PointPicker({ label, value, onChange, moonSites }) {
  // Astre choisi : celui de la position, la Terre au départ.
  const [body, setBody] = useState(value?.body ?? 'earth');
  // Lieu choisi dans la liste (ou « Ma position »), texte tapé et résultats de la recherche.
  const [picked, setPicked] = useState(null);
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  // « Ma position » : mesure en cours et message d'échec.
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');

  // La position vient de l'extérieur (inversion A ↔ B) : l'astre affiché la suit, le lieu choisi aussi.
  useEffect(() => { if (value?.body) setBody(value.body); }, [value?.body]);
  useEffect(() => {
    if (!value || value.body !== 'earth') { setPicked(null); return; }
    setPicked((p) => (p && p.lat === value.lat && p.lon === value.lon ? p : { name: value.name ?? '', lat: value.lat, lon: value.lon }));
  }, [value]);

  // Recherche d'un lieu de la Terre : après un court délai, annulée si la frappe continue.
  useEffect(() => {
    const q = input.trim();
    // Pas de recherche pour le nom du lieu déjà choisi : MUI le recopie dans le champ, ce n'est pas une frappe.
    if (body !== 'earth' || q.length < 2 || (picked && q === placeLabel(picked).trim())) { setOptions([]); setSearching(false); return undefined; }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => setOptions(Array.isArray(r?.items) ? r.items : []))
        .catch((e) => { if (e?.name !== 'AbortError') setOptions([]); })
        .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
    }, SEARCH_DELAY_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [input, body, picked]);

  const changeBody = (_, next) => {
    if (!next || next === body) return;
    setBody(next); setInput(''); setOptions([]); setPicked(null); setNotice('');
    onChange(null);
  };

  // La mesure part de l'appui lui-même (condition de Safari pour demander l'autorisation).
  const useMyPosition = async () => {
    if (locating) return;
    setLocating(true); setNotice('');
    try {
      const place = placeFromPosition(await locate());
      const point = place && earthPoint(place);
      if (!point) throw new Error('position illisible');
      onChange(point);
    } catch (e) {
      setNotice(geolocationMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const site = body === 'moon' ? (moonSites.find((s) => value && s.lat === value.lat && s.lon === value.lon) ?? null) : null;

  return (
    <Box role="group" aria-label={label}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>{label}</Typography>
        <ToggleButtonGroup exclusive size="small" value={body} onChange={changeBody} aria-label={`Astre — ${label}`}>
          <ToggleButton value="earth" sx={{ minHeight: 36, px: 1.5, textTransform: 'none' }}>Terre</ToggleButton>
          <ToggleButton value="moon" sx={{ minHeight: 36, px: 1.5, textTransform: 'none' }}>Lune</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {body === 'earth' ? (
        <Stack spacing={1}>
          <Autocomplete
            size="small" loading={searching} filterOptions={(x) => x} autoHighlight
            options={picked && !options.some((o) => o.lat === picked.lat && o.lon === picked.lon) ? [picked, ...options] : options}
            inputValue={input} onInputChange={(_, v) => setInput(v)} value={picked}
            getOptionLabel={placeLabel} isOptionEqualToValue={(o, v) => o.lon === v.lon && o.lat === v.lat}
            onChange={(_, place) => { setPicked(place); onChange(place ? earthPoint(place) : null); }}
            noOptionsText={input.trim().length < 2 ? 'Tapez au moins deux lettres' : 'Aucun lieu trouvé'}
            loadingText="Recherche…"
            renderInput={(params) => <TextField {...params} placeholder="Ville ou lieu de la Terre" inputProps={{ ...params.inputProps, 'aria-label': `Lieu — ${label}` }} />}
          />
          <Button onClick={useMyPosition} disabled={locating} startIcon={<MyLocationIcon />} sx={{ minHeight: 44, textTransform: 'none', alignSelf: 'flex-start' }}>
            {locating ? 'Localisation…' : 'Ma position'}
          </Button>
          {notice && <Typography role="alert" variant="caption" color="error">{notice}</Typography>}
        </Stack>
      ) : (
        <TextField
          select fullWidth size="small" value={site?.id ?? ''} label="Site d’alunissage Apollo"
          onChange={(e) => { const s = moonSites.find((x) => x.id === e.target.value); onChange(s ? moonPoint(s) : null); }}
          helperText={site?.info ?? (moonSites.length ? ' ' : 'Sites indisponibles : serveur injoignable.')}
        >
          {moonSites.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
        </TextField>
      )}

      {value && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>{formatCoords(value)}</Typography>}
    </Box>
  );
}
