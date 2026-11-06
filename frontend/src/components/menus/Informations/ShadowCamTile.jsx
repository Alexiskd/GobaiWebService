import { Box, Button, Typography } from '@mui/material';
import { fmtLat, fmtLon } from '@/lib/format';

/** Une zone ShadowCam : un clic place la caméra au-dessus de la zone. */
export function ShadowCamTile({ site, onGoMoon }) {
  return (
    <Box component="li">
      <Button
        variant="outlined"
        fullWidth
        onClick={() => onGoMoon?.({ lon: site.lon, lat: site.lat }, 30)}
        title={`${fmtLat(site.lat)} ${fmtLon(site.lon)}${site.season ? ` · éclairage indirect en ${site.season}` : ''}`}
        sx={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', py: 0.75, height: '100%' }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{site.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {site.error ? 'indisponible' : site.loading ? 'chargement…' : site.res ? `${site.res} m/px` : fmtLat(site.lat)}
        </Typography>
      </Button>
    </Box>
  );
}
