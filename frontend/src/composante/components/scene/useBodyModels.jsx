// Importe de React les crochets useEffect et useRef.
import { useEffect, useRef } from 'react';
// Importe resolveApiUrl, qui complète une adresse de l'API.
import { resolveApiUrl } from '@/moteur/api';
// Importe la lecture JSON de l'API et sa base, pour le blend de la Lune enregistré dans BP.
import { API_BASE, get } from '@/moteur/api/client';

/** Astres dont le ciblage déclenche le chargement du blend de la Lune (elle-même et la Terre). */
const MOON_BLEND_NEAR = ['moon', 'earth'];

/**
 * Affiche dans la console du navigateur si BP est branchée et quels blends y sont enregistrés (une ligne par
 * variante : enregistré, taille, date, fabrication en cours, erreur). Renvoie le nombre de blends enregistrés.
 */
export function logMoonBlend(status) {
  // Base non branchée : un avertissement.
  if (!status?.database) { console.warn('[Blend Lune] BP non branchée au backend (DATABASE_URL absent) : aucun blend.'); return 0; }
  // Une ligne par variante.
  const rows = (status.variants || []).map((v) => ({
    relief: `×${v.exaggeration}`, enBase: v.stored, taille: v.size ? `${(v.size / 1e6).toFixed(1)} Mo` : '—',
    date: v.createdAt ?? '—', fabrication: v.building, erreur: v.error ?? '',
  }));
  const n = rows.filter((r) => r.enBase).length;
  console.info(`[Blend Lune] BP branchée : ${n} blend(s) en base de données.`);
  console.table(rows);
  return n;
}

/**
 * Blend de la Lune à charger, d'après GET /tiles/moon-blend/status : le relief réel (×1) s'il est dans BP, sinon la
 * première variante enregistrée ; null si aucune ne l'est (la Lune garde alors ses tuiles seules).
 */
export function pickMoonBlend(status) {
  // Variantes enregistrées dans BP.
  const stored = (status?.variants || []).filter((v) => v.stored);
  // Aucune : rien à charger.
  if (!stored.length) return null;
  // Le relief réel en priorité.
  const v = stored.find((x) => x.exaggeration === 1) || stored[0];
  // Adresse du fichier lu dans BP.
  return `${API_BASE}/tiles/moon-blend/${v.exaggeration}/model.glb`;
}
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
    // Blend de la Lune : importé directement de BP s'il existe, une seule fois, quand la Lune ou la Terre est ciblée.
    // Il remplace les tuiles de loin (au-delà de 2,2 rayons), comme prévu pour le modèle de la Lune ; de près, les
    // tuiles restent. Aucun blend dans BP, base absente ou erreur : rien ne change, sans message.
    if (MOON_BLEND_NEAR.includes(currentBodyId) && !started.current.has('moon-blend')) {
      // Noté comme demandé.
      started.current.add('moon-blend');
      // Lit les variantes enregistrées, puis charge la meilleure s'il y en a une.
      get('/tiles/moon-blend/status')
        .then((status) => {
          // Console : état de BP et de chaque blend, puis celui qui est importé.
          logMoonBlend(status);
          const url = pickMoonBlend(status);
          return url ? engine.loadMoonModel(resolveApiUrl(url)) : null;
        })
        .then((info) => { if (info) console.info('[Blend Lune] modèle importé depuis BP :', info); })
        .catch((e) => console.warn('[Blend Lune] échec :', e?.message || e));
    }
  // Fin de l'effet ; dépendances : le moteur et l'astre ciblé.
  }, [engine, currentBodyId]);
// Fin de useBodyModels.
}
