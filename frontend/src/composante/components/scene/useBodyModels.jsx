// Importe de React les crochets useEffect et useRef.
import { useEffect, useRef } from 'react';
// Importe resolveApiUrl, qui complète une adresse de l'API.
import { resolveApiUrl } from '@/moteur/api';
// Importe BODY_MODELS, la table des astres qui ont un modèle 3D.
import { BODY_MODELS } from '@/moteur/engine/tiledBodies';

/**
 * Modèles 3D officiels des astres irréguliers (Phobos, Deimos) : chargés la première fois que l'astre ou sa planète est
 * ciblé, puis affichés à la place de la sphère. Un échec laisse la sphère et ses tuiles, sans message.
 */
// Déclare et exporte le crochet useBodyModels : reçoit le moteur et l'identifiant de l'astre ciblé.
export function useBodyModels({ engine, currentBodyId }) {
  // Référence : les identifiants des modèles déjà demandés.
  const started = useRef(new Set());
  // Moteur recréé : on repart d'un ensemble vide.
  useEffect(() => { started.current = new Set(); }, [engine]);
  // Effet relancé quand le moteur ou l'astre ciblé change.
  useEffect(() => {
    // Sans moteur ou sans astre ciblé, rien à faire.
    if (!engine || !currentBodyId) return;
    // Parcourt les modèles connus (identifiant et configuration).
    for (const [id, cfg] of Object.entries(BODY_MODELS)) {
      // Passe au suivant si l'astre ciblé n'est pas dans le voisinage du modèle, ou si le modèle est déjà demandé.
      if (!cfg.modelNear.includes(currentBodyId) || started.current.has(id)) continue;
      // Note que le modèle est demandé.
      started.current.add(id);
      // Demande au moteur de charger le modèle depuis son adresse complète (Promise.resolve accepte aussi un retour non asynchrone).
      Promise.resolve(engine.loadBodyModel(id, resolveApiUrl(cfg.modelPath)))
        // Un échec est ignoré.
        .catch(() => {}); // chargement automatique : échec silencieux, la sphère reste
    // Fin du parcours.
    }
  // Fin de l'effet ; dépendances : le moteur et l'astre ciblé.
  }, [engine, currentBodyId]);
// Fin de useBodyModels.
}
