// Crochets React.
import { useCallback, useEffect, useState } from 'react';
// API des comptes de contributeurs.
import { fetchMe, getSession, loginContributor, logoutContributor, setSession, signupContributor } from '@/moteur/api/contributions';

/**
 * Compte du contributeur : inscription, connexion et déconnexion.
 * Le cookie HttpOnly porte la session ; seul le profil public est mémorisé localement. À l'ouverture, le serveur
 * confirme que le cookie est encore valide. Le marqueur « cookie » n'est jamais un secret ni un jeton.
 */
export function useCompte({ open }) {
  // Session en cours, lue au premier affichage.
  const [session, setCurrent] = useState(getSession);
  // Appel en cours ?
  const [busy, setBusy] = useState(false);
  // Dernier message d'erreur.
  const [error, setError] = useState('');

  // Marqueur interne : toutes les requêtes web utilisent le cookie HttpOnly, pas un jeton JavaScript.
  const token = session?.account?.name ? 'cookie' : null;

  // À l'ouverture : vérifie que la session est toujours acceptée par le serveur.
  useEffect(() => {
    if (!open) return undefined;
    // À chaque ouverture, vérifie le cookie même si le stockage local du profil est vide.
    // Contrôleur d'annulation.
    const ctrl = new AbortController();
    // Demande le compte de la session.
    fetchMe('cookie', ctrl.signal).then((account) => {
      if (ctrl.signal.aborted) return;
      if (account) {
        const restored = setSession({ account, persistent: session?.persistent });
        setCurrent(restored);
      } else {
        setSession(null);
        setCurrent(null);
      }
    });
    // À la fermeture : annule.
    return () => ctrl.abort();
  // À chaque ouverture et à chaque changement de jeton.
  }, [open]);

  /** Inscription (`mode` vaut 'signup') ou connexion ('login'). Renvoie vrai si la session est ouverte. */
  const submit = useCallback(async (mode, name, password) => {
    // Un appel à la fois.
    setBusy(true);
    // Efface l'erreur précédente.
    setError('');
    // Essaie.
    try {
      // Inscription ou connexion.
      const opened = await (mode === 'signup' ? signupContributor(name, password) : loginContributor(name, password));
      // Session gardée.
      setCurrent(opened);
      // Réussi.
      return true;
    // Refus du serveur : son message est montré tel quel.
    } catch (e) {
      // Le message.
      setError(e.message || 'Impossible de se connecter.');
      // Échoué.
      return false;
    // Dans tous les cas : l'appel est fini.
    } finally {
      // Boutons rendus.
      setBusy(false);
    // Fin de l'essai.
    }
  // Sans dépendance : les fonctions appelées sont stables.
  }, []);

  /** Déconnexion : révoque côté serveur puis efface le profil local. */
  const logout = useCallback(() => {
    setSession(null);
    setCurrent(null);
    setError('');
    void logoutContributor().catch(() => {});
  }, []);

  // L'état du compte.
  return { session, token, busy, error, setError, submit, logout };
// Fin de useCompte.
}
