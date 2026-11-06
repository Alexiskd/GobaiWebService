import { useEffect, useState } from 'react';

const loading = new Map(); // URL du SDK → promesse de window.paypal (un seul chargement par configuration)

/** URL du SDK JavaScript PayPal (boutons de paiement, paiement immédiat, en euros, interface en français). */
export function paypalSdkUrl(clientId, currency) {
  const qs = new URLSearchParams({ 'client-id': clientId, currency, intent: 'capture', components: 'buttons', locale: 'fr_FR' });
  return `https://www.paypal.com/sdk/js?${qs}`;
}

function loadSdk(url) {
  if (!loading.has(url)) {
    const p = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.dataset.sdkIntegrationSource = 'gobai-space';
      script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('SDK PayPal incomplet')));
      script.onerror = () => reject(new Error('Impossible de charger PayPal (bloqueur de publicités ?)'));
      document.head.appendChild(script);
    });
    p.catch(() => loading.delete(url)); // nouvel essai possible plus tard
    loading.set(url, p);
  }
  return loading.get(url);
}

/** Charge le SDK PayPal à la demande : { paypal, error }. Rien n'est chargé tant que `clientId` est absent. */
export function usePaypalSdk(clientId, currency = 'EUR') {
  const [state, setState] = useState({ paypal: null, error: null });
  useEffect(() => {
    if (!clientId) return undefined;
    let alive = true;
    setState({ paypal: null, error: null });
    loadSdk(paypalSdkUrl(clientId, currency)).then(
      (paypal) => alive && setState({ paypal, error: null }),
      (e) => alive && setState({ paypal: null, error: e.message }),
    );
    return () => { alive = false; };
  }, [clientId, currency]);
  return state;
}
