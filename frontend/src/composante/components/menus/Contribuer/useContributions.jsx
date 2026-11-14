// Crochets React.
import { useCallback, useEffect, useRef, useState } from 'react';
// API des contributions.
import { fetchContributions, publishContribution, removeContribution, voteContribution } from '@/moteur/api/contributions';

/**
 * Liste des placements publiés : lecture, publication, vote et retrait.
 * La liste est relue à l'ouverture de la fenêtre et à chaque changement de tri ; elle reste en mémoire après la
 * fermeture, pour que le calque 3D continue de montrer les emprises sur le globe.
 */
export function useContributions({ open, token }) {
  // Les placements.
  const [items, setItems] = useState([]);
  // Ordre de la liste.
  const [sort, setSort] = useState('populaire');
  // Le serveur garde-t-il les contributions durablement ?
  const [persistent, setPersistent] = useState(true);
  // Lecture en cours ?
  const [loading, setLoading] = useState(false);
  // Dernier message d'erreur.
  const [error, setError] = useState('');
  // Compteur de lectures : seule la dernière réponse est gardée.
  const run = useRef(0);

  /** Relit la liste depuis le serveur. */
  const refresh = useCallback(async (signal) => {
    // Numéro de cette lecture.
    const id = ++run.current;
    // Affiche l'attente.
    setLoading(true);
    // Essaie.
    try {
      // Les placements triés.
      const data = await fetchContributions(sort, token, signal);
      // Réponse dépassée par une plus récente : ignorée.
      if (id !== run.current) return;
      // La liste et le mode de stockage.
      setItems(data.items || []);
      setPersistent(data.persistent !== false);
      // Plus d'erreur.
      setError('');
    // Échec de la lecture (hors annulation).
    } catch (e) {
      // Annulation : rien à dire.
      if (e.name === 'AbortError' || id !== run.current) return;
      // Message du serveur.
      setError(e.message || 'Liste des contributions indisponible.');
    // Dans tous les cas.
    } finally {
      // Fin de l'attente, si la lecture est encore la dernière.
      if (id === run.current) setLoading(false);
    // Fin de l'essai.
    }
  // Dépend du tri et de la session.
  }, [sort, token]);

  // À l'ouverture, et à chaque changement de tri ou de session.
  useEffect(() => {
    // Fenêtre fermée : la liste déjà lue est gardée telle quelle.
    if (!open) return undefined;
    // Contrôleur d'annulation.
    const ctrl = new AbortController();
    // Lance la lecture.
    refresh(ctrl.signal);
    // À la fermeture : annule.
    return () => ctrl.abort();
  // Dépend de l'ouverture et de la fonction de lecture.
  }, [open, refresh]);

  /** Publie un placement ; renvoie la contribution créée. */
  const publish = useCallback(async (payload) => {
    // Publication.
    const created = await publishContribution(token, payload);
    // Ajoutée en tête de liste, sans attendre une relecture.
    setItems((current) => [created, ...current.filter((i) => i.id !== created.id)]);
    // La contribution.
    return created;
  // Dépend de la session.
  }, [token]);

  /** Vote sur un placement. La direction est envoyée telle quelle : c'est le serveur qui retire la voix déjà donnée. */
  const vote = useCallback(async (item, value) => {
    // Essaie.
    try {
      // Nouveaux compteurs, et la voix qui en résulte.
      const result = await voteContribution(token, item.id, value);
      // Remplace les compteurs de ce placement.
      setItems((current) => current.map((i) => (i.id === item.id ? { ...i, ...result } : i)));
      // Plus d'erreur.
      setError('');
    // Refus du serveur.
    } catch (e) {
      // Message.
      setError(e.message || 'Vote non enregistré.');
    // Fin de l'essai.
    }
  // Dépend de la session.
  }, [token]);

  /** Retire son propre placement. */
  const remove = useCallback(async (item) => {
    // Essaie.
    try {
      // Retrait.
      await removeContribution(token, item.id);
      // Retiré de la liste.
      setItems((current) => current.filter((i) => i.id !== item.id));
      // Plus d'erreur.
      setError('');
    // Refus du serveur.
    } catch (e) {
      // Message.
      setError(e.message || 'Contribution non retirée.');
    // Fin de l'essai.
    }
  // Dépend de la session.
  }, [token]);

  // L'état de la liste.
  return { items, sort, setSort, persistent, loading, error, setError, refresh, publish, vote, remove };
// Fin de useContributions.
}
