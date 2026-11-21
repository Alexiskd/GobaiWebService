// Fenêtre « Trajet » : temps de trajet entre deux positions de la Terre ou de la Lune. Aucun tracé d'itinéraire.
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { computeItinerary, computeTrip, fetchMoonSites } from '@/Computing/api';
import { PROVIDERS } from '@/Engine/shared/lib/app/assistantSession';
import { formatDuration, formatKm, isPoint, pointLabel, tripSignature } from '@/Engine/shared/lib/app/trajet';
import { useAssistantSession } from '@/Fairing/hooks/useAssistantSession';
import { useViewport } from '@/Fairing/hooks/useViewport';
import { PanelHeader } from '../../ui/PanelHeader.jsx';
import { RouteIcon, SwapVertIcon } from '../../ui/icons.jsx';
import { ItineraireView } from './ItineraireView.jsx';
import { PointPicker } from './PointPicker.jsx';

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
 * Fenêtre « Trajet » (même en-tête et même style que les autres fenêtres). Le départ (A) et l'arrivée (B) se posent
 * sur la Terre (recherche, « Ma position ») ou sur la Lune (sites Apollo). Dès que les deux sont posés, et à chaque
 * changement, la durée est recalculée toute seule :
 *  - Terre → Lune : trajet au sol jusqu'au site de lancement le plus proche (estimé par le modèle), puis 3 jours de vol ;
 *  - Lune → Terre : 3 jours, fixés par le serveur ;
 *  - tout autre trajet : estimé par le modèle de l'utilisateur (Claude ou Mistral) avec sa clé, sans tracé.
 * `onOpenAssistant` : ouvre la connexion de l'assistant, où l'on saisit sa clé.
 */
export function Trajet({ open, onClose, onOpenAssistant }) {
  const { compact } = useViewport();
  const session = useAssistantSession();
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [moonSites, setMoonSites] = useState([]);
  // Calcul : 'idle' | 'loading' | 'done' | 'error', avec son résultat ou son erreur.
  const [trip, setTrip] = useState({ status: 'idle', data: null, error: null });
  // Recalcul demandé à la main (bouton « Recalculer ») : change la signature.
  const [nonce, setNonce] = useState(0);
  // Itinéraire demandé par le bouton « Itinéraire » : 'idle' | 'loading' | 'done' | 'error'.
  const [itin, setItin] = useState({ status: 'idle', data: null, error: null });
  const provider = session?.provider ?? DEFAULT_PROVIDER;
  const signature = tripSignature(a, b, provider);
  const apiKey = session?.key ?? '';

  // Sites Apollo : lus dans le backend à l'ouverture.
  useEffect(() => {
    if (!open || moonSites.length) return undefined;
    const ctrl = new AbortController();
    fetchMoonSites(ctrl.signal).then((r) => setMoonSites(Array.isArray(r?.items) ? r.items : []), () => {});
    return () => ctrl.abort();
  }, [open, moonSites.length]);

  // Recalcul automatique : à chaque nouveau départ, nouvelle arrivée ou nouvelle connexion.
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
    // `a`, `b` et le fournisseur sont résumés par la signature ; la clé relance après une connexion ; `nonce` relance à la demande.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature, apiKey, nonce]);

  // Un autre départ, une autre arrivée ou une autre connexion : l'itinéraire affiché n'est plus le bon.
  useEffect(() => { setItin({ status: 'idle', data: null, error: null }); }, [signature]);
  // Fenêtre fermée : requête d'itinéraire abandonnée.
  const itinCtrl = useRef(null);
  useEffect(() => { if (!open) { itinCtrl.current?.abort(); setItin({ status: 'idle', data: null, error: null }); } }, [open]);

  // Itinéraire : le modèle de l'utilisateur le découpe en étapes (un moyen de locomotion chacune), que les moteurs modélisent.
  const planItinerary = () => {
    itinCtrl.current?.abort();
    const ctrl = new AbortController();
    itinCtrl.current = ctrl;
    setItin({ status: 'loading', data: null, error: null });
    computeItinerary(provider, apiKey, a, b, ctrl.signal).then(
      (data) => setItin({ status: 'done', data, error: null }),
      (error) => { if (error?.name !== 'AbortError') setItin({ status: 'error', data: null, error }); },
    );
  };

  const swap = () => { setA(b); setB(a); };
  const ready = isPoint(a) && isPoint(b);
  const data = trip.data;
  const failure = trip.status === 'error' ? describeError(trip.error, session) : null;
  // L'itinéraire n'existe qu'entre deux lieux de la Terre.
  const onEarth = ready && a.body === 'earth' && b.body === 'earth';
  const itinFailure = itin.status === 'error' ? describeError(itin.error, session) : null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth={itin.data ? 'sm' : 'xs'} fullWidth aria-label="Temps de trajet">
      <PanelHeader kicker="Terre et Lune" title="Temps de trajet" onClose={onClose} />
      <DialogContent>
        <Stack spacing={2}>
          <PointPicker label="Départ (A)" value={a} onChange={setA} moonSites={moonSites} />
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Tooltip title="Inverser le départ et l’arrivée">
              <span>
                <IconButton onClick={swap} disabled={!a && !b} aria-label="Inverser le départ et l’arrivée" sx={{ width: 44, height: 44 }}><SwapVertIcon /></IconButton>
              </span>
            </Tooltip>
          </Box>
          <PointPicker label="Arrivée (B)" value={b} onChange={setB} moonSites={moonSites} />

          <Box role="status" aria-live="polite" sx={{ minHeight: 120, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            {!ready && (
              <Typography color="text.secondary" variant="body2">
                Choisissez un départ et une arrivée : la durée se calcule toute seule, sans tracé d’itinéraire. Terre → Lune : trajet jusqu’au site de lancement le plus proche, puis 3 jours de vol.
              </Typography>
            )}
            {ready && trip.status === 'loading' && !data && (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CircularProgress size={20} /><Typography variant="body2">Calcul du trajet…</Typography>
              </Stack>
            )}
            {ready && data && !failure && (
              <Stack spacing={1} sx={{ opacity: trip.status === 'loading' ? 0.5 : 1, transition: 'opacity 150ms' }}>
                <Typography variant="caption" color="text.secondary">{pointLabel(a)} → {pointLabel(b)}</Typography>
                <Typography component="p" sx={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(data.durationMinutes)}</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                  <Chip size="small" color={data.source === 'fixe' ? 'default' : 'primary'} variant="outlined"
                    label={data.source === 'fixe' ? (data.legs ? 'Vol fixe : 3 j' : 'Valeur fixe Apollo') : `Calculé par ${PROVIDERS[data.provider]?.label ?? 'votre modèle'}`} />
                  {data.mode && <Chip size="small" variant="outlined" label={data.mode} />}
                  <Chip size="small" variant="outlined" label={data.distanceKind === 'terre-lune' ? `≈ ${formatKm(data.distanceKm)} (moyenne Terre–Lune)` : formatKm(data.distanceKm)} />
                </Stack>
                {data.legs?.length > 0 && (
                  <Stack component="ul" spacing={0.5} aria-label="Étapes du trajet" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {data.legs.map((leg) => (
                      <Stack component="li" key={leg.kind} direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                        <Typography variant="body2">{leg.label}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatDuration(leg.minutes)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
                {data.summary && <Typography variant="body2" color="text.secondary">{data.summary}</Typography>}
                {data.needsKey && onOpenAssistant && (
                  <Button onClick={() => { onClose(); onOpenAssistant(); }} sx={{ minHeight: 44, textTransform: 'none', alignSelf: 'flex-start' }}>Connecter ma clé pour ajouter le trajet au sol</Button>
                )}
              </Stack>
            )}
            {failure && (
              <Stack spacing={1}>
                <Alert severity="warning" sx={{ alignItems: 'center' }}>{failure.text}</Alert>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                  {failure.connect && onOpenAssistant && <Button onClick={() => { onClose(); onOpenAssistant(); }} sx={{ minHeight: 44, textTransform: 'none' }}>Me connecter avec ma clé</Button>}
                  {failure.billingUrl && <Link href={failure.billingUrl} target="_blank" rel="noopener noreferrer" sx={{ alignSelf: 'center' }}>Ajouter un moyen de paiement</Link>}
                  {!failure.connect && !failure.billingUrl && <Button onClick={() => setNonce((n) => n + 1)} sx={{ minHeight: 44, textTransform: 'none' }}>Recalculer</Button>}
                </Stack>
              </Stack>
            )}
          </Box>

          {/* Itinéraire : étapes par moyen de locomotion, modélisées en 3D (véhicules volants) ou en 2D (au sol). */}
          <Stack spacing={1.5}>
            <Button
              variant="outlined" startIcon={<RouteIcon />} onClick={planItinerary} disabled={!onEarth || itin.status === 'loading'}
              sx={{ minHeight: 44, textTransform: 'none', alignSelf: 'flex-start' }}
            >
              {itin.status === 'loading' ? 'Calcul de l’itinéraire…' : itin.data ? 'Recalculer l’itinéraire' : 'Itinéraire'}
            </Button>
            {ready && !onEarth && <Typography variant="caption" color="text.secondary">L’itinéraire est disponible entre deux lieux de la Terre.</Typography>}
            {itin.status === 'loading' && <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><CircularProgress size={20} /><Typography variant="body2">Le modèle prépare les étapes…</Typography></Stack>}
            {itinFailure && (
              <Alert severity="warning" sx={{ alignItems: 'center' }}>
                {itinFailure.text}
                {itinFailure.connect && onOpenAssistant && <Button size="small" onClick={() => { onClose(); onOpenAssistant(); }} sx={{ ml: 1 }}>Me connecter</Button>}
                {itinFailure.billingUrl && <Link href={itinFailure.billingUrl} target="_blank" rel="noopener noreferrer" sx={{ ml: 1 }}>Ajouter un moyen de paiement</Link>}
              </Alert>
            )}
            {itin.data && <ItineraireView itinerary={itin.data} />}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {session
              ? `Les trajets hors Apollo sont recalculés automatiquement par ${PROVIDERS[provider]?.label ?? 'votre modèle'}, avec votre clé : elle reste dans ce navigateur.`
              : 'Les trajets hors Apollo sont calculés par votre modèle Claude ou Mistral : connectez-vous avec votre clé depuis le bouton Assistant.'}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
