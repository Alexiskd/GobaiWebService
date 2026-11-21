// Champ d'une position (départ ou arrivée) de la barre « Trajet » : un seul champ qui propose « Ma position », les
// sites Apollo de la Lune et, pendant la frappe, les lieux de la Terre trouvés par la recherche du serveur.
import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, TextField, Typography } from '@mui/material';
import { searchPlaces } from '@/Computing/api';
import { geolocationMessage, locate, placeFromPosition } from '@/Engine/shared/lib/device/homePlace';
import { earthPoint, formatCoords, moonPoint } from '@/Engine/shared/lib/app/trajet';
import { MyLocationIcon } from '../ui/icons.jsx';

/** Délai avant de lancer la recherche, pendant la frappe (ms). */
const SEARCH_DELAY_MS = 300;
/** Option « Ma position » : la mesure part de l'appui sur l'option. */
const ME = { key: 'me', group: 'Ma position', name: 'Ma position' };

/** Texte sans accents ni majuscules, pour comparer ce qui est tapé au nom d'un site. */
const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Libellé d'une option : le nom, puis son contexte (région, pays). */
const labelOf = (o) => (o?.context ? `${o.name} — ${o.context}` : o?.name ?? '');

/**
 * `label` : « Départ » ou « Arrivée » ; `letter` : « A » ou « B » ; `value` : { body, lat, lon, name? } ou null ;
 * `onChange` reçoit la position choisie (ou null) ; `moonSites` : les sites Apollo servis par le backend.
 */
export function TrajetPointField({ label, letter, value, onChange, moonSites }) {
  // Option choisie, texte tapé, lieux trouvés, recherche et mesure en cours, message d'échec de la mesure.
  const [picked, setPicked] = useState(null);
  const [input, setInput] = useState('');
  const [found, setFound] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');

  // La position vient de l'extérieur (inversion A ↔ B, remise à zéro) : l'option choisie la suit.
  useEffect(() => {
    if (!value) { setPicked(null); return; }
    setPicked((p) => (p?.point && p.point.lat === value.lat && p.point.lon === value.lon ? p
      : { key: `v-${value.lat}-${value.lon}`, group: value.body === 'moon' ? 'Lune' : 'Terre', name: value.name || formatCoords(value), point: value }));
  }, [value]);

  // Recherche d'un lieu de la Terre : après un court délai, annulée si la frappe continue.
  useEffect(() => {
    const q = input.trim();
    // Pas de recherche pour le nom déjà choisi : MUI le recopie dans le champ, ce n'est pas une frappe.
    if (q.length < 2 || (picked && q === labelOf(picked).trim())) { setFound([]); setSearching(false); return undefined; }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => setFound((Array.isArray(r?.items) ? r.items : []).map((p, i) => ({ key: `t-${i}-${p.lat}-${p.lon}`, group: 'Terre', name: p.name, context: p.context, point: earthPoint(p) })).filter((o) => o.point)))
        .catch((e) => { if (e?.name !== 'AbortError') setFound([]); })
        .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
    }, SEARCH_DELAY_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [input, picked]);

  // Options : sans frappe, « Ma position » et les sites Apollo ; avec une frappe, les sites qui correspondent, puis les lieux.
  const options = useMemo(() => {
    const sites = moonSites.map((s) => ({ key: `l-${s.id}`, group: 'Lune', name: s.name, context: s.info, point: moonPoint(s) })).filter((o) => o.point);
    const q = fold(input.trim());
    const list = q.length < 2 ? [ME, ...sites] : [...sites.filter((o) => fold(o.name).includes(q)), ...found];
    return picked && !list.some((o) => o.key === picked.key) ? [picked, ...list] : list;
  }, [moonSites, found, input, picked]);

  // La mesure part de l'appui lui-même (condition de Safari pour demander l'autorisation).
  const useMyPosition = async () => {
    if (locating) return;
    setLocating(true); setNotice('');
    try {
      const place = placeFromPosition(await locate());
      const point = place && earthPoint(place);
      if (!point) throw new Error('position illisible');
      setPicked({ key: `v-${point.lat}-${point.lon}`, group: 'Terre', name: point.name, point });
      onChange(point);
    } catch (e) {
      setNotice(geolocationMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const choose = (_, option) => {
    setNotice('');
    if (!option) { setPicked(null); onChange(null); return; }
    if (option.key === 'me') { useMyPosition(); return; }
    setPicked(option);
    onChange(option.point);
  };

  return (
    <Autocomplete
      size="small" fullWidth autoHighlight openOnFocus
      options={options} loading={searching || locating} filterOptions={(x) => x} groupBy={(o) => o.group}
      inputValue={input} onInputChange={(_, v) => setInput(v)} value={picked} onChange={choose}
      getOptionLabel={labelOf} isOptionEqualToValue={(o, v) => o.key === v.key}
      noOptionsText={input.trim().length < 2 ? 'Tapez au moins deux lettres' : 'Aucun lieu trouvé'}
      loadingText={locating ? 'Localisation…' : 'Recherche…'}
      renderOption={(props, o) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            {o.key === 'me' && <MyLocationIcon fontSize="small" sx={{ mr: 1 }} />}
            <span>{o.name}{o.context && <Typography component="span" variant="caption" color="text.secondary"> — {o.context}</Typography>}</span>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params} placeholder={label} error={Boolean(notice)} helperText={notice || undefined}
          slotProps={{
            htmlInput: { ...params.inputProps, 'aria-label': `${label} (${letter})` },
            input: { ...params.InputProps, startAdornment: (<><Typography component="span" aria-hidden="true" sx={{ mr: 0.75, fontWeight: 700, color: 'primary.main' }}>{letter}</Typography>{params.InputProps.startAdornment}</>) },
          }}
        />
      )}
    />
  );
}
