// Barre « Trajet » : barre d'outils en haut de l'écran pour le temps de trajet entre deux positions de la Terre ou de la
// Lune. Aucun tracé d'itinéraire. Elle remplace l'ancienne fenêtre : départ (A), inversion, arrivée (B), puis la durée.
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Link, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { computeTrip, fetchMoonSites } from '@/Computing/api';
import { PROVIDERS } from '@/Engine/shared/lib/app/assistantSession';
import { formatDuration, formatKm, isPoint, tripSignature } from '@/Engine/shared/lib/app/trajet';
import { useAssistantSession } from '@/Fairing/hooks/useAssistantSession';
import { useViewport } from '@/Fairing/hooks/useViewport';
import { HUD_TOP, PANEL_W, edge } from '@/Fairing/theme/layout';
import { safe } from '@/Fairing/theme/mediaQueries';
import { CloseIcon, SwapVertIcon } from '../ui/icons.jsx';
import { TrajetPointField } from './TrajetPointField.jsx';

/** Délai entre un changement de position et le recalcul automatique (ms) : évite un appel par touche ou par clic. */
const RECALC_DELAY_MS = 500;
/** Fournisseur de repli quand personne n'est connecté : le serveur ne s'en sert que pour le trajet fixé Terre ↔ Apollo. */
const DEFAULT_PROVIDER = 'claude';

/** Message et action pour un refus du serveur ou du fournisseur. */
function describeError(error, session) {
  if (error?.code === 'invalid_key' && !session) {
    return { text: 'Ce trajet est calculé par votre modèle : connectez-vous avec votre clé Claude ou Mistral (bouton Assistant).', connect: true };
  }
  if (error?.code === 'invalid_key') return { text: error.message, connect: true };
  if (error?.code === 'billing') return { text: error.message, billingUrl: error.billingUrl };
  return { text: error?.message || 'Le calcul du trajet a échoué.' };
}

/**
 * `open` : barre affichée ; `onClose` : la ferme ; `onOpenAssistant` : ouvre la connexion de l'assistant (saisie de la clé).
 * Calcul automatique dès que A et B sont posés, et à chaque changement :
 *  - Terre → Lune : trajet au sol jusqu'au site de lancement le plus proche, puis 3 jours de vol ;
 *  - Lune → Terre : 3 jours, fixés par le serveur ;
 *  - autre trajet : estimé par le modèle de l'utilisateur avec sa clé.
 */
export function TrajetBar({ open, onClose, onOpenAssistant }) {
  const { compact } = useViewport();
  const session = useAssistantSession();
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [moonSites, setMoonSites] = useState([]);
  const [trip, setTrip] = useState({ status: 'idle', data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const provider = session?.provider ?? DEFAULT_PROVIDER;
  const apiKey = session?.key ?? '';
  const signature = tripSignature(a, b, provider);

  // Sites Apollo : lus dans le backend à la première ouverture.
  useEffect(() => {
    if (!open || moonSites.length) return undefined;
    const ctrl = new AbortController();
    fetchMoonSites(ctrl.signal).then((r) => setMoonSites(Array.isArray(r?.items) ? r.items : []), () => {});
    return () => ctrl.abort();
  }, [open, moonSites.length]);

  // Recalcul automatique : nouveau départ, nouvelle arrivée ou nouvelle connexion.
  useEffect(() => {
    if (!open || !signature) { setTrip({ status: 'idle', data: null, error: null }); return undefined; }
    const ctrl = new AbortController();
    setTrip((t) => ({ status: 'loading', data: t.data, error: null }));
    const timer = setTimeout(() => {
      computeTrip(provider, apiKey, a, b, ctrl.signal).then(
        (data) => setTrip({ status: 'done', data, error: null }),
        (error) => { if (error?.name !== 'AbortError') setTrip({ status: 'error', data: null, error }); },
      );
    }, RECALC_DELAY_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // `a`, `b` et le fournisseur sont résumés par la signature ; la clé relance après une connexion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature, apiKey, nonce]);

  if (!open) return null;

  const swap = () => { setA(b); setB(a); };
  const ready = isPoint(a) && isPoint(b);
  const data = trip.data;
  const failure = trip.status === 'error' ? describeError(trip.error, session) : null;
  const connect = () => { onClose(); onOpenAssistant?.(); };

  return (
    <Paper
      component="section" elevation={4} role="toolbar" aria-label="Temps de trajet" data-hud="trip"
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.hudPanel,
        // Ordinateur : centrée en haut, entre le bandeau du titre (à gauche) et le panneau d'informations (à droite).
        // Téléphone : sur toute la largeur, sous la zone du titre.
        ...(compact
          ? { top: `calc(${HUD_TOP} + 8px)`, left: edge('left', 8), right: edge('right', 8), maxHeight: `calc(100dvh - ${HUD_TOP} - ${safe('bottom')} - 80px)`, overflowY: 'auto' }
          : { top: edge('top', 12), left: '50%', transform: 'translateX(-50%)', width: `clamp(340px, calc(100vw - 2 * (${PANEL_W} + 100px)), 860px)` }),
        display: 'flex', flexDirection: 'column', gap: 1, p: 1,
      }}
    >
      <Stack direction={compact ? 'column' : 'row'} spacing={compact ? 1 : 0.5} sx={{ alignItems: compact ? 'stretch' : 'center' }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}><TrajetPointField label="Départ" letter="A" value={a} onChange={setA} moonSites={moonSites} /></Box>
          <Tooltip title="Inverser le départ et l’arrivée">
            <span>
              <IconButton onClick={swap} disabled={!a && !b} aria-label="Inverser le départ et l’arrivée" sx={{ width: 36, height: 36, transform: compact ? 'none' : 'rotate(90deg)' }}><SwapVertIcon fontSize="small" /></IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 0 }}><TrajetPointField label="Arrivée" letter="B" value={b} onChange={setB} moonSites={moonSites} /></Box>
        </Stack>
        {!compact && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}
        <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'flex-start' : 'center', minWidth: compact ? 0 : 96 }}>
          {!ready && <Typography variant="caption" color="text.secondary">Durée : choisissez A et B</Typography>}
          {ready && trip.status === 'loading' && !data && <CircularProgress size={18} aria-label="Calcul du trajet" />}
          {ready && data && !failure && (
            <Typography component="p" sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: trip.status === 'loading' ? 0.5 : 1, transition: 'opacity 150ms' }}>{formatDuration(data.durationMinutes)}</Typography>
          )}
        </Box>
        <Tooltip title="Fermer">
          <IconButton onClick={onClose} aria-label="Fermer la barre de trajet" sx={{ width: 36, height: 36, alignSelf: compact ? 'flex-end' : 'center', order: compact ? -1 : 0, position: compact ? 'absolute' : 'static', top: compact ? 4 : 'auto', right: compact ? 4 : 'auto' }}><CloseIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>

      {ready && data && !failure && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center', px: 0.5 }}>
          <Chip size="small" color={data.source === 'fixe' ? 'default' : 'primary'} variant="outlined"
            label={data.source === 'fixe' ? (data.legs ? 'Vol fixe : 3 j' : 'Valeur fixe Apollo') : `Calculé par ${PROVIDERS[data.provider]?.label ?? 'votre modèle'}`} />
          {data.mode && <Chip size="small" variant="outlined" label={data.mode} />}
          <Chip size="small" variant="outlined" label={data.distanceKind === 'terre-lune' ? `≈ ${formatKm(data.distanceKm)} (moyenne Terre–Lune)` : formatKm(data.distanceKm)} />
          {data.legs?.map((leg) => (
            <Typography key={leg.kind} variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{leg.label} : <b>{formatDuration(leg.minutes)}</b></Typography>
          ))}
          {data.needsKey && onOpenAssistant && <Button size="small" onClick={connect} sx={{ textTransform: 'none' }}>Connecter ma clé pour ajouter le trajet au sol</Button>}
        </Stack>
      )}
      {failure && (
        <Alert severity="warning" sx={{ alignItems: 'center', py: 0 }}
          action={(
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              {failure.connect && onOpenAssistant && <Button size="small" onClick={connect}>Me connecter</Button>}
              {failure.billingUrl && <Link href={failure.billingUrl} target="_blank" rel="noopener noreferrer" variant="body2">Paiement</Link>}
              {!failure.connect && !failure.billingUrl && <Button size="small" onClick={() => setNonce((n) => n + 1)}>Recalculer</Button>}
            </Stack>
          )}>
          {failure.text}
        </Alert>
      )}
    </Paper>
  );
}
