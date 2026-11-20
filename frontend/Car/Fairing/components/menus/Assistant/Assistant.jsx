// Fenêtre de l'assistant : connexion avec la clé de l'utilisateur (Claude ou Mistral), puis conversation qui pilote l'interface.
import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Chip, CircularProgress, InputBase, Paper, Popper, Stack, TextField, Typography } from '@mui/material';
// Session de l'assistant (fournisseur et clé, gardés dans ce navigateur seulement).
import { PROVIDERS, clearSession, isVerified, markVerified } from '@/Engine/shared/lib/assistantSession';
import { useAssistantSession } from '@/Fairing/hooks/useAssistantSession';
// Appels au backend : vérification de la clé et conversation.
import { askAssistant, connectAssistant } from '@/Computing/api/assistant';
// Relevé des éléments actionnables de la page.
import { collectInventory } from '@/Engine/shared/lib/domInventory';
import { useViewport } from '@/Fairing/hooks/useViewport';
import { RAIL, STRIP_H, TITLE_H, edge } from '@/Fairing/theme/layout';
import { MQ, safe } from '@/Fairing/theme/mediaQueries';
import { AutoAwesomeIcon, CheckIcon, CloseIcon, LogoutIcon, SendIcon } from '../../ui/icons.jsx';
import { BillingScreen, LoginScreen } from './AssistantGate.jsx';
import { ProviderLogo } from './ProviderLogo.jsx';
import { C, SANS, SERIF, WRAP, visuallyHidden } from './assistantTheme.js';

/** Questions proposées : un appui les envoie dans la conversation. */
const SUGGESTIONS = [
  'Quelle est la plus grande lune du système solaire ?',
  'Pourquoi Vénus tourne-t-elle à l’envers ?',
];

/** Mêmes bornes que l'API (assistant.dto.ts) : 12 messages par envoi, 1 000 caractères par message. */
const MAX_HISTORY = 12;
const MAX_CHARS = 1000;
// Hauteur de la barre d'outils de l'ordinateur, marge comprise.
const DESKTOP_BAR_H = 52;

/** Message affiché quand la clé est refusée en cours de conversation. */
const KEY_REFUSED = 'Votre clé a été refusée (invalide ou révoquée). Reconnectez-vous avec une clé valide.';

/** Un message : celui de l'utilisateur dans une pastille grise à droite, la réponse à nu, en empattements. */
const Bubble = ({ from, error, done, children }) => (
  <Box
    sx={from === 'user'
      ? { alignSelf: 'flex-end', maxWidth: '85%', minWidth: 0, flex: 'none', px: 1.5, py: 0.9, borderRadius: '14px', bgcolor: C.row }
      : { alignSelf: 'stretch', minWidth: 0, flex: 'none', px: 0.5, py: 0.25, ...(error ? { pl: 1.25, borderLeft: `2px solid ${C.error}` } : {}) }}
  >
    <Typography component="span" sx={visuallyHidden}>{from === 'user' ? 'Vous : ' : 'Assistant : '}</Typography>
    {children && (
      <Typography lang="fr" sx={{ ...WRAP, whiteSpace: 'pre-wrap', color: error ? C.error : C.text, fontFamily: from === 'user' ? SANS : SERIF, fontSize: from === 'user' ? 14 : 15, lineHeight: 1.5 }}>
        {children}
      </Typography>
    )}
    {done?.length > 0 && (
      <Stack direction="row" useFlexGap spacing={0.5} sx={{ flexWrap: 'wrap', mt: children ? 0.75 : 0 }} aria-label="Actions effectuées">
        {done.map((label, i) => <Chip key={i} size="small" variant="outlined" icon={<CheckIcon />} label={label} sx={chipWrap} />)}
      </Stack>
    )}
  </Box>
);

/** Étiquette dont le texte passe sur plusieurs lignes : hauteur libre, libellé coupé proprement, coche alignée en haut. */
const chipWrap = {
  color: C.muted, borderColor: C.border, fontFamily: SANS, height: 'auto', minHeight: 24, maxWidth: '100%', alignItems: 'flex-start', py: 0.25,
  '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35, py: '2px' },
  '& .MuiChip-icon': { mt: '3px' },
};

/** Ligne cliquable, comme une entrée de menu : texte à gauche, fond gris au survol et au clavier. */
const Row = ({ children, ...props }) => (
  <ButtonBase
    {...props}
    sx={{
      justifyContent: 'flex-start', textAlign: 'left', width: '100%', px: 1.25, py: 0.8, borderRadius: '8px',
      display: 'flex', flex: 'none', minWidth: 0, whiteSpace: 'normal', ...WRAP,
      color: C.text, fontFamily: SANS, fontSize: 14, lineHeight: 1.35,
      '&:hover, &.Mui-focusVisible': { bgcolor: C.row },
      '&.Mui-disabled': { color: C.muted },
    }}
  >
    {children}
  </ButtonBase>
);

/** Petit bouton carré de l'en-tête (fermer) : 28 px, 44 px sur écran tactile. */
const headerButton = { flex: 'none', width: 28, height: 28, borderRadius: '8px', color: C.muted, '&:hover, &.Mui-focusVisible': { bgcolor: C.row, color: C.text }, [MQ.coarse]: { width: 44, height: 44 } };

/**
 * Bandeau du fournisseur connecté, sous l'en-tête : logo, « Connecté à Claude », modèle, et « Se déconnecter ».
 * Ses deux parties passent l'une sous l'autre quand le rail est trop étroit : rien ne se chevauche.
 */
function ConnectedBar({ session, onLogout }) {
  const p = PROVIDERS[session.provider];
  return (
    <Stack direction="row" useFlexGap spacing={1} sx={{ flex: 'none', alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, px: 1.5, py: 0.75, borderBottom: `1px solid ${C.border}`, bgcolor: C.field }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flex: '1 1 140px', minWidth: 0 }}>
        <ProviderLogo provider={session.provider} size={18} />
        <Typography sx={{ ...WRAP, fontFamily: SANS, fontSize: 13, lineHeight: 1.35, color: C.text }}>
          Connecté à {p.label}
          {session.model && <Box component="span" sx={{ display: 'block', fontSize: 11.5, color: C.muted }}>{session.model}</Box>}
        </Typography>
      </Stack>
      <ButtonBase onClick={onLogout} sx={{ flex: 'none', display: 'flex', gap: 0.5, alignItems: 'center', minHeight: 32, px: 1, borderRadius: '8px', color: C.muted, fontFamily: SANS, fontSize: 13, '&:hover, &.Mui-focusVisible': { bgcolor: C.row, color: C.text }, [MQ.coarse]: { minHeight: 44 } }}>
        <LogoutIcon sx={{ fontSize: 16 }} /> Se déconnecter
      </ButtonBase>
    </Stack>
  );
}

/**
 * Barre de l'assistant sur téléphone : une seule pilule (logo du fournisseur, champ, bouton d'envoi), posée dans le
 * flux du dock du bas (MobileDock). Les réponses ne sont pas affichées (l'écran reste à la scène) ; une erreur l'est,
 * au-dessus de la pilule. Un appui sur le logo ouvre la ligne « Connecté à … · Se déconnecter ».
 */
function MobileBar({ session, text, setText, busy, send, error, onLogout }) {
  const [focused, setFocused] = useState(false);
  const [account, setAccount] = useState(false);
  const canSend = !busy && Boolean(text.trim());
  const p = PROVIDERS[session.provider];
  return (
    <Box
      component="section"
      aria-label="Assistant"
      data-assistant-panel=""
      sx={{
        position: 'relative', display: 'flex', flexDirection: 'column', gap: 0.75,
        pl: `calc(${safe('left')} + 10px)`, pr: `calc(${safe('right')} + 10px)`, '@media (min-width: 700px)': { pl: 0, pr: `calc(${safe('right')} + 8px)` },
        pointerEvents: 'none',
      }}
    >
      {(account || error) && (
        <Box sx={{ pointerEvents: 'auto', width: '100%', maxWidth: 560, mx: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 0.5, px: 1.5, py: 1, borderRadius: '16px', bgcolor: 'rgba(31, 30, 29, 0.94)', border: `1px solid ${C.border}` }}>
          {error && <Typography role="alert" sx={{ ...WRAP, fontFamily: SANS, fontSize: 13.5, lineHeight: 1.4, color: C.error }}>{error}</Typography>}
          {account && (
            <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography sx={{ ...WRAP, flex: '1 1 120px', fontFamily: SANS, fontSize: 13.5, color: C.text }}>Connecté à {p.label}</Typography>
              <ButtonBase onClick={onLogout} sx={{ flex: 'none', display: 'flex', gap: 0.5, minHeight: 44, px: 1.25, borderRadius: '12px', border: `1px solid ${C.border}`, color: C.text, fontFamily: SANS, fontSize: 14 }}>
                <LogoutIcon sx={{ fontSize: 17 }} /> Se déconnecter
              </ButtonBase>
            </Stack>
          )}
        </Box>
      )}
      <Box
        component="form"
        onSubmit={(e) => { e.preventDefault(); if (canSend) send(); }}
        sx={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 0.5,
          width: '100%', maxWidth: 560, mx: 'auto', boxSizing: 'border-box',
          minHeight: 52, pl: 0.5, pr: 0.75, py: 0.75,
          borderRadius: '26px', fontFamily: SANS, color: C.text,
          bgcolor: 'rgba(31, 30, 29, 0.88)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          border: `1px solid ${focused ? C.muted : C.border}`, boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45)', transition: 'border-color 120ms',
        }}
      >
        {/* Le logo du fournisseur : cible de 44 px, ouvre la ligne du compte. */}
        <ButtonBase type="button" onClick={() => setAccount((v) => !v)} aria-expanded={account} aria-label={`Compte ${p.label}`} sx={{ flex: 'none', width: 44, height: 44, borderRadius: '50%' }}>
          <ProviderLogo provider={session.provider} size={22} />
        </ButtonBase>
        {/* Le champ : une à trois lignes, 16 px pour que Safari ne zoome pas au focus. */}
        <InputBase
          multiline maxRows={3} fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) send(); } }}
          placeholder={busy ? 'L’assistant répond…' : `Demander à ${p.label}…`}
          enterKeyHint="send"
          inputProps={{ 'aria-label': 'Message pour l’assistant', maxLength: MAX_CHARS, autoCapitalize: 'sentences' }}
          sx={{
            flex: '1 1 auto', minWidth: 0, color: C.text, fontFamily: SANS, fontSize: 16, lineHeight: 1.35, py: 0.25,
            '& textarea': { overflowWrap: 'anywhere', p: 0 },
            '& textarea::placeholder': { color: C.muted, opacity: 1 },
          }}
        />
        <ButtonBase
          type="submit"
          disabled={!canSend}
          aria-label={busy ? 'L’assistant répond' : 'Envoyer'}
          sx={{
            flex: 'none', width: 44, height: 44, borderRadius: '50%',
            bgcolor: canSend ? C.accent : C.row, color: canSend ? '#1f1e1d' : C.muted,
            transition: 'background-color 120ms', '&:active': { transform: 'scale(0.94)' },
          }}
        >
          {busy ? <CircularProgress size={18} sx={{ color: C.accent }} /> : <SendIcon sx={{ fontSize: 20 }} />}
        </ButtonBase>
      </Box>
    </Box>
  );
}

/**
 * Menu « Assistant » : panneau de conversation, jamais modal — pendant l'échange, l'utilisateur continue de tourner
 * le globe et voit l'assistant agir sur la scène.
 *
 * Connexion obligatoire : tant qu'aucune clé n'est validée, l'écran de connexion (Claude ou Mistral) remplace la
 * conversation, sur ordinateur comme sur téléphone. Toutes les questions partent avec la clé et le fournisseur de
 * l'utilisateur ; le serveur la relaie sans la garder. À chaque question, le fournisseur peut répondre :
 *  - clé invalide ou révoquée → session effacée, retour à l'écran de connexion avec le message ;
 *  - pas de moyen de paiement / plus de crédit → écran de facturation à la place de la fenêtre.
 *
 * Deux positions, choisies par `placement` :
 *  - « popper » : petit menu ancré au bouton de la barre d'outils ;
 *  - « hud »    : à la place de la navigation — rail de gauche sur ordinateur, dock du bas sur téléphone.
 *
 * Le modèle reçoit l'inventaire des éléments actionnables de la page, relevé à chaque message, et désigne ceux sur
 * lesquels agir ; les autres actions (aller sur un astre, ouvrir une fenêtre…) partent à `onAction`, qui les revalide.
 */
export function Assistant({ open, anchorEl, onClose, onAction, onNavigator, placement = 'popper', shifted = false }) {
  const { compact } = useViewport();
  const session = useAssistantSession();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // Écran de facturation : { provider, key, message, billingUrl } ; null sinon.
  const [billing, setBilling] = useState(null);
  // Message affiché sur l'écran de connexion (clé refusée).
  const [loginError, setLoginError] = useState('');
  // Revérification d'une session enregistrée lors d'une visite précédente.
  const [checking, setChecking] = useState(false);
  const endRef = useRef(null);
  const alive = useRef(true);
  const inventory = useRef(new Map());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Déconnexion (ici ou dans un autre onglet) : la conversation, liée au fournisseur, est effacée.
  useEffect(() => {
    if (session) return;
    setMessages([]);
    setBusy(false);
  }, [session]);

  // Première ouverture avec une session d'une visite précédente : appel de test (clé révoquée, crédit épuisé ?).
  useEffect(() => {
    if (!open || !session || billing || isVerified(session)) return undefined;
    const ctrl = new AbortController();
    setChecking(true);
    connectAssistant(session.provider, session.key, ctrl.signal)
      .then(() => markVerified())
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        if (e?.code === 'invalid_key') { logout(e.message || KEY_REFUSED); return; }
        if (e?.code === 'billing') { setBilling({ provider: session.provider, key: session.key, message: e.message, billingUrl: e.billingUrl }); return; }
        // Serveur ou fournisseur momentanément indisponible : la session reste, la prochaine question refera le contrôle.
        markVerified();
      })
      .finally(() => { if (!ctrl.signal.aborted) setChecking(false); });
    return () => { ctrl.abort(); setChecking(false); };
  // `logout` est stable dans les faits (setters d'état) : pas besoin de la suivre.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, billing]);

  // Échap ferme le menu (sauf si une autre fenêtre a déjà traité la touche).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // À chaque nouveau message, fait défiler jusqu'à la fin de la conversation.
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'nearest' }); }, [open, messages, busy]);

  /** Efface la clé et revient à l'écran de connexion, avec un message éventuel. */
  function logout(message = '') {
    clearSession();
    setBilling(null);
    setLoginError(message);
    setMessages([]);
  }

  /**
   * Exécute une action demandée par le modèle. Le clic sur un élément de la page est fait ici, où se trouve la
   * table du dernier relevé ; les autres actions partent au parent, qui les revalide contre sa liste fermée.
   * Un élément qui a quitté la page entre l'envoi et la réponse n'est pas cliqué.
   */
  const runAction = (action) => {
    if (action?.name !== 'agir_sur_un_element') return onAction?.(action) ?? null;
    const id = action?.input?.element;
    const el = typeof id === 'string' ? inventory.current.get(id) : null;
    if (!el) return null;
    if (!globalThis.document?.contains?.(el)) return null;
    if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') return null;
    el.click?.();
    return `Clic sur « ${el.getAttribute?.('aria-label') || el.getAttribute?.('title') || (el.textContent || '').trim().slice(0, 40) || id} »`;
  };

  /** Envoie une question (celle donnée, sinon le texte saisi), avec la clé et le fournisseur de l'utilisateur. */
  const send = async (value) => {
    const question = String(value ?? text).trim().slice(0, MAX_CHARS);
    if (!question || busy || !session) return;
    const history = [...messages.filter((m) => !m.error), { from: 'user', text: question }];
    setMessages((m) => [...m, { from: 'user', text: question }]);
    setText('');
    setBusy(true);
    try {
      const payload = history.slice(-MAX_HISTORY).map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text.slice(0, MAX_CHARS) }));
      const { elements, byId } = collectInventory();
      inventory.current = byId;
      const { reply, actions = [] } = await askAssistant(session.provider, session.key, payload, elements);
      if (!alive.current) return;
      const done = actions.map((a) => runAction(a)).filter(Boolean);
      const shown = reply || (done.length ? 'C’est fait.' : 'Je ne peux pas faire cette action dans l’interface.');
      setMessages((m) => [...m, { from: 'assistant', text: shown, done }]);
    } catch (e) {
      if (!alive.current) return;
      // Clé refusée : retour à l'écran de connexion.
      if (e?.code === 'invalid_key') { logout(e.message || KEY_REFUSED); return; }
      // Plus de moyen de paiement ou de crédit : écran de facturation à la place de la fenêtre.
      if (e?.code === 'billing') { setBilling({ provider: session.provider, key: session.key, message: e.message, billingUrl: e.billingUrl }); return; }
      setMessages((m) => [...m, { from: 'assistant', error: true, text: e?.message || 'L’assistant n’a pas pu répondre.' }]);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (!open) return null;

  const barH = compact ? STRIP_H : DESKTOP_BAR_H;
  const reserved = compact ? TITLE_H + STRIP_H : DESKTOP_BAR_H;
  const hud = placement === 'hud';
  const anchored = !hud && Boolean(anchorEl && document.body.contains(anchorEl));
  // Téléphone : la fenêtre se réduit à une barre de saisie (les réponses ne sont pas affichées).
  const bare = compact;
  // Place prise par l'arborescence des astres quand elle est ouverte : le panneau s'en écarte.
  const shift = shifted ? (compact ? STRIP_H : RAIL + 12) : 0;
  const placed = hud
    ? (compact
      ? { position: 'fixed', left: 0, right: 0, bottom: `calc(${shift}px + ${safe('bottom')})`, pb: shift ? 0 : safe('bottom'), zIndex: (t) => t.zIndex.toolbar - 5 }
      : { position: 'fixed', left: `calc(${edge('left')} + ${shift}px)`, top: '50%', transform: 'translateY(-50%)', zIndex: (t) => t.zIndex.hud })
    : (anchored ? {} : { position: 'fixed', left: edge('left', 8), bottom: `calc(${barH}px + ${safe('bottom')} + 16px)`, zIndex: (t) => t.zIndex.toolbar + 5 });

  // Ce que montre la fenêtre : connexion, facturation, vérification en cours, ou conversation.
  const gate = billing ? 'billing' : !session ? 'login' : checking ? 'checking' : null;

  // Téléphone, conversation ouverte : la barre flottante dédiée.
  if (bare && hud && !gate) {
    const last = messages[messages.length - 1];
    return <MobileBar session={session} text={text} setText={setText} busy={busy} send={send} error={last?.error ? last.text : ''} onLogout={() => logout()} />;
  }

  const gateBody = gate === 'billing' ? (
    <BillingScreen
      provider={billing.provider}
      keyToRetry={billing.key}
      message={billing.message}
      billingUrl={billing.billingUrl}
      onResolved={() => setBilling(null)}
      onInvalid={(m) => logout(m || KEY_REFUSED)}
      onLogout={() => logout()}
    />
  ) : gate === 'login' ? (
    <LoginScreen
      initialError={loginError}
      onConnected={() => setLoginError('')}
      onBilling={(b) => { setLoginError(''); setBilling(b); }}
    />
  ) : gate === 'checking' ? (
    <Stack direction="row" spacing={1} role="status" sx={{ alignItems: 'center', px: 1.5, py: 2 }}>
      <CircularProgress size={16} sx={{ color: C.accent }} />
      <Typography sx={{ ...WRAP, fontFamily: SANS, fontSize: 14, color: C.muted }}>Vérification de votre clé {PROVIDERS[session.provider]?.label}…</Typography>
    </Stack>
  ) : null;

  const panel = (
    <Paper
      component="section"
      elevation={8}
      aria-label="Assistant"
      data-assistant-panel=""
      sx={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        bgcolor: C.panel, color: C.text, backgroundImage: 'none', border: `1px solid ${C.border}`, borderRadius: '14px', fontFamily: SANS,
        // Largeur : sur téléphone (dock), toute la largeur utile, 560 px au plus ; celle du rail en position « hud » ; 340 px sinon.
        width: bare && hud ? '100%' : compact ? 'min(360px, calc(100vw - 16px))' : hud ? RAIL : 340,
        maxWidth: bare && hud ? 560 : 'calc(100vw - 16px)', minWidth: 0, boxSizing: 'border-box',
        ...(bare && hud ? { mx: 'auto' } : {}),
        maxHeight: compact ? `min(520px, 62dvh, calc(100dvh - ${reserved}px - 24px))` : `min(520px, calc(100dvh - ${reserved}px - 96px))`,
        ...(bare && hud ? {} : placed),
      }}
    >
      {/* En-tête : logo du fournisseur connecté (l'astre filant sinon), titre, Astres, fermer. Passe à la ligne au besoin. */}
      <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flex: 'none', flexWrap: 'wrap', rowGap: 0.75, px: 1.5, py: 1.1, borderBottom: `1px solid ${C.border}` }}>
        {session && !gate ? <ProviderLogo provider={session.provider} size={20} /> : <AutoAwesomeIcon sx={{ width: 20, height: 20, flex: 'none', color: C.accent }} />}
        <Typography component="h2" noWrap sx={{ flex: '1 1 auto', minWidth: 0, fontFamily: SERIF, fontSize: 19, lineHeight: 1.2, color: C.text }}>Assistant</Typography>
        {onNavigator && (
          <Chip
            size="small" variant="outlined" clickable label="Astres" onClick={onNavigator} title="Arborescence des astres"
            sx={{ flex: 'none', color: C.muted, borderColor: C.border, fontFamily: SANS, '&:hover': { bgcolor: C.row, color: C.text }, [MQ.coarse]: { height: 44, borderRadius: '22px' } }}
          />
        )}
        <ButtonBase onClick={onClose} aria-label="Fermer" sx={headerButton}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </ButtonBase>
      </Stack>

      {gate ? (
        // Connexion, facturation ou vérification : à la place de la conversation, qui reste masquée. Défile si besoin.
        <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>{gateBody}</Box>
      ) : (
        <>
          <ConnectedBar session={session} onLogout={() => logout()} />
          {/* Zone de conversation : seule partie qui rétrécit quand la place manque ; elle défile. */}
          <Box sx={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1.25, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>
            <Stack spacing={1} sx={{ flex: 'none', minWidth: 0 }} aria-live="polite">
              {messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', px: 1, py: 1.5 }}>
                  <Typography sx={{ ...WRAP, fontFamily: SERIF, fontSize: 18, lineHeight: 1.3, color: C.text }}>Posez une question ou demandez une action</Typography>
                  <Typography sx={{ ...WRAP, mt: 0.75, fontFamily: SANS, fontSize: 13, lineHeight: 1.45, color: C.muted }}>
                    Les réponses sont générées par une IA et peuvent contenir des erreurs.
                  </Typography>
                </Box>
              ) : (
                messages.map((m, i) => <Bubble key={i} from={m.from} error={m.error} done={m.done}>{m.text}</Bubble>)
              )}
              {busy && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 'none', alignSelf: 'flex-start', px: 1 }}>
                  <CircularProgress size={14} sx={{ color: C.accent }} />
                  <Typography sx={{ fontFamily: SANS, fontSize: 13, color: C.muted }}>L’assistant répond…</Typography>
                </Stack>
              )}
              <Box ref={endRef} />
            </Stack>
            {messages.length === 0 && (
              <Stack spacing={0.25} sx={{ flex: 'none' }}>
                {SUGGESTIONS.map((s) => <Row key={s} disabled={busy} onClick={() => send(s)}>{s}</Row>)}
              </Stack>
            )}
            {messages.length === 0 && (
              <Typography sx={{ ...WRAP, flex: 'none', fontFamily: SANS, fontSize: 11.5, lineHeight: 1.45, color: C.muted }}>
                Vos messages sont envoyés à l’API {PROVIDERS[session.provider].label} avec votre clé, via le serveur de Gobai Space qui ne la garde pas. N’y mettez pas d’informations personnelles.
              </Typography>
            )}
          </Box>
          {/* Zone de saisie. */}
          <Box sx={{ flex: 'none', px: 1.25, py: 1, borderTop: `1px solid ${C.border}` }}>
            <Stack component="form" direction="row" spacing={1} onSubmit={(e) => { e.preventDefault(); send(); }} sx={{ alignItems: 'flex-end' }}>
              <TextField
                size="small" fullWidth multiline maxRows={4}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Demander à ${PROVIDERS[session.provider].label}…`}
                slotProps={{ htmlInput: { 'aria-label': 'Message pour l’assistant', maxLength: MAX_CHARS } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: C.field, color: C.text, borderRadius: '12px', fontFamily: SANS, fontSize: compact ? 16 : 14, lineHeight: 1.4, py: '9px',
                    '& fieldset': { borderColor: C.border },
                    '&:hover fieldset': { borderColor: C.muted },
                    '&.Mui-focused fieldset': { borderColor: C.muted, borderWidth: 1 },
                  },
                  '& textarea::placeholder': { color: C.muted, opacity: 1 },
                  '& textarea': { overflowWrap: 'anywhere' },
                  minWidth: 0,
                }}
              />
              <ButtonBase
                type="submit"
                disabled={busy || !text.trim()}
                aria-label="Envoyer"
                sx={{
                  flex: 'none', width: 40, height: 40, borderRadius: '12px', bgcolor: C.accent, color: '#1f1e1d',
                  '&:hover, &.Mui-focusVisible': { bgcolor: '#e08a6d' },
                  '&.Mui-disabled': { bgcolor: C.row, color: C.muted },
                  [MQ.coarse]: { width: 44, height: 44 },
                }}
              >
                <SendIcon sx={{ fontSize: 20 }} />
              </ButtonBase>
            </Stack>
          </Box>
        </>
      )}
    </Paper>
  );

  // Téléphone, connexion ou facturation : la carte se pose dans le dock du bas, à la place de la barre de saisie.
  // Marges latérales écartées des bords et des zones de sécurité (encoche en paysage), comme la barre de saisie.
  if (bare && hud) {
    return (
      <Box sx={{ position: 'relative', pl: `calc(${safe('left')} + 10px)`, pr: `calc(${safe('right')} + 10px)`, '@media (min-width: 700px)': { pl: 0, pr: `calc(${safe('right')} + 8px)` } }}>
        {panel}
      </Box>
    );
  }
  if (!anchored) return panel;
  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement={compact ? 'bottom-end' : 'top-start'}
      modifiers={[{ name: 'offset', options: { offset: [0, 10] } }, { name: 'flip', options: { padding: 8 } }, { name: 'preventOverflow', options: { padding: 8, altAxis: true, tether: false } }]}
      sx={{ zIndex: (t) => t.zIndex.toolbar + 5 }}
    >
      {panel}
    </Popper>
  );
}
