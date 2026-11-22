// Vols et billets de train du trajet A → B (Terre seulement) : prix des vols (Aviasales) et horaires des trains (SNCF),
// avec un lien de réservation par proposition. Appel à la demande (bouton), pas à chaque changement de position.
import { useEffect, useRef, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Alert, Button, Chip, CircularProgress, Link, TextField } from '@/Fairing/kit';
import { fetchTickets } from '@/Computing/api';
import { formatDuration } from '@/Engine/shared/lib/app/trajet';

/** Date du jour + n jours, au format AAAA-MM-JJ, dans le fuseau de l'appareil (pas en UTC : à 0 h 30 à Paris, c'est déjà demain). */
const dayPlus = (n) => {
  const d = new Date(Date.now() + n * 86400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Heure lisible d'une date ISO (« 07:45 »), sans conversion de fuseau : l'heure locale du départ. */
const hhmm = (iso) => (typeof iso === 'string' && /T(\d{2}:\d{2})/.exec(iso)?.[1]) || '';

/** Prix lisible (« 49 € »). */
const money = (price, currency) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(price);

/** Correspondances lisibles. */
const transfersLabel = (n) => (n ? `${n} correspondance${n > 1 ? 's' : ''}` : 'Direct');

/** Bloc d'un mode (vols ou trains) : propositions, ou raison de leur absence. */
function Mode({ title, result, children }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex flex-row items-baseline justify-between gap-2">
        <h3 className="t-subtitle2 font-semibold m-0">{title}</h3>
        {result?.source && <span className="t-caption text-soft">{result.source}</span>}
      </div>
      {result?.status === 'ok' ? (
        <>
          {result.note && <span className="t-caption text-soft">{result.note}</span>}
          <ul className="flex flex-col gap-2 m-0 p-0 list-none">{children}</ul>
        </>
      ) : (
        <p className="t-body2 text-soft m-0">{result?.message ?? '—'}</p>
      )}
    </section>
  );
}

/** Une ligne de proposition : à gauche le trajet, à droite le prix ou la durée et le lien de réservation. */
function Offre({ main, sub, right, href, cta }) {
  return (
    <li className="flex flex-row gap-3 items-center justify-between p-3 border border-line rounded-[12px]">
      <div className="min-w-0 flex flex-col">
        <span className="t-body2 font-semibold tabular-nums">{main}</span>
        <span className="t-caption text-soft truncate">{sub}</span>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="t-body2 font-bold tabular-nums">{right}</span>
        <Link href={href} target="_blank" rel="noopener sponsored" className="t-caption">{cta}</Link>
      </div>
    </li>
  );
}

/** `a`, `b` : les deux lieux de la Terre du trajet. */
export function BilletsView({ a, b }) {
  const [date, setDate] = useState(() => dayPlus(0));
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const ctrl = useRef(null);

  // Autre départ ou autre arrivée : les billets affichés ne sont plus les bons.
  useEffect(() => { ctrl.current?.abort(); setState({ status: 'idle', data: null, error: null }); }, [a, b]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const search = () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState({ status: 'loading', data: null, error: null });
    fetchTickets(a, b, date, c.signal).then(
      (data) => setState({ status: 'done', data, error: null }),
      (error) => { if (error?.name !== 'AbortError') setState({ status: 'error', data: null, error }); },
    );
  };

  const flights = state.data?.flights;
  const trains = state.data?.trains;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-row gap-2 items-end flex-wrap">
        <TextField
          type="date" label="Date de départ" size="small" fullWidth={false} value={date}
          onChange={(e) => setDate(e.target.value)} inputProps={{ min: dayPlus(0), max: dayPlus(365) }}
        />
        <Button variant="outlined" onClick={search} disabled={!date || state.status === 'loading'} className="min-h-11 normal-case">
          {state.status === 'loading' ? 'Recherche…' : 'Vols et trains'}
        </Button>
      </div>

      {state.status === 'loading' && (
        <div className="flex flex-row gap-3 items-center"><CircularProgress size={20} /><p className="t-body2">Recherche des vols et des trains…</p></div>
      )}
      {state.status === 'error' && <Alert severity="warning">{state.error?.message || 'La recherche a échoué.'}</Alert>}

      {state.data && (
        <div className="flex flex-col gap-4">
          <Mode title="Vols" result={flights}>
            {flights?.from && flights?.to && (
              <li className="t-caption text-soft">{flights.from} → {flights.to}</li>
            )}
            {flights?.offers?.map((o) => (
              <Offre
                key={o.bookingUrl + o.departureAt}
                main={`${o.departureAt.slice(0, 10)} · ${hhmm(o.departureAt)} · ${o.originAirport} → ${o.destinationAirport}`}
                sub={[o.airline && `${o.airline} ${o.flightNumber}`.trim(), transfersLabel(o.transfers), o.durationMinutes ? formatDuration(o.durationMinutes) : ''].filter(Boolean).join(' · ')}
                right={money(o.price, o.currency)}
                href={o.bookingUrl}
                cta="Réserver"
              />
            ))}
          </Mode>

          <Mode title="Trains" result={trains}>
            {trains?.offers?.map((o) => (
              <Offre
                key={o.departureAt + o.arrivalAt}
                main={`${hhmm(o.departureAt)} → ${hhmm(o.arrivalAt)} · ${o.from} → ${o.to}`}
                sub={[o.trains.join(' + '), transfersLabel(o.transfers), o.co2Grams !== null ? `${(o.co2Grams / 1000).toFixed(1)} kg CO₂` : ''].filter(Boolean).join(' · ')}
                right={formatDuration(o.durationMinutes)}
                href={o.bookingUrl}
                cta="Billets sur SNCF Connect"
              />
            ))}
          </Mode>

          <div className="flex flex-row gap-2 flex-wrap">
            <Chip size="small" variant="outlined" label="Prix des vols : recherches récentes, à confirmer à la réservation" />
          </div>
        </div>
      )}
    </div>
  );
}
