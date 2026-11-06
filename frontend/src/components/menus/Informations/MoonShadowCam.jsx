import { Box, Typography } from '@mui/material';
import { Hint } from '../../ui/Hint';
import { Section } from '../../ui/Section';
import { ShadowCamTile } from './ShadowCamTile';

export function MoonShadowCam({ items, onGoMoon }) {
  if (!items.length) return null;
  return (
    <Section title="Pôles vus par Danuri (ShadowCam)">
      <Hint>Fond des cratères jamais éclairés par le Soleil, photographié dans la lumière renvoyée par les reliefs voisins.</Hint>
      {['south', 'north'].map((pole) => {
        const list = items.filter((s) => s.pole === pole);
        if (!list.length) return null;
        return (
          <Box key={pole} sx={{ mb: 1.5 }}>
            <Typography component="h4" variant="subtitle2" sx={{ mb: 0.75 }}>{pole === 'south' ? 'Pôle Sud' : 'Pôle Nord'}</Typography>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 0.75 }}>
              {list.map((s) => <ShadowCamTile key={s.id} site={s} onGoMoon={onGoMoon} />)}
            </Box>
          </Box>
        );
      })}
    </Section>
  );
}
