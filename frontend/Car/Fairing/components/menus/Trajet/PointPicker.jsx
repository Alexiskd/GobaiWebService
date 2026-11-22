// Choix d'une position (départ ou arrivée) : un lieu de la Terre (recherche ou « Ma position ») ou un site de la Lune.
import { useEffect, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Button, MenuItem, TextField, ToggleButton, ToggleButtonGroup } from '@/Fairing/kit';
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
  // Liste des suggestions : ouverte ou non, et la suggestion mise en avant au clavier.
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Le champ affiche le lieu choisi quand il change.
  useEffect(() => { if (picked) setInput(placeLabel(picked)); }, [picked]);

  // La position vient de l'extérieur (inversion A ↔ B) : l'astre affiché la suit, le lieu choisi aussi.
  useEffect(() => { if (value?.body) setBody(value.body); }, [value?.body]);
  useEffect(() => {
    if (!value || value.body !== 'earth') { setPicked(null); return; }
    setPicked((p) => (p && p.lat === value.lat && p.lon === value.lon ? p : { name: value.name ?? '', lat: value.lat, lon: value.lon }));
  }, [value]);

  // Recherche d'un lieu de la Terre : après un court délai, annulée si la frappe continue.
  useEffect(() => {
    const q = input.trim();
    // Pas de recherche pour le nom du lieu déjà choisi : il est recopié dans le champ, ce n'est pas une frappe.
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

  // Suggestions affichées : le lieu choisi en tête s'il n'est pas déjà dans la liste.
  const shown = picked && !options.some((o) => o.lat === picked.lat && o.lon === picked.lon) ? [picked, ...options] : options;
  // choose : retient un lieu et le donne à l'appelant.
  const choose = (place) => { setPicked(place); setListOpen(false); onChange(place ? earthPoint(place) : null); };
  // Clavier : flèches pour parcourir, Entrée pour choisir, Échap pour refermer la liste.
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setListOpen(true); setActive((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && listOpen && shown[active]) { e.preventDefault(); choose(shown[active]); }
    else if (e.key === 'Escape' && listOpen) { e.stopPropagation(); setListOpen(false); }
  };
  // La liste se montre pendant la saisie, pas quand le champ affiche le lieu déjà choisi.
  const typing = listOpen && input.trim().length > 0 && !(picked && input.trim() === placeLabel(picked).trim());
  const site = body === 'moon' ? (moonSites.find((s) => value && s.lat === value.lat && s.lon === value.lon) ?? null) : null;

  return (
    <div role="group" aria-label={label}>
      <div className="flex flex-row gap-2 items-center justify-between mb-2">
        <span className="t-overline text-soft leading-[1.6]">{label}</span>
        <ToggleButtonGroup exclusive size="small" value={body} onChange={changeBody} aria-label={`Astre — ${label}`}>
          <ToggleButton value="earth" className="min-h-9 px-3 normal-case">Terre</ToggleButton>
          <ToggleButton value="moon" className="min-h-9 px-3 normal-case">Lune</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {body === 'earth' ? (
        <div className="flex flex-col gap-2">
          {/* Champ de recherche d'un lieu, avec ses suggestions en dessous (liste ancrée au champ). */}
          <div className="relative">
            <TextField
              size="small" value={input} placeholder="Ville ou lieu de la Terre"
              onChange={(e) => { setInput(e.target.value); setListOpen(true); setActive(0); }}
              onFocus={() => setListOpen(true)}
              onBlur={() => { setListOpen(false); if (picked) setInput(placeLabel(picked)); }}
              onKeyDown={onKeyDown}
              inputProps={{ 'aria-label': `Lieu — ${label}`, role: 'combobox', 'aria-expanded': typing, 'aria-autocomplete': 'list', autoComplete: 'off' }}
            />
            {typing && (
              <ul role="listbox" aria-label={`Suggestions — ${label}`} className="g-paper g-elev absolute z-10 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto p-1">
                {searching ? (
                  <li className="t-body2 text-soft px-3 py-2">Recherche…</li>
                ) : shown.length ? shown.map((o, i) => (
                  <li
                    key={`${o.lat}-${o.lon}-${i}`} role="option" aria-selected={i === active}
                    // Au pointeur enfoncé (avant la perte de focus du champ) : choisit la suggestion.
                    onPointerDown={(e) => { e.preventDefault(); choose(o); }}
                    onPointerMove={() => setActive(i)}
                    className={`t-body2 px-3 py-2 rounded-[8px] cursor-pointer ${i === active ? 'bg-hover' : ''}`}
                  >
                    {placeLabel(o)}
                  </li>
                )) : (
                  <li className="t-body2 text-soft px-3 py-2">{input.trim().length < 2 ? 'Tapez au moins deux lettres' : 'Aucun lieu trouvé'}</li>
                )}
              </ul>
            )}
          </div>
          <Button onClick={useMyPosition} disabled={locating} startIcon={<MyLocationIcon />} className="min-h-11 normal-case self-start">
            {locating ? 'Localisation…' : 'Ma position'}
          </Button>
          {notice && <span role="alert" className="t-caption text-error">{notice}</span>}
        </div>
      ) : (
        <TextField
          select fullWidth size="small" value={site?.id ?? ''} label="Site d’alunissage Apollo"
          onChange={(e) => { const s = moonSites.find((x) => x.id === e.target.value); onChange(s ? moonPoint(s) : null); }}
          helperText={site?.info ?? (moonSites.length ? ' ' : 'Sites indisponibles : serveur injoignable.')}
        >
          {moonSites.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
        </TextField>
      )}

      {value && <span className="t-caption text-soft block mt-1 tabular-nums">{formatCoords(value)}</span>}
    </div>
  );
}
