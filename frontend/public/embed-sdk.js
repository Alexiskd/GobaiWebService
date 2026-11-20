/**
 * SDK d'embarquement Gobai Space : script statique (sans build) à inclure dans une page hôte.
 *
 *   <script src="https://www.gobaispace.com/embed-sdk.js"></script>
 *   <script>
 *     const globe = GobaiEmbed.create('#globe', { planet: 'terre' });
 *     globe.on('gobai:ready', () => globe.goTo({ lon: 2.35, lat: 48.85 }));
 *   </script>
 *
 * Crée une <iframe> transparente affichant le globe 3D interactif, pilote le moteur par commandes
 * et reçoit ses événements via postMessage. Le protocole est défini côté page embarquée dans
 * Car/Computing/embed/embedProtocol.js — ce fichier en est le miroir : le SDK est un script statique sans
 * bundler, il ne peut pas importer ce module. Tout changement doit être répercuté des deux côtés.
 */
(function (global) {
  'use strict';

  // Marqueur de source des messages (miroir d'embedProtocol.js).
  var HOST_SOURCE = 'gobai-host';
  var EMBED_SOURCE = 'gobai-embed';
  // Le type de réponse à une commande, avec l'identifiant renvoyé par la page embarquée.
  var REPLY_TYPE = 'gobai:reply';
  // Délai au-delà duquel une commande sans réponse est rejetée.
  var COMMAND_TIMEOUT_MS = 10000;
  // Numéro de séquence des commandes : chaque commande reçoit un identifiant unique par page.
  var seq = 0;

  // baseOf : le dossier d'une URL de script, pour déduire l'adresse de embed.html.
  function baseOf(scriptUrl) {
    try { return new URL('.', scriptUrl).href.replace(/\/+$/, ''); } catch (e) { return ''; }
  }

  // Base du SDK : l'adresse de ce script, capturée au chargement (document.currentScript).
  var SCRIPT_BASE = (function () {
    try { return document.currentScript && document.currentScript.src ? baseOf(document.currentScript.src) : ''; } catch (e) { return ''; }
  })();

  // isEvent : le message vient-il de la page embarquée, avec la forme du protocole ?
  function isEvent(data) {
    return Boolean(data) && typeof data === 'object'
      && data.source === EMBED_SOURCE
      && typeof data.type === 'string'
      && data.type.indexOf('gobai:') === 0;
  }

  /**
   * create : installe un globe dans un conteneur.
   * target : sélecteur CSS ou élément. options : planet ('terre'), lon, lat, base, origin, title.
   * Renvoie le contrôle : setPlanet, goTo, setSky, zoom, getState, on, off, destroy.
   */
  function create(target, options) {
    options = options || {};
    // Le conteneur : élément ou sélecteur CSS.
    var container = typeof target === 'string' ? document.querySelector(target) : target;
    // Conteneur introuvable : erreur explicite.
    if (!container) throw new Error('GobaiEmbed : conteneur introuvable.');
    // La base de l'embarquement : explicite, ou déduite du script.
    var base = options.base || SCRIPT_BASE;
    // L'origine de destination des commandes : explicite, ou « * ».
    var origin = options.origin || '*';
    // Le titre de l'iframe, pour l'accessibilité.
    var title = options.title || 'Globe 3D interactif · Gobai Space';

    // La requête de l'adresse : l'astre, et éventuellement le lieu visé.
    var query = new URLSearchParams();
    query.set('planet', options.planet || 'terre');
    if (Number.isFinite(Number(options.lon)) && Number.isFinite(Number(options.lat))) {
      query.set('lon', String(options.lon));
      query.set('lat', String(options.lat));
    }
    // Sans base connue : l'embarquement est cherché sur le même domaine que la page hôte.
    var src = (base || '') + '/embed.html?' + query.toString();

    // L'iframe : transparente, sans bordure, sans fond — le globe flotte au-dessus du contenu de l'hôte.
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = title;
    iframe.loading = 'lazy';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'fullscreen');
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';
    iframe.style.width = options.width || '100%';
    iframe.style.height = options.height || '100%';
    container.appendChild(iframe);

    // Les commandes en attente : identifiant -> { resolve, reject, timer }.
    var pending = new Map();
    // Les abonnés aux événements : type -> Set de fonctions.
    var listeners = new Map();

    // decline : rejette une commande en attente, et nettoie son minuteur.
    function decline(entry, reason) {
      clearTimeout(entry.timer);
      pending.delete(entry.id);
      entry.reject(new Error(reason));
    }

    // onMessage : reçoit les messages de la page embarquée (réponses et événements).
    function onMessage(event) {
      // Seuls les messages de cette iframe sont retenus.
      if (!event || event.source !== iframe.contentWindow) return;
      // Hors protocole : ignoré.
      if (!isEvent(event.data)) return;
      // Une réponse : résout la commande en attente correspondante.
      if (event.data.type === REPLY_TYPE && event.data.id !== undefined && pending.has(event.data.id)) {
        var entry = pending.get(event.data.id);
        clearTimeout(entry.timer);
        pending.delete(event.data.id);
        if (event.data.ok) entry.resolve(event.data);
        else entry.reject(new Error(event.data.message || 'Commande refusée par la page embarquée.'));
        return;
      // Fin du cas réponse.
      }
      // Un événement : prévient chaque abonné, dans l'ordre d'abonnement.
      var subs = listeners.get(event.data.type);
      if (subs) subs.forEach(function (cb) { try { cb(event.data); } catch (e) { /* un abonné en erreur n'arrête pas les autres */ } });
    // Fin de onMessage.
    }
    window.addEventListener('message', onMessage);

    // request : envoie une commande, et renvoie la promesse de sa réponse.
    function request(type, payload) {
      seq += 1;
      var id = 'gobai-' + String(seq);
      var entry = { id: id, resolve: null, reject: null, timer: 0 };
      var promise = new Promise(function (resolve, reject) {
        entry.resolve = resolve;
        entry.reject = reject;
      });
      // Sans réponse à temps : la promesse est rejetée.
      entry.timer = setTimeout(function () { decline(entry, 'GobaiEmbed : pas de réponse à ' + type + ' dans les ' + COMMAND_TIMEOUT_MS + ' ms.'); }, COMMAND_TIMEOUT_MS);
      pending.set(id, entry);
      try {
        iframe.contentWindow.postMessage({ source: HOST_SOURCE, id: id, type: type, payload: payload }, origin);
      } catch (e) {
        decline(entry, 'GobaiEmbed : envoi impossible (' + ((e && e.message) || e) + ').');
      }
      return promise;
    // Fin de request.
    }

    // on : abonne à un événement ('gobai:ready', 'gobai:planet', 'gobai:error').
    function on(type, cb) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(cb);
      // La désinscription est renvoyée, pour un usage direct.
      return function () { off(type, cb); };
    // Fin de on.
    }
    // off : désabonne.
    function off(type, cb) { if (listeners.has(type)) listeners.get(type).delete(cb); }

    // destroy : retire l'écoute, rejette les commandes en attente, puis retire l'iframe.
    function destroy() {
      window.removeEventListener('message', onMessage);
      pending.forEach(function (entry) { decline(entry, 'GobaiEmbed : lecteur détruit.'); });
      listeners.clear();
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }

    // Le contrôle rendu à l'hôte.
    return {
      // L'iframe posée, pour un réglage fin par l'hôte.
      iframe: iframe,
      // Changer d'astre (slug sans accent ni majuscule : 'terre', 'mars', 'titan'…).
      setPlanet: function (slug) { return request('gobai:set-planet', { slug: slug }); },
      // Viser un lieu : longitude et latitude en degrés, altitude optionnelle en mètres.
      goTo: function (opts) { return request('gobai:go-to', opts || {}); },
      // Montrer ou non le ciel étoilé (masqué par défaut dans l'embarquement).
      setSky: function (visible) { return request('gobai:set-sky', { visible: !!visible }); },
      // Zoom relatif : f < 1 rapproche, f > 1 éloigne.
      zoom: function (factor) { return request('gobai:zoom', { factor: factor }); },
      // État courant : { ok, planet, sky }.
      getState: function () { return request('gobai:get-state', {}); },
      // Les événements.
      on: on,
      off: off,
      // La destruction.
      destroy: destroy,
    // Fin du contrôle.
    };
  // Fin de create.
  }

  // Le composant <gobai-globe planet="terre"> : l'intégration la plus courte, en pur HTML.
  if (global.customElements && !customElements.get('gobai-globe')) {
    var GobaiGlobe = function () {
      return Reflect.construct(HTMLElement, [], GobaiGlobe);
    };
    GobaiGlobe.prototype = Object.create(HTMLElement.prototype, { constructor: { value: GobaiGlobe } });
    // À la connexion : un contrôle par élément, le conteneur est l'élément lui-même.
    GobaiGlobe.prototype.connectedCallback = function () {
      if (this._ctl) return;
      this.style.display = 'block';
      this.style.width = this.getAttribute('width') || '100%';
      this.style.height = this.getAttribute('height') || '100%';
      this._ctl = create(this, { planet: this.getAttribute('planet') || 'terre' });
    };
    // À la déconnexion : le moteur est arrêté, l'iframe retirée.
    GobaiGlobe.prototype.disconnectedCallback = function () {
      if (this._ctl) { this._ctl.destroy(); this._ctl = null; }
    };
    // L'attribut planet changé : le globe affiché suit.
    GobaiGlobe.prototype.attributeChangedCallback = function (name, oldV, newV) {
      if (name === 'planet' && this._ctl && newV && newV !== oldV) this._ctl.setPlanet(newV);
    };
    GobaiGlobe.observedAttributes = ['planet'];
    customElements.define('gobai-globe', GobaiGlobe);
  }

  // L'API publique : une seule fonction d'entrée.
  global.GobaiEmbed = { create: create, version: '1.0.0' };
// Fin du module.
})(typeof window !== 'undefined' ? window : this);
