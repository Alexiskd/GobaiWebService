/** Comptes et contributions désactivés en mode frontend statique. */
const ACCOUNT_KEY = 'gobai.contribution.account';
const LEGACY_KEY = 'gobai.contribution';
export function getSession() {
  try { const raw = globalThis.localStorage?.getItem(ACCOUNT_KEY); const value = raw ? JSON.parse(raw) : null; return value?.account?.name ? { account: value.account, persistent: value.persistent ?? null } : null; } catch { return null; }
}
export function setSession(session) {
  try { if (session?.account?.name) globalThis.localStorage?.setItem(ACCOUNT_KEY, JSON.stringify({ account: session.account, persistent: session.persistent ?? null })); else globalThis.localStorage?.removeItem(ACCOUNT_KEY); globalThis.localStorage?.removeItem(LEGACY_KEY); } catch {}
  return session?.account ? { account: session.account, persistent: session.persistent ?? null } : null;
}
export const signupContributor = async () => { throw new Error('Inscription indisponible en mode statique.'); };
export const loginContributor = async () => { throw new Error('Connexion indisponible en mode statique.'); };
export async function logoutContributor() { setSession(null); }
export const fetchMe = async () => null;
export const fetchContributions = async () => ({ items: [], persistent: false });
export const publishContribution = async () => { throw new Error('Publication indisponible en mode statique.'); };
export const voteContribution = async () => { throw new Error('Vote indisponible en mode statique.'); };
export const removeContribution = async () => { throw new Error('Suppression indisponible en mode statique.'); };
