// Fenêtre de l'assistant : connexion avec la clé de l'utilisateur (Claude ou Mistral), puis conversation qui pilote l'interface.
import { useEffect, useRef, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Chip, CircularProgress, InputBase, Popper, TextField } from '@/Fairing/kit';
// Importe les conversions des valeurs de style calculées au rendu.
import { sz } from '@/Fairing/kit/sx';
// Session de l'assistant (fournisseur et clé, gardés dans ce navigateur seulement).
import { PROVIDERS, clearSession, isVerified, markVerified } from '@/Engine/shared/lib/app/assistantSession';
import { useAssistantSession } from '@/Fairing/hooks/useAssistantSession';
// Appels au backend : vérification de la clé et conversation.
import { askAssistant, connectAssistant } from '@/Computing/api/assistant';
// Relevé des éléments actionnables de la page.
import { collectInventory } from '@/Engine/shared/lib/app/domInventory';
import { useViewport } from '@/Fairing/hooks/useViewport';
import { RAIL_W, STRIP_H, TITLE_H, edge } from '@/Fairing/theme/layout';
import { safe } from '@/Fairing/theme/mediaQueries';
import { AutoAwesomeIcon, CheckIcon, CloseIcon, LogoutIcon, SendIcon } from '../../ui/icons.jsx';
import { BillingScreen, LoginScreen, MobileLoginBar } from './AssistantGate.jsx';
import { ProviderLogo } from './ProviderLogo.jsx';
import { C } from './assistantTheme.js';

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
  <div
    className={`${from === 'user' ? 'self-end max-w-[85%] min-w-0 flex-none px-3 py-[7.2px] rounded-[14px] bg-[#30302e]' : `self-stretch min-w-0 flex-none px-1 py-0.5 ${error ? 'pl-2.5' : ''}`}`} style={{ ...(from === 'user' ? {  } : { ...(error ? { borderLeft: `2px solid ${C.error}` } : {  }) }) }}
  >
    <span className="sr-only">{from === 'user' ? 'Vous : ' : 'Assistant : '}</span>
    {children && (
      <p lang="fr" className={`t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] whitespace-pre-wrap ${error ? 'text-[#e5867a]' : 'text-[#eceae3]'} ${from === 'user' ? 'font-sys' : 'font-serif'} ${from === 'user' ? 'text-[14px]' : 'text-[15px]'} leading-[1.5]`}>
        {children}
      </p>
    )}
    {done?.length > 0 && (
      <div className={`flex flex-row gap-1 flex-wrap ${children ? 'mt-1.5' : 'mt-0'}`} aria-label="Actions effectuées">
        {done.map((label, i) => <Chip key={i} size="small" variant="outlined" icon={<CheckIcon />} label={label} className="text-[#a3a097] border-[#3b3a37] font-sys h-auto min-h-6 max-w-full items-start py-0.5 [&_.g-chip-label]:whitespace-normal [&_.g-chip-label]:[overflow-wrap:anywhere] [&_.g-chip-label]:leading-[1.35] [&_.g-chip-label]:py-0.5 [&_.g-chip-icon]:mt-[3px]" />)}
      </div>
    )}
  </div>
);

/** Ligne cliquable, comme une entrée de menu : texte à gauche, fond gris au survol et au clavier. */
const Row = ({ children, ...props }) => (
  <button type="button"
    {...props}
    className="g-base justify-start text-left w-full px-2.5 py-[6.4px] rounded-[8px] flex flex-none min-w-0 whitespace-normal min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] text-[#eceae3] font-sys text-[14px] leading-[1.35] hover:bg-[#30302e] focus-visible:bg-[#30302e] disabled:text-[#a3a097]"
  >
    {children}
  </button>
);

/**
 * Bandeau du fournisseur connecté, sous l'en-tête : logo, « Connecté à Claude », modèle, et « Se déconnecter ».
 * Ses deux parties passent l'une sous l'autre quand le rail est trop étroit : rien ne se chevauche.
 */
function ConnectedBar({ session, onLogout }) {
  const p = PROVIDERS[session.provider];
  return (
    <div className="flex flex-row gap-2 flex-none items-center flex-wrap gap-y-1 px-3 py-1.5 bg-[#262624]" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex flex-row gap-1.5 items-center flex-[1_1_140px] min-w-0">
        <ProviderLogo provider={session.provider} size={18} />
        <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[13px] leading-[1.35] text-[#eceae3]">
          Connecté à {p.label}
          {session.model && <span className="block text-[11.5px] text-[#a3a097]">{session.model}</span>}
        </p>
      </div>
      <button type="button" onClick={onLogout} className="g-base flex-none flex gap-1 items-center min-h-8 px-2 rounded-[8px] text-[#a3a097] font-sys text-[13px] hover:bg-[#30302e] focus-visible:bg-[#30302e] hover:text-[#eceae3] focus-visible:text-[#eceae3] pointer-coarse:min-h-11">
        <LogoutIcon className="text-[16px]" /> Se déconnecter
      </button>
    </div>
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
    <section
      aria-label="Assistant"
      data-assistant-panel=""
      className="relative flex flex-col gap-1.5 pointer-events-none pl-[calc(var(--safe-left,env(safe-area-inset-left,0px))_+_10px)] pr-[calc(var(--safe-right,env(safe-area-inset-right,0px))_+_10px)] min-[700px]:pl-0 min-[700px]:pr-[calc(var(--safe-right,env(safe-area-inset-right,0px))_+_8px)]"
    >
      {(account || error) && (
        <div className="pointer-events-auto w-full max-w-110 mx-auto box-border flex flex-col gap-1 px-3 py-2 rounded-[16px] bg-[color:rgba(31,30,29,0.94)]" style={{ border: `1px solid ${C.border}` }}>
          {error && <p role="alert" className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[13.5px] leading-[1.4] text-[#e5867a]">{error}</p>}
          {account && (
            <div className="flex flex-row gap-2 items-center flex-wrap gap-y-1">
              <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] flex-[1_1_120px] font-sys text-[13.5px] text-[#eceae3]">Connecté à {p.label}</p>
              <button type="button" onClick={onLogout} className="g-base flex-none flex gap-1 min-h-8 px-2.5 rounded-[12px] text-[#eceae3] font-sys text-[14px]" style={{ border: `1px solid ${C.border}` }}>
                <LogoutIcon className="text-[17px]" /> Se déconnecter
              </button>
            </div>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); if (canSend) send(); }}
        className="pointer-events-auto flex items-center gap-1 w-full max-w-110 mx-auto box-border min-h-10 pl-[3.2px] pr-1 py-[3.2px] rounded-[20px] font-sys text-[#eceae3] bg-[color:rgba(31,30,29,0.88)] [box-shadow:0_4px_16px_rgba(0,0,0,0.4)] [transition:border-color_120ms]" style={{ border: `1px solid ${focused ? C.muted : C.border}` }}
      >
        {/* Le logo du fournisseur : cible de 44 px, ouvre la ligne du compte. */}
        <button type="button" onClick={() => setAccount((v) => !v)} aria-expanded={account} aria-label={`Compte ${p.label}`} className="g-base flex-none w-8 h-8 rounded-full">
          <ProviderLogo provider={session.provider} size={18} />
        </button>
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
          className="flex-auto min-w-0 text-[#eceae3] font-sys text-[16px] leading-[1.35] py-0 [&_textarea]:[overflow-wrap:anywhere] [&_textarea]:p-0 [&_textarea::placeholder]:text-[#a3a097] [&_textarea::placeholder]:opacity-100"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={busy ? 'L’assistant répond' : 'Envoyer'}
          className={`g-base flex-none w-8 h-8 rounded-full ${canSend ? 'bg-[#d97757]' : 'bg-[#30302e]'} ${canSend ? 'text-[#1f1e1d]' : 'text-[#a3a097]'} [transition:background-color_120ms] active:[transform:scale(0.94)]`}
        >
          {busy ? <CircularProgress size={16} className="text-[#d97757]" /> : <SendIcon className="text-[17px]" />}
        </button>
      </form>
    </section>
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
    // Question envoyée : le champ perd le focus (plus de sélection ni de curseur ; sur iPhone, le clavier se ferme).
    const active = globalThis.document?.activeElement;
    if (active?.closest?.('[data-assistant-panel]')) active.blur();
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
  // Téléphone : la hauteur de la bande ; ordinateur : la largeur du rail (qui suit la fenêtre), plus 12 px.
  const shift = shifted ? (compact ? `${STRIP_H}px` : `(${RAIL_W} + 12px)`) : '0px';
  const placed = hud
    ? (compact
      ? { position: 'fixed', left: 0, right: 0, bottom: `calc(${shift} + ${safe('bottom')})`, paddingBottom: shifted ? 0 : safe('bottom'), zIndex: 35 }
      : { position: 'fixed', left: `calc(${edge('left')} + ${shift})`, top: '50%', transform: 'translateY(-50%)', zIndex: 20 })
    : (anchored ? {} : { position: 'fixed', left: edge('left', 8), bottom: `calc(${barH}px + ${safe('bottom')} + 16px)`, zIndex: 45 });

  // Ce que montre la fenêtre : connexion, facturation, vérification en cours, ou conversation.
  const gate = billing ? 'billing' : !session ? 'login' : checking ? 'checking' : null;

  // Téléphone, conversation ouverte : la barre flottante dédiée.
  if (bare && hud && !gate) {
    const last = messages[messages.length - 1];
    return <MobileBar session={session} text={text} setText={setText} busy={busy} send={send} error={last?.error ? last.text : ''} onLogout={() => logout()} />;
  }

  // Téléphone, connexion ou vérification de la clé : la même pilule que la saisie (choix Claude / Mistral, puis clé d'API).
  if (bare && hud && (gate === 'login' || gate === 'checking')) {
    return (
      <MobileLoginBar
        initialError={loginError}
        checkingLabel={gate === 'checking' ? `Vérification de votre clé ${PROVIDERS[session.provider]?.label}…` : ''}
        onConnected={() => setLoginError('')}
        onBilling={(b) => { setLoginError(''); setBilling(b); }}
      />
    );
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
    <div role="status" className="flex flex-row gap-2 items-center px-3 py-4">
      <CircularProgress size={16} className="text-[#d97757]" />
      <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[14px] text-[#a3a097]">Vérification de votre clé {PROVIDERS[session.provider]?.label}…</p>
    </div>
  ) : null;

  const panel = (
    <section
      aria-label="Assistant"
      data-assistant-panel=""
      className={`g-paper g-elev flex flex-col overflow-hidden bg-[#1f1e1d] text-[#eceae3] [background-image:none] rounded-[14px] font-sys ${bare && hud ? 'max-w-140' : 'max-w-[calc(100vw_-_16px)]'} min-w-0 box-border ${bare && hud ? 'mx-auto' : ''}`} style={{ border: `1px solid ${C.border}`, width: sz(bare && hud ? '100%' : compact ? 'min(360px, calc(100vw - 16px))' : hud ? RAIL_W : 340), maxHeight: sz(compact ? `min(520px, 62dvh, calc(100dvh - ${reserved}px - 24px))` : `min(520px, calc(100dvh - ${reserved}px - 96px))`), ...(bare && hud ? null : placed) }}
    >
      {/* En-tête : logo du fournisseur connecté (l'astre filant sinon), titre, Astres, fermer. Passe à la ligne au besoin. */}
      <div className="flex flex-row gap-2 items-center flex-none flex-wrap gap-y-1.5 px-3 py-[8.8px]" style={{ borderBottom: `1px solid ${C.border}` }}>
        {session && !gate ? <ProviderLogo provider={session.provider} size={20} /> : <AutoAwesomeIcon className="w-5 h-5 flex-none text-[#d97757]" />}
        <h2 className="t-body1 truncate flex-auto min-w-0 font-serif text-[19px] leading-[1.2] text-[#eceae3]">Assistant</h2>
        {onNavigator && (
          <Chip
            size="small" variant="outlined" clickable label="Astres" onClick={onNavigator} title="Arborescence des astres"
            className="flex-none text-[#a3a097] border-[#3b3a37] font-sys hover:bg-[#30302e] hover:text-[#eceae3] pointer-coarse:h-11 pointer-coarse:rounded-[22px]"
          />
        )}
        <button type="button" onClick={onClose} aria-label="Fermer" className="g-base flex-none w-7 h-7 rounded-[8px] text-[#a3a097] hover:bg-[#30302e] focus-visible:bg-[#30302e] hover:text-[#eceae3] focus-visible:text-[#eceae3] pointer-coarse:w-11 pointer-coarse:h-11">
          <CloseIcon className="text-[16px]" />
        </button>
      </div>

      {gate ? (
        // Connexion, facturation ou vérification : à la place de la conversation, qui reste masquée. Défile si besoin.
        <div className="flex-auto min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">{gateBody}</div>
      ) : (
        <>
          <ConnectedBar session={session} onLogout={() => logout()} />
          {/* Zone de conversation : seule partie qui rétrécit quand la place manque ; elle défile. */}
          <div className="flex-auto flex flex-col gap-2 p-2.5 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="flex flex-col gap-2 flex-none min-w-0" aria-live="polite">
              {messages.length === 0 ? (
                <div className="text-center px-2 py-3">
                  <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-serif text-[18px] leading-[1.3] text-[#eceae3]">Posez une question ou demandez une action</p>
                  <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] mt-1.5 font-sys text-[13px] leading-[1.45] text-[#a3a097]">
                    Les réponses sont générées par une IA et peuvent contenir des erreurs.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => <Bubble key={i} from={m.from} error={m.error} done={m.done}>{m.text}</Bubble>)
              )}
              {busy && (
                <div className="flex flex-row gap-2 items-center flex-none self-start px-2">
                  <CircularProgress size={14} className="text-[#d97757]" />
                  <p className="t-body1 font-sys text-[13px] text-[#a3a097]">L’assistant répond…</p>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {messages.length === 0 && (
              <div className="flex flex-col gap-0.5 flex-none">
                {SUGGESTIONS.map((s) => <Row key={s} disabled={busy} onClick={() => send(s)}>{s}</Row>)}
              </div>
            )}
            {messages.length === 0 && (
              <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] flex-none font-sys text-[11.5px] leading-[1.45] text-[#a3a097]">
                Vos messages sont envoyés à l’API {PROVIDERS[session.provider].label} avec votre clé, via le serveur de Gobai Space qui ne la garde pas. N’y mettez pas d’informations personnelles.
              </p>
            )}
          </div>
          {/* Zone de saisie. */}
          <div className="flex-none px-2.5 py-2" style={{ borderTop: `1px solid ${C.border}` }}>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex flex-row gap-2 items-end">
              <TextField
                size="small" fullWidth multiline maxRows={4}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Demander à ${PROVIDERS[session.provider].label}…`}
                slotProps={{ htmlInput: { 'aria-label': 'Message pour l’assistant', maxLength: MAX_CHARS } }}
                className={`min-w-0 font-sys leading-[1.4] ${compact ? 'text-[16px]' : 'text-[14px]'} [&_.g-field-box]:bg-[#262624] [&_.g-field-box]:border-[#3b3a37] [&_.g-field-box]:rounded-[12px] [&_.g-field-box:hover]:border-[#a3a097] [&_.g-field-box:focus-within]:border-[#a3a097] [&_.g-field-box:focus-within]:shadow-none [&_textarea]:text-[#eceae3] [&_textarea]:py-[9px] [&_textarea]:[overflow-wrap:anywhere] [&_textarea::placeholder]:text-[#a3a097] [&_textarea::placeholder]:opacity-100`}
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                aria-label="Envoyer"
                className="g-base flex-none w-10 h-10 rounded-[12px] bg-[#d97757] text-[#1f1e1d] hover:bg-[#e08a6d] focus-visible:bg-[#e08a6d] disabled:bg-[#30302e] disabled:text-[#a3a097] pointer-coarse:w-11 pointer-coarse:h-11"
              >
                <SendIcon className="text-[20px]" />
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );

  // Téléphone, facturation : la carte se pose dans le dock du bas, à la place de la barre de saisie.
  // Marges latérales écartées des bords et des zones de sécurité (encoche en paysage), comme la barre de saisie.
  if (bare && hud) {
    return (
      <div className="relative pl-[calc(var(--safe-left,env(safe-area-inset-left,0px))_+_10px)] pr-[calc(var(--safe-right,env(safe-area-inset-right,0px))_+_10px)] min-[700px]:pl-0 min-[700px]:pr-[calc(var(--safe-right,env(safe-area-inset-right,0px))_+_8px)]">
        {panel}
      </div>
    );
  }
  if (!anchored) return panel;
  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement={compact ? 'bottom-end' : 'top-start'}
      className="z-[45]"
    >
      {panel}
    </Popper>
  );
}
