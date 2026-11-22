// Écrans affichés à la place de la fenêtre de l'assistant : connexion (Claude ou Mistral) et facturation.
import { useEffect, useRef, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { CircularProgress, InputBase, Link, cx } from '@/Fairing/kit';
import { PROVIDERS, saveSession } from '@/Engine/shared/lib/app/assistantSession';
import { connectAssistant } from '@/Computing/api/assistant';
import { ArrowBackIcon, KeyIcon, LogoutIcon, OpenInNewIcon, SendIcon } from '../../ui/icons.jsx';
import { ProviderLogo } from './ProviderLogo.jsx';
import { C } from './assistantTheme.js';

/** Bouton plein (action principale) ou bordé, 48 px de haut : cible tactile confortable, libellé qui passe à la ligne. */
function GateButton({ primary = false, children, className, ...props }) {
  // Rend le bouton : plein (couleur d'accent) ou à contour.
  return (
    <button type="button"
      {...props}
      className={cx(
        'g-base flex items-center justify-center gap-2 min-h-12 px-3 py-2 rounded-[12px] font-sys text-[15px] font-semibold leading-[1.3] text-center min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] disabled:text-[#a3a097]',
        primary
          ? 'bg-[#d97757] text-[#1f1e1d] hover:bg-[#e08a6d] focus-visible:bg-[#e08a6d] disabled:bg-[#30302e]'
          : 'border border-[#3b3a37] text-[#eceae3] hover:bg-[#30302e] focus-visible:bg-[#30302e] disabled:bg-transparent',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Encadré d'erreur, annoncé aux lecteurs d'écran. */
function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] px-2.5 py-2 rounded-[10px] bg-[#262624] text-[#e5867a] font-sys text-[13.5px] leading-[1.45]" style={{ borderLeft: `3px solid ${C.error}` }}>
      {children}
    </p>
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
    <section
      aria-label="Connexion à l’assistant"
      data-assistant-panel=""
      className="relative flex flex-col gap-1.5 pointer-events-none pl-[calc(var(--safe-left,env(safe-area-inset-left,0px))_+_10px)] pr-[calc(var(--safe-right,env(safe-area-inset-right,0px))_+_10px)] min-[700px]:pl-0 min-[700px]:pr-[calc(var(--safe-right,env(safe-area-inset-right,0px))_+_8px)]"
    >
      {error && (
        <div className="pointer-events-auto w-full max-w-110 mx-auto box-border px-3 py-2 rounded-[16px] bg-[color:rgba(31,30,29,0.94)]" style={{ border: `1px solid ${C.border}` }}>
          <p role="alert" className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[13.5px] leading-[1.4] text-[#e5867a]">{error}</p>
        </div>
      )}
      <form
        onSubmit={submit}
        className="pointer-events-auto flex items-center gap-1 w-full max-w-110 mx-auto box-border min-h-10 pl-[3.2px] pr-1 py-[3.2px] rounded-[20px] font-sys text-[#eceae3] bg-[color:rgba(31,30,29,0.88)] [box-shadow:0_4px_16px_rgba(0,0,0,0.4)]" style={{ border: `1px solid ${error ? C.error : C.border}` }}
      >
        {checkingLabel ? (
          <div role="status" className="flex flex-row gap-2 items-center flex-auto min-w-0 min-h-8 px-2.5">
            <CircularProgress size={16} className="text-[#d97757] flex-none" />
            <p className="t-body1 truncate font-sys text-[14px] text-[#a3a097]">{checkingLabel}</p>
          </div>
        ) : !p ? (
          // Temps 1 : le choix du fournisseur, deux moitiés de la pilule.
          Object.values(PROVIDERS).map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => choose(x.id)}
              aria-label={`Se connecter à ${x.label}`}
              className="g-base flex-[1_1_0] min-w-0 min-h-8 flex items-center justify-center gap-1.5 px-2 rounded-[16px] font-sys text-[14px] font-semibold text-[#eceae3] active:bg-[#30302e] focus-visible:bg-[#30302e]"
            >
              <ProviderLogo provider={x.id} size={18} />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{x.label}</span>
            </button>
          ))
        ) : (
          // Temps 2 : retour, clé d'API, connexion. 16 px pour que Safari ne zoome pas au focus.
          <>
            <button type="button" onClick={back} disabled={busy} aria-label="Changer de fournisseur" className="g-base flex-none w-8 h-8 rounded-full text-[#a3a097]">
              <ArrowBackIcon className="text-[17px]" />
            </button>
            <KeyIcon className="text-[18px] text-[#a3a097] flex-none" />
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
              className="flex-auto min-w-0 text-[#eceae3] font-sys text-[16px] leading-[1.35] [&_input]:p-0 [&_input::placeholder]:text-[#a3a097] [&_input::placeholder]:opacity-100"
            />
            <button
              type="submit"
              disabled={busy || !clean}
              aria-label={busy ? 'Vérification de la clé' : 'Se connecter'}
              className={`g-base flex-none w-8 h-8 rounded-full ${!busy && clean ? 'bg-[#d97757]' : 'bg-[#30302e]'} ${!busy && clean ? 'text-[#1f1e1d]' : 'text-[#a3a097]'} [transition:background-color_120ms] active:[transform:scale(0.94)]`}
            >
              {busy ? <CircularProgress size={16} className="text-[#d97757]" /> : <SendIcon className="text-[17px]" />}
            </button>
          </>
        )}
      </form>
    </section>
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
    <section aria-label="Connexion à l’assistant" className="flex flex-col gap-2.5 p-3 min-w-0">
      <h3 className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-serif text-[18px] leading-[1.3] text-[#eceae3]">
        {p ? `Se connecter à ${p.label}` : 'Connectez-vous pour utiliser l’assistant'}
      </h3>

      {!p ? (
        <>
          <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[13.5px] leading-[1.45] text-[#a3a097]">
            Choisissez votre fournisseur, puis entrez votre propre clé d’API.
          </p>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex flex-col gap-2">
            {Object.values(PROVIDERS).map((x) => (
              <GateButton key={x.id} onClick={() => choose(x.id)} className="justify-start text-left">
                <ProviderLogo provider={x.id} size={24} />
                <span className="min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] flex flex-col">
                  <span>Se connecter à {x.label}</span>
                  <span className="text-[12px] font-normal text-[#a3a097]">{x.platform}</span>
                </span>
              </GateButton>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-[8.8px] min-w-0">
          <div className="flex flex-row gap-2 items-center min-w-0">
            <ProviderLogo provider={p.id} size={22} />
            <label htmlFor="gobai-assistant-key" className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[14px] text-[#eceae3]">
              Clé d’API {p.platform}
            </label>
          </div>
          <div className="flex items-center gap-2 px-2.5 min-h-12 rounded-[12px] bg-[#262624] focus-within:border-[#a3a097]" style={{ border: `1px solid ${error ? C.error : C.border}` }}>
            <KeyIcon className="text-[18px] text-[#a3a097] flex-none" />
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
              className="flex-auto min-w-0 text-[#eceae3] font-sys text-[16px] [&_input::placeholder]:text-[#a3a097] [&_input::placeholder]:opacity-100"
            />
          </div>
          <ErrorNote>{error}</ErrorNote>
          <Link href={p.keysUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] self-start inline-flex items-center gap-1 min-h-8 text-[#d97757] font-sys text-[13.5px]">
            Obtenir une clé sur {p.platform} <OpenInNewIcon className="text-[15px]" />
          </Link>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
            <GateButton type="button" onClick={back} disabled={busy} aria-label="Changer de fournisseur">
              <ArrowBackIcon className="text-[18px]" /> Retour
            </GateButton>
            <GateButton type="submit" primary disabled={busy || !clean}>
              {busy ? <><CircularProgress size={16} className="text-[#a3a097]" /> Vérification…</> : 'Se connecter'}
            </GateButton>
          </div>
        </form>
      )}

      <p id="gobai-assistant-key-note" className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[11.5px] leading-[1.45] text-[#a3a097]">{KEY_NOTE}</p>
    </section>
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
    <section role="alert" aria-label={`Facturation ${p.label}`} className="flex flex-col gap-2.5 p-3 min-w-0">
      <div className="flex flex-row gap-2 items-center min-w-0">
        <ProviderLogo provider={p.id} size={24} />
        <h3 className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-serif text-[18px] leading-[1.3] text-[#eceae3]">Moyen de paiement requis</h3>
      </div>
      <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[14px] leading-[1.5] text-[#eceae3]">
        {message || `Votre compte ${p.label} n’a pas de moyen de paiement ou n’a plus de crédit gratuit.`}
      </p>
      <p className="t-body1 min-w-0 [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto] font-sys text-[13px] leading-[1.45] text-[#a3a097]">
        Ajoutez un moyen de paiement sur {p.platform}, puis revenez ici.
      </p>
      <GateButton primary component="a" href={billingUrl || p.billingUrl} target="_blank" rel="noopener noreferrer">
        Ajouter un moyen de paiement <OpenInNewIcon className="text-[17px]" />
      </GateButton>
      {keyToRetry && (
        <GateButton onClick={retry} disabled={busy}>
          {busy ? <><CircularProgress size={16} className="text-[#a3a097]" /> Vérification…</> : 'J’ai ajouté un moyen de paiement'}
        </GateButton>
      )}
      <ErrorNote>{note}</ErrorNote>
      <GateButton onClick={onLogout} className="border-0 text-[#a3a097] min-h-11">
        <LogoutIcon className="text-[17px]" /> Se déconnecter
      </GateButton>
    </section>
  );
}
