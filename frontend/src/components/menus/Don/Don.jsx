import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, Dialog, DialogContent, InputAdornment, LinearProgress, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { fetchDonationConfig } from '@/api';
import { useViewport } from '@/hooks/useViewport';
import { PanelHeader } from '../../ui/PanelHeader';
import { PaypalButtons } from './PaypalButtons';
import { usePaypalSdk } from './usePaypalSdk';

const PRESETS = [5, 10, 20, 50, 100];

const money = (n, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/** « 1er décembre à 00:00 » dans le fuseau du serveur de dons. */
function resetLabel(iso, timeZone) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone, day: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat('fr-FR', { timeZone, month: 'long' }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${day === '1' ? '1er' : day} ${month} à ${time}`;
}

function monthLabel(month, timeZone) {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone, month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 15)));
}

/** Fenêtre de don : collecte du mois plafonnée, montants rapides ou libres, paiement PayPal. */
export function Don({ open, onClose }) {
  const { compact } = useViewport();
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [amountText, setAmountText] = useState('10');
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(null);
  const amountRef = useRef(10);
  const { paypal, error: sdkError } = usePaypalSdk(open && config?.enabled ? config.clientId : null, config?.currency);

  const reload = useCallback((signal) => fetchDonationConfig(signal).then(setConfig, (e) => {
    if (e.name !== 'AbortError') setLoadError(e.message);
  }), []);

  useEffect(() => {
    if (!open) return undefined;
    const ctrl = new AbortController();
    setLoadError(''); setError(''); setThanks(null);
    reload(ctrl.signal);
    return () => ctrl.abort();
  }, [open, reload]);

  const amount = Number(amountText.replace(',', '.'));
  amountRef.current = amount;
  const remaining = config?.remaining ?? 0;
  const closed = config && remaining < config.minAmount;

  const validate = useCallback(() => {
    if (!config) return 'Chargement…';
    if (!Number.isFinite(amount) || amount < config.minAmount) return `Montant minimum : ${money(config.minAmount)}.`;
    if (Math.round(amount * 100) / 100 !== amount) return 'Deux décimales au maximum.';
    if (amount > config.remaining) return `Il reste ${money(config.remaining)} à collecter ce mois-ci.`;
    return '';
  }, [amount, config]);

  const onApproved = useCallback((r) => {
    setThanks(r.amount);
    setError('');
    setConfig((c) => (c ? { ...c, raised: r.raised, remaining: r.remaining } : c));
  }, []);

  const tz = config?.timeZone || 'Europe/Paris';
  const percent = config ? Math.min(100, (config.raised / config.monthlyLimit) * 100) : 0;
  const preset = PRESETS.includes(amount) ? amount : null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="xs" fullWidth aria-label="Faire un don">
      <PanelHeader
        kicker="Soutenir le projet"
        title="Faire un don"
        titleAdornment={config?.environment === 'sandbox' && <Chip size="small" color="warning" label="Mode test" />}
        onClose={onClose}
      />
      <DialogContent>
        {!config && !loadError && <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>}
        {loadError && <Alert severity="error">Impossible de charger les dons : {loadError}</Alert>}

        {config && (
          <Stack spacing={2.5}>
            <Typography variant="body2" color="text.secondary">
              Gobai Space est gratuit et sans publicité. Les dons financent l’hébergement et l’imagerie satellite.
            </Typography>

            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
                <Typography variant="subtitle2">Collecte de {monthLabel(config.month, tz)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {money(config.raised)} / {money(config.monthlyLimit)}
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={percent} sx={{ height: 8, borderRadius: 4 }} aria-label="Montant collecté ce mois-ci" />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Plafond de {money(config.monthlyLimit)} par mois · remise à zéro le {resetLabel(config.resetsAt, tz)}
              </Typography>
            </Box>

            {thanks !== null && <Alert severity="success">Merci pour ton don de {money(thanks)} !</Alert>}

            {!config.enabled && <Alert severity="info">Les dons ne sont pas encore ouverts.</Alert>}

            {config.enabled && closed && (
              <Alert severity="info">
                La collecte de ce mois est complète, merci à tous ! Elle rouvre le {resetLabel(config.resetsAt, tz)}.
              </Alert>
            )}

            {config.enabled && !closed && (
              <>
                <Stack spacing={1.5}>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={preset}
                    onChange={(_e, v) => { if (v !== null) { setAmountText(String(v)); setError(''); } }}
                    aria-label="Montant du don"
                  >
                    {PRESETS.map((v) => (
                      <ToggleButton key={v} value={v} disabled={v > remaining}>{money(v)}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <TextField
                    label="Autre montant"
                    size="small"
                    value={amountText}
                    onChange={(e) => { setAmountText(e.target.value); setError(''); }}
                    error={Boolean(amountText) && Boolean(validate())}
                    helperText={`Entre ${money(config.minAmount)} et ${money(remaining)}`}
                    slotProps={{
                      htmlInput: { inputMode: 'decimal', 'aria-label': 'Montant libre en euros' },
                      input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
                    }}
                  />
                </Stack>

                {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
                {sdkError && <Alert severity="warning">{sdkError}</Alert>}

                {paypal ? (
                  <Box sx={{ bgcolor: 'common.white', borderRadius: 1, p: 1.5 }}>
                    <PaypalButtons paypal={paypal} amountRef={amountRef} validate={validate} onApproved={onApproved} onError={setError} />
                  </Box>
                ) : !sdkError && (
                  <Stack alignItems="center" sx={{ py: 2 }}><CircularProgress size={28} /></Stack>
                )}

                <Typography variant="caption" color="text.secondary">
                  Paiement sécurisé par PayPal (compte PayPal ou carte bancaire). Gobai Space ne voit jamais tes coordonnées bancaires.
                </Typography>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
