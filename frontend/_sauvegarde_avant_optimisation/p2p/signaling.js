/**
 * Client du relais de signalisation WebSocket. Il ne transporte que des messages de contrôle (rejoindre, quitter,
 * SDP, ICE) : les fichiers et les tuiles passent ensuite directement par le canal WebRTC.
 */
export class Signaling {
  constructor({ url, onMessage, onOpen, onClose }) {
    this.url = url;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.ws = null;
    this.queue = [];
    this.closedByUs = false;
  }

  get ready() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  open() {
    if (this.ws) return;
    this.closedByUs = false;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      for (const msg of this.queue.splice(0)) ws.send(msg);
      this.onOpen?.();
    };
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        this.onMessage?.(JSON.parse(event.data));
      } catch { /* message illisible : ignoré, le serveur reste la source de vérité */ }
    };
    ws.onclose = (event) => {
      this.ws = null;
      this.onClose?.({ code: event.code, reason: event.reason, intentional: this.closedByUs });
    };
    ws.onerror = () => { /* la fermeture qui suit décrit l'erreur */ };
  }

  send(message) {
    const text = JSON.stringify(message);
    if (this.ready) this.ws.send(text);
    else if (this.queue.length < 50) this.queue.push(text);
  }

  close() {
    this.closedByUs = true;
    this.queue.length = 0;
    this.ws?.close(1000, 'départ');
    this.ws = null;
  }
}
