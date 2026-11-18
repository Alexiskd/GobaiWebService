/**
 * Protocole d'embarquement : les messages postMessage échangés entre une page hôte (SDK public/embed-sdk.js)
 * et la page embarquée (embed.html). Fonctions pures, testables sans navigateur.
 * Les constantes sont recopiées dans public/embed-sdk.js : le SDK est un script statique sans bundler,
 * il ne peut pas importer ce module — tout changement ici doit y être répercuté.
 */

// Marqueur de source d'une commande : seule la fenêtre hôte peut en envoyer.
export const HOST_SOURCE = 'gobai-host';
// Marqueur de source des messages envoyés par la page embarquée (réponses et événements).
export const EMBED_SOURCE = 'gobai-embed';

// Le type de la réponse à une commande : même forme qu'une commande, avec l'identifiant reçu.
export const REPLY_TYPE = 'gobai:reply';
// Les événements publiés vers l'hôte, sans identifiant : ouvert (globe prêt), changement d'astre visé, erreur interne.
export const EVENT_READY = 'gobai:ready';
export const EVENT_PLANET = 'gobai:planet';
export const EVENT_ERROR = 'gobai:error';

// Les cinq commandes que l'hôte peut envoyer : changer d'astre, viser un lieu, montrer le ciel, zoomer, lire l'état.
export const COMMAND_SET_PLANET = 'gobai:set-planet';
export const COMMAND_GO_TO = 'gobai:go-to';
export const COMMAND_SET_SKY = 'gobai:set-sky';
export const COMMAND_ZOOM = 'gobai:zoom';
export const COMMAND_GET_STATE = 'gobai:get-state';

/** foldSlug : un nom en slug comparable, sans accents ni majuscules (même règle que focusBySlug du moteur). */
export function foldSlug(value) {
  // La casse tombe, les accents sont décomposés puis retirés, les bords sont rognés.
  return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** isCommand : reconnaît un message de commande envoyé par l'hôte (source, type et forme minimale). */
export function isCommand(data) {
  // La charge peut être absente ; le reste est obligatoire.
  return Boolean(data) && typeof data === 'object'
    && data.source === HOST_SOURCE
    && typeof data.type === 'string'
    && data.type.startsWith('gobai:')
    && (typeof data.id === 'string' || typeof data.id === 'number')
    && (data.payload === undefined || (Boolean(data.payload) && typeof data.payload === 'object'));
}

/** makeEvent : un événement publié vers l'hôte, sans identifiant. */
export function makeEvent(type, payload = {}) {
  // Le marqueur de source, le type, puis la charge.
  return { source: EMBED_SOURCE, type, ...payload };
}

/** makeReply : la réponse à une commande, avec l'identifiant reçu pour l'apparier côté hôte. */
export function makeReply(type, id, payload = {}) {
  // Le marqueur de source, le type de réponse, l'identifiant de la commande, puis la charge.
  return { source: EMBED_SOURCE, type, id, ...payload };
}

/**
 * normalizeCommand : valide et normalise la charge utile d'une commande.
 * Renvoie la charge nettoyée, ou null si la commande est inconnue ou invalide.
 */
export function normalizeCommand(type, payload = {}) {
  // Suivant la commande (début) : chacun de ses champs est relu, converti, puis contrôlé.
  switch (type) {
    // Changer d'astre : un slug non vide.
    case COMMAND_SET_PLANET:
      return typeof payload.slug === 'string' && payload.slug.trim() ? { slug: payload.slug } : null;
    // Viser un lieu : longitude et latitude en nombres finis, altitude optionnelle.
    case COMMAND_GO_TO: {
      const lon = Number(payload.lon);
      const lat = Number(payload.lat);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      const altitudeM = Number(payload.altitudeM);
      return { lon, lat, name: '', altitudeM: Number.isFinite(altitudeM) ? altitudeM : undefined };
    }
    // Ciel visible ou non : un booléen strict.
    case COMMAND_SET_SKY:
      return typeof payload.visible === 'boolean' ? { visible: payload.visible } : null;
    // Zoom relatif : un facteur fini et strictement positif (f < 1 rapproche, f > 1 éloigne).
    case COMMAND_ZOOM: {
      const factor = Number(payload.factor);
      return Number.isFinite(factor) && factor > 0 ? { factor } : null;
    }
    // Lire l'état : aucune charge utile.
    case COMMAND_GET_STATE:
      return {};
    // Commande inconnue.
    default:
      return null;
  // Fin du choix.
  }
}
