// Démarrage sans attente de la couche unique de la Terre : la description de la couche (GET /tiles/layers/:id —
// sources d'imagerie et modèles d'adresse) est gardée dans le navigateur. À la visite suivante, les tuiles partent
// tout de suite avec cette copie, pendant que la description à jour est redemandée au serveur en arrière-plan.
// Fonctions pures : le stockage (localStorage) est passé en paramètre.
// Importe validPlan, qui vérifie un plan de chargement direct.
import { validPlan } from './earthDirect';

// Préfixe des clés du stockage local où sont gardées les descriptions de couche.
export const LAYER_INFO_PREFIX = 'gobai:couche-v1:';
// Âge maximal d'une description gardée : un jour.
export const LAYER_INFO_MAX_AGE_MS = 24 * 60 * 60_000; // au-delà d'un jour, on attend la réponse du serveur
// Marge avant l'expiration annoncée : une minute.
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Description gardée d'une couche, ou null : absente, illisible, trop ancienne, expirée (`expiresAt`) ou sans plan de
 * chargement direct (seules les couches chargées chez leurs fournisseurs démarrent ainsi).
 */
// Déclare et exporte readLayerInfo : le stockage, l'identifiant de la couche et l'instant présent.
export function readLayerInfo(storage, layerId, now = Date.now()) {
  // Début du bloc protégé.
  try {
    // Lit et décode l'entrée gardée, null s'il n'y en a pas.
    const saved = JSON.parse(storage?.getItem(LAYER_INFO_PREFIX + layerId) || 'null');
    // La description de la couche.
    const info = saved?.info;
    // Absente, sans modèle d'adresse ou sans plan direct valide : null.
    if (!info || typeof info.urlTemplate !== 'string' || !validPlan(info.direct)) return null;
    // Date d'enregistrement illisible, future ou trop ancienne : null.
    if (!(now - saved.at >= 0) || now - saved.at > LAYER_INFO_MAX_AGE_MS) return null;
    // Si elle a une date d'expiration et qu'elle expire dans moins d'une minute : null.
    if (info.expiresAt && !(Date.parse(info.expiresAt) - now > EXPIRY_MARGIN_MS)) return null;
    // Sinon : la description.
    return info;
  // En cas d'erreur de lecture ou de décodage.
  } catch {
    // Rien.
    return null;
  // Fin du bloc.
  }
// Fin de readLayerInfo.
}

/** Garde la description d'une couche (si elle a un plan de chargement direct). Renvoie vrai si elle est enregistrée. */
// Déclare et exporte saveLayerInfo : le stockage, l'identifiant, la description et l'instant présent.
export function saveLayerInfo(storage, layerId, info, now = Date.now()) {
  // Sans stockage, sans description ou sans plan direct valide : rien n'est enregistré.
  if (!storage || !info || !validPlan(info.direct)) return false;
  // Début du bloc protégé.
  try {
    // Enregistre la description avec sa date.
    storage.setItem(LAYER_INFO_PREFIX + layerId, JSON.stringify({ at: now, info }));
    // Enregistrée.
    return true;
  // En cas d'échec.
  } catch {
    // Non enregistrée.
    return false; // stockage plein ou refusé : démarrage habituel la prochaine fois
  // Fin du bloc.
  }
// Fin de saveLayerInfo.
}
