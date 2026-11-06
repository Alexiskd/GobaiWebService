import { Box, ButtonBase, Card, Stack, Typography } from '@mui/material';
import { fmtLat, fmtLon, nf } from '@/lib/format';
import { Hint } from '../../ui/Hint';

// Mêmes couleurs que les trajectoires des sondes dans la scène (moonOrbiters.jsx).
const ORBITER_COLORS = { lro: '#ffb347', 'chandrayaan-2': '#ff7eb6', danuri: '#7ee0ff', capstone: '#b6ff7e' };

const orbitLabel = (minutes) => (minutes < 600 ? `${nf(minutes, 1)} min` : `${nf(minutes / 1440, 2)} j`);

const Stat = ({ term, value }) => (
  <Box>
    <Typography component="dt" variant="caption" color="text.secondary">{term}</Typography>
    <Typography component="dd" variant="body2" sx={{ m: 0 }}>{value}</Typography>
  </Box>
);

export function Orbiter({ o, onSelect }) {
  const color = ORBITER_COLORS[o.id] || '#ffffff';
  return (
    <Card component="li" variant="outlined" sx={{ bgcolor: 'transparent', backdropFilter: 'none', borderColor: o.selected ? color : 'divider' }}>
      <ButtonBase
        onClick={() => onSelect?.(o.id)}
        disabled={!o.ok}
        title={o.description}
        aria-pressed={Boolean(o.selected)}
        sx={{ width: '100%', justifyContent: 'flex-start', gap: 1, px: 1.5, pt: 1, pb: 0.5, textAlign: 'left', '&.Mui-disabled': { opacity: 0.7 } }}
      >
        <Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flex: 'none' }} />
        <Typography variant="body2" component="strong" sx={{ fontWeight: 600 }}>{o.name}</Typography>
        <Typography variant="caption" color="text.secondary">{o.agency}</Typography>
      </ButtonBase>
      <Box sx={{ px: 1.5, pb: 1 }}>
        {o.ok ? (
          <>
            <Stack component="dl" direction="row" spacing={2} sx={{ m: 0 }}>
              <Stat term="Altitude" value={`${nf(o.altitudeKm)} km`} />
              <Stat term="Vitesse" value={`${nf(o.speedKmS, 3)} km/s`} />
              <Stat term="Période" value={o.periodMin ? orbitLabel(o.periodMin) : '—'} />
            </Stack>
            {o.selected && (
              <Hint>
                Survole {fmtLat(o.lat)} {fmtLon(o.lon)} · {o.earthVisible ? 'en vue de la Terre' : 'derrière la Lune, sans contact direct avec la Terre'}
              </Hint>
            )}
          </>
        ) : (
          <Hint>{o.error || 'Pas de position pour l’instant'}</Hint>
        )}
      </Box>
    </Card>
  );
}
