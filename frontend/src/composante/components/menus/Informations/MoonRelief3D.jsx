// Relief 3D de la Lune, dans la section « Caractéristiques » de la Lune : avancement du préchargement des tuiles de
// relief dans BP (la base PostgreSQL du serveur) et téléchargement du modèle 3D du relief (.glb).
// Hooks de React.
import { useEffect, useState } from 'react';
// Composants MUI.
import { Box, Button, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
// Lecture JSON de l'API et base des routes.
import { API_BASE, get } from '@/moteur/api/client';

// Intervalle de relecture de l'état pendant le préchargement.
const POLL_MS = 5000;

/** Section « Relief 3D » de la Lune. */
export function MoonRelief3D() {
  // État renvoyé par GET /tiles/moon-relief/status, ou null tant qu'il n'est pas lu ; erreur éventuelle.
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);
  // Réglages du modèle : finesse de la grille et exagération du relief.
  const [cols, setCols] = useState(720);
  const [exaggeration, setExaggeration] = useState(1);

  // Lit l'état, puis le relit toutes les 5 s tant que le préchargement tourne.
  useEffect(() => {
    let alive = true, timer = null;
    const ctrl = new AbortController();
    const read = async () => {
      try {
        const s = await get('/tiles/moon-relief/status', { signal: ctrl.signal });
        if (!alive) return;
        setStatus(s); setError(false);
        if (s?.preload?.running) timer = setTimeout(read, POLL_MS);
      } catch {
        if (alive) setError(true);
      }
    };
    read();
    return () => { alive = false; ctrl.abort(); if (timer) clearTimeout(timer); };
  }, []);

  // Avancement en pourcentage.
  const p = status?.preload;
  const pct = p?.total ? Math.round((p.stored / p.total) * 100) : 0;
  // Adresse du modèle avec ses réglages.
  const href = `${API_BASE}/tiles/moon-relief/model.glb?cols=${cols}&exaggeration=${exaggeration}`;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="subtitle2" component="h3">Relief 3D (BP)</Typography>
      {/* État du préchargement. */}
      {error && <Typography variant="body2" color="text.secondary">État du relief indisponible.</Typography>}
      {status && !status.database && (
        <Typography variant="body2" color="text.secondary">Base BP non branchée : le relief est servi sans préchargement.</Typography>
      )}
      {status?.database && (
        <Box sx={{ mt: 0.5 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {p.running ? 'Préchargement…' : pct >= 100 ? 'Préchargé' : 'En attente'} · niveaux 0 à {p.maxZoom}
            </Typography>
            <Typography variant="body2">{p.stored.toLocaleString('fr-FR')} / {p.total.toLocaleString('fr-FR')}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, height: 6, borderRadius: 3 }} aria-label="Préchargement du relief de la Lune" />
          {p.failed > 0 && <Typography variant="caption" color="text.secondary">{p.failed} tuile(s) en échec, retentées au prochain démarrage.</Typography>}
        </Box>
      )}
      {/* Téléchargement du modèle 3D. */}
      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        <TextField select size="small" label="Finesse" value={cols} onChange={(e) => setCols(Number(e.target.value))} sx={{ flex: 1 }}>
          <MenuItem value={360}>1° (≈ 30 km)</MenuItem>
          <MenuItem value={720}>0,5° (≈ 15 km)</MenuItem>
          <MenuItem value={1440}>0,25° (≈ 8 km)</MenuItem>
        </TextField>
        <TextField select size="small" label="Relief" value={exaggeration} onChange={(e) => setExaggeration(Number(e.target.value))} sx={{ flex: 1 }}>
          {[1, 5, 10, 20].map((x) => <MenuItem key={x} value={x}>× {x}</MenuItem>)}
        </TextField>
      </Stack>
      <Button
        fullWidth variant="outlined" sx={{ mt: 1 }} component="a" href={href} download
        disabled={Boolean(status?.database) && !status.model?.ready}
      >
        Télécharger le modèle 3D (.glb)
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Altitudes LOLA (LRO, NASA Moon Trek), sphère de 1 737,4 km, unités en km. S’ouvre dans Blender (Fichier › Importer › glTF).
        {status?.database && !status.model?.ready ? ' Disponible dès que le niveau 3 est préchargé.' : ''}
      </Typography>
    </Box>
  );
}
