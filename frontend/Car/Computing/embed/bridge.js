// Pont postMessage de la page d'embarquement : reçoit les commandes du site hôte, lui répond, et lui publie les événements.
// Importe le protocole : les constantes, la reconnaissance d'une commande, la validation des charges et les enveloppes.
import {
  COMMAND_GET_STATE, COMMAND_GO_TO, COMMAND_SET_PLANET, COMMAND_SET_SKY, COMMAND_ZOOM,
  EVENT_ERROR, EVENT_PLANET, EVENT_READY, REPLY_TYPE,
  foldSlug, isCommand, makeEvent, makeReply, normalizeCommand,
} from './embedProtocol.js';

/**
 * createEmbedBridge : branche l'écoute des commandes de l'hôte et renvoie les fonctions de publication.
 * Commandes acceptées : set-planet, go-to, set-sky, zoom, get-state. Événements envoyés : ready, planet, error.
 * La fenêtre hôte est seule écoutée (event.source === window.parent) : une autre iframe de la page ne peut rien commander.
 */
export function createEmbedBridge({ engine, targetOrigin = '*', send } = {}) {
  // L'envoi : window.parent.postMessage par défaut, avec l'origine autorisée ; une fonction peut être injectée pour les tests.
  const post = send || ((msg) => window.parent.postMessage(msg, targetOrigin));
  // Le slug de l'astre visé, relu dans le moteur à chaque besoin.
  const currentSlug = () => foldSlug(engine.focusTarget()?.name || '');
  // notifyPlanet : publie l'astre visé à l'hôte (à chaque focus, et sur demande).
  const notifyPlanet = () => post(makeEvent(EVENT_PLANET, { planet: currentSlug() }));
  // action : exécute une commande déjà validée, puis répond à l'hôte avec son identifiant.
  const action = (type, id, payload) => {
    // La charge de la réponse, remplie par la commande exécutée.
    let reply = { ok: false };
    // Suivant la commande (début).
    switch (type) {
      // Changer d'astre : focusBySlug renvoie vrai si le nom existe, faux sinon.
      case COMMAND_SET_PLANET:
        reply = { ok: engine.focusBySlug(payload.slug) };
        // Un astre inconnu reste un succès technique : la réponse le dit, l'hôte décide.
        if (!reply.ok) reply.message = `Astre inconnu : ${payload.slug}`;
        break;
      // Viser un lieu : goTo anime la caméra ; une erreur interne est rattrapée et rapportée.
      case COMMAND_GO_TO:
        try { engine.goTo(payload); reply = { ok: true }; } catch (e) { reply = { ok: false, message: String(e?.message || e) }; }
        break;
      // Ciel visible ou non (masqué au départ dans l'embarquement, remonté seulement sur demande).
      case COMMAND_SET_SKY:
        engine.setSkyVisible(payload.visible);
        reply = { ok: true };
        break;
      // Zoom relatif : f < 1 rapproche, f > 1 éloigne.
      case COMMAND_ZOOM:
        engine.zoom(payload.factor);
        reply = { ok: true };
        break;
      // État courant : l'astre visé, et l'état du ciel.
      case COMMAND_GET_STATE:
        reply = { ok: true, planet: currentSlug(), ...(engine.sky ? { sky: engine.sky.visible } : {}) };
        break;
    // Fin du choix.
    }
    // La réponse, appariée à la commande par son identifiant.
    post(makeReply(REPLY_TYPE, id, reply));
  // Fin de action.
  };
  // La commande reçue : la fenêtre hôte seule parle, et la forme doit être celle du protocole.
  const onMessage = (event) => {
    // Tout message qui ne vient pas du parent est ignoré.
    if (!event || event.source !== window.parent) return;
    // Tout message hors protocole est ignoré.
    if (!isCommand(event.data)) return;
    // La charge normalisée ; null si la commande est inconnue ou invalide.
    const payload = normalizeCommand(event.data.type, event.data.payload || {});
    // Commande refusée : la réponse le dit, toujours avec l'identifiant reçu.
    if (!payload) { post(makeReply(REPLY_TYPE, event.data.id, { ok: false, message: `Commande inconnue ou charge invalide : ${event.data.type}` })); return; }
    // Commande acceptée : exécutée, puis sa réponse est postée.
    action(event.data.type, event.data.id, payload);
  // Fin de la commande reçue.
  };
  // Branche l'écoute des messages.
  window.addEventListener('message', onMessage);
  // Ce que la page embarquée garde du pont : publier, saluer, signaler, détacher.
  return {
    // notifyPlanet : l'astre visé a changé.
    notifyPlanet,
    // sendReady : le globe est prêt à l'usage.
    sendReady: () => post(makeEvent(EVENT_READY, { planet: currentSlug() })),
    // sendError : une erreur interne à signaler à l'hôte.
    sendError: (message) => post(makeEvent(EVENT_ERROR, { message })),
    // detach : retire l'écouteur (démontage de la page).
    detach: () => window.removeEventListener('message', onMessage),
  // Fin du pont.
  };
// Fin de createEmbedBridge.
}
