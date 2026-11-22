// Écrans affichés à la place de la fenêtre de l'assistant : connexion (Claude ou Mistral) et facturation.
import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, CircularProgress, InputBase, Link, Stack, Typography } from '@mui/material';
import { PROVIDERS, saveSession } from '@/Engine/shared/lib/app/assistantSession';
import { connectAssistant } from '@/Computing/api/assistant';
import { safe } from '@/Fairing/theme/mediaQueries';
import { ArrowBackIcon, KeyIcon, LogoutIcon, OpenInNewIcon, SendIcon } from '../../ui/icons.jsx';
import { ProviderLogo } from './ProviderLogo.jsx';
import { C, SANS, SERIF, WRAP } from './assistantTheme.js';

/** Bouton plein (action principale) ou bordé, 48 px de haut : cible tactile confortable, libellé qui passe à la ligne. */
function GateButton({ primary = false, children, sx, ...props }) {
  return (
    <ButtonBase
      {...props}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minHeight: 48, px: 1.5, py: 1,
        borderRadius: '12px', fontFamily: SANS, fontSize: 15, fontWeight: 600, lineHeight: 1.3, textAlign: 'center', ...WRAP,
        ...(primary
          ? { bgcolor: C.accent, color: '#1f1e1d', '&:hover, &.Mui-focusVisible': { bgcolor: '#e08a6d' } }
          : { border: `1px solid ${C.border}`, color: C.text, '&:hover, &.Mui-focusVisible': { bgcolor: C.row } }),
        '&.Mui-disabled': { bgcolor: primary ? C.row : 'transparent', color: C.muted },
        ...sx,
      }}
    >
      {children}
    </ButtonBase>
  );
}

/** Encadré d'erreur, annoncé aux lecteurs d'écran. */
function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <Typography role="alert" sx={{ ...WRAP, px: 1.25, py: 1, borderRadius: '10px', borderLeft: `3px solid ${C.error}`, bgcolor: C.field, color: C.error, fontFamily: SANS, fontSize: 13.5, lineHeight: 1.45 }}>
      {children}
    </Typography>
  );
}

/** Ce que l'utilisateur doit savoir de sa clé, en une phrase. */
const KEY_NOTE = 'Votre clé reste dans ce navigateur. Elle passe par le serveur de Gobai Space à chaque question, sans y être enregistrée. Les requêtes sont facturées sur votre compte chez le fournisseur.';

/**
 * Logique de connexion, partagée par l'écran (ordinateur) et la barre (téléphone) : fournisseur choisi, clé saisie,
 * appel de test chez le fournisseur, erreur éventuelle.
 */
function useLogin({ initialError, onBilling, onConnected }) {
  const [provider, setProvider] = useState(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const inputRef = useRef(null);
  const ctrl = useRef(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => { setError(initialError); }, [initialError]);
  // Fournisseur choisi : le champ de la clé prend le focus.
  useEffect(() => { if (provider) inputRef.current?.focus(); }, [provider]);

  const p = provider ? PROVIDERS[provider] : null;
  const clean = key.trim();

  const submit = async (e) => {
    e?.preventDefault();
    if (!p || !clean || busy) return;
    setBusy(true); setError('');
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    try {
      const res = await connectAssistant(p.id, clean, ctrl.current.signal);
      saveSession({ provider: p.id, key: clean, model: res?.model || '' });
      setKey('');
      onConnected?.();
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (err?.code === 'billing') { onBilling?.({ provider: p.id, key: clean, message: err.message, billingUrl: err.billingUrl || p.billingUrl }); return; }
      setError(err?.message || `Connexion à ${p.label} impossible.`);
    } finally {
      setBusy(false);
    }
  };

  /** Choisit un fournisseur (efface l'erreur précédente). */
  const choose = (id) => { setProvider(id); setError(''); };
  /** Revient au choix du fournisseur et efface la clé saisie. */
  const back = () => { setProvider(null); setKey(''); setError(''); };

  return { p, key, setKey, clean, busy, error, inputRef, submit, choose, back };
}

/**
 * Barre de connexion sur téléphone : la même pilule que la barre de saisie de l'assistant (52 px de haut, même largeur,
 * posée dans le dock du bas), jamais plus grande. Deux temps : 1) deux boutons, Claude et Mistral ; 2) un retour, le
 * champ de la clé d'API et le bouton de connexion. Une erreur s'affiche au-dessus de la pilule, comme pour la saisie.
 * `checkingLabel` : vérification d'une clé déjà enregistrée, un indicateur remplace le contenu.
 */
export function MobileLoginBar({ initialError = '', onBilling, onConnected, checkingLabel = '' }) {
  const { p, key, setKey, clean, busy, error, inputRef, submit, choose, back } = useLogin({ initialError, onBilling, onConnected });
  return (
    <Box
      component="section"
      aria-label="Connexion à l’assistant"
      data-assistant-panel=""
      sx={{
        position: 'relative', display: 'flex', flexDirection: 'column', gap: 0.75,
        pl: `calc(${safe('left')} + 10px)`, pr: `calc(${safe('right')} + 10px)`, '@media (min-width: 700px)': { pl: 0, pr: `calc(${safe('right')} + 8px)` },
        pointerEvents: 'none',
      }}
    >
      {error && (
        <Box sx={{ pointerEvents: 'auto', width: '100%', maxWidth: 440, mx: 'auto', boxSizing: 'border-box', px: 1.5, py: 1, borderRadius: '16px', bgcolor: 'rgba(31, 30, 29, 0.94)', border: `1px solid ${C.border}` }}>
          <Typography role="alert" sx={{ ...WRAP, fontFamily: SANS, fontSize: 13.5, lineHeight: 1.4, color: C.error }}>{error}</Typography>
        </Box>
      )}
      <Box
        component="form"
        onSubmit={submit}
        sx={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 0.5,
          width: '100%', maxWidth: 440, mx: 'auto', boxSizing: 'border-box',
          minHeight: 40, pl: 0.4, pr: 0.5, py: 0.4,
          borderRadius: '20px', fontFamily: SANS, color: C.text,
          bgcolor: 'rgba(31, 30, 29, 0.88)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          border: `1px solid ${error ? C.error : C.border}`, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        {checkingLabel ? (
          <Stack direction="row" spacing={1} role="status" sx={{ alignItems: 'center', flex: '1 1 auto', minWidth: 0, minHeight: 32, px: 1.25 }}>
            <CircularProgress size={16} sx={{ color: C.accent, flex: 'none' }} />
            <Typography noWrap sx={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>{checkingLabel}</Typography>
          </Stack>
        ) : !p ? (
          // Temps 1 : le choix du fournisseur, deux moitiés de la pilule.
          Object.values(PROVIDERS).map((x) => (
            <ButtonBase
              key={x.id}
              type="button"
              onClick={() => choose(x.id)}
              aria-label={`Se connecter à ${x.label}`}
              sx={{
                flex: '1 1 0', minWidth: 0, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, px: 1, borderRadius: '16px',
                fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.text, '&:active': { bgcolor: C.row }, '&.Mui-focusVisible': { bgcolor: C.row },
              }}
            >
              <ProviderLogo provider={x.id} size={18} />
              <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}</Box>
            </ButtonBase>
          ))
        ) : (
          // Temps 2 : retour, clé d'API, connexion. 16 px pour que Safari ne zoome pas au focus.
          <>
            <ButtonBase type="button" onClick={back} disabled={busy} aria-label="Changer de fournisseur" sx={{ flex: 'none', width: 32, height: 32, borderRadius: '50%', color: C.muted }}>
              <ArrowBackIcon sx={{ fontSize: 17 }} />
            </ButtonBase>
            <KeyIcon sx={{ fontSize: 18, color: C.muted, flex: 'none' }} />
            <InputBase
              fullWidth
              inputRef={inputRef}
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={`Clé d’API ${p.label}…`}
              autoComplete="off"
              disabled={busy}
              enterKeyHint="go"
              inputProps={{ 'aria-label': `Clé d’API ${p.platform}`, spellCheck: false, autoCapitalize: 'off', autoCorrect: 'off', 'aria-invalid': Boolean(error) }}
              sx={{ flex: '1 1 auto', minWidth: 0, color: C.text, fontFamily: SANS, fontSize: 16, lineHeight: 1.35, '& input': { p: 0 }, '& input::placeholder': { color: C.muted, opacity: 1 } }}
            />
            <ButtonBase
              type="submit"
              disabled={busy || !clean}
              aria-label={busy ? 'Vérification de la clé' : 'Se connecter'}
              sx={{
                flex: 'none', width: 32, height: 32, borderRadius: '50%',
                bgcolor: !busy && clean ? C.accent : C.row, color: !busy && clean ? '#1f1e1d' : C.muted,
                transition: 'background-color 120ms', '&:active': { transform: 'scale(0.94)' },
              }}
            >
              {busy ? <CircularProgress size={16} sx={{ color: C.accent }} /> : <SendIcon sx={{ fontSize: 17 }} />}
            </ButtonBase>
          </>
        )}
      </Box>
    </Box>
  );
}

/**
 * Écran de connexion : choix du fournisseur, puis saisie de la clé. La clé est vérifiée par un appel de test chez le
 * fournisseur ; tant qu'elle n'est pas valide, la fenêtre de l'assistant reste masquée.
 *  - clé valide et compte en état de payer → session enregistrée dans le navigateur, `onConnected` ;
 *  - pas de moyen de paiement ou plus de crédit → `onBilling` (écran de facturation) ;
 *  - clé refusée, ou autre refus → message sous le champ.
 */
export function LoginScreen({ initialError = '', onBilling, onConnected }) {
  const { p, key, setKey, clean, busy, error, inputRef, submit, choose, back } = useLogin({ initialError, onBilling, onConnected });

  return (
    <Box component="section" aria-label="Connexion à l’assistant" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: 1.5, minWidth: 0 }}>
      <Typography component="h3" sx={{ ...WRAP, fontFamily: SERIF, fontSize: 18, lineHeight: 1.3, color: C.text }}>
        {p ? `Se connecter à ${p.label}` : 'Connectez-vous pour utiliser l’assistant'}
      </Typography>

      {!p ? (
        <>
          <Typography sx={{ ...WRAP, fontFamily: SANS, fontSize: 13.5, lineHeight: 1.45, color: C.muted }}>
            Choisissez votre fournisseur, puis entrez votre propre clé d’API.
          </Typography>
          <ErrorNote>{error}</ErrorNote>
          <Stack spacing={1}>
            {Object.values(PROVIDERS).map((x) => (
              <GateButton key={x.id} onClick={() => choose(x.id)} sx={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                <ProviderLogo provider={x.id} size={24} />
                <Box component="span" sx={{ ...WRAP, display: 'flex', flexDirection: 'column' }}>
                  <span>Se connecter à {x.label}</span>
                  <Box component="span" sx={{ fontSize: 12, fontWeight: 400, color: C.muted }}>{x.platform}</Box>
                </Box>
              </GateButton>
            ))}
          </Stack>
        </>
      ) : (
        <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <ProviderLogo provider={p.id} size={22} />
            <Typography component="label" htmlFor="gobai-assistant-key" sx={{ ...WRAP, fontFamily: SANS, fontSize: 14, color: C.text }}>
              Clé d’API {p.platform}
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, minHeight: 48, borderRadius: '12px', bgcolor: C.field, border: `1px solid ${error ? C.error : C.border}`, '&:focus-within': { borderColor: C.muted } }}>
            <KeyIcon sx={{ fontSize: 18, color: C.muted, flex: 'none' }} />
            <InputBase
              id="gobai-assistant-key"
              inputRef={inputRef}
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={p.placeholder}
              autoComplete="off"
              disabled={busy}
              inputProps={{ spellCheck: false, autoCapitalize: 'off', autoCorrect: 'off', 'aria-invalid': Boolean(error), 'aria-describedby': 'gobai-assistant-key-note' }}
              // 16 px : Safari sur iPhone ne zoome pas au focus.
              sx={{ flex: '1 1 auto', minWidth: 0, color: C.text, fontFamily: SANS, fontSize: 16, '& input::placeholder': { color: C.muted, opacity: 1 } }}
            />
          </Box>
          <ErrorNote>{error}</ErrorNote>
          <Link href={p.keysUrl} target="_blank" rel="noopener noreferrer" sx={{ ...WRAP, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 0.5, minHeight: 32, color: C.accent, fontFamily: SANS, fontSize: 13.5 }}>
            Obtenir une clé sur {p.platform} <OpenInNewIcon sx={{ fontSize: 15 }} />
          </Link>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 1 }}>
            <GateButton type="button" onClick={back} disabled={busy} aria-label="Changer de fournisseur">
              <ArrowBackIcon sx={{ fontSize: 18 }} /> Retour
            </GateButton>
            <GateButton type="submit" primary disabled={busy || !clean}>
              {busy ? <><CircularProgress size={16} sx={{ color: C.muted }} /> Vérification…</> : 'Se connecter'}
            </GateButton>
          </Box>
        </Box>
      )}

      <Typography id="gobai-assistant-key-note" sx={{ ...WRAP, fontFamily: SANS, fontSize: 11.5, lineHeight: 1.45, color: C.muted }}>{KEY_NOTE}</Typography>
    </Box>
  );
}

/**
 * Écran de facturation : le compte n'a pas de moyen de paiement ou n'a plus de crédit gratuit. Lien vers la page de
 * paiement du fournisseur ; « J'ai ajouté un moyen de paiement » refait l'appel de test avec la même clé.
 */
export function BillingScreen({ provider, keyToRetry, message, billingUrl, onResolved, onInvalid, onLogout }) {
  const p = PROVIDERS[provider] ?? PROVIDERS.claude;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const ctrl = useRef(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const retry = async () => {
    if (busy || !keyToRetry) return;
    setBusy(true); setNote('');
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    try {
      const res = await connectAssistant(p.id, keyToRetry, ctrl.current.signal);
      saveSession({ provider: p.id, key: keyToRetry, model: res?.model || '' });
      onResolved?.();
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (err?.code === 'invalid_key') { onInvalid?.(err.message); return; }
      setNote(err?.code === 'billing' ? `Toujours aucun moyen de paiement actif chez ${p.label}. Le changement peut prendre quelques minutes.` : (err?.message || 'Vérification impossible.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box component="section" role="alert" aria-label={`Facturation ${p.label}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: 1.5, minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
        <ProviderLogo provider={p.id} size={24} />
        <Typography component="h3" sx={{ ...WRAP, fontFamily: SERIF, fontSize: 18, lineHeight: 1.3, color: C.text }}>Moyen de paiement requis</Typography>
      </Stack>
      <Typography sx={{ ...WRAP, fontFamily: SANS, fontSize: 14, lineHeight: 1.5, color: C.text }}>
        {message || `Votre compte ${p.label} n’a pas de moyen de paiement ou n’a plus de crédit gratuit.`}
      </Typography>
      <Typography sx={{ ...WRAP, fontFamily: SANS, fontSize: 13, lineHeight: 1.45, color: C.muted }}>
        Ajoutez un moyen de paiement sur {p.platform}, puis revenez ici.
      </Typography>
      <GateButton primary component="a" href={billingUrl || p.billingUrl} target="_blank" rel="noopener noreferrer">
        Ajouter un moyen de paiement <OpenInNewIcon sx={{ fontSize: 17 }} />
      </GateButton>
      {keyToRetry && (
        <GateButton onClick={retry} disabled={busy}>
          {busy ? <><CircularProgress size={16} sx={{ color: C.muted }} /> Vérification…</> : 'J’ai ajouté un moyen de paiement'}
        </GateButton>
      )}
      <ErrorNote>{note}</ErrorNote>
      <GateButton onClick={onLogout} sx={{ border: 'none', color: C.muted, minHeight: 44 }}>
        <LogoutIcon sx={{ fontSize: 17 }} /> Se déconnecter
      </GateButton>
    </Box>
  );
}
