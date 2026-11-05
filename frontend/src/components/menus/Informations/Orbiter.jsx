import { fmtLat, fmtLon, nf } from '@/lib/format';
import { Hint } from '../../ui/Hint';

// Mêmes couleurs que les trajectoires des sondes dans la scène (moonOrbiters.jsx).
const ORBITER_COLORS = { lro: '#ffb347', 'chandrayaan-2': '#ff7eb6', danuri: '#7ee0ff', capstone: '#b6ff7e' };

const orbitLabel = (minutes) => (minutes < 600 ? `${nf(minutes, 1)} min` : `${nf(minutes / 1440, 2)} j`);

export function Orbiter({ o, onSelect }) {
  const color = ORBITER_COLORS[o.id] || '#ffffff';
  return (
    <li className={o.selected ? 'ac-orbiter is-selected' : 'ac-orbiter'} style={{ '--c': color }}>
      <button
        type="button"
        className="ac-orbiter-head"
        onClick={() => onSelect?.(o.id)}
        disabled={!o.ok}
        title={o.description}
        aria-pressed={Boolean(o.selected)}
      >
        <span className={`ac-dot dot ${o.id}`} aria-hidden="true" />
        <strong className="ac-orbiter-name">{o.name}</strong>
        <small className="ac-orbiter-agency">{o.agency}</small>
      </button>
      {o.ok ? (
        <>
          <dl className="ac-stats">
            <div><dt>Altitude</dt><dd>{nf(o.altitudeKm)} km</dd></div>
            <div><dt>Vitesse</dt><dd>{nf(o.speedKmS, 3)} km/s</dd></div>
            <div><dt>Période</dt><dd>{o.periodMin ? orbitLabel(o.periodMin) : '—'}</dd></div>
          </dl>
          {o.selected && (
            <Hint>
              Survole {fmtLat(o.lat)} {fmtLon(o.lon)} · {o.earthVisible ? 'en vue de la Terre' : 'derrière la Lune, sans contact direct avec la Terre'}
            </Hint>
          )}
        </>
      ) : (
        <Hint>{o.error || 'Pas de position pour l’instant'}</Hint>
      )}
    </li>
  );
}
