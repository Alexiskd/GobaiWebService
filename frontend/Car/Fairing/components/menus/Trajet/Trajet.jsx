// Fenêtre « Trajet » : temps de trajet entre deux positions de la Terre ou de la Lune. Aucun tracé d'itinéraire.
import { useEffect, useRef, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Alert, Button, Chip, CircularProgress, Dialog, DialogContent, IconButton, Link, Tooltip } from '@/Fairing/kit';
import { computeItinerary, computeTrip, fetchMoonSites } from '@/Computing/api';
import { PROVIDERS } from '@/Engine/shared/lib/app/assistantSession';
import { formatDuration, formatKm, isPoint, pointLabel, tripSignature } from '@/Engine/shared/lib/app/trajet';
import { useAssistantSession } from '@/Fairing/hooks/useAssistantSession';
import { useViewport } from '@/Fairing/hooks/useViewport';
import { PanelHeader } from '../../ui/PanelHeader.jsx';
import { RouteIcon, SwapVertIcon } from '../../ui/icons.jsx';
import { BilletsView } from './BilletsView.jsx';
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
        <div className="flex flex-col gap-4">
          <PointPicker label="Départ (A)" value={a} onChange={setA} moonSites={moonSites} />
          <div className="flex justify-center">
            <Tooltip title="Inverser le départ et l’arrivée">
              <span>
                <IconButton onClick={swap} disabled={!a && !b} aria-label="Inverser le départ et l’arrivée" className="w-11 h-11"><SwapVertIcon /></IconButton>
              </span>
            </Tooltip>
          </div>
          <PointPicker label="Arrivée (B)" value={b} onChange={setB} moonSites={moonSites} />

          <div role="status" aria-live="polite" className="min-h-30 p-4 border border-line rounded-[16px]">
            {!ready && (
              <p className="t-body2 text-soft">
                Choisissez un départ et une arrivée : la durée se calcule toute seule, sans tracé d’itinéraire. Terre → Lune : trajet jusqu’au site de lancement le plus proche, puis 3 jours de vol.
              </p>
            )}
            {ready && trip.status === 'loading' && !data && (
              <div className="flex flex-row gap-3 items-center">
                <CircularProgress size={20} /><p className="t-body2">Calcul du trajet…</p>
              </div>
            )}
            {ready && data && !failure && (
              <div className={`flex flex-col gap-2 ${trip.status === 'loading' ? 'opacity-50' : 'opacity-100'} [transition:opacity_150ms]`}>
                <span className="t-caption text-soft">{pointLabel(a)} → {pointLabel(b)}</span>
                <p className="t-body1 text-[40px] font-bold leading-[1.1] tabular-nums">{formatDuration(data.durationMinutes)}</p>
                <div className="flex flex-row gap-2 flex-wrap gap-y-1">
                  <Chip size="small" color={data.source === 'fixe' ? 'default' : 'primary'} variant="outlined"
                    label={data.source === 'fixe' ? (data.legs ? 'Vol fixe : 3 j' : 'Valeur fixe Apollo') : `Calculé par ${PROVIDERS[data.provider]?.label ?? 'votre modèle'}`} />
                  {data.mode && <Chip size="small" variant="outlined" label={data.mode} />}
                  <Chip size="small" variant="outlined" label={data.distanceKind === 'terre-lune' ? `≈ ${formatKm(data.distanceKm)} (moyenne Terre–Lune)` : formatKm(data.distanceKm)} />
                </div>
                {data.legs?.length > 0 && (
                  <ul aria-label="Étapes du trajet" className="flex flex-col gap-1 m-0 p-0 list-none">
                    {data.legs.map((leg) => (
                      <li key={leg.kind} className="flex flex-row gap-2 justify-between">
                        <p className="t-body2">{leg.label}</p>
                        <p className="t-body2 font-semibold tabular-nums whitespace-nowrap">{formatDuration(leg.minutes)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {data.summary && <p className="t-body2 text-soft">{data.summary}</p>}
                {data.needsKey && onOpenAssistant && (
                  <Button onClick={() => { onClose(); onOpenAssistant(); }} className="min-h-11 normal-case self-start">Connecter ma clé pour ajouter le trajet au sol</Button>
                )}
              </div>
            )}
            {failure && (
              <div className="flex flex-col gap-2">
                <Alert severity="warning" className="items-center">{failure.text}</Alert>
                <div className="flex flex-row gap-2 flex-wrap gap-y-2">
                  {failure.connect && onOpenAssistant && <Button onClick={() => { onClose(); onOpenAssistant(); }} className="min-h-11 normal-case">Me connecter avec ma clé</Button>}
                  {failure.billingUrl && <Link href={failure.billingUrl} target="_blank" rel="noopener noreferrer" className="self-center">Ajouter un moyen de paiement</Link>}
                  {!failure.connect && !failure.billingUrl && <Button onClick={() => setNonce((n) => n + 1)} className="min-h-11 normal-case">Recalculer</Button>}
                </div>
              </div>
            )}
          </div>

          {/* Itinéraire : étapes par moyen de locomotion, modélisées en 3D (véhicules volants) ou en 2D (au sol). */}
          <div className="flex flex-col gap-3">
            <Button
              variant="outlined" startIcon={<RouteIcon />} onClick={planItinerary} disabled={!onEarth || itin.status === 'loading'}
              className="min-h-11 normal-case self-start"
            >
              {itin.status === 'loading' ? 'Calcul de l’itinéraire…' : itin.data ? 'Recalculer l’itinéraire' : 'Itinéraire'}
            </Button>
            {ready && !onEarth && <span className="t-caption text-soft">L’itinéraire est disponible entre deux lieux de la Terre.</span>}
            {itin.status === 'loading' && <div className="flex flex-row gap-3 items-center"><CircularProgress size={20} /><p className="t-body2">Le modèle prépare les étapes…</p></div>}
            {itinFailure && (
              <Alert severity="warning" className="items-center">
                {itinFailure.text}
                {itinFailure.connect && onOpenAssistant && <Button size="small" onClick={() => { onClose(); onOpenAssistant(); }} className="ml-2">Me connecter</Button>}
                {itinFailure.billingUrl && <Link href={itinFailure.billingUrl} target="_blank" rel="noopener noreferrer" className="ml-2">Ajouter un moyen de paiement</Link>}
              </Alert>
            )}
            {itin.data && <ItineraireView itinerary={itin.data} />}
            {/* Vols et billets de train du trajet, avec un lien de réservation par proposition. */}
            {onEarth && <BilletsView a={a} b={b} />}
          </div>

          <span className="t-caption text-soft">
            {session
              ? `Les trajets hors Apollo sont recalculés automatiquement par ${PROVIDERS[provider]?.label ?? 'votre modèle'}, avec votre clé : elle reste dans ce navigateur.`
              : 'Les trajets hors Apollo sont calculés par votre modèle Claude ou Mistral : connectez-vous avec votre clé depuis le bouton Assistant.'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
